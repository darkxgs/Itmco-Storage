import { NextRequest, NextResponse } from "next/server"
import { createAutoBackup, isBackupDue, cleanupOldBackups } from "@/lib/auto-backup"

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const cronSecret = request.nextUrl.searchParams.get('secret')
    
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if backup is due
    const isDue = await isBackupDue()
    
    if (!isDue) {
      return NextResponse.json({
        success: true,
        message: 'Backup not due yet',
        timestamp: new Date().toISOString()
      })
    }

    // Create auto backup
    const backupResult = await createAutoBackup()
    
    // Clean up old backups
    await cleanupOldBackups()

    return NextResponse.json({
      success: backupResult.success,
      message: backupResult.success ? 'Auto backup completed successfully' : 'Auto backup failed',
      backupId: backupResult.backupId,
      recordCounts: backupResult.recordCounts,
      size: backupResult.size,
      error: backupResult.error,
      timestamp: backupResult.timestamp
    })
  } catch (error) {
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

export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}