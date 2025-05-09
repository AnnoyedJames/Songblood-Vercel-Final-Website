import { requireAuth } from "@/lib/auth"
import { isPreviewMode } from "@/lib/environment-detection"
import Header from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getRawPlateletsInventory, getPlateletsInventory } from "@/lib/platelets-service"
import AddTestEntryButton from "./add-test-entry-button"

export const dynamic = "force-dynamic"

export default async function PlateletsDiagnosticsPage() {
  // Handle preview mode
  if (isPreviewMode()) {
    const rawData = await getRawPlateletsInventory(1)
    const groupedData = await getPlateletsInventory(1)

    return (
      <div className="min-h-screen flex flex-col">
        <Header hospitalId={1} />
        <main className="flex-1 container py-6 px-4 md:py-8">
          <h1 className="text-2xl font-bold mb-6">Platelets Inventory Diagnostics (Preview Mode)</h1>
          <DiagnosticsContent rawData={rawData.data} groupedData={groupedData} />
        </main>
      </div>
    )
  }

  // For non-preview mode, handle authentication
  const session = await requireAuth()
  const { hospitalId } = session

  // Get diagnostic data
  const rawData = await getRawPlateletsInventory(hospitalId)
  const groupedData = await getPlateletsInventory(hospitalId)

  return (
    <div className="min-h-screen flex flex-col">
      <Header hospitalId={hospitalId} />
      <main className="flex-1 container py-6 px-4 md:py-8">
        <h1 className="text-2xl font-bold mb-6">Platelets Inventory Diagnostics</h1>
        <DiagnosticsContent rawData={rawData.data} groupedData={groupedData} />
      </main>
    </div>
  )
}

function DiagnosticsContent({ rawData, groupedData }: { rawData: any; groupedData: any }) {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Platelets Inventory Analysis</h2>
        <AddTestEntryButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Grouped Platelets Data (Used in Dashboard)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Blood Type</TableHead>
                  <TableHead>Rh</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Total Amount (ml)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!groupedData || groupedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      No grouped data found
                    </TableCell>
                  </TableRow>
                ) : (
                  groupedData.map((item: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell>{item.blood_type}</TableCell>
                      <TableCell>{item.rh}</TableCell>
                      <TableCell className="text-right">{item.count}</TableCell>
                      <TableCell className="text-right">{item.total_amount}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Raw Platelets Inventory Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bag ID</TableHead>
                  <TableHead>Blood Type</TableHead>
                  <TableHead>Rh</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Expiration Date</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!rawData || rawData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      No raw inventory data found
                    </TableCell>
                  </TableRow>
                ) : (
                  rawData.map((item: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell>{item.bag_id}</TableCell>
                      <TableCell>{item.blood_type}</TableCell>
                      <TableCell>{item.rh}</TableCell>
                      <TableCell>{item.amount}</TableCell>
                      <TableCell>{new Date(item.expiration_date).toLocaleDateString()}</TableCell>
                      <TableCell>{item.active ? "Yes" : "No"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Summary:</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Total raw entries: {rawData ? rawData.length : 0}</li>
                <li>Total blood types in grouped data: {groupedData ? groupedData.length : 0}</li>
                <li>
                  Total units in grouped data:{" "}
                  {groupedData ? groupedData.reduce((sum: number, item: any) => sum + Number(item.count), 0) : 0}
                </li>
                <li>
                  Total amount in grouped data:{" "}
                  {groupedData ? groupedData.reduce((sum: number, item: any) => sum + Number(item.total_amount), 0) : 0}{" "}
                  ml
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium mb-2">Blood Type Distribution:</h3>
              <ul className="list-disc pl-5 space-y-1">
                {groupedData &&
                  groupedData.map((item: any, index: number) => (
                    <li key={index}>
                      {item.blood_type} {item.rh}: {item.count} units ({item.total_amount} ml)
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
