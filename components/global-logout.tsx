"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function GlobalLogout() {
  const router = useRouter()

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "logout" && event.newValue === "true") {
        // Redirect to login page with reason
        router.push("/login?reason=logged-out-in-another-tab")
      }
    }

    window.addEventListener("storage", handleStorage)

    return () => {
      window.removeEventListener("storage", handleStorage)
    }
  }, [router])

  // This component doesn't render anything
  return null
}
