// Server-only: holds the service role key, which bypasses RLS. Never import this
// from a "use client" file or anything a client component imports.
import { NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export type AppRole = "admin" | "inventory_manager" | "engineer"

export interface AppUser {
  id: string
  name: string
  email: string
  role: AppRole
}

let adminClient: SupabaseClient | null = null

export function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured")
    }
    adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return adminClient
}

// Every row of a table, paging past the 1000-row response cap (ordered by id)
export async function fetchAllAdmin(table: string, columns = "*"): Promise<any[]> {
  const admin = getAdminClient()
  const rows: any[] = []
  for (let from = 0; ; ) {
    const { data, error } = await admin.from(table).select(columns).order("id").range(from, from + 999)
    if (error) throw error
    if (!data || data.length === 0) return rows
    rows.push(...data)
    from += data.length
  }
}

// Tables included in backups, parents before children so a restore satisfies foreign keys.
// public.users is backed up for reference but not restored: logins live in Supabase Auth.
export const BACKUP_TABLES = [
  "warehouses",
  "categories",
  "customers",
  "branches",
  "users",
  "products",
  "issuances",
  "release_items",
  "stock_entries",
  "user_warehouse_permissions",
  "activity_logs",
] as const

export const RESTORABLE_TABLES: readonly string[] = BACKUP_TABLES.filter((t) => t !== "users")

// Never export password hashes, even to admins
export const USERS_BACKUP_COLUMNS = "id, name, email, role, is_active, created_at, updated_at"

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

// Verifies the caller's Supabase access token (sent by apiFetch as a Bearer header)
// and loads their profile. Throws HttpError(401/403) when they may not proceed.
export async function requireAppUser(request: Request, roles?: AppRole[]): Promise<AppUser> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) throw new HttpError(401, "Not signed in")

  const admin = getAdminClient()
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(token)
  if (error || !user) throw new HttpError(401, "Invalid or expired session")

  const { data: profile } = await admin
    .from("users")
    .select("id, name, email, role, is_active")
    .eq("id", user.id)
    .maybeSingle()
  if (!profile || !profile.is_active) throw new HttpError(403, "Account is not active")
  if (roles && !roles.includes(profile.role)) throw new HttpError(403, "Not allowed")

  return { id: profile.id, name: profile.name, email: profile.email, role: profile.role }
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error(error)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}
