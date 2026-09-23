import { NextResponse } from "next/server"
import { getAdminClient, requireAppUser, errorResponse, HttpError, type AppRole } from "@/lib/supabase-admin"
import { validateEmail, validatePassword } from "@/lib/validation"

// User accounts live in two places that must stay in sync: Supabase Auth (email +
// password) and public.users (name, role, active flag), sharing the same id.
// Both are written here with the service role, after checking the caller is an admin.

const ROLES: AppRole[] = ["admin", "inventory_manager", "engineer"]
const USER_COLUMNS = "id, name, email, role, is_active, created_at, updated_at"
// Supabase Auth has no "disabled" flag; a very long ban is the documented equivalent
const BANNED = "876000h"

async function readBody(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new HttpError(400, "Invalid JSON body")
  }
}

function checkFields(body: any, { requirePassword }: { requirePassword: boolean }) {
  if (body.name !== undefined && !String(body.name).trim()) throw new HttpError(400, "يرجى إدخال اسم المستخدم")
  if (body.email !== undefined) {
    const emailError = validateEmail(String(body.email).trim())
    if (emailError) throw new HttpError(400, emailError)
  }
  if (body.role !== undefined && !ROLES.includes(body.role)) throw new HttpError(400, "دور غير صالح")
  if (requirePassword) {
    const passwordError = validatePassword(String(body.password || ""))
    if (passwordError) throw new HttpError(400, passwordError)
  } else if (body.password && String(body.password).length < 6) {
    // Editing keeps the old behaviour (any password the admin chooses), down to
    // Supabase Auth's own minimum of 6 characters
    throw new HttpError(400, "كلمة المرور يجب أن تكون 6 أحرف على الأقل")
  }
}

export async function POST(request: Request) {
  try {
    await requireAppUser(request, ["admin"])
    const body = await readBody(request)
    checkFields(body, { requirePassword: true })
    if (!body.name || !body.email || !body.role) throw new HttpError(400, "بيانات ناقصة")

    const admin = getAdminClient()
    const email = String(body.email).trim().toLowerCase()
    const isActive = body.is_active !== false

    const { data: created, error: authError } = await admin.auth.admin.createUser({
      email,
      password: String(body.password),
      email_confirm: true,
      user_metadata: { name: String(body.name).trim() },
      ...(isActive ? {} : { ban_duration: BANNED }),
    })
    if (authError || !created.user) {
      const exists = authError?.message?.toLowerCase().includes("already")
      throw new HttpError(exists ? 409 : 400, exists ? "البريد الإلكتروني مستخدم بالفعل" : authError?.message || "فشل إنشاء الحساب")
    }

    const { data: profile, error: profileError } = await admin
      .from("users")
      .insert({ id: created.user.id, name: String(body.name).trim(), email, role: body.role, is_active: isActive })
      .select(USER_COLUMNS)
      .single()

    if (profileError) {
      // Don't leave a login with no profile behind
      await admin.auth.admin.deleteUser(created.user.id)
      throw new HttpError(profileError.code === "23505" ? 409 : 400, profileError.code === "23505" ? "البريد الإلكتروني مستخدم بالفعل" : profileError.message)
    }

    return NextResponse.json({ user: profile })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const caller = await requireAppUser(request, ["admin"])
    const body = await readBody(request)
    if (!body.id) throw new HttpError(400, "Missing user id")
    checkFields(body, { requirePassword: false })

    if (body.id === caller.id && ((body.role && body.role !== "admin") || body.is_active === false)) {
      throw new HttpError(400, "لا يمكنك إلغاء صلاحية أو تعطيل حسابك الخاص")
    }

    const admin = getAdminClient()
    const email = body.email !== undefined ? String(body.email).trim().toLowerCase() : undefined

    const authUpdate: Record<string, any> = {}
    if (email) authUpdate.email = email
    if (body.password) authUpdate.password = String(body.password)
    if (body.is_active !== undefined) authUpdate.ban_duration = body.is_active ? "none" : BANNED
    if (Object.keys(authUpdate).length > 0) {
      const { error } = await admin.auth.admin.updateUserById(body.id, authUpdate)
      if (error) {
        const exists = error.message?.toLowerCase().includes("already")
        throw new HttpError(exists ? 409 : 400, exists ? "البريد الإلكتروني مستخدم بالفعل" : error.message)
      }
    }

    const profileUpdate: Record<string, any> = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) profileUpdate.name = String(body.name).trim()
    if (email) profileUpdate.email = email
    if (body.role !== undefined) profileUpdate.role = body.role
    if (body.is_active !== undefined) profileUpdate.is_active = !!body.is_active

    const { data: profile, error } = await admin
      .from("users")
      .update(profileUpdate)
      .eq("id", body.id)
      .select(USER_COLUMNS)
      .single()
    if (error) throw new HttpError(400, error.message)

    return NextResponse.json({ user: profile })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const caller = await requireAppUser(request, ["admin"])
    const id = new URL(request.url).searchParams.get("id")
    if (!id) throw new HttpError(400, "Missing user id")
    if (id === caller.id) throw new HttpError(400, "لا يمكنك حذف حسابك الخاص")

    const admin = getAdminClient()
    // Profile first: if issuances still reference this user the FK stops us here,
    // before the login is removed.
    const { error } = await admin.from("users").delete().eq("id", id)
    if (error) {
      throw new HttpError(
        409,
        error.code === "23503" ? "لا يمكن حذف مستخدم مرتبط بإصدارات أو سجلات. قم بتعطيله بدلاً من ذلك" : error.message,
      )
    }

    const { error: authError } = await admin.auth.admin.deleteUser(id)
    if (authError && authError.status !== 404) throw new HttpError(500, authError.message)

    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}
