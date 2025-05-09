import { NextResponse } from "next/server"
import { dbClient } from "@/lib/db"
import { isPreviewMode } from "@/lib/environment-detection"

export async function GET() {
  try {
    // In preview mode, return mock data
    if (isPreviewMode()) {
      return NextResponse.json({
        message: "Preview mode - returning mock data",
        mockData: [
          { blood_type: "A", count: 12, total_amount: 6000 },
          { blood_type: "B", count: 9, total_amount: 4500 },
          { blood_type: "O", count: 18, total_amount: 9000 },
          { blood_type: "AB", count: 6, total_amount: 3000 },
        ],
      })
    }

    // Check if database client is initialized
    if (!dbClient) {
      return NextResponse.json({ error: "Database client not initialized" }, { status: 500 })
    }

    // Get all plasma entries without grouping
    const allPlasmaEntries = await dbClient`
      SELECT 
        bag_id,
        blood_type, 
        amount,
        expiration_date,
        active,
        hospital_id
      FROM plasma_inventory
      ORDER BY blood_type, expiration_date
    `

    // Get grouped plasma data
    const groupedPlasma = await dbClient`
      SELECT 
        blood_type, 
        COUNT(*)::integer as count, 
        SUM(amount)::integer as total_amount
      FROM plasma_inventory
      WHERE expiration_date > CURRENT_DATE AND active = true
      GROUP BY blood_type
      ORDER BY blood_type
    `

    // Get plasma data by hospital
    const plasmaByHospital = await dbClient`
      SELECT 
        hospital_id,
        blood_type, 
        COUNT(*)::integer as count
      FROM plasma_inventory
      WHERE expiration_date > CURRENT_DATE AND active = true
      GROUP BY hospital_id, blood_type
      ORDER BY hospital_id, blood_type
    `

    // Get expired plasma entries
    const expiredPlasma = await dbClient`
      SELECT 
        blood_type, 
        COUNT(*)::integer as count
      FROM plasma_inventory
      WHERE expiration_date <= CURRENT_DATE AND active = true
      GROUP BY blood_type
      ORDER BY blood_type
    `

    // Get inactive plasma entries
    const inactivePlasma = await dbClient`
      SELECT 
        blood_type, 
        COUNT(*)::integer as count
      FROM plasma_inventory
      WHERE active = false
      GROUP BY blood_type
      ORDER BY blood_type
    `

    return NextResponse.json({
      totalEntries: allPlasmaEntries.length,
      sampleEntries: allPlasmaEntries.slice(0, 5),
      groupedData: groupedPlasma,
      byHospital: plasmaByHospital,
      expired: expiredPlasma,
      inactive: inactivePlasma,
      currentDate: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error in plasma diagnostics:", error)
    return NextResponse.json({ error: "Failed to retrieve plasma diagnostics" }, { status: 500 })
  }
}
