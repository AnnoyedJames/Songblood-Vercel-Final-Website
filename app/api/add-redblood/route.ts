import { NextResponse } from "next/server"
import { addNewRedBloodBag } from "@/lib/db"
import { cookies } from "next/headers"
import { queryCache } from "@/lib/cache"
import { AppError, ErrorType } from "@/lib/error-handling"
import { isPreviewMode } from "@/lib/environment-detection"

// Force dynamic rendering for API routes that use cookies
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    // Check for preview mode first
    const preview = isPreviewMode()

    // Get session
    const cookieStore = cookies()
    const adminId = cookieStore.get("adminId")?.value
    const hospitalId = cookieStore.get("hospitalId")?.value

    // In preview mode, use mock data
    if (preview) {
      console.log("[Preview Mode] Processing add-redblood request with mock data")

      // Simulate processing delay
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Return success response
      return NextResponse.json({
        success: true,
        message: "Red blood cell bag added successfully (Preview Mode)",
        preview: true,
      })
    }

    if (!adminId || !hospitalId) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          type: ErrorType.AUTHENTICATION,
          details: "Your session has expired or is invalid. Please log in again.",
        },
        { status: 401 },
      )
    }

    // Get request body
    let requestBody
    try {
      requestBody = await request.json()
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request format",
          type: ErrorType.VALIDATION,
          details: "The request body could not be parsed as JSON.",
        },
        { status: 400 },
      )
    }

    const { donorName, amount, expirationDate, bloodType, rh, hospitalId: formHospitalId } = requestBody

    // Validate required fields
    const validationErrors: Record<string, string> = {}

    if (!donorName || typeof donorName !== "string" || donorName.trim().length < 2) {
      validationErrors["redblood-donorName"] = "Donor name must be at least 2 characters"
    }

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      validationErrors["redblood-amount"] = "Amount must be a positive number"
    } else if (Number(amount) < 100) {
      validationErrors["redblood-amount"] = "Amount must be at least 100 ml"
    } else if (Number(amount) > 500) {
      validationErrors["redblood-amount"] = "Amount cannot exceed 500 ml"
    }

    if (!expirationDate) {
      validationErrors["redblood-expirationDate"] = "Expiration date is required"
    } else {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const expDate = new Date(expirationDate)
      if (expDate < today) {
        validationErrors["redblood-expirationDate"] = "Expiration date cannot be in the past"
      }
    }

    if (!bloodType) {
      validationErrors["redblood-bloodType"] = "Blood type is required"
    } else if (!["A", "B", "AB", "O"].includes(bloodType)) {
      validationErrors["redblood-bloodType"] = "Invalid blood type"
    }

    if (!rh || !["+", "-"].includes(rh)) {
      validationErrors["redblood-rh"] = "Valid Rh factor is required (+ or -)"
    }

    // Return validation errors if any
    if (Object.keys(validationErrors).length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          type: ErrorType.VALIDATION,
          validationErrors,
          details: "Please correct the errors and try again.",
        },
        { status: 400 },
      )
    }

    // Validate hospital ID
    if (Number(hospitalId) !== formHospitalId) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Hospital mismatch",
          type: ErrorType.AUTHENTICATION,
          details: "The hospital ID in the form does not match your authenticated hospital.",
        },
        { status: 403 },
      )
    }

    // Get admin credentials from cookies
    const adminUsername = cookieStore.get("adminUsername")?.value
    const adminPassword = cookieStore.get("adminPassword")?.value

    if (!adminUsername || !adminPassword) {
      return NextResponse.json(
        {
          success: false,
          error: "Session expired. Please login again.",
          type: ErrorType.AUTHENTICATION,
          details: "Your authentication credentials have expired. Please log in again to continue.",
        },
        { status: 401 },
      )
    }

    // Add new red blood cell bag
    try {
      const result = await addNewRedBloodBag(
        donorName,
        amount,
        Number(hospitalId),
        expirationDate,
        bloodType,
        rh,
        adminUsername,
        adminPassword,
      )

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || "Failed to add red blood cell bag",
            type: result.type || ErrorType.SERVER,
            details: result.details,
            retryable: result.retryable,
          },
          { status: 400 },
        )
      }

      // Invalidate relevant caches
      queryCache.invalidate(`redblood:${hospitalId}`)

      return NextResponse.json({ success: true })
    } catch (error) {
      // Handle database errors
      if (error instanceof AppError) {
        if (error.type === ErrorType.DATABASE_CONNECTION) {
          return NextResponse.json(
            {
              success: false,
              error: "Database connection error",
              type: ErrorType.DATABASE_CONNECTION,
              details: "Unable to connect to the database. Please try again later.",
              retryable: true,
            },
            { status: 503 },
          )
        } else if (error.type === ErrorType.VALIDATION) {
          return NextResponse.json(
            {
              success: false,
              error: error.message || "Validation error",
              type: ErrorType.VALIDATION,
              details: error.details || "Please check your input and try again.",
            },
            { status: 400 },
          )
        } else if (error.type === ErrorType.AUTHENTICATION) {
          return NextResponse.json(
            {
              success: false,
              error: "Authentication failure, please login again",
              type: ErrorType.AUTHENTICATION,
              details: "Your session has expired or your credentials are invalid. Please log in again.",
            },
            { status: 401 },
          )
        }
      }

      // Log the error for debugging
      console.error("Add red blood cell error:", error)

      // Return a generic error response
      return NextResponse.json(
        {
          success: false,
          error: "An error occurred while processing your request",
          type: ErrorType.SERVER,
          details: "Our team has been notified of this issue. Please try again later.",
          retryable: true,
        },
        { status: 500 },
      )
    }
  } catch (error: any) {
    // Log the error for debugging
    console.error("Add red blood cell error:", error)

    // Return a generic error response
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred",
        type: ErrorType.SERVER,
        details: "Our team has been notified of this issue. Please try again later.",
        retryable: true,
      },
      { status: 500 },
    )
  }
}
