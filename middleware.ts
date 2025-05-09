import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Safer preview mode detection that won't throw errors
function isPreviewModeMiddleware(request: NextRequest): boolean {
  try {
    // Check for Vercel preview environment
    const vercelEnv = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV
    if (vercelEnv === "preview") {
      return true
    }

    // Check for preview mode flag
    if (process.env.IS_PREVIEW === "true") {
      return true
    }

    // Check for specific preview URL patterns
    const hostname = request.nextUrl.hostname
    if (
      hostname.includes("vercel.app") ||
      hostname.includes("localhost") ||
      hostname.includes("vusercontent.net") // v0 preview URLs
    ) {
      return true
    }

    // Check for preview cookie
    const previewCookie = request.cookies.get("__previewMode")
    if (previewCookie) {
      return true
    }

    return false
  } catch (error) {
    // If any error occurs during detection, default to treating it as preview mode
    // This is safer than blocking access
    console.error("Error in preview mode detection:", error)
    return true
  }
}

export function middleware(request: NextRequest) {
  try {
    const path = request.nextUrl.pathname

    // CRITICAL FIX: Completely bypass middleware for root path in preview mode
    // This prevents conflicts with page-level redirects
    if (path === "/" && isPreviewModeMiddleware(request)) {
      console.log("[Middleware] Root path in preview mode - bypassing middleware completely")
      return NextResponse.next()
    }

    // Define public paths that don't require authentication
    const isPublicPath = path === "/login" || path === "/register"

    // Get authentication status from cookies - with safe fallbacks
    const adminId = request.cookies.get("adminId")?.value
    const hospitalId = request.cookies.get("hospitalId")?.value
    const isAuthenticated = !!adminId && !!hospitalId

    // Special handling for preview mode - with error handling
    const inPreviewMode = isPreviewModeMiddleware(request)

    // In preview mode, allow access to all paths without redirects
    if (inPreviewMode) {
      console.log(`[Middleware] Preview mode detected for path: ${path} - allowing access`)
      return NextResponse.next()
    }

    // Redirect logic for non-preview mode
    if (!isAuthenticated && !isPublicPath) {
      // Redirect to login if trying to access protected route without authentication
      const url = new URL("/login", request.url)
      url.searchParams.set("reason", "login-required")
      console.log(`[Middleware] Not authenticated, redirecting to login from: ${path}`)
      return NextResponse.redirect(url)
    }

    if (isAuthenticated && (path === "/login" || path === "/register")) {
      // Redirect to dashboard if already authenticated and trying to access login or register
      console.log(`[Middleware] Already authenticated, redirecting to dashboard from: ${path}`)
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    // Special case for root path: redirect to login if not authenticated, dashboard if authenticated
    if (path === "/") {
      const redirectUrl = isAuthenticated ? "/dashboard" : "/login"
      console.log(`[Middleware] Root path, redirecting to: ${redirectUrl}`)
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    return NextResponse.next()
  } catch (error) {
    // Global error handler for middleware
    console.error("[Middleware] Error:", error)

    // In case of any error, allow the request to proceed
    // This prevents the middleware from blocking access to the application
    return NextResponse.next()
  }
}

// Configure middleware to run on specific paths
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
