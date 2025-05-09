"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"

export default function AddTestEntryButton() {
  const [isLoading, setIsLoading] = useState(false)

  const addTestEntry = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/diagnostics/platelets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Test Entry Added",
          description: data.message,
          variant: "default",
        })
        // Refresh the page to show the new entry
        window.location.reload()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to add test entry",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button onClick={addTestEntry} disabled={isLoading}>
      {isLoading ? "Adding..." : "Add Test Platelet Entry"}
    </Button>
  )
}
