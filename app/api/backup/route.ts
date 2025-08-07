import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { createSecurityMiddleware, SecurityError } from "@/lib/security"
import { logActivity } from "@/lib/auth"

export async function GET() {
  try {
    // Get all data for backup
    const [users, products, issuances, activityLogs] = await Promise.all([
      supabase.from("users").select("*").order("created_at", { ascending: true }),
      supabase.from("products").select("*").order("created_at", { ascending: true }),
      supabase.from("issuances").select("*").order("created_at", { ascending: true }),
      supabase.from("activity_logs").select("*").order("created_at", { ascending: true }),
    ])

    if (users.error || products.error || issuances.error || activityLogs.error) {
      throw new Error("Failed to fetch data for backup")
    }

    const backupData = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: "1.0",
        system: "ITMCO Inventory Management",
        tables: ["users", "products", "issuances", "activity_logs"],
        recordCounts: {
          users: users.data?.length || 0,
          products: products.data?.length || 0,
          issuances: issuances.data?.length || 0,
          activity_logs: activityLogs.data?.length || 0,
        },
      },
      data: {
        users: users.data,
        products: products.data,
        issuances: issuances.data,
        activity_logs: activityLogs.data,
      },
    }

    return NextResponse.json(backupData, {
      headers: {
        "Content-Disposition": `attachment; filename="itmco-backup-${new Date().toISOString().split("T")[0]}.json"`,
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error("Backup error:", error)
    return NextResponse.json(
      {
        error: "Backup failed",
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    // Apply security middleware
    const securityMiddleware = createSecurityMiddleware()
    const secureRequest = await securityMiddleware(request as any)
    
    const { type = "full", tables = ["users", "products", "issuances", "activity_logs", "security_logs"] } = await secureRequest.json()

    // Validate table names (whitelist approach)
    const allowedTables = ["users", "products", "issuances", "activity_logs", "security_logs", "backup_history"]
    const invalidTables = tables.filter((table: string) => !allowedTables.includes(table))
    
    if (invalidTables.length > 0) {
      throw new SecurityError(`Invalid table names: ${invalidTables.join(', ')}`, 'INVALID_INPUT')
    }

    const backupData: any = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: "2.0",
        system: "ITMCO Inventory Management",
        type,
        tables,
        backupId: `manual_${Date.now()}`
      },
      data: {},
    }

    // Fetch data based on requested tables
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: true })

      if (error) {
        throw new Error(`Failed to backup table: ${table}`)
      }

      backupData.data[table] = data
      backupData.metadata.recordCounts = {
        ...backupData.metadata.recordCounts,
        [table]: data?.length || 0,
      }
    }

    // Log backup activity
    await logActivity(
      'system',
      'نظام النسخ الاحتياطي',
      'نسخ احتياطي يدوي',
      'النظام',
      `تم إنشاء نسخة احتياطية يدوية - ${tables.length} جداول`
    )

    // Store backup metadata
    await supabase.from('backup_history').insert({
      backup_id: backupData.metadata.backupId,
      timestamp: backupData.metadata.timestamp,
      type: 'manual',
      record_counts: backupData.metadata.recordCounts,
      size: JSON.stringify(backupData).length,
      status: 'completed'
    })

    return NextResponse.json(backupData)
  } catch (error) {
    console.error("Custom backup error:", error)
    
    if (error instanceof SecurityError) {
      return NextResponse.json(
        {
          error: "Security violation",
          message: error.message,
          type: error.type,
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      {
        error: "Custom backup failed",
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
