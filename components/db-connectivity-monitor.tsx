"use client"

import { useState, useEffect } from "react"
import { AlertCircle, CheckCircle, RefreshCw } from "lucide-react"

type DbConnectivityStatus = {
  connected: boolean
  lastChecked: Date | null
  responseTime: number | null
  error: string | null
  checking: boolean
}

export default function DbConnectivityMonitor() {
  const [status, setStatus] = useState<DbConnectivityStatus>({
    connected: false,
    lastChecked: null,
    responseTime: null,
    error: null,
    checking: true,
  })

  // Function to check database connectivity
  const checkConnectivity = async () => {
    setStatus((prev) => ({ ...prev, checking: true }))

    try {
      const response = await fetch("/api/db-status", {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`)
      }

      const data = await response.json()

      setStatus({
        connected: data.connected,
        lastChecked: new Date(),
        responseTime: data.diagnostics?.responseTimeMs || null,
        error: data.connected ? null : data.error || "Unknown error",
        checking: false,
      })
    } catch (error) {
      setStatus({
        connected: false,
        lastChecked: new Date(),
        responseTime: null,
        error: error instanceof Error ? error.message : "Failed to check database connectivity",
        checking: false,
      })
    }
  }

  // Check connectivity on mount and periodically
  useEffect(() => {
    checkConnectivity()

    // Check every 5 minutes
    const intervalId = setInterval(checkConnectivity, 5 * 60 * 1000)

    return () => clearInterval(intervalId)
  }, [])

  // If not checked yet, show loading
  if (!status.lastChecked) {
    return (
      <div className="flex items-center space-x-2 text-gray-500">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span>Checking database connectivity...</span>
      </div>
    )
  }

  // If connected, show success
  if (status.connected) {
    return (
      <div className="flex items-center space-x-2 text-green-600">
        <CheckCircle className="h-4 w-4" />
        <span>Database connected</span>
        {status.responseTime && <span className="text-xs text-gray-500">({status.responseTime}ms)</span>}
      </div>
    )
  }

  // If not connected, show error
  return (
    <div className="flex flex-col">
      <div className="flex items-center space-x-2 text-red-600">
        <AlertCircle className="h-4 w-4" />
        <span>Database connection error</span>
        <button
          onClick={checkConnectivity}
          className="ml-2 p-1 rounded-full hover:bg-gray-100"
          disabled={status.checking}
        >
          <RefreshCw className={`h-3 w-3 ${status.checking ? "animate-spin" : ""}`} />
        </button>
      </div>
      {status.error && <p className="text-xs text-red-500 mt-1">{status.error}</p>}
    </div>
  )
}
