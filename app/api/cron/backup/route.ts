import { NextRequest, NextResponse } from "next/server"
import { deleteOldBackups, storeBackup, RETENTION_DAYS } from "@/lib/auto-backup"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Daily full backup, scheduled in vercel.json. Keeps RETENTION_DAYS days of backups.
export async function GET(request: NextRequest) {
  try {
    // Vercel Cron sends "Authorization: Bearer $CRON_SECRET"; secrets in the URL end up in logs
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const stored = await storeBackup('auto')
    const removed = await deleteOldBackups()

    return NextResponse.json({
      success: true,
      backup: stored.name,
      size: stored.size,
      recordCounts: stored.recordCounts,
      removedOlderThanDays: RETENTION_DAYS,
      removed,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Cron backup error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Cron backup failed',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
