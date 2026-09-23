import { NextResponse } from "next/server"
import {
  BACKUP_TABLES,
  USERS_BACKUP_COLUMNS,
  errorResponse,
  fetchAllAdmin,
  getAdminClient,
  requireAppUser,
  HttpError,
} from "@/lib/supabase-admin"

async function buildBackup(tables: readonly string[], type: string) {
  const backupData: any = {
    metadata: {
      timestamp: new Date().toISOString(),
      version: "3.0",
      system: "ITMCO Inventory Management",
      type,
      tables,
      recordCounts: {},
      backupId: `${type}_${Date.now()}`,
    },
    data: {},
  }

  // Keep BACKUP_TABLES order so the file restores parents before children
  for (const table of BACKUP_TABLES.filter((t) => tables.includes(t))) {
    try {
      const rows = await fetchAllAdmin(table, table === "users" ? USERS_BACKUP_COLUMNS : "*")
      backupData.data[table] = rows
      backupData.metadata.recordCounts[table] = rows.length
    } catch (error: any) {
      // Optional tables (e.g. release_items) may not exist in every database
      if (error?.code === "42P01" || error?.code === "PGRST205") continue
      throw new Error(`Failed to backup table ${table}: ${error.message}`)
    }
  }
  return backupData
}

export async function GET(request: Request) {
  try {
    await requireAppUser(request, ["admin"])
    const backupData = await buildBackup(BACKUP_TABLES, "full")

    return NextResponse.json(backupData, {
      headers: {
        "Content-Disposition": `attachment; filename="itmco-backup-${new Date().toISOString().split("T")[0]}.json"`,
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const caller = await requireAppUser(request, ["admin"])
    const body = await request.json().catch(() => ({}))
    const type = body.type === "partial" ? "partial" : "full"
    const tables: string[] = Array.isArray(body.tables) && body.tables.length > 0 ? body.tables : [...BACKUP_TABLES]

    const invalidTables = tables.filter((table) => !(BACKUP_TABLES as readonly string[]).includes(table))
    if (invalidTables.length > 0) {
      throw new HttpError(400, `Invalid table names: ${invalidTables.join(", ")}`)
    }

    const backupData = await buildBackup(tables, type)
    const admin = getAdminClient()

    await admin.from("activity_logs").insert({
      user_id: caller.id,
      user_name: caller.name,
      action: "نسخ احتياطي يدوي",
      module: "النظام",
      details: `تم إنشاء نسخة احتياطية يدوية - ${Object.keys(backupData.data).length} جداول`,
    })

    // backup_history is optional; don't fail the download if it's missing
    await admin.from("backup_history").insert({
      backup_id: backupData.metadata.backupId,
      timestamp: backupData.metadata.timestamp,
      type: "manual",
      record_counts: backupData.metadata.recordCounts,
      size: JSON.stringify(backupData).length,
      status: "completed",
    })

    return NextResponse.json(backupData)
  } catch (error) {
    return errorResponse(error)
  }
}
