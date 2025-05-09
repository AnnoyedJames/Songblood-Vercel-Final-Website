import { NextResponse } from "next/server"
import { isAuthenticated } from "@/lib/auth"
import { AppError, ErrorType, logError } from "@/lib/error-handling"
import { isPreviewMode } from "@/lib/environment-detection"

// Force dynamic rendering for API routes that use cookies
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // In preview mode, always return authenticated
    if (isPreviewMode()) {
      return NextResponse.json({ authenticated: true }, { status: 200 })
    }

    const authenticated = await isAuthenticated()
    return NextResponse.json({ authenticated }, { status: 200 })
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
    const appError = logError(error, "Check Session API")
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
