import { supabase } from "./supabase"
import { clearUserFromStorage, loadUserFromStorage, saveUserToStorage, type User } from "./utils"

const INVALID_CREDENTIALS = "البريد الإلكتروني أو كلمة المرور غير صحيحة"

// The app profile (name, role) for a Supabase Auth user. Passwords live in Supabase Auth;
// the browser never sees a password hash.
async function loadProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, role, is_active")
    .eq("id", userId)
    .maybeSingle()

  if (error) throw error
  if (!data || !data.is_active) return null
  return { id: data.id, name: data.name, email: data.email, role: data.role }
}

export async function authenticateUser(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error || !data.user) {
      if (error?.status === 429) {
        return { success: false, message: "محاولات كثيرة. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى" }
      }
      return { success: false, message: INVALID_CREDENTIALS }
    }

    const user = await loadProfile(data.user.id)
    if (!user) {
      await supabase.auth.signOut()
      return { success: false, message: "هذا الحساب غير مفعل. تواصل مع مدير النظام" }
    }

    return { success: true, user }
  } catch (error) {
    console.error("Authentication error:", error)
    return { success: false, message: "حدث خطأ في النظام" }
  }
}

// The signed-in user, or null. The localStorage profile is only a display cache:
// without a live Supabase session it is discarded, and the database (RLS) is what
// actually enforces access.
export async function getSessionUser(): Promise<User | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    clearUserFromStorage()
    return null
  }

  try {
    const user = await loadProfile(session.user.id)
    if (!user) {
      await signOut()
      return null
    }
    saveUserToStorage(user)
    return user
  } catch (error) {
    // Network hiccup: keep working from the cached profile of this same session
    console.error("Error refreshing profile:", error)
    const cached = loadUserFromStorage()
    return cached?.id === session.user.id ? cached : null
  }
}

export async function signOut() {
  await supabase.auth.signOut()
  clearUserFromStorage()
}

export async function logActivity(userId: string, userName: string, action: string, module: string, details: string) {
  try {
    await supabase.from("activity_logs").insert({
      user_id: userId,
      user_name: userName,
      action,
      module,
      details,
    })
  } catch (error) {
    console.error("Error logging activity:", error)
  }
}

// Alias for authenticateUser to match the import in login page
export const loginUser = authenticateUser
