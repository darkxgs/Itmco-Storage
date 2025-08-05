import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(request: Request) {
  try {
    const backupData = await request.json()

    // Validate backup data structure
    if (!backupData.metadata || !backupData.data) {
      throw new Error("Invalid backup file format")
    }

    const { metadata, data } = backupData
    const results = {
      restored: {},
      errors: {},
      summary: {
        totalTables: 0,
        successfulTables: 0,
        failedTables: 0,
        totalRecords: 0,
        restoredRecords: 0,
      },
    }

    // Process each table
    for (const [tableName, tableData] of Object.entries(data)) {
      results.summary.totalTables++
      results.summary.totalRecords += (tableData as any[]).length

      try {
        // Clear existing data (optional - be careful!)
        // await supabase.from(tableName).delete().neq('id', '')

        // Insert backup data
        if ((tableData as any[]).length > 0) {
          const { data: insertedData, error } = await supabase.from(tableName).insert(tableData as any[])

          if (error) {
            throw error
          }

          results.restored[tableName] = {
            records: (tableData as any[]).length,
            status: "success",
          }
          results.summary.successfulTables++
          results.summary.restoredRecords += (tableData as any[]).length
        }
      } catch (error) {
        results.errors[tableName] = {
          error: error.message,
          records: (tableData as any[]).length,
        }
        results.summary.failedTables++
      }
    }

    return NextResponse.json({
      success: results.summary.failedTables === 0,
      message: `Restoration completed. ${results.summary.successfulTables}/${results.summary.totalTables} tables restored successfully.`,
      results,
      metadata: {
        restoredAt: new Date().toISOString(),
        originalBackup: metadata,
      },
    })
  } catch (error) {
    console.error("Restore error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Restoration failed",
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
