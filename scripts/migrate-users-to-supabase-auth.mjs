// One-time migration: copies every row of public.users into Supabase Auth with the
// SAME id and the SAME bcrypt password hash, so everyone keeps their current password
// and every issued_by / user_id reference stays valid.
//
// Needs the service role key (Supabase dashboard → Project Settings → API). Reads
// NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment or .env.local.
//
//   node scripts/migrate-users-to-supabase-auth.mjs --dry-run   (shows what it would do)
//   node scripts/migrate-users-to-supabase-auth.mjs             (does it)
//
// Safe to re-run: users already present in Supabase Auth are skipped.

import fs from "node:fs"
import path from "node:path"

const dryRun = process.argv.includes("--dry-run")

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "")
  }
}
loadEnvFile(path.join(process.cwd(), ".env.local"))

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "")
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (env or .env.local).")
  process.exit(1)
}

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" }

async function fetchUsers() {
  const users = []
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(
      `${url}/rest/v1/users?select=id,email,name,role,is_active,password_hash&order=id&limit=1000&offset=${offset}`,
      { headers },
    )
    if (!res.ok) throw new Error(`Reading public.users failed: ${res.status} ${await res.text()}`)
    const page = await res.json()
    users.push(...page)
    if (page.length < 1000) return users
  }
}

async function authUserExists(id) {
  const res = await fetch(`${url}/auth/v1/admin/users/${id}`, { headers })
  return res.ok
}

const users = await fetchUsers()
console.log(`${users.length} users in public.users${dryRun ? " (dry run, nothing will be written)" : ""}\n`)

const summary = { created: 0, alreadyMigrated: 0, needsAttention: 0 }

for (const user of users) {
  const label = `${user.email} (${user.role}${user.is_active === false ? ", inactive" : ""})`

  if (await authUserExists(user.id)) {
    console.log(`skip     ${label}: already in Supabase Auth`)
    summary.alreadyMigrated++
    continue
  }

  const hasBcryptHash = /^\$2[aby]\$\d{2}\$/.test(user.password_hash || "")
  if (!hasBcryptHash) {
    console.log(`ATTENTION ${label}: no usable password hash; will be created without a password, set one from the users page`)
  }

  if (dryRun) {
    console.log(`would create ${label}`)
    continue
  }

  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: user.id,
      email: String(user.email).trim().toLowerCase(),
      ...(hasBcryptHash ? { password_hash: user.password_hash } : {}),
      email_confirm: true,
      user_metadata: { name: user.name },
      ...(user.is_active === false ? { ban_duration: "876000h" } : {}),
    }),
  })

  if (res.ok) {
    const created = await res.json()
    if (created.id !== user.id) {
      // The app finds the profile by this id; a different one means this person can't log in
      console.log(`ATTENTION ${label}: Supabase Auth assigned id ${created.id} instead of ${user.id}`)
      summary.needsAttention++
      continue
    }
    console.log(`created  ${label}`)
    summary.created++
    if (!hasBcryptHash) summary.needsAttention++
  } else {
    // Most likely: this email already belongs to a different Supabase Auth user
    console.log(`ATTENTION ${label}: ${res.status} ${await res.text()}`)
    summary.needsAttention++
  }
}

console.log(`\ncreated: ${summary.created}, already migrated: ${summary.alreadyMigrated}, needs attention: ${summary.needsAttention}`)
if (summary.needsAttention > 0) process.exitCode = 1
