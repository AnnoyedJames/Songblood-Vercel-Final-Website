import { neon, type NeonQueryFunction } from "@neondatabase/serverless"
import { queryCache } from "./cache"
import { AppError, ErrorType, logError } from "./error-handling"
import { configureNeon, DB_CONFIG, getDatabaseUrl, isPreviewEnvironment } from "./db-config"
import { isPreviewMode } from "./environment-detection"
import { withRetry, DEFAULT_RETRY_CONFIG } from "./retry-utils"
import { checkDbHealth, startHealthChecks, getDbHealthStatus } from "./db-health"

// Configure Neon with optimal settings
configureNeon()

// Track connection errors for reporting
let CONNECTION_ERROR_MESSAGE = ""

// Function to get connection error message
export function getConnectionErrorMessage() {
  return CONNECTION_ERROR_MESSAGE
}

// Function to set connection error message
export function setConnectionErrorMessage(message: string) {
  CONNECTION_ERROR_MESSAGE = message
}

// Create SQL client with the database URL (will be null in preview mode)
const dbUrl = getDatabaseUrl()
export const dbClient = dbUrl ? neon(dbUrl) : null

// Start periodic health checks
const stopHealthChecks = startHealthChecks()

// Enhanced query function with retries, timeouts, and error handling
export async function executeQuery<T>(
  queryFn: (sql: NeonQueryFunction<any>) => Promise<T>,
  options: {
    cacheKey?: string
    cacheTtl?: number
    retryConfig?: typeof DEFAULT_RETRY_CONFIG
    critical?: boolean
  } = {},
): Promise<T> {
  const { cacheKey, cacheTtl = DB_CONFIG.CACHE_TTL_MS, retryConfig = DEFAULT_RETRY_CONFIG, critical = false } = options

  // Check if in preview mode
  if (isPreviewMode()) {
    throw new AppError(ErrorType.SERVER, "Database queries cannot be executed in preview mode", "Use mock data instead")
  }

  // Check for cached result
  if (cacheKey) {
    const cached = queryCache.get<T>(cacheKey)
    if (cached) {
      return cached
    }
  }

  // Check if database client is initialized
  if (!dbClient) {
    throw new AppError(
      ErrorType.DATABASE_CONNECTION,
      "Database client not initialized",
      "Database URL environment variable may be missing or invalid",
    )
  }

  // Check database health for critical queries
  if (critical) {
    const health = getDbHealthStatus()
    if (!health.isConnected && health.lastChecked.getTime() > Date.now() - 60000) {
      throw new AppError(
        ErrorType.DATABASE_CONNECTION,
        "Database is currently unavailable",
        health.error || "Recent health check failed",
      )
    }
  }

  try {
    // Execute query with retry logic
    const result = await withRetry(async () => {
      try {
        return await queryFn(dbClient!)
      } catch (error) {
        // Enhance error with more context
        if (error instanceof Error) {
          if (error.message.includes("timeout")) {
            throw new AppError(ErrorType.TIMEOUT, "Database query timed out", error.message, true)
          }
          if (error.message.includes("connection")) {
            throw new AppError(ErrorType.DATABASE_CONNECTION, "Database connection error", error.message, true)
          }
        }
        throw error
      }
    }, retryConfig)

    // Cache successful result if cacheKey provided
    if (cacheKey && result) {
      queryCache.set(cacheKey, result, cacheTtl)
    }

    return result
  } catch (error) {
    // Log and rethrow with enhanced context
    throw logError(error, "Database Query")
  }
}

// Mock data for preview mode and fallbacks
export const MOCK_DATA = {
  redblood: [
    { blood_type: "A", rh: "+", count: 10, total_amount: 5000 },
    { blood_type: "B", rh: "+", count: 8, total_amount: 4000 },
    { blood_type: "O", rh: "+", count: 15, total_amount: 7500 },
    { blood_type: "AB", rh: "+", count: 5, total_amount: 2500 },
    { blood_type: "A", rh: "-", count: 3, total_amount: 1500 },
    { blood_type: "B", rh: "-", count: 2, total_amount: 1000 },
    { blood_type: "O", rh: "-", count: 6, total_amount: 3000 },
    { blood_type: "AB", rh: "-", count: 1, total_amount: 500 },
  ],
  plasma: [
    { blood_type: "A", count: 12, total_amount: 6000 },
    { blood_type: "B", count: 9, total_amount: 4500 },
    { blood_type: "O", count: 18, total_amount: 9000 },
    { blood_type: "AB", count: 6, total_amount: 3000 },
  ],
  platelets: [
    { blood_type: "A", rh: "+", count: 7, total_amount: 3500 },
    { blood_type: "B", rh: "+", count: 5, total_amount: 2500 },
    { blood_type: "O", rh: "+", count: 10, total_amount: 5000 },
    { blood_type: "AB", rh: "+", count: 3, total_amount: 1500 },
    { blood_type: "A", rh: "-", count: 2, total_amount: 1000 },
    { blood_type: "B", rh: "-", count: 1, total_amount: 500 },
    { blood_type: "O", rh: "-", count: 4, total_amount: 2000 },
    { blood_type: "AB", rh: "-", count: 1, total_amount: 500 },
  ],
  hospitals: [
    { hospital_id: 1, hospital_name: "Central Hospital" },
    { hospital_id: 2, hospital_name: "Memorial Medical Center" },
    { hospital_id: 3, hospital_name: "University Hospital" },
  ],
  admins: [{ admin_id: 1, hospital_id: 1, admin_username: "admin", admin_password: "password" }],
  surplus_alerts: [
    {
      type: "RedBlood",
      bloodType: "O",
      rh: "+",
      hospitalName: "Memorial Medical Center",
      hospitalId: 2,
      count: 25,
      yourCount: 4,
      contactPhone: "555-1234",
      contactEmail: "contact@memorial.example.com",
    },
    {
      type: "Plasma",
      bloodType: "AB",
      rh: "",
      hospitalName: "University Hospital",
      hospitalId: 3,
      count: 15,
      yourCount: 3,
      contactPhone: "555-5678",
      contactEmail: "contact@university.example.com",
    },
  ],
  search_results: [
    {
      type: "RedBlood",
      bag_id: 12345,
      donor_name: "John Doe",
      blood_type: "A",
      rh: "+",
      amount: 450,
      expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      hospital_name: "Central Hospital",
      hospital_contact_phone: "555-1234",
    },
    {
      type: "Plasma",
      bag_id: 12346,
      donor_name: "Jane Smith",
      blood_type: "O",
      rh: "",
      amount: 400,
      expiration_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      hospital_name: "Central Hospital",
      hospital_contact_phone: "555-1234",
    },
  ],
}

// Function to test database connection with enhanced diagnostics
export async function testDatabaseConnection(): Promise<{
  connected: boolean
  error?: string
  diagnostics?: {
    responseTimeMs?: number
    databaseUrl?: string
    serverVersion?: string
  }
}> {
  // In preview mode, return a mock successful connection
  if (isPreviewEnvironment()) {
    console.log("Preview mode: Skipping actual database connection test")
    return {
      connected: true,
      diagnostics: {
        responseTimeMs: 0,
        databaseUrl: "preview-mode-mock-url",
        serverVersion: "PostgreSQL 14.0 (preview mode)",
      },
    }
  }

  try {
    // Check if database URL is defined
    const dbUrl = getDatabaseUrl()
    if (!dbUrl) {
      const errorMsg = "Database connection string is missing"
      setConnectionErrorMessage(errorMsg)
      console.error(errorMsg)
      return {
        connected: false,
        error: errorMsg,
      }
    }

    // Create a direct neon client for testing only
    const testClient = neon(dbUrl)
    const startTime = performance.now()

    // Use a timeout promise to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Database connection timed out"))
      }, DB_CONFIG.CONNECTION_TIMEOUT_MS)
    })

    try {
      // Race the database query against the timeout
      const result = await Promise.race([
        testClient`
          SELECT 1 as connection_test, 
          current_setting('server_version') as version
        `,
        timeoutPromise,
      ])

      const endTime = performance.now()
      const responseTimeMs = Math.round(endTime - startTime)

      // Get server version from result
      const serverVersion = result[0]?.version || "Unknown"

      setConnectionErrorMessage("") // Clear any previous error message

      return {
        connected: true,
        diagnostics: {
          responseTimeMs,
          databaseUrl: dbUrl.replace(/:[^:]*@/, ":****@"), // Mask password
          serverVersion,
        },
      }
    } catch (fetchError) {
      // Handle fetch errors specifically
      const errorMessage =
        fetchError instanceof Error
          ? `Error connecting to database: ${fetchError.message}`
          : "Failed to connect to database"

      console.error("Database connection test failed:", errorMessage)
      setConnectionErrorMessage(errorMessage)

      // Log additional information for debugging
      if (fetchError instanceof Error) {
        console.error("Error stack:", fetchError.stack)
      }

      return {
        connected: false,
        error: errorMessage,
      }
    }
  } catch (error) {
    // Handle any other errors
    const errorMessage = error instanceof Error ? error.message : "Unknown database connection error"
    console.error("Database connection test error:", errorMessage)
    setConnectionErrorMessage(errorMessage)

    return {
      connected: false,
      error: errorMessage,
    }
  }
}

// Initialize database connection on module load
if (process.env.NODE_ENV !== "production" && !isPreviewEnvironment()) {
  testDatabaseConnection()
    .then(({ connected, error, diagnostics }) => {
      if (!connected) {
        console.warn(`Database connection failed: ${error}. Application will show error messages to users.`)
        setConnectionErrorMessage(error || "Failed to connect to database")
      } else {
        console.log("Database connection successful", diagnostics)
        setConnectionErrorMessage("")
      }
    })
    .catch((error) => {
      console.error("Unexpected error during database initialization:", error)
      setConnectionErrorMessage(error instanceof Error ? error.message : String(error))
    })
}

// Helper function to get hospital data by ID with enhanced error handling
export async function getHospitalById(hospitalId: number) {
  // In preview mode, return mock data
  if (isPreviewMode()) {
    const hospital = MOCK_DATA.hospitals.find((h) => h.hospital_id === hospitalId) || MOCK_DATA.hospitals[0]
    return hospital
  }

  try {
    const cacheKey = `hospital:${hospitalId}`

    return await executeQuery(
      async (sql) => {
        const result = await sql`
          SELECT * FROM hospital WHERE hospital_id = ${hospitalId}
        `

        if (!result || result.length === 0) {
          throw new AppError(ErrorType.NOT_FOUND, "Hospital not found")
        }

        return result[0]
      },
      { cacheKey, critical: true },
    )
  } catch (error) {
    // In production, fall back to mock data
    if (process.env.NODE_ENV === "production") {
      console.warn("Error getting hospital data, using mock data:", error)
      return MOCK_DATA.hospitals[0]
    }
    throw logError(error, "Get Hospital")
  }
}

// Helper function to verify admin credentials
export async function verifyAdminCredentials(username: string, password: string) {
  // In preview mode, accept any credentials for testing
  if (isPreviewMode()) {
    // For demo purposes, accept "admin/password" or any credentials in preview mode
    if (username === "admin" && password === "password") {
      return MOCK_DATA.admins[0]
    }
    // In preview mode, accept any credentials
    return { admin_id: 1, hospital_id: 1 }
  }

  try {
    if (!dbClient) {
      console.warn("Database client not initialized, authentication will fail")
      return null
    }

    const result = await dbClient`
      SELECT admin_id, hospital_id FROM admin 
      WHERE admin_username = ${username} AND admin_password = ${password}
    `

    return result[0] || null
  } catch (error) {
    // Log the error but don't expose it to the caller
    logError(error, "Verify Admin Credentials")
    return null
  }
}

// Helper function to get blood inventory for a hospital with enhanced error handling
export async function getBloodInventory(hospitalId: number) {
  // In preview mode, return mock data
  if (isPreviewMode()) {
    return MOCK_DATA.redblood
  }

  try {
    const cacheKey = `redblood:${hospitalId}`

    return await executeQuery(
      async (sql) => {
        const redBlood = await sql`
          SELECT blood_type, rh, COUNT(*) as count, SUM(amount) as total_amount
          FROM redblood_inventory
          WHERE hospital_id = ${hospitalId} AND expiration_date > CURRENT_DATE AND active = true
          GROUP BY blood_type, rh
          ORDER BY blood_type, rh
        `

        console.log("Retrieved red blood cell data from DB:", redBlood)

        // Ensure numeric values are properly parsed
        return redBlood.map((item) => ({
          ...item,
          count: Number(item.count),
          total_amount: Number(item.total_amount),
        }))
      },
      { cacheKey },
    )
  } catch (error) {
    if (process.env.NODE_ENV === "production" || isPreviewMode()) {
      console.warn("Error getting blood inventory, using mock data:", error)
      return MOCK_DATA.redblood
    }
    throw logError(error, "Get Blood Inventory")
  }
}

// Helper function to get plasma inventory for a hospital
export async function getPlasmaInventory(hospitalId: number) {
  // Add this at the beginning of the getPlasmaInventory function
  console.log(`getPlasmaInventory called for hospital ${hospitalId}`)
  // In preview mode, return mock data
  if (isPreviewMode()) {
    return MOCK_DATA.plasma
  }

  try {
    const cacheKey = `plasma:${hospitalId}`
    const cached = queryCache.get<any[]>(cacheKey)

    if (cached) {
      return cached
    }

    if (!dbClient) {
      throw new AppError(
        ErrorType.DATABASE_CONNECTION,
        "Database client not initialized",
        "Database URL environment variable may be missing or invalid",
      )
    }

    // Replace the existing SQL query with this more detailed one
    const plasma = await dbClient`
      SELECT 
        blood_type, 
        COUNT(*)::integer as count, 
        SUM(amount)::integer as total_amount,
        COUNT(DISTINCT blood_type) as distinct_types
      FROM plasma_inventory
      WHERE 
        hospital_id = ${hospitalId} 
        AND expiration_date > CURRENT_DATE 
        AND active = true
      GROUP BY blood_type
      ORDER BY blood_type
    `

    // Add this after the SQL query
    console.log(`Raw plasma data from database:`, JSON.stringify(plasma, null, 2))

    // Add this after the query
    console.log(`Distinct blood types in plasma: ${plasma[0]?.distinct_types || 0}`)

    // Add a diagnostic query to check all plasma entries without grouping:
    const allPlasmaEntries = await dbClient`
      SELECT 
        blood_type, 
        amount,
        expiration_date,
        active
      FROM plasma_inventory
      WHERE hospital_id = ${hospitalId}
      ORDER BY blood_type, expiration_date
    `
    console.log(`All plasma entries (ungrouped): ${allPlasmaEntries.length}`)
    console.log(`Sample entries:`, JSON.stringify(allPlasmaEntries.slice(0, 3), null, 2))

    queryCache.set(cacheKey, plasma)
    return plasma
  } catch (error) {
    if (process.env.NODE_ENV === "production" || isPreviewMode()) {
      console.warn("Error getting plasma inventory, using mock data:", error)
      return MOCK_DATA.plasma
    }
    throw logError(error, "Get Plasma Inventory")
  }
}

// Helper function to get platelets inventory for a hospital with fixed query
export async function getPlateletsInventory(hospitalId: number) {
  // In preview mode, return mock data
  if (isPreviewMode()) {
    return MOCK_DATA.platelets
  }

  try {
    const cacheKey = `platelets:${hospitalId}`
    const cached = queryCache.get<any[]>(cacheKey)

    if (cached) {
      return cached
    }

    if (!dbClient) {
      throw new AppError(
        ErrorType.DATABASE_CONNECTION,
        "Database client not initialized",
        "Database URL environment variable may be missing or invalid",
      )
    }

    // Fixed query - removed potential issues with the GROUP BY clause
    // and ensured proper type conversion for numeric values
    const platelets = await dbClient`
      SELECT 
        blood_type, 
        rh, 
        COUNT(*)::integer as count, 
        SUM(amount)::integer as total_amount
      FROM platelets_inventory
      WHERE 
        hospital_id = ${hospitalId} 
        AND expiration_date > CURRENT_DATE 
        AND active = true
      GROUP BY blood_type, rh
      ORDER BY blood_type, rh
    `

    // Log the retrieved data for debugging
    console.log(`Retrieved platelets data for hospital ${hospitalId}:`, JSON.stringify(platelets, null, 2))

    // Ensure numeric values are properly parsed
    const processedData = platelets.map((item) => ({
      ...item,
      count: Number(item.count),
      total_amount: Number(item.total_amount),
    }))

    queryCache.set(cacheKey, processedData)
    return processedData
  } catch (error) {
    if (process.env.NODE_ENV === "production" || isPreviewMode()) {
      console.warn("Error getting platelets inventory, using mock data:", error)
      return MOCK_DATA.platelets
    }
    throw logError(error, "Get Platelets Inventory")
  }
}

// Helper function to get surplus alerts
export async function getSurplusAlerts(hospitalId: number) {
  // In preview mode, return mock data
  if (isPreviewMode()) {
    return MOCK_DATA.surplus_alerts
  }

  try {
    // Get current hospital's inventory
    const currentHospitalInventory = await dbClient`
      SELECT 'RedBlood' as type, blood_type, rh, COUNT(*) as count
      FROM redblood_inventory
      WHERE hospital_id = ${hospitalId} AND expiration_date > CURRENT_DATE AND active = true
      GROUP BY blood_type, rh
      UNION ALL
      SELECT 'Plasma' as type, blood_type, '' as rh, COUNT(*) as count
      FROM plasma_inventory
      WHERE hospital_id = ${hospitalId} AND expiration_date > CURRENT_DATE AND active = true
      GROUP BY blood_type
      UNION ALL
      SELECT 'Platelets' as type, blood_type, rh, COUNT(*) as count
      FROM platelets_inventory
      WHERE hospital_id = ${hospitalId} AND expiration_date > CURRENT_DATE AND active = true
      GROUP BY blood_type, rh
    `

    // Get other hospitals with surplus
    const alerts = []

    for (const item of currentHospitalInventory) {
      const { type, blood_type, rh, count } = item

      // If current hospital has low stock (less than 5 units)
      if (Number(count) < 5) {
        let surplusHospitals

        if (type === "RedBlood") {
          surplusHospitals = await dbClient`
            SELECT h.hospital_id, h.hospital_name, COUNT(*) as count, 
                   h.hospital_contact_phone, h.hospital_contact_mail
            FROM redblood_inventory rb
            JOIN hospital h ON rb.hospital_id = h.hospital_id
            WHERE rb.hospital_id != ${hospitalId}
              AND rb.blood_type = ${blood_type}
              AND rb.rh = ${rh}
              AND rb.expiration_date > CURRENT_DATE
              AND rb.active = true
            GROUP BY h.hospital_id, h.hospital_name, h.hospital_contact_phone, h.hospital_contact_mail
            HAVING COUNT(*) > 10
            ORDER BY count DESC
          `
        } else if (type === "Plasma") {
          surplusHospitals = await dbClient`
            SELECT h.hospital_id, h.hospital_name, COUNT(*) as count,
                   h.hospital_contact_phone, h.hospital_contact_mail
            FROM plasma_inventory p
            JOIN hospital h ON p.hospital_id = h.hospital_id
            WHERE p.hospital_id != ${hospitalId}
              AND p.blood_type = ${blood_type}
              AND p.expiration_date > CURRENT_DATE
              AND p.active = true
            GROUP BY h.hospital_id, h.hospital_name, h.hospital_contact_phone, h.hospital_contact_mail
            HAVING COUNT(*) > 10
            ORDER BY count DESC
          `
        } else if (type === "Platelets") {
          surplusHospitals = await dbClient`
            SELECT h.hospital_id, h.hospital_name, COUNT(*) as count,
                   h.hospital_contact_phone, h.hospital_contact_mail
            FROM platelets_inventory p
            JOIN hospital h ON p.hospital_id = h.hospital_id
            WHERE p.hospital_id != ${hospitalId}
              AND p.blood_type = ${blood_type}
              AND p.rh = ${rh}
              AND p.expiration_date > CURRENT_DATE
              AND p.active = true
            GROUP BY h.hospital_id, h.hospital_name, h.hospital_contact_phone, h.hospital_contact_mail
            HAVING COUNT(*) > 10
            ORDER BY count DESC
          `
        }

        if (surplusHospitals && surplusHospitals.length > 0) {
          for (const hospital of surplusHospitals) {
            alerts.push({
              type,
              bloodType: blood_type,
              rh: rh || "",
              hospitalName: hospital.hospital_name,
              hospitalId: hospital.hospital_id,
              count: hospital.count,
              yourCount: count,
              contactPhone: hospital.hospital_contact_phone,
              contactEmail: hospital.hospital_contact_mail,
            })
          }
        }
      }
    }

    return alerts
  } catch (error) {
    if (process.env.NODE_ENV === "production" || isPreviewMode()) {
      console.warn("Error getting surplus alerts, using mock data:", error)
      return MOCK_DATA.surplus_alerts
    }
    throw logError(error, "Get Surplus Alerts")
  }
}

// Helper function to search for donors
export async function searchDonors(query: string) {
  // In preview mode, return mock data
  if (isPreviewMode()) {
    // Filter mock data based on the query for a more realistic experience
    if (!query || query.trim() === "") return []

    return MOCK_DATA.search_results.filter(
      (item) => item.donor_name.toLowerCase().includes(query.toLowerCase()) || item.bag_id.toString().includes(query),
    )
  }

  if (!query || query.trim() === "") return []

  try {
    const searchTerm = `%${query}%`

    // Search by bag ID if the query is a number
    if (!isNaN(Number(query))) {
      const bagId = Number(query)

      const redBloodResults = await dbClient`
        SELECT 'RedBlood' as type, rb.bag_id, rb.donor_name, rb.blood_type, rb.rh, 
               rb.amount, rb.expiration_date, h.hospital_name, h.hospital_contact_phone
        FROM redblood_inventory rb
        JOIN hospital h ON rb.hospital_id = h.hospital_id
        WHERE rb.bag_id = ${bagId} AND rb.active = true
      `

      const plasmaResults = await dbClient`
        SELECT 'Plasma' as type, p.bag_id, p.donor_name, p.blood_type, '' as rh, 
               p.amount, p.expiration_date, h.hospital_name, h.hospital_contact_phone
        FROM plasma_inventory p
        JOIN hospital h ON p.hospital_id = h.hospital_id
        WHERE p.bag_id = ${bagId} AND p.active = true
      `

      const plateletsResults = await dbClient`
        SELECT 'Platelets' as type, p.bag_id, p.donor_name, p.blood_type, p.rh, 
               p.amount, p.expiration_date, h.hospital_name, h.hospital_contact_phone
        FROM platelets_inventory p
        JOIN hospital h ON p.hospital_id = h.hospital_id
        WHERE p.bag_id = ${bagId} AND p.active = true
      `

      return [...redBloodResults, ...plasmaResults, ...plateletsResults]
    }

    // Search by donor name
    const redBloodResults = await dbClient`
      SELECT 'RedBlood' as type, rb.bag_id, rb.donor_name, rb.blood_type, rb.rh, 
             rb.amount, rb.expiration_date, h.hospital_name, h.hospital_contact_phone
      FROM redblood_inventory rb
      JOIN hospital h ON rb.hospital_id = h.hospital_id
      WHERE rb.donor_name ILIKE ${searchTerm} AND rb.active = true
    `

    const plasmaResults = await dbClient`
      SELECT 'Plasma' as type, p.bag_id, p.donor_name, p.blood_type, '' as rh, 
             p.amount, p.expiration_date, h.hospital_name, h.hospital_contact_phone
      FROM plasma_inventory p
      JOIN hospital h ON p.hospital_id = h.hospital_id
      WHERE p.donor_name ILIKE ${searchTerm} AND p.active = true
    `

    const plateletsResults = await dbClient`
      SELECT 'Platelets' as type, p.bag_id, p.donor_name, p.blood_type, p.rh, 
             p.amount, p.expiration_date, h.hospital_name, h.hospital_contact_phone
      FROM platelets_inventory p
      JOIN hospital h ON p.hospital_id = h.hospital_id
      WHERE p.donor_name ILIKE ${searchTerm} AND p.active = true
    `

    return [...redBloodResults, ...plasmaResults, ...plateletsResults]
  } catch (error) {
    if (process.env.NODE_ENV === "production" || isPreviewMode()) {
      console.warn("Error searching donors, using mock data:", error)
      return MOCK_DATA.search_results
    }
    throw logError(error, "Search Donors")
  }
}

// Add this function to the existing db.ts file
export async function registerAdmin(username: string, password: string, hospitalId: number) {
  try {
    // First check if the hospital exists
    const hospitalCheck = await dbClient`
      SELECT hospital_id FROM hospital WHERE hospital_id = ${hospitalId}
    `

    if (hospitalCheck.length === 0) {
      throw new AppError(ErrorType.VALIDATION, "Hospital not found")
    }

    // Check if username already exists
    const usernameCheck = await dbClient`
      SELECT admin_id FROM admin WHERE admin_username = ${username}
    `

    if (usernameCheck.length > 0) {
      throw new AppError(ErrorType.VALIDATION, "Username already exists")
    }

    // Insert new admin
    const result = await dbClient`
      INSERT INTO admin (admin_username, admin_password, hospital_id)
      VALUES (${username}, ${password}, ${hospitalId})
      RETURNING admin_id
    `

    if (result.length > 0) {
      return { success: true }
    } else {
      throw new AppError(ErrorType.SERVER, "Failed to create admin account")
    }
  } catch (error) {
    throw logError(error, "Register Admin")
  }
}

// Function to get all hospitals for dropdown lists
export async function getAllHospitals() {
  try {
    const cacheKey = "all-hospitals"
    const cached = queryCache.get(cacheKey)

    if (cached) {
      return cached
    }

    const hospitals = await dbClient`
      SELECT hospital_id, hospital_name 
      FROM hospital 
      ORDER BY hospital_name
    `

    queryCache.set(cacheKey, hospitals)
    return hospitals
  } catch (error) {
    throw logError(error, "Get All Hospitals")
  }
}

// New function to soft-delete a blood inventory entry
export async function softDeleteBloodEntry(bagId: number, entryType: string, hospitalId: number) {
  try {
    // Verify that the entry belongs to the hospital
    const ownershipCheck = await verifyEntryOwnership(bagId, entryType, hospitalId)
    if (!ownershipCheck.success) {
      return ownershipCheck
    }

    // Soft-delete the entry based on its type by setting active = false
    let result
    if (entryType === "RedBlood") {
      result = await dbClient`
        UPDATE redblood_inventory
        SET active = false
        WHERE bag_id = ${bagId} AND hospital_id = ${hospitalId}
        RETURNING bag_id
      `
      // Invalidate cache
      queryCache.invalidate(`redblood:${hospitalId}`)
    } else if (entryType === "Plasma") {
      result = await dbClient`
        UPDATE plasma_inventory
        SET active = false
        WHERE bag_id = ${bagId} AND hospital_id = ${hospitalId}
        RETURNING bag_id
      `
      // Invalidate cache
      queryCache.invalidate(`plasma:${hospitalId}`)
    } else if (entryType === "Platelets") {
      result = await dbClient`
        UPDATE platelets_inventory
        SET active = false
        WHERE bag_id = ${bagId} AND hospital_id = ${hospitalId}
        RETURNING bag_id
      `
      // Invalidate cache
      queryCache.invalidate(`platelets:${hospitalId}`)
    } else {
      return {
        success: false,
        error: "Invalid entry type",
      }
    }

    if (result && result.length > 0) {
      return { success: true }
    } else {
      return {
        success: false,
        error: "Failed to delete entry",
      }
    }
  } catch (error) {
    console.error("Error soft-deleting blood entry:", error)
    const appError = logError(error, "Soft Delete Blood Entry")
    return {
      success: false,
      error: appError.message,
      details: appError.details,
    }
  }
}

// Helper function to verify entry ownership
async function verifyEntryOwnership(bagId: number, entryType: string, hospitalId: number) {
  try {
    let result
    if (entryType === "RedBlood") {
      result = await dbClient`
        SELECT hospital_id FROM redblood_inventory WHERE bag_id = ${bagId} AND active = true
      `
    } else if (entryType === "Plasma") {
      result = await dbClient`
        SELECT hospital_id FROM plasma_inventory WHERE bag_id = ${bagId} AND active = true
      `
    } else if (entryType === "Platelets") {
      result = await dbClient`
        SELECT hospital_id FROM platelets_inventory WHERE bag_id = ${bagId} AND active = true
      `
    } else {
      return {
        success: false,
        error: "Invalid entry type",
      }
    }

    if (!result || result.length === 0) {
      return {
        success: false,
        error: "Entry not found",
      }
    }

    if (result[0].hospital_id !== hospitalId) {
      return {
        success: false,
        error: "You don't have permission to modify this entry",
      }
    }

    return { success: true }
  } catch (error) {
    console.error("Error verifying entry ownership:", error)
    const appError = logError(error, "Verify Entry Ownership")
    return {
      success: false,
      error: appError.message,
      details: appError.details,
    }
  }
}

// Add new red blood cell bag
export async function addNewRedBloodBag(
  donorName: string,
  amount: number,
  hospitalId: number,
  expirationDate: string,
  bloodType: string,
  rh: string,
  adminUsername?: string,
  adminPassword?: string,
) {
  try {
    if (!dbClient) {
      throw new AppError(
        ErrorType.DATABASE_CONNECTION,
        "Database client not initialized",
        "Database URL environment variable may be missing or invalid",
      )
    }

    // Validate admin credentials if provided
    if (adminUsername && adminPassword) {
      const admin = await verifyAdminCredentials(adminUsername, adminPassword)
      if (!admin) {
        return {
          success: false,
          error: "Invalid admin credentials",
          type: ErrorType.AUTHENTICATION,
          retryable: false,
        }
      }
    }

    // Insert new red blood cell bag
    const result = await dbClient`
      INSERT INTO redblood_inventory (donor_name, amount, hospital_id, expiration_date, blood_type, rh)
      VALUES (${donorName}, ${amount}, ${hospitalId}, ${expirationDate}, ${bloodType}, ${rh})
      RETURNING bag_id
    `

    if (result.length > 0) {
      return { success: true }
    } else {
      return {
        success: false,
        error: "Failed to add red blood cell bag",
        type: ErrorType.SERVER,
        retryable: true,
      }
    }
  } catch (error) {
    console.error("Add red blood cell error:", error)
    const appError = logError(error, "Add Red Blood Cell")
    return {
      success: false,
      error: appError.message,
      type: appError.type,
      details: appError.details,
      retryable: true,
    }
  }
}

// Add new plasma bag
export async function addNewPlasmaBag(
  donorName: string,
  amount: number,
  hospitalId: number,
  expirationDate: string,
  bloodType: string,
  adminUsername?: string,
  adminPassword?: string,
) {
  try {
    if (!dbClient) {
      throw new AppError(
        ErrorType.DATABASE_CONNECTION,
        "Database client not initialized",
        "Database URL environment variable may be missing or invalid",
      )
    }

    // Validate admin credentials if provided
    if (adminUsername && adminPassword) {
      const admin = await verifyAdminCredentials(adminUsername, adminPassword)
      if (!admin) {
        return {
          success: false,
          error: "Invalid admin credentials",
          type: ErrorType.AUTHENTICATION,
          retryable: false,
        }
      }
    }

    // Insert new plasma bag
    const result = await dbClient`
      INSERT INTO plasma_inventory (donor_name, amount, hospital_id, expiration_date, blood_type)
      VALUES (${donorName}, ${amount}, ${hospitalId}, ${expirationDate}, ${bloodType})
      RETURNING bag_id
    `

    if (result.length > 0) {
      return { success: true }
    } else {
      return {
        success: false,
        error: "Failed to add plasma bag",
        type: ErrorType.SERVER,
        retryable: true,
      }
    }
  } catch (error) {
    console.error("Add plasma error:", error)
    const appError = logError(error, "Add Plasma")
    return {
      success: false,
      error: appError.message,
      type: appError.type,
      details: appError.details,
      retryable: true,
    }
  }
}

// Add new platelets bag
export async function addNewPlateletsBag(
  donorName: string,
  amount: number,
  hospitalId: number,
  expirationDate: string,
  bloodType: string,
  rh: string,
  adminUsername?: string,
  adminPassword?: string,
) {
  try {
    if (!dbClient) {
      throw new AppError(
        ErrorType.DATABASE_CONNECTION,
        "Database client not initialized",
        "Database URL environment variable may be missing or invalid",
      )
    }

    // Validate admin credentials if provided
    if (adminUsername && adminPassword) {
      const admin = await verifyAdminCredentials(adminUsername, adminPassword)
      if (!admin) {
        return {
          success: false,
          error: "Invalid admin credentials",
          type: ErrorType.AUTHENTICATION,
          retryable: false,
        }
      }
    }

    // Insert new platelets bag
    const result = await dbClient`
      INSERT INTO platelets_inventory (donor_name, amount, hospital_id, expiration_date, blood_type, rh)
      VALUES (${donorName}, ${amount}, ${hospitalId}, ${expirationDate}, ${bloodType}, ${rh})
      RETURNING bag_id
    `

    if (result.length > 0) {
      return { success: true }
    } else {
      return {
        success: false,
        error: "Failed to add platelets bag",
        type: ErrorType.SERVER,
        retryable: true,
      }
    }
  } catch (error) {
    console.error("Add platelets error:", error)
    const appError = logError(error, "Add Platelets")
    return {
      success: false,
      error: appError.message,
      type: appError.type,
      details: appError.details,
      retryable: true,
    }
  }
}

// Export for testing
export { testDatabaseConnection as testDatabaseConnectionWithoutCache, checkDbHealth, getDbHealthStatus }
