import { neon } from "@neondatabase/serverless"
import { getDatabaseUrl, DB_CONFIG, isPreviewEnvironment } from "./db-config"
import { AppError, ErrorType, logError } from "./error-handling"
import { queryCache } from "./cache"

// Database health status
type DbHealthStatus = {
  isConnected: boolean
  lastChecked: Date
  responseTimeMs: number | null
  error: string | null
}

// Initialize health status
let dbHealthStatus: DbHealthStatus = {
  isConnected: false,
  lastChecked: new Date(0), // Unix epoch
  responseTimeMs: null,
  error: "Health check not yet performed",
}

// Get current health status
export function getDbHealthStatus(): DbHealthStatus {
  return { ...dbHealthStatus }
}

// Check database health
export async function checkDbHealth(): Promise<DbHealthStatus> {
  // Skip in preview mode
  if (isPreviewEnvironment()) {
    dbHealthStatus = {
      isConnected: true,
      lastChecked: new Date(),
      responseTimeMs: 0,
      error: null,
    }
    return dbHealthStatus
  }

  try {
    const dbUrl = getDatabaseUrl()
    if (!dbUrl) {
      throw new AppError(ErrorType.DATABASE_CONNECTION, "Database URL not found", "Check environment variables")
    }

    // Create a test client
    const testClient = neon(dbUrl)

    // Measure response time
    const startTime = performance.now()

    // Execute a simple query with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Database health check timed out")), DB_CONFIG.CONNECTION_TIMEOUT_MS)
    })

    await Promise.race([testClient`SELECT 1 as health_check`, timeoutPromise])

    const endTime = performance.now()
    const responseTimeMs = Math.round(endTime - startTime)

    // Update health status
    dbHealthStatus = {
      isConnected: true,
      lastChecked: new Date(),
      responseTimeMs,
      error: null,
    }

    return dbHealthStatus
  } catch (error) {
    // Log and update health status
    const appError = logError(error, "Database Health Check")

    dbHealthStatus = {
      isConnected: false,
      lastChecked: new Date(),
      responseTimeMs: null,
      error: appError.message,
    }

    return dbHealthStatus
  }
}

// Start periodic health checks
export function startHealthChecks(intervalMs = DB_CONFIG.HEALTH_CHECK_INTERVAL_MS): () => void {
  // Skip in preview mode
  if (isPreviewEnvironment()) {
    return () => {}
  }

  // Perform initial health check
  checkDbHealth().catch(console.error)

  // Set up interval for periodic checks
  const intervalId = setInterval(() => {
    checkDbHealth()
      .then((status) => {
        // If connection was restored after being down, invalidate cache
        if (status.isConnected && !dbHealthStatus.isConnected) {
          console.log("Database connection restored, invalidating cache")
          queryCache.invalidateAll()
        }
      })
      .catch(console.error)
  }, intervalMs)

  // Return cleanup function
  return () => clearInterval(intervalId)
}
