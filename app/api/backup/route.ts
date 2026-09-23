import { NextResponse } from "next/server"
import { errorResponse, getAdminClient, requireAppUser, HttpError } from "@/lib/supabase-admin"
import { backupDownloadUrl, listBackups, storeBackup } from "@/lib/auto-backup"

export const dynamic = "force-dynamic"

// GET               → stored backups (newest first)
// GET ?download=... → short-lived download link for one of them
export async function GET(request: Request) {
  try {
    await requireAppUser(request, ["admin"])
    const download = new URL(request.url).searchParams.get("download")

    if (download) {
      return NextResponse.json({ url: await backupDownloadUrl(download) })
    }
    return NextResponse.json({ backups: await listBackups() })
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid backup name") {
      return errorResponse(new HttpError(400, error.message))
    }
    return errorResponse(error)
  }
}

// POST → take a full backup now, keep it in storage, and return a download link
export async function POST(request: Request) {
  try {
    const caller = await requireAppUser(request, ["admin"])
    const stored = await storeBackup("manual")

    await getAdminClient().from("activity_logs").insert({
      user_id: caller.id,
      user_name: caller.name,
      action: "نسخ احتياطي يدوي",
      module: "النظام",
      details: `تم إنشاء نسخة احتياطية يدوية - ${Object.values(stored.recordCounts).reduce((a, b) => a + b, 0)} سجل`,
    })

    return NextResponse.json({ ...stored, url: await backupDownloadUrl(stored.name) })
  } catch (error) {
    return errorResponse(error)
  }
}
