// Server-only (API routes): full backups kept as gzipped JSON in a private Supabase
// Storage bucket. The daily Vercel cron (/api/cron/backup) and the backup page both
// create them here; files are downloaded through short-lived signed URLs, so their
// size isn't limited by Vercel's ~4.5 MB response cap.
import { gzipSync } from "node:zlib"
import { BACKUP_TABLES, USERS_BACKUP_COLUMNS, fetchAllAdmin, getAdminClient } from "./supabase-admin"

const BUCKET = "backups"
export const RETENTION_DAYS = 30
const FILE_NAME = /^itmco-backup-[0-9TZ-]+-(auto|manual)\.json\.gz$/

export interface StoredBackup {
  name: string
  size: number
  createdAt: string
  type: "auto" | "manual"
}

export async function buildBackup(type: "auto" | "manual") {
  const backup: any = {
    metadata: {
      timestamp: new Date().toISOString(),
      version: "3.0",
      system: "ITMCO Inventory Management",
      type,
      tables: [] as string[],
      recordCounts: {} as Record<string, number>,
    },
    data: {},
  }

  // BACKUP_TABLES order: parents before children, so a restore satisfies foreign keys
  for (const table of BACKUP_TABLES) {
    try {
      const rows = await fetchAllAdmin(table, table === "users" ? USERS_BACKUP_COLUMNS : "*")
      backup.data[table] = rows
      backup.metadata.tables.push(table)
      backup.metadata.recordCounts[table] = rows.length
    } catch (error: any) {
      // Optional tables (e.g. release_items) may not exist in every database
      if (error?.code === "42P01" || error?.code === "PGRST205") continue
      throw new Error(`Failed to backup table ${table}: ${error.message}`)
    }
  }
  return backup
}

async function ensureBucket() {
  const storage = getAdminClient().storage
  const { data } = await storage.getBucket(BUCKET)
  if (data) return
  const { error } = await storage.createBucket(BUCKET, { public: false })
  if (error && !/already exists/i.test(error.message)) throw error
}

export async function storeBackup(type: "auto" | "manual") {
  const backup = await buildBackup(type)
  const body = gzipSync(Buffer.from(JSON.stringify(backup)))
  const name = `itmco-backup-${backup.metadata.timestamp.replace(/[:.]/g, "-")}-${type}.json.gz`

  await ensureBucket()
  const { error } = await getAdminClient()
    .storage.from(BUCKET)
    .upload(name, body, { contentType: "application/gzip", upsert: false })
  if (error) throw error

  return { name, size: body.length, recordCounts: backup.metadata.recordCounts as Record<string, number> }
}

export async function listBackups(): Promise<StoredBackup[]> {
  await ensureBucket()
  const { data, error } = await getAdminClient()
    .storage.from(BUCKET)
    .list("", { limit: 1000, sortBy: { column: "name", order: "desc" } })
  if (error) throw error

  return (data || [])
    .filter((file) => FILE_NAME.test(file.name))
    .map((file) => ({
      name: file.name,
      size: Number(file.metadata?.size) || 0,
      createdAt: file.created_at || "",
      type: file.name.endsWith("-auto.json.gz") ? "auto" : "manual",
    }))
}

export async function deleteOldBackups(days = RETENTION_DAYS) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const old = (await listBackups()).filter((file) => file.createdAt && new Date(file.createdAt).getTime() < cutoff)
  if (old.length === 0) return 0

  const { error } = await getAdminClient()
    .storage.from(BUCKET)
    .remove(old.map((file) => file.name))
  if (error) throw error
  return old.length
}

export async function backupDownloadUrl(name: string) {
  if (!FILE_NAME.test(name)) throw new Error("Invalid backup name")
  const { data, error } = await getAdminClient()
    .storage.from(BUCKET)
    .createSignedUrl(name, 60, { download: name })
  if (error) throw error
  return data.signedUrl
}
