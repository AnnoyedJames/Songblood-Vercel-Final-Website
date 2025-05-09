import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { isPreviewMode } from "@/lib/environment-detection"
import { getRawPlateletsInventory, addTestPlateletEntry } from "@/lib/platelets-service"

export async function GET(request: NextRequest) {
  try {
    // Check if we're in preview mode
    if (isPreviewMode()) {
      const diagnosticData = await getRawPlateletsInventory(1)
      return NextResponse.json(diagnosticData)
    }

    // Check authentication
    const session = await requireAuth()
    const { hospitalId } = session

    // Get diagnostic data
    const diagnosticData = await getRawPlateletsInventory(hospitalId)
    return NextResponse.json(diagnosticData)
  } catch (error) {
    console.error("Error in platelets diagnostics:", error)
    return NextResponse.json({ error: "Failed to get platelets diagnostic data" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if we're in preview mode
    if (isPreviewMode()) {
      const result = await addTestPlateletEntry(1)
      return NextResponse.json(result)
    }

    // Check authentication
    const session = await requireAuth()
    const { hospitalId } = session

    // Add test platelet entry
    const result = await addTestPlateletEntry(hospitalId)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error adding test platelet entry:", error)
    return NextResponse.json({ error: "Failed to add test platelet entry" }, { status: 500 })
  }
}
