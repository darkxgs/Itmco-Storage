import bcrypt from "bcryptjs"
import { supabase } from "./supabase"

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return await bcrypt.hash(password, saltRounds)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash)
}

export async function authenticateUser(email: string, password: string) {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .eq("is_active", true)
      .single()

    if (error || !user) {
      return { success: false, message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" }
    }

    const isValidPassword = await verifyPassword(password, user.password_hash)

    if (!isValidPassword) {
      return { success: false, message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" }
    }

    // Update last login
    await supabase.from("users").update({ updated_at: new Date().toISOString() }).eq("id", user.id)

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    }
  } catch (error) {
    console.error("Authentication error:", error)
    return { success: false, message: "حدث خطأ في النظام" }
  }
}

export async function logActivity(userId: string, userName: string, action: string, module: string, details: string) {
  try {
    await supabase.from("activity_logs").insert({
      user_id: userId,
      user_name: userName,
      action,
      module,
      details,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error logging activity:", error)
  }
}

// Alias for authenticateUser to match the import in login page
export const loginUser = authenticateUser

// Sign in function for test components
export async function signIn(email: string, password: string) {
  return await authenticateUser(email, password)
}
