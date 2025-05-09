import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { isPreviewMode } from "@/lib/environment-detection"
import { getPlateletsInventory } from "@/lib/platelets-service"

export async function GET(request: NextRequest) {
  try {
    // Check if we're in preview mode
    if (isPreviewMode()) {
      console.log("Preview mode: Returning mock platelets data from API")
      // Return mock data for preview mode
      const mockInventory = [
        { blood_type: "A", rh: "+", count: 7, total_amount: 3500 },
        { blood_type: "B", rh: "+", count: 5, total_amount: 2500 },
        { blood_type: "O", rh: "+", count: 10, total_amount: 5000 },
        { blood_type: "AB", rh: "+", count: 3, total_amount: 1500 },
        { blood_type: "A", rh: "-", count: 2, total_amount: 1000 },
        { blood_type: "B", rh: "-", count: 1, total_amount: 500 },
        { blood_type: "O", rh: "-", count: 4, total_amount: 2000 },
        { blood_type: "AB", rh: "-", count: 1, total_amount: 500 },
      ]
      return NextResponse.json(mockInventory)
    }

    // Check authentication
    const session = await requireAuth()

    // Get hospitalId from query params or session
    const url = new URL(request.url)
    const hospitalId = url.searchParams.get("hospitalId")
      ? Number.parseInt(url.searchParams.get("hospitalId")!)
      : session.hospitalId

    // Verify the user has access to this hospital's data
    if (hospitalId !== session.hospitalId) {
      return NextResponse.json({ error: "Unauthorized access to hospital data" }, { status: 403 })
    }

    console.log(`API route: Fetching platelets inventory for hospital ${hospitalId}`)

    // Get inventory data using our enhanced service
    const inventory = await getPlateletsInventory(hospitalId)

    // Log the response for debugging
    console.log(`API response for platelets inventory (hospital ${hospitalId}):`, JSON.stringify(inventory, null, 2))

    return NextResponse.json(inventory)
  } catch (error) {
    console.error("Error fetching platelets inventory:", error)
    return NextResponse.json({ error: "Failed to fetch inventory data" }, { status: 500 })
  }
}
