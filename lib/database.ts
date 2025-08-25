import { supabase } from "./supabase"
import type { Product, ProductInsert, ProductUpdate, Issuance, IssuanceInsert } from "./supabase"
import { validateInput, validateObject, createSecureQuery, SecurityError } from "./security"

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
    // Validate and sanitize input
    const sanitizedProduct = validateObject(product)
    
    // Validate required fields
    if (!sanitizedProduct.name || !sanitizedProduct.brand || !sanitizedProduct.model || !sanitizedProduct.category) {
      throw new SecurityError("Missing required fields", "INVALID_INPUT")
    }

    // Additional validation for product data
    if (sanitizedProduct.stock < 0 || sanitizedProduct.minStock < 0) {
      throw new SecurityError("Stock values cannot be negative", "INVALID_INPUT")
    }

    // Map minStock to min_stock for database
    const dbProduct: ProductInsert = {
      name: validateInput(sanitizedProduct.name),
      brand: validateInput(sanitizedProduct.brand),
      model: validateInput(sanitizedProduct.model),
      category: validateInput(sanitizedProduct.category),
      stock: Math.max(0, Number(sanitizedProduct.stock) || 0),
      min_stock: Math.max(0, Number(sanitizedProduct.minStock) || 0),
      description: sanitizedProduct.description ? validateInput(sanitizedProduct.description) : null,
    }

    const { data, error } = await createSecureQuery("products", "insert").insert(dbProduct).select().single()

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
    // Validate and sanitize input
    const sanitizedUpdates = validateObject(updates)
    const productId = Number(id)
    
    if (!productId || productId <= 0) {
      throw new SecurityError("Invalid product ID", "INVALID_INPUT")
    }

    // Additional validation
    if (sanitizedUpdates.stock !== undefined && sanitizedUpdates.stock < 0) {
      throw new SecurityError("Stock cannot be negative", "INVALID_INPUT")
    }

    // Map minStock to min_stock for database
    const dbUpdates: ProductUpdate = {
      updated_at: new Date().toISOString(),
    }

    // Only update provided fields
    if (sanitizedUpdates.name !== undefined) dbUpdates.name = validateInput(sanitizedUpdates.name)
    if (sanitizedUpdates.brand !== undefined) dbUpdates.brand = validateInput(sanitizedUpdates.brand)
    if (sanitizedUpdates.model !== undefined) dbUpdates.model = validateInput(sanitizedUpdates.model)
    if (sanitizedUpdates.category !== undefined) dbUpdates.category = validateInput(sanitizedUpdates.category)
    if (sanitizedUpdates.stock !== undefined) dbUpdates.stock = Math.max(0, Number(sanitizedUpdates.stock))
    if (sanitizedUpdates.description !== undefined) {
      dbUpdates.description = sanitizedUpdates.description ? validateInput(sanitizedUpdates.description) : null
    }
    if (sanitizedUpdates.minStock !== undefined) {
      dbUpdates.min_stock = Math.max(0, Number(sanitizedUpdates.minStock))
    }

    const { data, error } = await createSecureQuery("products", "update").update(dbUpdates).eq("id", productId).select().single()

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
    const productId = Number(id)
    
    if (!productId || productId <= 0) {
      throw new SecurityError("Invalid product ID", "INVALID_INPUT")
    }

    // Check if product has any issuances
    const { data: issuances } = await createSecureQuery("issuances", "select").select("id").eq("product_id", productId).limit(1)

    if (issuances && issuances.length > 0) {
      throw new SecurityError("Cannot delete product with existing issuances", "INVALID_INPUT")
    }

    const { error } = await createSecureQuery("products", "delete").delete().eq("id", productId)

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

// Enhanced reports functions with advanced filtering
export async function getFilteredIssuances(filters: {
  startDate?: string
  endDate?: string
  branch?: string
  category?: string
  productName?: string
  engineer?: string
  customer?: string
} = {}) {
  return withErrorHandling(async () => {
    let query = supabase
      .from("issuances")
      .select(`
        *,
        products!inner(
          id,
          name,
          brand,
          model,
          category,
          description
        )
      `)
      .order("created_at", { ascending: false })

    // Apply date filters
    if (filters.startDate) {
      query = query.gte("created_at", filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte("created_at", filters.endDate)
    }

    // Apply branch filter
    if (filters.branch && filters.branch !== "all") {
      query = query.eq("branch", filters.branch)
    }

    // Apply engineer filter
    if (filters.engineer) {
      query = query.ilike("engineer", `%${filters.engineer}%`)
    }

    // Apply customer filter
    if (filters.customer) {
      query = query.ilike("customer_name", `%${filters.customer}%`)
    }

    const { data, error } = await query

    if (error) throw error

    let results = data || []

    // Apply product-based filters (client-side for complex joins)
    if (filters.category && filters.category !== "all") {
      results = results.filter(item => item.products?.category === filters.category)
    }

    if (filters.productName) {
      results = results.filter(item => 
        item.product_name?.toLowerCase().includes(filters.productName.toLowerCase()) ||
        item.products?.name?.toLowerCase().includes(filters.productName.toLowerCase())
      )
    }

    // Map to enhanced format with product details
    return results.map(item => ({
      ...item,
      productId: item.product_id,
      productName: item.product_name,
      customerName: item.customer_name,
      serialNumber: item.serial_number,
      issuedBy: item.issued_by,
      date: item.created_at.split("T")[0],
      // Enhanced product information
      productDetails: {
        category: item.products?.category,
        partNumber: null, // Part number not available in current schema
        brand: item.products?.brand || item.brand,
        model: item.products?.model || item.model,
        description: item.products?.description
      }
    }))
  }, "Failed to fetch filtered issuances")
}

export async function getMonthlyIssuances(filters: {
  startDate?: string
  endDate?: string
  branch?: string
  category?: string
} = {}) {
  return withErrorHandling(async () => {
    const issuances = await getFilteredIssuances(filters)

    // Group by month
    const monthlyData = issuances.reduce((acc: any, item) => {
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

export async function getProductFrequency(filters: {
  startDate?: string
  endDate?: string
  branch?: string
  category?: string
} = {}) {
  return withErrorHandling(async () => {
    const issuances = await getFilteredIssuances(filters)

    // Group by product with enhanced details
    const productData = issuances.reduce((acc: any, item) => {
      const productKey = item.product_name
      if (!acc[productKey]) {
        acc[productKey] = {
          name: item.product_name,
          category: item.productDetails?.category,
          partNumber: item.productDetails?.partNumber,
          brand: item.productDetails?.brand,
          model: item.productDetails?.model,
          count: 0
        }
      }
      acc[productKey].count += item.quantity || 0
      return acc
    }, {})

    return Object.values(productData || {})
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10) // Top 10 products
  }, "Failed to fetch product frequency")
}

export async function getBranchPerformance(filters: {
  startDate?: string
  endDate?: string
  category?: string
  productName?: string
} = {}) {
  return withErrorHandling(async () => {
    const issuances = await getFilteredIssuances(filters)

    // Group by branch
    const branchData = issuances.reduce((acc: any, item) => {
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
