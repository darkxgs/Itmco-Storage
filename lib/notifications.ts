import { supabase } from "./supabase"

export interface Notification {
  id: string
  title: string
  message: string
  type: "info" | "warning" | "error" | "success"
  priority: "low" | "medium" | "high"
  read: boolean
  user_id: string
  created_at: string
  action_url?: string
}

export async function createNotification(notification: Omit<Notification, "id" | "created_at" | "read">) {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .insert({
        ...notification,
        read: false,
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error("Error creating notification:", error)
    throw error
  }
}

export async function getUserNotifications(userId: string, limit = 50) {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error("Error fetching notifications:", error)
    throw error
  }
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", notificationId)

    if (error) throw error
  } catch (error) {
    console.error("Error marking notification as read:", error)
    throw error
  }
}

export async function markAllNotificationsAsRead(userId: string) {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false)

    if (error) throw error
  } catch (error) {
    console.error("Error marking all notifications as read:", error)
    throw error
  }
}

// Auto-generate notifications for low stock
export async function checkLowStockAndNotify() {
  try {
    const { data: products } = await supabase
      .from("products")
      .select("id, name, stock, min_stock")
      .lte("stock", supabase.sql`min_stock`)
      .gt("stock", 0)

    if (!products || products.length === 0) return

    // Get admin users to notify
    const { data: admins } = await supabase
      .from("users")
      .select("id")
      .in("role", ["admin", "inventory_manager"])
      .eq("is_active", true)

    if (!admins || admins.length === 0) return

    // Create notifications for each admin
    const notifications = admins.flatMap((admin) =>
      products.map((product) => ({
        title: "تنبيه مخزون منخفض",
        message: `المنتج "${product.name}" وصل إلى الحد الأدنى للمخزون (${product.stock} متبقي)`,
        type: "warning" as const,
        priority: "medium" as const,
        user_id: admin.id,
        action_url: `/inventory?search=${encodeURIComponent(product.name)}`,
      })),
    )

    await Promise.all(notifications.map((notification) => createNotification(notification)))

    return notifications.length
  } catch (error) {
    console.error("Error checking low stock:", error)
    throw error
  }
}
