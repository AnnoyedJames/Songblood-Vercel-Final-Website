"use client"

import { useEffect, useState, useCallback } from "react"
import BloodInventoryWarnings from "./blood-inventory-warnings"
import { isPreviewMode } from "@/lib/environment-detection"

type InventoryItem = {
  blood_type: string
  rh?: string
  count: number
  total_amount: number
}

type InventoryData = {
  redBlood: InventoryItem[]
  plasma: InventoryItem[]
  platelets: InventoryItem[]
}

type FetchStatus = {
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  retryCount: number
}

type RealTimeInventoryWarningsProps = {
  initialRedBlood: InventoryItem[]
  initialPlasma: InventoryItem[]
  initialPlatelets: InventoryItem[]
  hospitalId: number | string
  refreshInterval?: number // in milliseconds
  className?: string
}

export default function RealTimeInventoryWarnings({
  initialRedBlood,
  initialPlasma,
  initialPlatelets,
  hospitalId,
  refreshInterval = 60000, // Default to 1 minute
  className = "",
}: RealTimeInventoryWarningsProps) {
  // State for inventory data
  const [inventoryData, setInventoryData] = useState<InventoryData>({
    redBlood: initialRedBlood,
    plasma: initialPlasma,
    platelets: initialPlatelets,
  })

  // State for fetch status
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>({
    loading: false,
    error: null,
    lastUpdated: null,
    retryCount: 0,
  })

  // State for preview mode
  const [isPreview, setIsPreview] = useState(false)

  // Check if in preview mode on mount
  useEffect(() => {
    setIsPreview(isPreviewMode())
  }, [])

  // Function to fetch inventory data with enhanced error handling
  const fetchInventoryData = useCallback(
    async (retryOnError = true) => {
      // Skip in preview mode
      if (isPreview) return

      // Set loading state
      setFetchStatus((prev) => ({ ...prev, loading: true }))

      try {
        // Create AbortController for timeout handling
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout

        // Fetch all inventory data in parallel
        const [redBloodRes, plasmaRes, plateletsRes] = await Promise.all([
          fetch(`/api/inventory/redblood?hospitalId=${hospitalId}`, {
            credentials: "include",
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
            signal: controller.signal,
          }),
          fetch(`/api/inventory/plasma?hospitalId=${hospitalId}`, {
            credentials: "include",
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
            signal: controller.signal,
          }),
          fetch(`/api/inventory/platelets?hospitalId=${hospitalId}`, {
            credentials: "include",
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
            signal: controller.signal,
          }),
        ])

        // Clear timeout
        clearTimeout(timeoutId)

        // Handle authentication errors
        if (redBloodRes.status === 401 || plasmaRes.status === 401 || plateletsRes.status === 401) {
          throw new Error("Authentication required")
        }

        // Handle other error responses
        if (!redBloodRes.ok || !plasmaRes.ok || !plateletsRes.ok) {
          const errorRes = !redBloodRes.ok ? redBloodRes : !plasmaRes.ok ? plasmaRes : plateletsRes
          const errorData = await errorRes.json().catch(() => ({}))

          throw new Error(
            errorData.message || errorData.error || `Error ${errorRes.status}: Failed to fetch inventory data`,
          )
        }

        // Parse response data
        const [redBloodData, plasmaData, plateletsData] = await Promise.all([
          redBloodRes.json(),
          plasmaRes.json(),
          plateletsRes.json(),
        ])

        // Update state with new data
        setInventoryData({
          redBlood: redBloodData,
          plasma: plasmaData,
          platelets: plateletsData,
        })

        // Reset error state and update last updated time
        setFetchStatus({
          loading: false,
          error: null,
          lastUpdated: new Date(),
          retryCount: 0,
        })
      } catch (err) {
        console.error("Error fetching inventory data:", err)

        // Determine if we should retry
        const shouldRetry = retryOnError && fetchStatus.retryCount < 3

        // Update error state
        setFetchStatus((prev) => ({
          loading: false,
          error: err instanceof Error ? err.message : "Failed to refresh inventory data",
          lastUpdated: prev.lastUpdated,
          retryCount: prev.retryCount + (retryOnError ? 1 : 0),
        }))

        // Retry after delay if needed
        if (shouldRetry) {
          const retryDelay = Math.min(2000 * (fetchStatus.retryCount + 1), 10000)
          setTimeout(() => fetchInventoryData(true), retryDelay)
        }
      }
    },
    [hospitalId, isPreview, fetchStatus.retryCount],
  )

  // Set up interval for periodic updates
  useEffect(() => {
    // Skip in preview mode
    if (isPreview) return

    // Fetch data immediately on mount
    fetchInventoryData(true)

    // Set up interval for periodic updates
    const intervalId = setInterval(() => fetchInventoryData(true), refreshInterval)

    // Clean up interval on component unmount
    return () => clearInterval(intervalId)
  }, [fetchInventoryData, refreshInterval, isPreview])

  // Render component
  return (
    <div className={`relative ${className}`}>
      {/* Loading indicator */}
      {fetchStatus.loading && (
        <div className="absolute top-2 right-2">
          <div className="animate-pulse h-2 w-2 rounded-full bg-blue-500"></div>
        </div>
      )}

      {/* Last updated indicator */}
      {fetchStatus.lastUpdated && !fetchStatus.error && (
        <div className="absolute top-2 left-2 text-xs text-gray-500">
          Updated: {fetchStatus.lastUpdated.toLocaleTimeString()}
        </div>
      )}

      {/* Error message */}
      {fetchStatus.error && (
        <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-700 mb-4">
          <p className="font-medium">{fetchStatus.error}</p>
          <p className="text-sm mt-1">Using last available data</p>
          <button
            onClick={() => fetchInventoryData(false)}
            className="text-sm mt-2 text-red-600 hover:text-red-800 underline"
          >
            Retry now
          </button>
        </div>
      )}

      {/* Inventory warnings */}
      <BloodInventoryWarnings
        redBlood={inventoryData.redBlood}
        plasma={inventoryData.plasma}
        platelets={inventoryData.platelets}
      />
    </div>
  )
}
