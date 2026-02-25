import { supabase } from "./supabase"
import { logActivity } from "./auth"

export interface BackupConfig {
  autoBackupEnabled: boolean
  backupFrequency: 'hourly' | 'daily' | 'weekly'
  backupRetentionDays: number
  lastBackupAt?: string
  nextBackupAt?: string
}

export interface BackupResult {
  success: boolean
  backupId?: string
  timestamp: string
  recordCounts: Record<string, number>
  size: number
  error?: string
}

// Get backup configuration from database
export async function getBackupConfig(): Promise<BackupConfig> {
  try {
    const { data, error } = await supabase
      .from('backup_config')
      .select('*')
      .single()

    if (error) {
      // Return default config if no config exists
      return {
        autoBackupEnabled: true,
        backupFrequency: 'daily',
        backupRetentionDays: 30
      }
    }

    return {
      autoBackupEnabled: data.auto_backup_enabled,
      backupFrequency: data.backup_frequency,
      backupRetentionDays: data.backup_retention_days,
      lastBackupAt: data.last_backup_at,
      nextBackupAt: data.next_backup_at
    }
  } catch (error) {
    console.error('Error getting backup config:', error)
    return {
      autoBackupEnabled: true,
      backupFrequency: 'daily',
      backupRetentionDays: 30
    }
  }
}

// Update backup configuration
export async function updateBackupConfig(config: Partial<BackupConfig>): Promise<void> {
  try {
    const { error } = await supabase
      .from('backup_config')
      .update({
        auto_backup_enabled: config.autoBackupEnabled,
        backup_frequency: config.backupFrequency,
        backup_retention_days: config.backupRetentionDays,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1)

    if (error) throw error
  } catch (error) {
    console.error('Error updating backup config:', error)
    throw error
  }
}

// Create a comprehensive backup
export async function createAutoBackup(): Promise<BackupResult> {
  const timestamp = new Date().toISOString()
  
  try {
    // Get all data for backup
    const [users, products, issuances, activityLogs, securityLogs] = await Promise.all([
      supabase.from("users").select("*").order("created_at", { ascending: true }),
      supabase.from("products").select("*").order("created_at", { ascending: true }),
      supabase.from("issuances").select("*").order("created_at", { ascending: true }),
      supabase.from("activity_logs").select("*").order("created_at", { ascending: true }),
      supabase.from("security_logs").select("*").order("created_at", { ascending: true })
    ])

    if (users.error || products.error || issuances.error || activityLogs.error) {
      throw new Error("Failed to fetch data for backup")
    }

    const recordCounts = {
      users: users.data?.length || 0,
      products: products.data?.length || 0,
      issuances: issuances.data?.length || 0,
      activity_logs: activityLogs.data?.length || 0,
      security_logs: securityLogs.data?.length || 0
    }

    const backupData = {
      metadata: {
        timestamp,
        version: "2.0",
        system: "ITMCO Inventory Management",
        type: "auto",
        tables: ["users", "products", "issuances", "activity_logs", "security_logs"],
        recordCounts,
        backupId: `auto_${Date.now()}`
      },
      data: {
        users: users.data,
        products: products.data,
        issuances: issuances.data,
        activity_logs: activityLogs.data,
        security_logs: securityLogs.data
      }
    }

    // Calculate backup size
    const backupJson = JSON.stringify(backupData)
    const size = new Blob([backupJson]).size

    // Store backup metadata in database (in production, you'd store the actual backup in cloud storage)
    await supabase.from('backup_history').insert({
      backup_id: backupData.metadata.backupId,
      timestamp,
      type: 'auto',
      record_counts: recordCounts,
      size,
      status: 'completed'
    })

    // Update backup config with last backup time
    const config = await getBackupConfig()
    const nextBackupTime = calculateNextBackupTime(config.backupFrequency)
    
    await supabase
      .from('backup_config')
      .update({
        last_backup_at: timestamp,
        next_backup_at: nextBackupTime,
        updated_at: timestamp
      })
      .eq('id', 1)

    // Log the backup activity
    await logActivity(
      'system',
      'نظام النسخ الاحتياطي',
      'نسخ احتياطي تلقائي',
      'النظام',
      `تم إنشاء نسخة احتياطية تلقائية - ${Object.values(recordCounts).reduce((a, b) => a + b, 0)} سجل`
    )

    return {
      success: true,
      backupId: backupData.metadata.backupId,
      timestamp,
      recordCounts,
      size
    }
  } catch (error) {
    console.error('Auto backup failed:', error)
    
    // Log the failure
    await logActivity(
      'system',
      'نظام النسخ الاحتياطي',
      'فشل النسخ الاحتياطي',
      'النظام',
      `فشل في إنشاء النسخة الاحتياطية التلقائية: ${error.message}`
    )

    return {
      success: false,
      timestamp,
      recordCounts: {},
      size: 0,
      error: error.message
    }
  }
}

// Calculate next backup time based on frequency
function calculateNextBackupTime(frequency: 'hourly' | 'daily' | 'weekly'): string {
  const now = new Date()
  
  switch (frequency) {
    case 'hourly':
      now.setHours(now.getHours() + 1)
      break
    case 'daily':
      now.setDate(now.getDate() + 1)
      break
    case 'weekly':
      now.setDate(now.getDate() + 7)
      break
  }
  
  return now.toISOString()
}

// Check if backup is due
export async function isBackupDue(): Promise<boolean> {
  try {
    const config = await getBackupConfig()
    
    if (!config.autoBackupEnabled) {
      return false
    }
    
    if (!config.nextBackupAt) {
      return true // No backup scheduled, create one
    }
    
    const nextBackup = new Date(config.nextBackupAt)
    const now = new Date()
    
    return now >= nextBackup
  } catch (error) {
    console.error('Error checking backup due:', error)
    return false
  }
}

// Clean up old backups based on retention policy
export async function cleanupOldBackups(): Promise<void> {
  try {
    const config = await getBackupConfig()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - config.backupRetentionDays)
    
    const { error } = await supabase
      .from('backup_history')
      .delete()
      .lt('timestamp', cutoffDate.toISOString())
    
    if (error) {
      console.error('Error cleaning up old backups:', error)
    }
  } catch (error) {
    console.error('Error in cleanup process:', error)
  }
}

// Initialize backup system
export async function initializeBackupSystem(): Promise<void> {
  try {
    // Create backup_history table if it doesn't exist
    await supabase.rpc('create_backup_history_table')
    
    // Schedule initial backup if needed
    if (await isBackupDue()) {
      await createAutoBackup()
    }
    
    // Clean up old backups
    await cleanupOldBackups()
  } catch (error) {
    console.error('Error initializing backup system:', error)
  }
}

// Get backup history
export async function getBackupHistory(limit: number = 10): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('backup_history')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    
    return data || []
  } catch (error) {
    console.error('Error getting backup history:', error)
    return []
  }
}