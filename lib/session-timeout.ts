"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"

interface SessionTimeoutOptions {
  timeoutMinutes?: number
  warningMinutes?: number
  enabled?: boolean
  preserveFormData?: boolean
}

interface SessionTimeoutResult {
  resetTimer: () => void
  timeRemaining: number
  showWarning: boolean
}

export function useSessionTimeout({
  timeoutMinutes = 60,
  warningMinutes = 5,
  enabled = true,
  preserveFormData = false,
}: SessionTimeoutOptions): SessionTimeoutResult {
  const router = useRouter()
  const [lastActivity, setLastActivity] = useState<number>(Date.now())
  const [timeRemaining, setTimeRemaining] = useState<number>(timeoutMinutes * 60)
  const [showWarning, setShowWarning] = useState<boolean>(false)

  // Reset the timer
  const resetTimer = useCallback(() => {
    setLastActivity(Date.now())
    setShowWarning(false)
  }, [])

  // Check if the session has timed out
  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(() => {
      const now = Date.now()
      const elapsedSeconds = Math.floor((now - lastActivity) / 1000)
      const remainingSeconds = timeoutMinutes * 60 - elapsedSeconds
      setTimeRemaining(remainingSeconds)

      // Show warning when approaching timeout
      if (remainingSeconds <= warningMinutes * 60 && remainingSeconds > 0) {
        setShowWarning(true)
      }

      // Session timeout reached
      if (remainingSeconds <= 0) {
        clearInterval(interval)

        // Save form data if enabled
        if (preserveFormData) {
          try {
            const forms = document.querySelectorAll("form")
            forms.forEach((form) => {
              if (form.id) {
                const formData: Record<string, string> = {}
                const formElements = form.elements
                for (let i = 0; i < formElements.length; i++) {
                  const element = formElements[i] as HTMLInputElement
                  if (element.name && element.value && element.type !== "password") {
                    formData[element.name] = element.value
                  }
                }

                if (Object.keys(formData).length > 0) {
                  const pageIdentifier = window.location.pathname.replace(/\//g, "_")
                  const storageKey = `formData_${pageIdentifier}_${form.id}`
                  sessionStorage.setItem(
                    storageKey,
                    JSON.stringify({
                      timestamp: Date.now(),
                      data: formData,
                    }),
                  )
                }
              }
            })
          } catch (error) {
            console.error("Error saving form data:", error)
          }
        }

        // Get the current path for the returnTo parameter
        const currentPath = encodeURIComponent(window.location.pathname + window.location.search)

        // Redirect to login with session timeout reason
        router.push(`/login?reason=session-timeout&returnTo=${currentPath}`)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [lastActivity, timeoutMinutes, warningMinutes, router, enabled, preserveFormData])

  // Update last activity on user interaction
  useEffect(() => {
    if (!enabled) return

    const updateLastActivity = () => {
      setLastActivity(Date.now())
      setShowWarning(false)
    }

    // Add event listeners for user activity
    window.addEventListener("mousemove", updateLastActivity)
    window.addEventListener("mousedown", updateLastActivity)
    window.addEventListener("keypress", updateLastActivity)
    window.addEventListener("touchmove", updateLastActivity)
    window.addEventListener("scroll", updateLastActivity)

    return () => {
      // Clean up event listeners
      window.removeEventListener("mousemove", updateLastActivity)
      window.removeEventListener("mousedown", updateLastActivity)
      window.removeEventListener("keypress", updateLastActivity)
      window.removeEventListener("touchmove", updateLastActivity)
      window.removeEventListener("scroll", updateLastActivity)
    }
  }, [enabled])

  return { resetTimer, timeRemaining, showWarning }
}

// Function to check if the session has timed out
export async function checkSessionTimeout() {
  try {
    const response = await fetch("/api/check-session", {
      method: "GET",
      credentials: "include",
    })

    if (!response.ok) {
      return { expired: true }
    }

    const data = await response.json()
    return { expired: !data.authenticated }
  } catch (error) {
    console.error("Error checking session timeout:", error)
    return { expired: false } // Assume not expired on error to prevent false logouts
  }
}
