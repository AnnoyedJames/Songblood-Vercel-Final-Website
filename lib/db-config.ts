import { neonConfig } from "@neondatabase/serverless"

// Database configuration
export const DB_CONFIG = {
  CONNECTION_TIMEOUT_MS: 10000, // 10 seconds
  QUERY_TIMEOUT_MS: 30000, // 30 seconds
  CONNECTION_POOL_SIZE: 10,
  MAX_BATCH_SIZE: 1000,
  CACHE_TTL_MS: 60000, // 1 minute
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 500,
  HEALTH_CHECK_INTERVAL_MS: 300000, // 5 minutes
}

// Configure Neon with optimal settings
export function configureNeon() {
  try {
    // Skip configuration in preview mode
    if (isPreviewEnvironment()) {
      return
    }

    // Configure Neon with optimal settings
    neonConfig.fetchConnectionCache = true
    neonConfig.wsConnectionTimeoutMs = DB_CONFIG.CONNECTION_TIMEOUT_MS
    neonConfig.fetchTimeoutMs = DB_CONFIG.QUERY_TIMEOUT_MS
    neonConfig.fetchMaxBatchSize = DB_CONFIG.MAX_BATCH_SIZE

    // Log configuration
    console.log("Neon database configured with optimal settings")
  } catch (error) {
    console.error("Failed to configure Neon:", error)
  }
}

// Get database URL with fallback handling
export function getDatabaseUrl(): string | null {
  // Skip in preview mode
  if (isPreviewEnvironment()) {
    return null
  }

  // Try different environment variable formats
  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING

  if (!dbUrl) {
    console.error("No database URL found in environment variables")
    return null
  }

  return dbUrl
}

// Check if running in preview environment
export function isPreviewEnvironment(): boolean {
  // Check for preview mode environment variables
  if (process.env.IS_PREVIEW === "true" || process.env.VERCEL_ENV === "preview") {
    return true
  }

  // Check for preview hostnames
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname
    if (hostname.includes("vercel.app") || hostname.includes("localhost") || hostname.includes("vusercontent.net")) {
      return true
    }
  }

  return false
}
