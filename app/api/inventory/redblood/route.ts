import { type NextRequest, NextResponse } from "next/server"
import { getBloodInventory } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { isPreviewMode } from "@/lib/environment-detection"
import { AppError, ErrorType } from "@/lib/error-handling"

export async function GET(request: NextRequest) {
  try {
    // Check if we're in preview mode
    if (isPreviewMode()) {
      // Return mock data for preview mode
      const mockInventory = [
        { blood_type: "A", rh: "+", count: 25, total_amount: 12500 },
        { blood_type: "A", rh: "-", count: 10, total_amount: 5000 },
        { blood_type: "B", rh: "+", count: 15, total_amount: 7500 },
        { blood_type: "B", rh: "-", count: 5, total_amount: 2500 },
        { blood_type: "AB", rh: "+", count: 8, total_amount: 4000 },
        { blood_type: "AB", rh: "-", count: 3, total_amount: 1500 },
        { blood_type: "O", rh: "+", count: 30, total_amount: 15000 },
        { blood_type: "O", rh: "-", count: 12, total_amount: 6000 },
      ]
      return NextResponse.json(mockInventory)
    }

    // Check authentication
    const session = await requireAuth()

    // Get hospitalId from query params or session
    const url = new URL(request.url)
    const hospitalIdParam = url.searchParams.get("hospitalId")

    let hospitalId: number

    if (hospitalIdParam) {
      // Validate hospital ID is a number
      if (!/^\d+$/.test(hospitalIdParam)) {
        return NextResponse.json({ error: "Invalid hospital ID format" }, { status: 400 })
      }

      hospitalId = Number.parseInt(hospitalIdParam)
    } else {
      hospitalId = session.hospitalId
    }

    // Verify the user has access to this hospital's data
    if (hospitalId !== session.hospitalId) {
      return NextResponse.json(
        {
          error: "Unauthorized access to hospital data",
          message: "You do not have permission to view data for this hospital",
        },
        { status: 403 },
      )
    }

    // Get inventory data with timeout handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    try {
      const inventory = await getBloodInventory(hospitalId)
      clearTimeout(timeoutId)

      // Add response headers for caching and security
      const headers = new Headers()
      headers.set("Cache-Control", "private, max-age=60") // Cache for 1 minute
      headers.set("X-Content-Type-Options", "nosniff")

      return NextResponse.json(inventory, { headers })
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof AppError) {
        if (error.type === ErrorType.DATABASE_CONNECTION) {
          return NextResponse.json(
            { error: "Database connection error", message: error.message },
            { status: 503 }, // Service Unavailable
          )
        }

        if (error.type === ErrorType.TIMEOUT) {
          return NextResponse.json(
            { error: "Request timeout", message: "The database query took too long to complete" },
            { status: 504 }, // Gateway Timeout
          )
        }
      }

      throw error // Let the outer catch handle other errors
    }
  } catch (error) {
    console.error("Error fetching red blood inventory:", error)

    // Determine appropriate status code based on error type
    let status = 500
    let errorMessage = "Failed to fetch inventory data"

    if (error instanceof AppError) {
      switch (error.type) {
        case ErrorType.AUTHENTICATION:
          status = 401
          errorMessage = "Authentication required"
          break
        case ErrorType.NOT_FOUND:
          status = 404
          errorMessage = "Resource not found"
          break
        case ErrorType.VALIDATION:
          status = 400
          errorMessage = "Invalid request"
          break
      }
    }

    return NextResponse.json({ error: errorMessage }, { status })
  }
}
