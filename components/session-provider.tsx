"use client"

import { type ReactNode, useEffect, createContext, useContext, useState } from "react"
import { useSessionTimeout } from "@/lib/session-timeout"
import { usePathname, useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { isPreviewMode } from "@/lib/environment-detection"

interface SessionProviderProps {
  children: ReactNode
  timeoutMinutes?: number
  warningMinutes?: number
}

interface SessionContextType {
  resetTimer: () => void
  setLoggedOut: (isLoggedOut: boolean, reason?: string) => void
}

const SessionContext = createContext<SessionContextType | undefined>(undefined)

export default function SessionProvider({
  children,
  timeoutMinutes = 60, // Extended from 30 to 60 minutes
  warningMinutes = 5,
}: SessionProviderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()
  const [resetTimerFunction, setResetTimerFunction] = useState<(() => void) | null>(null)
  const preview = isPreviewMode()

  // Skip session timeout on login and register pages
  const isAuthPage = pathname === "/login" || pathname === "/register"

  // Use session timeout hook
  const { resetTimer, showWarning, timeRemaining } = useSessionTimeout({
    timeoutMinutes,
    warningMinutes,
    enabled: !isAuthPage && !preview,
    preserveFormData: true,
  })

  // Show warning toast when approaching timeout
  useEffect(() => {
    if (showWarning && !isAuthPage && !preview) {
      const minutes = Math.floor(timeRemaining / 60)
      const seconds = timeRemaining % 60

      toast({
        title: "Session Expiring Soon",
        description: `Your session will expire in ${minutes}m ${seconds}s. Would you like to stay logged in?`,
        duration: 0, // Don't auto-dismiss
        action: (
          <button
            onClick={resetTimer}
            className="bg-white text-black px-3 py-1 rounded-md hover:bg-gray-200 transition-colors"
          >
            Keep me logged in
          </button>
        ),
      })
    }
  }, [showWarning, timeRemaining, isAuthPage, preview, toast, resetTimer])

  useEffect(() => {
    setResetTimerFunction(() => resetTimer)
  }, [resetTimer])

  // Function to handle logout
  const setLoggedOut = (isLoggedOut: boolean, reason?: string) => {
    if (isLoggedOut && !preview) {
      // In preview mode, we don't want to redirect
      const redirectUrl = reason ? `/login?reason=${reason}` : "/login"
      router.push(redirectUrl)
    }
  }

  // Check for form data to restore on page load
  useEffect(() => {
    if (isAuthPage || preview) return

    try {
      const pageIdentifier = pathname.replace(/\//g, "_")
      const storageKeyPrefix = `formData_${pageIdentifier}_`

      // Look for saved form data for this page
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key && key.startsWith(storageKeyPrefix)) {
          const savedData = JSON.parse(sessionStorage.getItem(key) || "{}")

          // Check if data is less than 30 minutes old
          const isRecent = Date.now() - savedData.timestamp < 30 * 60 * 1000

          if (isRecent) {
            // Show toast notification about form data
            toast({
              title: "Form data recovered",
              description: "We've restored your previously entered data.",
              duration: 5000,
              action: (
                <button
                  onClick={() => {
                    sessionStorage.removeItem(key)
                    window.location.reload()
                  }}
                  className="bg-destructive text-destructive-foreground px-3 py-1 rounded-md hover:bg-destructive/90 transition-colors"
                >
                  Discard
                </button>
              ),
            })

            // Wait for DOM to be ready
            setTimeout(() => {
              // Find the form and restore data
              const formId = key.split("_").pop()
              const form = document.getElementById(formId) as HTMLFormElement

              if (form) {
                Object.entries(savedData.data).forEach(([name, value]) => {
                  const element = form.elements.namedItem(name) as
                    | HTMLInputElement
                    | HTMLSelectElement
                    | HTMLTextAreaElement
                  if (element) {
                    element.value = value as string
                  }
                })
              }
            }, 500)

            // Remove the saved data
            sessionStorage.removeItem(key)
            break
          } else {
            // Remove old data
            sessionStorage.removeItem(key)
          }
        }
      }
    } catch (error) {
      console.error("Error restoring form data:", error)
    }
  }, [pathname, toast, isAuthPage, preview])

  // Listen for storage events (for cross-tab logout)
  useEffect(() => {
    if (preview) return // Skip in preview mode

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "logout" && event.newValue === "true") {
        window.location.href = "/login?reason=logged-out-in-another-tab"
      }
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [preview])

  return (
    <SessionContext.Provider value={{ resetTimer: resetTimerFunction || (() => {}), setLoggedOut }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)

  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider")
  }

  return context
}
