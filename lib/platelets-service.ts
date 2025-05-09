import { neon } from "@neondatabase/serverless"
import { queryCache } from "./cache"
import { AppError, ErrorType, logError } from "./error-handling"
import { isPreviewMode } from "./environment-detection"
import { MOCK_DATA } from "./db"

/**
 * Enhanced service for retrieving platelets inventory data
 * with improved error handling, logging, and data validation
 */
export async function getPlateletsInventory(hospitalId: number) {
  // In preview mode, return mock data
  if (isPreviewMode()) {
    console.log("Preview mode: Returning mock platelets data")
    return MOCK_DATA.platelets
  }

  try {
    console.log(`Retrieving platelets inventory for hospital ID: ${hospitalId}`)

    // Check cache first
    const cacheKey = `platelets:${hospitalId}`
    const cached = queryCache.get<any[]>(cacheKey)

    if (cached) {
      console.log("Using cached platelets data:", cached)
      return cached
    }

    // Validate database URL
    if (!process.env.DATABASE_URL) {
      throw new AppError(
        ErrorType.DATABASE_CONNECTION,
        "Database URL is not defined",
        "Check your environment variables",
      )
    }

    // Create database client
    const dbClient = neon(process.env.DATABASE_URL)

    // Log the query we're about to execute
    const query = `
      SELECT 
        blood_type, 
        rh, 
        COUNT(*)::integer as count, 
        SUM(amount)::integer as total_amount
      FROM platelets_inventory
      WHERE 
        hospital_id = $1 
        AND expiration_date > CURRENT_DATE 
        AND active = true
      GROUP BY blood_type, rh
      ORDER BY blood_type, rh
    `
    console.log(`Executing platelets query for hospital ${hospitalId}:`, query)

    // Execute the query with parameters to prevent SQL injection
    const result = await dbClient.query(query, [hospitalId])

    // Log the raw result
    console.log(`Raw platelets data for hospital ${hospitalId}:`, JSON.stringify(result, null, 2))

    // Validate and process the result
    if (!result || !Array.isArray(result)) {
      console.warn("Invalid platelets data returned from database:", result)
      throw new AppError(
        ErrorType.DATA_PROCESSING,
        "Invalid platelets data returned from database",
        "The database query did not return an array",
      )
    }

    // Process the data to ensure consistent types
    const processedData = result.map((item) => ({
      blood_type: item.blood_type,
      rh: item.rh,
      count: Number(item.count) || 0,
      total_amount: Number(item.total_amount) || 0,
    }))

    // Log the processed data
    console.log(`Processed platelets data for hospital ${hospitalId}:`, JSON.stringify(processedData, null, 2))

    // Cache the result
    queryCache.set(cacheKey, processedData)

    return processedData
  } catch (error) {
    // Log the error
    console.error("Error retrieving platelets inventory:", error)

    // In production, fall back to mock data
    if (process.env.NODE_ENV === "production" || isPreviewMode()) {
      console.warn("Falling back to mock platelets data due to error")
      return MOCK_DATA.platelets
    }

    // In development, throw the error for debugging
    throw logError(error, "Get Platelets Inventory")
  }
}

/**
 * Function to get raw platelets inventory data for debugging
 */
export async function getRawPlateletsInventory(hospitalId: number) {
  // In preview mode, return mock data
  if (isPreviewMode()) {
    return {
      success: true,
      data: [
        {
          bag_id: 1001,
          blood_type: "A",
          rh: "+",
          amount: 250,
          hospital_id: hospitalId,
          active: true,
          expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        {
          bag_id: 1002,
          blood_type: "B",
          rh: "+",
          amount: 250,
          hospital_id: hospitalId,
          active: true,
          expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        {
          bag_id: 1003,
          blood_type: "O",
          rh: "+",
          amount: 250,
          hospital_id: hospitalId,
          active: true,
          expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        {
          bag_id: 1004,
          blood_type: "AB",
          rh: "+",
          amount: 250,
          hospital_id: hospitalId,
          active: true,
          expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        {
          bag_id: 1005,
          blood_type: "A",
          rh: "-",
          amount: 250,
          hospital_id: hospitalId,
          active: true,
          expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        {
          bag_id: 1006,
          blood_type: "O",
          rh: "-",
          amount: 250,
          hospital_id: hospitalId,
          active: true,
          expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      ],
    }
  }

  try {
    if (!process.env.DATABASE_URL) {
      return {
        success: false,
        error: "DATABASE_URL environment variable is not defined",
      }
    }

    const dbClient = neon(process.env.DATABASE_URL)

    // Get all raw platelet inventory data without any grouping
    const query = `
      SELECT *
      FROM platelets_inventory
      WHERE hospital_id = $1 AND active = true
      ORDER BY blood_type, rh, expiration_date DESC
    `

    const result = await dbClient.query(query, [hospitalId])

    return {
      success: true,
      data: result,
      query,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logError(error, "Get Raw Platelets Inventory")

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Function to add a test platelet entry for debugging
 */
export async function addTestPlateletEntry(hospitalId: number) {
  if (isPreviewMode()) {
    return { success: true, message: "Test platelet entry added (preview mode)" }
  }

  try {
    if (!process.env.DATABASE_URL) {
      return {
        success: false,
        error: "DATABASE_URL environment variable is not defined",
      }
    }

    const dbClient = neon(process.env.DATABASE_URL)

    // Generate random blood type and Rh
    const bloodTypes = ["A", "B", "AB", "O"]
    const rhFactors = ["+", "-"]
    const bloodType = bloodTypes[Math.floor(Math.random() * bloodTypes.length)]
    const rh = rhFactors[Math.floor(Math.random() * rhFactors.length)]

    // Set expiration date to 30 days from now
    const expirationDate = new Date()
    expirationDate.setDate(expirationDate.getDate() + 30)

    // Insert test platelet entry
    const query = `
      INSERT INTO platelets_inventory 
      (donor_name, amount, hospital_id, expiration_date, blood_type, rh, active)
      VALUES 
      ($1, $2, $3, $4, $5, $6, $7)
      RETURNING bag_id
    `

    const result = await dbClient.query(query, [
      `Test Donor ${new Date().toISOString()}`,
      250,
      hospitalId,
      expirationDate.toISOString(),
      bloodType,
      rh,
      true,
    ])

    // Invalidate cache
    queryCache.invalidate(`platelets:${hospitalId}`)

    return {
      success: true,
      message: `Test platelet entry added with ID: ${result[0]?.bag_id}`,
      details: {
        bagId: result[0]?.bag_id,
        bloodType,
        rh,
        expirationDate: expirationDate.toISOString(),
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logError(error, "Add Test Platelet Entry")

    return {
      success: false,
      error: errorMessage,
    }
  }
}
