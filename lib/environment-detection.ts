// Detect if we're in a preview environment - client-side version
export function isPreviewMode(): boolean {
  try {
    // Check for Vercel preview environment
    if (process.env.NEXT_PUBLIC_VERCEL_ENV === "preview") {
      return true
    }

    // Check for specific preview URL patterns
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname
      if (
        hostname.includes("vercel.app") ||
        hostname.includes("localhost") ||
        hostname.includes("vusercontent.net") // v0 preview URLs
      ) {
        return true
      }
    }

    // Check for preview cookie
    if (typeof document !== "undefined") {
      const previewCookie = document.cookie.split("; ").find((row) => row.startsWith("__previewMode="))
      if (previewCookie) {
        return true
      }
    }

    // Check for preview mode flag
    if (process.env.IS_PREVIEW === "true") {
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

// Server-side version of isPreviewMode
export function isPreviewModeServer(): boolean {
  try {
    // Check for Vercel preview environment
    if (process.env.VERCEL_ENV === "preview") {
      return true
    }

    // Check for specific build ID or environment variable
    if (process.env.NEXT_PUBLIC_BUILD_ID?.includes("preview")) {
      return true
    }

    // Check for preview mode flag
    if (process.env.IS_PREVIEW === "true") {
      return true
    }

    return false
  } catch (error) {
    // If any error occurs during detection, default to treating it as preview mode
    // This is safer than blocking access
    console.error("Error in server preview mode detection:", error)
    return true
  }
}

// Universal version that works in both client and server contexts
export function isPreviewModeUniversal(): boolean {
  try {
    // First try server-side detection
    if (typeof window === "undefined") {
      return isPreviewModeServer()
    }

    // Then try client-side detection
    return isPreviewMode()
  } catch (error) {
    // If any error occurs during detection, default to treating it as preview mode
    console.error("Error in universal preview mode detection:", error)
    return true
  }
}
