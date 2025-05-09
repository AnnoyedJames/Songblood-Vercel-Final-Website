import { NextResponse } from "next/server"
import { testDatabaseConnection, getDbHealthStatus } from "@/lib/db"
import { isPreviewMode } from "@/lib/environment-detection"

export async function GET() {
  try {
    // Check if in preview mode
    if (isPreviewMode()) {
      return NextResponse.json({
        connected: true,
        message: "Preview mode active - using mock data",
        diagnostics: {
          responseTimeMs: 0,
          environment: "preview",
        },
      })
    }

    // Get current health status
    const healthStatus = getDbHealthStatus()

    // If health check was performed recently (within 30 seconds), use that result
    const isRecentCheck = healthStatus.lastChecked && Date.now() - healthStatus.lastChecked.getTime() < 30000

    if (isRecentCheck) {
      return NextResponse.json({
        connected: healthStatus.isConnected,
        error: healthStatus.error,
        message: healthStatus.isConnected ? "Database is connected" : "Database connection failed",
        diagnostics: {
          responseTimeMs: healthStatus.responseTimeMs,
          lastChecked: healthStatus.lastChecked.toISOString(),
        },
      })
    }

    // Otherwise, perform a new connection test
    const result = await testDatabaseConnection()

    // Set cache headers to prevent caching
    const headers = new Headers()
    headers.set("Cache-Control", "no-store, max-age=0")

    return NextResponse.json(
      {
        connected: result.connected,
        error: result.error,
        message: result.connected ? "Database is connected" : "Database connection failed",
        diagnostics: result.diagnostics,
      },
      { headers },
    )
  } catch (error) {
    console.error("Error checking database status:", error)

    return NextResponse.json(
      {
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error checking database status",
        message: "Failed to check database status",
      },
      { status: 500 },
    )
  }
}
