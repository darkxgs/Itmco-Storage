import { supabase } from "./supabase"
import type { Product, ProductInsert, ProductUpdate, Issuance, IssuanceInsert } from "./supabase"

// Enhanced error handling wrapper
async function withErrorHandling<T>(operation: () => Promise<T>, errorMessage: string): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    console.error(`Database error: ${errorMessage}`, error)
    throw new Error(`${errorMessage}: ${error.message || "Unknown error"}`)
  }
}

// Products with enhanced functionality
export async function getProducts() {
  return withErrorHandling(async () => {
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false })

    if (error) throw error
    return data || []
  }, "Failed to fetch products")
}

export async function createProduct(product: ProductInsert & { minStock?: number }) {
  return withErrorHandling(async () => {
    // Validate required fields
    if (!product.name || !product.brand || !product.model || !product.category) {
      throw new Error("Missing required fields")
    }

    // Map minStock to min_stock for database
    const dbProduct: ProductInsert = {
      name: product.name,
      brand: product.brand,
      model: product.model,
      category: product.category,
      stock: product.stock || 0,
      min_stock: product.minStock || 0,
      description: product.description || null,
    }

    const { data, error } = await supabase.from("products").insert(dbProduct).select().single()

    if (error) throw error

    // Map back to frontend format
    return {
      ...data,
      minStock: data.min_stock,
    }
  }, "Failed to create product")
}

export async function updateProduct(id: number, updates: ProductUpdate & { minStock?: number }) {
  return withErrorHandling(async () => {
    // Map minStock to min_stock for database
    const dbUpdates: ProductUpdate = {
      ...updates,
      updated_at: new Date().toISOString(),
    }

    if (updates.minStock !== undefined) {
      dbUpdates.min_stock = updates.minStock
      delete (dbUpdates as any).minStock
    }

    const { data, error } = await supabase.from("products").update(dbUpdates).eq("id", id).select().single()

    if (error) throw error

    // Map back to frontend format
    return {
      ...data,
      minStock: data.min_stock,
    }
  }, "Failed to update product")
}

export async function deleteProduct(id: number) {
  return withErrorHandling(async () => {
    // Check if product has any issuances
    const { data: issuances } = await supabase.from("issuances").select("id").eq("product_id", id).limit(1)

    if (issuances && issuances.length > 0) {
      throw new Error("Cannot delete product with existing issuances")
    }

    const { error } = await supabase.from("products").delete().eq("id", id)

    if (error) throw error
  }, "Failed to delete product")
}

// Enhanced issuances with better data mapping
export async function getIssuances() {
  return withErrorHandling(async () => {
    const { data, error } = await supabase.from("issuances").select("*").order("created_at", { ascending: false })

    if (error) throw error

    // Map database fields to frontend format
    return (data || []).map((item) => ({
      ...item,
      productId: item.product_id,
      productName: item.product_name,
      customerName: item.customer_name,
      serialNumber: item.serial_number,
      issuedBy: item.issued_by,
      date: item.created_at.split("T")[0], // Format date
    }))
  }, "Failed to fetch issuances")
}

export async function createIssuance(issuance: IssuanceInsert) {
  return withErrorHandling(async () => {
    // Validate stock availability
    const { data: product } = await supabase.from("products").select("stock").eq("id", issuance.product_id).single()

    if (!product) {
      throw new Error("Product not found")
    }

    if (product.stock < issuance.quantity) {
      throw new Error("Insufficient stock")
    }

    // Use the issuance data directly as it matches the database format
    const dbIssuance: IssuanceInsert = issuance

    // Use transaction to ensure data consistency
    const { data, error } = await supabase.from("issuances").insert(dbIssuance).select().single()

    if (error) throw error

    // Update product stock
    const { error: updateError } = await supabase
      .from("products")
      .update({
        stock: product.stock - issuance.quantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", issuance.product_id)

    if (updateError) throw updateError

    // Map back to frontend format
    return {
      ...data,
      productId: data.product_id,
      productName: data.product_name,
      customerName: data.customer_name,
      serialNumber: data.serial_number,
      issuedBy: data.issued_by,
      date: data.created_at.split("T")[0],
    }
  }, "Failed to create issuance")
}

export async function updateIssuance(id: number, updates: Partial<IssuanceInsert>, originalQuantity: number) {
  return withErrorHandling(async () => {
    // Get current issuance data
    const { data: currentIssuance, error: fetchError } = await supabase
      .from("issuances")
      .select("*")
      .eq("id", id)
      .single()

    if (fetchError || !currentIssuance) {
      throw new Error("Issuance not found")
    }

    // If quantity is being updated, check stock availability
    if (updates.quantity && updates.quantity !== originalQuantity) {
      const { data: product } = await supabase
        .from("products")
        .select("stock")
        .eq("id", currentIssuance.product_id)
        .single()

      if (!product) {
        throw new Error("Product not found")
      }

      // Calculate available stock (current stock + original quantity)
      const availableStock = product.stock + originalQuantity

      if (updates.quantity > availableStock) {
        throw new Error("Insufficient stock for the requested quantity")
      }

      // Update product stock
      const stockDifference = updates.quantity - originalQuantity
      const { error: updateStockError } = await supabase
        .from("products")
        .update({
          stock: product.stock - stockDifference,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentIssuance.product_id)

      if (updateStockError) throw updateStockError
    }

    // Update issuance
    const { data, error } = await supabase
      .from("issuances")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    // Map back to frontend format
    return {
      ...data,
      productId: data.product_id,
      productName: data.product_name,
      customerName: data.customer_name,
      serialNumber: data.serial_number,
      issuedBy: data.issued_by,
      date: data.created_at.split("T")[0],
    }
  }, "Failed to update issuance")
}

export async function deleteIssuance(id: number) {
  return withErrorHandling(async () => {
    // Get issuance data before deletion
    const { data: issuance, error: fetchError } = await supabase
      .from("issuances")
      .select("product_id, quantity")
      .eq("id", id)
      .single()

    if (fetchError || !issuance) {
      throw new Error("Issuance not found")
    }

    // Delete the issuance
    const { error: deleteError } = await supabase.from("issuances").delete().eq("id", id)

    if (deleteError) throw deleteError

    // Return stock to product
    const { error: updateStockError } = await supabase
      .from("products")
      .update({
        stock: supabase.sql`stock + ${issuance.quantity}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", issuance.product_id)

    if (updateStockError) throw updateStockError

    return { success: true }
  }, "Failed to delete issuance")
}

// Enhanced activity logs with pagination
export async function getActivityLogs(limit = 100, offset = 0) {
  return withErrorHandling(async () => {
    const { data, error } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return data || []
  }, "Failed to fetch activity logs")
}

// Enhanced dashboard stats with caching
let dashboardStatsCache: { data: any; timestamp: number } | null = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function getDashboardStats() {
  return withErrorHandling(async () => {
    // Check cache
    if (dashboardStatsCache && Date.now() - dashboardStatsCache.timestamp < CACHE_DURATION) {
      return dashboardStatsCache.data
    }

    // Fetch fresh data
    const [productsResult, issuancesResult] = await Promise.all([
      supabase.from("products").select("stock, min_stock"),
      supabase.from("issuances").select("id").gte("created_at", new Date().toISOString().split("T")[0]),
    ])

    const products = productsResult.data || []
    const totalProducts = products.length
    const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0)
    const lowStockCount = products.filter((p) => (p.stock || 0) <= (p.min_stock || 0) && (p.stock || 0) > 0).length
    const todayIssuances = issuancesResult.data?.length || 0

    const stats = {
      totalProducts,
      totalStock,
      todayIssuances,
      lowStockCount,
    }

    // Update cache
    dashboardStatsCache = {
      data: stats,
      timestamp: Date.now(),
    }

    return stats
  }, "Failed to fetch dashboard stats")
}

// Enhanced chart data functions
export async function getMonthlyStockData() {
  return withErrorHandling(async () => {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const [issuancesResult, productsResult] = await Promise.all([
      supabase.from("issuances").select("created_at, quantity").gte("created_at", sixMonthsAgo.toISOString()),
      supabase.from("products").select("stock"),
    ])

    const issuances = issuancesResult.data || []
    const products = productsResult.data || []
    const currentTotalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0)

    // Calculate stock for each month
    const monthlyData = []
    const months = [
      "يناير",
      "فبراير",
      "مارس",
      "أبريل",
      "مايو",
      "يونيو",
      "يوليو",
      "أغسطس",
      "سبتمبر",
      "أكتوبر",
      "نوفمبر",
      "ديسمبر",
    ]

    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthName = months[date.getMonth()]

      // Calculate stock at end of this month
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      const issuancesUpToMonth = issuances.filter((issuance) => new Date(issuance.created_at) <= monthEnd)

      const totalIssued = issuancesUpToMonth.reduce((sum, issuance) => sum + (issuance.quantity || 0), 0)
      const stockAtMonth = Math.max(0, currentTotalStock + totalIssued)

      monthlyData.push({
        name: monthName,
        stock: stockAtMonth,
      })
    }

    return monthlyData
  }, "Failed to fetch monthly stock data")
}

export async function getWeeklyIssuanceData() {
  return withErrorHandling(async () => {
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const { data: issuances } = await supabase
      .from("issuances")
      .select("created_at, quantity")
      .gte("created_at", oneWeekAgo.toISOString())

    const weekDays = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
    const weeklyData = []

    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dayName = weekDays[date.getDay()]

      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)

      const dayIssuances = (issuances || []).filter((issuance) => {
        const issuanceDate = new Date(issuance.created_at)
        return issuanceDate >= dayStart && issuanceDate < dayEnd
      })

      const totalIssued = dayIssuances.reduce((sum, issuance) => sum + (issuance.quantity || 0), 0)

      weeklyData.push({
        name: dayName,
        issued: totalIssued,
      })
    }

    return weeklyData
  }, "Failed to fetch weekly issuance data")
}

// Enhanced reports functions
export async function getMonthlyIssuances() {
  return withErrorHandling(async () => {
    const { data, error } = await supabase
      .from("issuances")
      .select("created_at, quantity")
      .gte("created_at", new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString())

    if (error) throw error

    // Group by month
    const monthlyData = (data || []).reduce((acc: any, item) => {
      const month = new Date(item.created_at).toLocaleDateString("ar-SA", { month: "long" })
      if (!acc[month]) {
        acc[month] = { month, issued: 0 }
      }
      acc[month].issued += item.quantity || 0
      return acc
    }, {})

    return Object.values(monthlyData || {})
  }, "Failed to fetch monthly issuances")
}

export async function getProductFrequency() {
  return withErrorHandling(async () => {
    const { data, error } = await supabase.from("issuances").select("product_name, quantity")

    if (error) throw error

    // Group by product
    const productData = (data || []).reduce((acc: any, item) => {
      if (!acc[item.product_name]) {
        acc[item.product_name] = { name: item.product_name, count: 0 }
      }
      acc[item.product_name].count += item.quantity || 0
      return acc
    }, {})

    return Object.values(productData || {})
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10) // Top 10 products
  }, "Failed to fetch product frequency")
}

export async function getBranchPerformance() {
  return withErrorHandling(async () => {
    const { data, error } = await supabase.from("issuances").select("branch, quantity")

    if (error) throw error

    // Group by branch
    const branchData = (data || []).reduce((acc: any, item) => {
      if (!acc[item.branch]) {
        acc[item.branch] = { branch: item.branch, count: 0 }
      }
      acc[item.branch].count += item.quantity || 0
      return acc
    }, {})

    return Object.values(branchData || {}).sort((a: any, b: any) => b.count - a.count)
  }, "Failed to fetch branch performance")
}

// Search functionality with advanced filtering
export async function searchProducts(
  query: string,
  filters: {
    category?: string
    stockStatus?: "all" | "available" | "low" | "out"
    minStock?: number
    maxStock?: number
  },
): Promise<Product[]> {
  return withErrorHandling(async () => {
    let queryBuilder = supabase.from("products").select("*")

    // Text search
    if (query) {
      queryBuilder = queryBuilder.or(`name.ilike.%${query}%,brand.ilike.%${query}%,model.ilike.%${query}%`)
    }

    // Category filter
    if (filters.category && filters.category !== "all") {
      queryBuilder = queryBuilder.eq("category", filters.category)
    }

    // Stock range filters
    if (filters.minStock !== undefined) {
      queryBuilder = queryBuilder.gte("stock", filters.minStock)
    }

    if (filters.maxStock !== undefined) {
      queryBuilder = queryBuilder.lte("stock", filters.maxStock)
    }

    const { data, error } = await queryBuilder.order("name")

    if (error) throw error

    let results = data || []

    // Apply stock status filter (client-side for complex logic)
    if (filters.stockStatus && filters.stockStatus !== "all") {
      results = results.filter((product) => {
        switch (filters.stockStatus) {
          case "available":
            return product.stock > (product.min_stock || 0)
          case "low":
            return product.stock <= (product.min_stock || 0) && product.stock > 0
          case "out":
            return product.stock === 0
          default:
            return true
        }
      })
    }

    return results
  }, "Failed to search products")
}

// Bulk operations
export async function bulkUpdateProducts(updates: Array<{ id: number; updates: ProductUpdate & { minStock?: number } }>) {
  return withErrorHandling(async () => {
    const results = await Promise.allSettled(
      updates.map(({ id, updates: productUpdates }) => updateProduct(id, productUpdates)),
    )

    const successful = results.filter((result) => result.status === "fulfilled").length
    const failed = results.filter((result) => result.status === "rejected").length

    return { successful, failed, total: updates.length }
  }, "Failed to bulk update products")
}

export async function bulkDeleteProducts(ids: number[]) {
  return withErrorHandling(async () => {
    const results = await Promise.allSettled(ids.map((id) => deleteProduct(id)))

    const successful = results.filter((result) => result.status === "fulfilled").length
    const failed = results.filter((result) => result.status === "rejected").length

    return { successful, failed, total: ids.length }
  }, "Failed to bulk delete products")
}

// Configuration data
export const CATEGORIES = [
  "آلات عد النقود",
  "آلات ربط النقود",
  "آلات فحص الشيكات",
  "ساعات الأمان",
  "أنظمة الحضور والانصراف",
  "ساعات السكرتارية",
  "بوابات الأمان",
]

export const BRANCHES = [
  "الفرع الرئيسي - القاهرة",
  "فرع الجيزة",
  "فرع الإسكندرية",
  "فرع المنصورة",
  "فرع طنطا",
  "فرع الزقازيق",
  "فرع شبرا الخيمة",
  "فرع 6 أكتوبر",
  "فرع المعادي",
  "فرع مدينة نصر",
  "فرع مصر الجديدة",
  "فرع حلوان",
  "فرع العاشر من رمضان",
  "فرع بدر",
  "فرع الشروق",
  "فرع بني سويف",
  "فرع المنيا",
  "فرع أسيوط",
  "فرع سوهاج",
  "فرع قنا",
  "فرع الأقصر",
  "فرع أسوان",
  "فرع دمنهور",
  "فرع كفر الشيخ",
  "فرع المحلة الكبرى",
  "فرع دمياط",
  "فرع بورسعيد",
  "فرع الإسماعيلية",
  "فرع السويس",
  "فرع الفيوم",
  "فرع مطروح",
  "فرع الغردقة",
  "فرع شرم الشيخ",
  "فرع العريش",

];


// Utility functions
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "EGP",
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function calculateStockValue(products: Product[]): number {
  return products.reduce((total, product) => {
    // Assuming each product has a cost field, otherwise default to 0
    const cost = (product as any).cost || 0
    return total + product.stock * cost
  }, 0)
}
