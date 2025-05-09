"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ServerCrash, RefreshCw, ArrowRight } from "lucide-react"
import Link from "next/link"
import { ErrorType } from "@/lib/error-handling"
import { isPreviewMode } from "@/lib/environment-detection"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string; type?: ErrorType }
  reset?: () => void
}) {
  const [redirecting, setRedirecting] = useState(false)
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)
  const inPreviewMode = isPreviewMode()

  useEffect(() => {
    // Log the error to an error reporting service
    console.error("[Error Boundary] Application error:", error)

    // CRITICAL FIX: Special handling for redirect errors in preview mode
    if (error.message?.includes("NEXT_REDIRECT") || error.message?.includes("Redirect")) {
      console.log("[Error Boundary] Detected redirect error in preview mode")

      // Extract the URL from the error message if possible
      const urlMatch = error.message.match(/url=([^,]+)/)
      const url = urlMatch ? urlMatch[1] : "/dashboard"

      setRedirectUrl(url)
      setRedirecting(true)

      // Use a direct window location change for more reliable redirect
      window.location.href = url
      return
    }

    // Special handling for preview mode - redirect to dashboard
    if (inPreviewMode && window.location.pathname === "/") {
      console.log("[Error Boundary] Root path in preview mode, redirecting to dashboard")
      window.location.href = "/dashboard"
    }
  }, [error, inPreviewMode])

  // Function to handle the reset action safely
  const handleReset = () => {
    if (typeof reset === "function") {
      reset()
    } else {
      // Fallback behavior if reset is not available
      console.log("[Error Boundary] Reset function not available, refreshing page instead")
      window.location.reload()
    }
  }

  // In preview mode or when redirecting, show a simple loading state
  if (inPreviewMode || redirecting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-xl font-bold mb-4">Redirecting...</h1>
          <p className="mb-4">Please wait while we redirect you to {redirectUrl || "the dashboard"}.</p>
          <div className="flex justify-center">
            <ArrowRight className="animate-pulse h-6 w-6" />
          </div>
        </div>
      </div>
    )
  }

  // Check if this is a database connection error
  const isDatabaseError =
    error.type === ErrorType.DATABASE_CONNECTION ||
    error.message?.includes("database") ||
    error.message?.includes("connection") ||
    error.message?.includes("Failed to fetch")

  // Check if this is a navigation error
  const isNavigationError =
    error.type === ErrorType.NAVIGATION || error.message?.includes("navigation") || error.message?.includes("route")

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <ServerCrash className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-3xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-gray-600">We apologize for the inconvenience</p>
        </div>

        <Alert variant={isDatabaseError ? "warning" : isNavigationError ? "default" : "destructive"} className="mb-6">
          <AlertTitle>
            {isDatabaseError ? "Database Connection Error" : isNavigationError ? "Navigation Error" : "Error"}
          </AlertTitle>
          <AlertDescription>
            {isDatabaseError
              ? "Unable to connect to the database. Please try again later."
              : isNavigationError
                ? "There was a problem navigating to the requested page."
                : error.message || "An unexpected error occurred. Please try again."}
          </AlertDescription>
        </Alert>

        <div className="flex justify-center gap-4">
          <Button onClick={handleReset} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
