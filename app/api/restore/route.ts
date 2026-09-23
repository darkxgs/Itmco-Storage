import { NextResponse } from "next/server"
import { RESTORABLE_TABLES, errorResponse, getAdminClient, requireAppUser, HttpError } from "@/lib/supabase-admin"

const CHUNK_SIZE = 500

// Adds rows from a backup file that are missing from the database. Existing rows (same id)
// are left untouched, so running a restore twice is harmless.
export async function POST(request: Request) {
  try {
    const caller = await requireAppUser(request, ["admin"])
    const backupData = await request.json().catch(() => null)

    if (!backupData?.metadata || !backupData?.data || typeof backupData.data !== "object") {
      throw new HttpError(400, "Invalid backup file format")
    }

    const admin = getAdminClient()
    const results: any = {
      restored: {},
      skipped: [] as string[],
      errors: {},
      summary: { totalTables: 0, successfulTables: 0, failedTables: 0, totalRecords: 0, restoredRecords: 0 },
    }

    // Only known tables, parents first (see BACKUP_TABLES)
    for (const tableName of Object.keys(backupData.data)) {
      if (!RESTORABLE_TABLES.includes(tableName)) results.skipped.push(tableName)
    }
    const tables = RESTORABLE_TABLES.filter((t) => Array.isArray(backupData.data[t]))

    for (const tableName of tables) {
      const rows: any[] = backupData.data[tableName]
      results.summary.totalTables++
      results.summary.totalRecords += rows.length

      try {
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const { error } = await admin
            .from(tableName)
            .upsert(rows.slice(i, i + CHUNK_SIZE), { onConflict: "id", ignoreDuplicates: true })
          if (error) throw error
        }
        results.restored[tableName] = { records: rows.length, status: "success" }
        results.summary.successfulTables++
        results.summary.restoredRecords += rows.length
      } catch (error: any) {
        results.errors[tableName] = { error: error.message, records: rows.length }
        results.summary.failedTables++
      }
    }

    // Rows came back with their original ids; move each id sequence past them so new
    // inserts don't collide. Function is created by the security migration.
    const { error: sequenceError } = await admin.rpc("reset_id_sequences")
    if (sequenceError) console.error("reset_id_sequences failed:", sequenceError)

    await admin.from("activity_logs").insert({
      user_id: caller.id,
      user_name: caller.name,
      action: "استعادة نسخة احتياطية",
      module: "النظام",
      details: `استعادة ${results.summary.successfulTables}/${results.summary.totalTables} جداول`,
    })

    return NextResponse.json({
      success: results.summary.failedTables === 0,
      message: `Restoration completed. ${results.summary.successfulTables}/${results.summary.totalTables} tables restored successfully.`,
      results,
      metadata: {
        restoredAt: new Date().toISOString(),
        originalBackup: backupData.metadata,
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
