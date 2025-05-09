import { formatBloodType, getBloodTypeColor } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type InventoryItem = {
  blood_type: string
  rh?: string
  count: number
  total_amount: number
}

type InventoryTableProps = {
  title: string
  inventory: InventoryItem[]
  showRh?: boolean
}

export default function InventoryTable({ title, inventory, showRh = false }: InventoryTableProps) {
  console.log(`InventoryTable - Raw ${title} data:`, JSON.stringify(inventory, null, 2))
  console.log(`InventoryTable - ${title} received data:`, JSON.stringify(inventory, null, 2))

  // Ensure inventory data is valid and properly formatted
  const validInventory = inventory
    .map((item, index) => {
      const isValid =
        item &&
        item.blood_type &&
        (typeof item.count === "number" || typeof item.count === "string") &&
        (typeof item.total_amount === "number" || typeof item.total_amount === "string")

      if (!isValid) {
        console.log(`InventoryTable - ${title} invalid item at index ${index}:`, JSON.stringify(item, null, 2))
        console.log(
          `Reasons: blood_type=${!!item?.blood_type}, count=${typeof item?.count}, total_amount=${typeof item?.total_amount}`,
        )
      }

      return { item, isValid }
    })
    .filter(({ isValid }) => isValid)
    .map(({ item }) => ({
      ...item,
      // Ensure count and total_amount are numbers
      count: Number(item.count),
      total_amount: Number(item.total_amount),
      // Ensure rh is a string if it exists
      rh: item.rh !== undefined ? String(item.rh) : undefined,
    }))

  console.log(`InventoryTable - ${title} valid data:`, JSON.stringify(validInventory, null, 2))
  console.log(`InventoryTable - ${title} before sorting:`, JSON.stringify(validInventory, null, 2))

  // Sort inventory by blood type (A, B, AB, O) and then by Rh factor (+ then -)
  const sortedInventory = [...validInventory].sort((a, b) => {
    // First sort by blood type
    if (a.blood_type !== b.blood_type) {
      // Custom sort order: O, A, B, AB
      const typeOrder = { O: 1, A: 2, B: 3, AB: 4 }
      const aOrder = typeOrder[a.blood_type as keyof typeof typeOrder] || 99
      const bOrder = typeOrder[b.blood_type as keyof typeof typeOrder] || 99
      console.log(`Sorting ${a.blood_type} (${aOrder}) vs ${b.blood_type} (${bOrder})`)
      return aOrder - bOrder
    }

    // Then sort by Rh factor if blood types are the same
    if (showRh && a.rh && b.rh) {
      // + comes before -
      console.log(`Sorting same blood type ${a.blood_type}, comparing Rh: ${a.rh} vs ${b.rh}`)
      return a.rh === "+" ? -1 : 1
    }

    return 0
  })

  console.log(`InventoryTable - ${title} sorted data:`, JSON.stringify(sortedInventory, null, 2))

  // Calculate total units and amount
  const totalUnits = sortedInventory.reduce((sum, item) => sum + item.count, 0)
  const totalAmount = sortedInventory.reduce((sum, item) => sum + item.total_amount, 0)

  console.log(`InventoryTable - ${title} calculated totals:`, { units: totalUnits, amount: totalAmount })

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h3 className="text-lg font-medium">{title}</h3>
        <div className="text-sm text-muted-foreground">
          Total: {totalUnits} units ({totalAmount.toLocaleString()} ml)
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Blood Type</TableHead>
            <TableHead className="text-right">Units</TableHead>
            <TableHead className="text-right">Total Amount (ml)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedInventory.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                No inventory data available
              </TableCell>
            </TableRow>
          ) : (
            sortedInventory.map((item, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Badge className={getBloodTypeColor(item.blood_type, item.rh)}>
                    {formatBloodType(item.blood_type, showRh ? item.rh : undefined)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{Number(item.count).toLocaleString()}</TableCell>
                <TableCell className="text-right">{Number(item.total_amount).toLocaleString()} ml</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
