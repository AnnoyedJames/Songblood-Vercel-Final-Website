"use client"

import { useEffect, useRef } from "react"
import { useSession } from "./session-provider"
import { checkSessionTimeout } from "@/lib/session-timeout"
import { isPreviewMode } from "@/lib/environment-detection"

interface SessionMonitorProps {
  interval?: number // Check interval in milliseconds
}

export default function SessionMonitor({ interval = 60000 }: SessionMonitorProps) {
  const { setLoggedOut } = useSession()
  const lastActivityRef = useRef<number>(Date.now())
  const preview = isPreviewMode()

  // Update last activity timestamp on user interaction
  useEffect(() => {
    if (preview) return // Skip in preview mode

    const updateLastActivity = () => {
      lastActivityRef.current = Date.now()
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
  }, [preview])

  // Periodically check session status
  useEffect(() => {
    if (preview) return // Skip in preview mode

    const checkSession = async () => {
      try {
        const result = await checkSessionTimeout()

        if (result.expired) {
          console.log("Session expired, logging out")
          setLoggedOut(true, "session-expired")
        }
      } catch (error) {
        console.error("Error checking session:", error)
      }
    }

    // Set up interval to check session
    const intervalId = setInterval(checkSession, interval)

    // Clean up interval on unmount
    return () => clearInterval(intervalId)
  }, [interval, setLoggedOut, preview])

  // This component doesn't render anything
  return null
}
