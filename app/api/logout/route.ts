import { NextResponse } from "next/server"
import { logout } from "@/lib/auth"
import { AppError, ErrorType, logError } from "@/lib/error-handling"

// Force dynamic rendering for API routes that use cookies
export const dynamic = "force-dynamic"

export async function POST() {
  try {
    const result = await logout()
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    // Handle different error types
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          type: error.type,
        },
        { status: error.type === ErrorType.AUTHENTICATION ? 401 : 500 },
      )
    }

    // Handle unexpected errors
    const appError = logError(error, "Logout API")
    return NextResponse.json(
      {
        success: false,
        error: appError.message,
        type: appError.type,
      },
      { status: 500 },
    )
  }
}
