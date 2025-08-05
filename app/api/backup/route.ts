import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

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
    const { type = "full", tables = ["users", "products", "issuances", "activity_logs"] } = await request.json()

    const backupData: any = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: "1.0",
        system: "ITMCO Inventory Management",
        type,
        tables,
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

    return NextResponse.json(backupData)
  } catch (error) {
    console.error("Custom backup error:", error)
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
