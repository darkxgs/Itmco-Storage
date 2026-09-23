import { supabase } from "./supabase"

// fetch() for this app's own /api routes, carrying the signed-in user's access token
// so the route can verify who is calling (see requireAppUser in lib/supabase-admin.ts).
export async function apiFetch(input: string, init: RequestInit = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (session) headers.set("Authorization", `Bearer ${session.access_token}`)
  return fetch(input, { ...init, headers })
}
