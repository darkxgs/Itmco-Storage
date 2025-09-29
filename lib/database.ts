import { supabase } from "./supabase"
import type { 
  Product, ProductInsert, ProductUpdate, 
  Issuance, IssuanceInsert,
  Branch, BranchInsert, BranchUpdate,
  Customer, CustomerInsert, CustomerUpdate,
  Warehouse, WarehouseInsert, WarehouseUpdate,
  ReleaseItem, ReleaseItemInsert, ReleaseItemUpdate
} from "./supabase"
import { validateInput, validateObject, createSecureQuery, SecurityError } from "./security"
import { 
  getCurrentUserId, 
  getUserAccessibleWarehouses, 
  hasWarehousePermission, 
  checkWarehousePermission,
  filterByUserWarehouses 
} from "./warehouse-permissions"

// Enhanced error handling wrapper
async function withErrorHandling<T>(operation: () => Promise<T>, errorMessage: string): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    console.error(`Database error: ${errorMessage}`, error)
    throw new Error(`${errorMessage}: ${error.message || "Unknown error"}`)
  }
}

// Products with warehouse permission filtering
export async function getProducts() {
  return withErrorHandling(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) throw error
    
    // Filter products by user's warehouse permissions
    const filteredData = await filterByUserWarehouses(data || [], 'view')
    return filteredData
  }, "Failed to fetch products")
}

// Generate next item code in format ITM-01, ITM-02, etc.
export async function generateNextItemCode(): Promise<string> {
  return withErrorHandling(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("item_code")
      .not("item_code", "is", null)
      .order("id", { ascending: false })
      .limit(1)

    if (error) throw error

    let nextNumber = 1
    if (data && data.length > 0 && data[0].item_code) {
      const lastCode = data[0].item_code
      const match = lastCode.match(/ITM-(\d+)$/)
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }

    return `ITM-${nextNumber.toString().padStart(2, '0')}`
  }, "Failed to generate item code")
}

export async function createProduct(product: ProductInsert & { minStock?: number }, userId?: string, userName?: string) {
  return withErrorHandling(async () => {
    // Validate and sanitize input
    const sanitizedProduct = validateObject(product)
    
    // Validate required fields
    if (!sanitizedProduct.name || !sanitizedProduct.brand || !sanitizedProduct.model || !sanitizedProduct.category) {
      throw new SecurityError("Missing required fields", "INVALID_INPUT")
    }

    // Check warehouse permission if warehouse_id is provided
    if (sanitizedProduct.warehouse_id) {
      await checkWarehousePermission(sanitizedProduct.warehouse_id, 'add')
    }

    // Additional validation for product data
    if (sanitizedProduct.stock < 0 || sanitizedProduct.minStock < 0) {
      throw new SecurityError("Stock values cannot be negative", "INVALID_INPUT")
    }

    // Validate price fields
    if (sanitizedProduct.purchase_price && sanitizedProduct.purchase_price < 0) {
      throw new SecurityError("Purchase price cannot be negative", "INVALID_INPUT")
    }
    if (sanitizedProduct.selling_price && sanitizedProduct.selling_price < 0) {
      throw new SecurityError("Selling price cannot be negative", "INVALID_INPUT")
    }

    // Generate item code if not provided
    let itemCode = sanitizedProduct.item_code
    if (!itemCode) {
      itemCode = await generateNextItemCode()
    }

    // Map minStock to min_stock for database
    const dbProduct: ProductInsert = {
      name: validateInput(sanitizedProduct.name),
      brand: validateInput(sanitizedProduct.brand),
      model: validateInput(sanitizedProduct.model),
      category: validateInput(sanitizedProduct.category),
      item_code: itemCode,
      warehouse_id: sanitizedProduct.warehouse_id ? Number(sanitizedProduct.warehouse_id) : null,
      purchase_price: sanitizedProduct.purchase_price ? Number(sanitizedProduct.purchase_price) : null,
      selling_price: sanitizedProduct.selling_price ? Number(sanitizedProduct.selling_price) : null,
      stock: Math.max(0, Number(sanitizedProduct.stock) || 0),
      min_stock: Math.max(0, Number(sanitizedProduct.minStock) || 0),
      description: sanitizedProduct.description ? validateInput(sanitizedProduct.description) : null,
    }

    const { data, error } = await createSecureQuery("products", "insert").insert(dbProduct).select().single()

    if (error) throw error

    // Create initial stock entry if stock > 0
    if (dbProduct.stock > 0) {
      const stockEntryData: StockEntryInsert = {
        product_id: data.id,
        product_name: data.name,
        item_code: data.item_code,
        quantity_added: dbProduct.stock,
        previous_stock: 0,
        new_stock: dbProduct.stock,
        notes: "إدخال أولي عند إنشاء المنتج",
        entered_by: userName || "النظام",
        user_id: userId || null,
        warehouse_id: data.warehouse_id
      }

      await supabase.from("stock_entries").insert(stockEntryData)
    }

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

    // Get current product to check warehouse permission
    const { data: currentProduct, error: fetchError } = await supabase
      .from('products')
      .select('warehouse_id')
      .eq('id', productId)
      .single()
    
    if (fetchError) throw fetchError
    
    // Check warehouse permission for current product's warehouse
    if (currentProduct?.warehouse_id) {
      await checkWarehousePermission(currentProduct.warehouse_id, 'edit')
    }
    
    // If updating warehouse_id, check permission for new warehouse too
    if (sanitizedUpdates.warehouse_id && sanitizedUpdates.warehouse_id !== currentProduct?.warehouse_id) {
      await checkWarehousePermission(sanitizedUpdates.warehouse_id, 'edit')
    }

    // Additional validation
    if (sanitizedUpdates.stock !== undefined && sanitizedUpdates.stock < 0) {
      throw new SecurityError("Stock cannot be negative", "INVALID_INPUT")
    }
    if (sanitizedUpdates.purchase_price !== undefined && sanitizedUpdates.purchase_price < 0) {
      throw new SecurityError("Purchase price cannot be negative", "INVALID_INPUT")
    }
    if (sanitizedUpdates.selling_price !== undefined && sanitizedUpdates.selling_price < 0) {
      throw new SecurityError("Selling price cannot be negative", "INVALID_INPUT")
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
    if (sanitizedUpdates.purchase_price !== undefined) {
      dbUpdates.purchase_price = sanitizedUpdates.purchase_price ? Number(sanitizedUpdates.purchase_price) : null
    }
    if (sanitizedUpdates.selling_price !== undefined) {
      dbUpdates.selling_price = sanitizedUpdates.selling_price ? Number(sanitizedUpdates.selling_price) : null
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

    // Get current product to check warehouse permission
    const { data: currentProduct, error: fetchError } = await supabase
      .from('products')
      .select('warehouse_id')
      .eq('id', productId)
      .single()
    
    if (fetchError) throw fetchError
    
    // Check warehouse permission for deletion
    if (currentProduct?.warehouse_id) {
      await checkWarehousePermission(currentProduct.warehouse_id, 'delete')
    }

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

    // Get current product stock
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("stock")
      .eq("id", issuance.product_id)
      .single()

    if (productError || !product) {
      throw new Error("Product not found")
    }

    // Return stock to product
    const { error: updateStockError } = await supabase
      .from("products")
      .update({
        stock: product.stock + issuance.quantity,
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
  warehouse?: string
  serialNumber?: string
  itemCode?: string
  limit?: number
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
      // Check if it's an ID (numeric) or name (string)
      if (!isNaN(Number(filters.branch))) {
        query = query.eq("branch_id", filters.branch)
      } else {
        query = query.eq("branch", filters.branch)
      }
    }

    // Apply engineer filter
    if (filters.engineer) {
      query = query.ilike("engineer", `%${filters.engineer}%`)
    }

    // Apply customer filter
    if (filters.customer && filters.customer !== "all") {
      // Check if it's an ID (numeric) or name (string)
      if (!isNaN(Number(filters.customer))) {
        query = query.eq("customer_id", filters.customer)
      } else {
        query = query.ilike("customer_name", `%${filters.customer}%`)
      }
    }

    // Apply warehouse filter
    if (filters.warehouse && filters.warehouse !== "all") {
      query = query.eq("warehouse_id", filters.warehouse)
    }

    // Apply serial number filter
    if (filters.serialNumber) {
      query = query.ilike("serial_number", `%${filters.serialNumber}%`)
    }

    // Apply limit if specified
    if (filters.limit) {
      query = query.limit(filters.limit)
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

    // Apply item code filter (both database and client-side)
    if (filters.itemCode) {
      // First try database-level filtering for better performance
      const itemCodeQuery = supabase
        .from("products")
        .select("id")
        .ilike("item_code", `%${filters.itemCode}%`)
      
      const { data: productIds } = await itemCodeQuery
      
      if (productIds && productIds.length > 0) {
        const ids = productIds.map(p => p.id)
        results = results.filter(item => 
          ids.includes(item.product_id) ||
          item.products?.item_code?.toLowerCase().includes(filters.itemCode.toLowerCase())
        )
      } else {
        // Fallback to client-side filtering
        results = results.filter(item => 
          item.products?.item_code?.toLowerCase().includes(filters.itemCode.toLowerCase())
        )
      }
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


// ==================== STOCK ENTRIES FUNCTIONS ====================

export async function getStockEntries(productId?: number, limit = 50) {
  return withErrorHandling(async () => {
    let query = supabase
      .from("stock_entries")
      .select("*")
      .order("entry_datetime", { ascending: false })

    if (productId) {
      query = query.eq("product_id", productId)
    }

    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) throw error

    return (data || []).map(entry => ({
      ...entry,
      entryDateFormatted: formatDate(entry.entry_date),
      entryTimeFormatted: formatTimeOnly(entry.entry_time),
      entryDateTimeFormatted: formatDateTime(entry.entry_datetime)
    }))
  }, "Failed to fetch stock entries")
}

export async function createStockEntry(entry: {
  productId: number
  quantityAdded: number
  notes?: string
  userId: string
  userName: string
}) {
  return withErrorHandling(async () => {
    // Get current product data
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("id", entry.productId)
      .single()

    if (productError || !product) {
      throw new Error("Product not found")
    }

    // Check warehouse permission if product has warehouse
    if (product.warehouse_id) {
      await checkWarehousePermission(product.warehouse_id, 'edit')
    }

    const previousStock = product.stock
    const newStock = previousStock + entry.quantityAdded

    // Create stock entry record
    const stockEntryData: StockEntryInsert = {
      product_id: entry.productId,
      product_name: product.name,
      item_code: product.item_code,
      quantity_added: entry.quantityAdded,
      previous_stock: previousStock,
      new_stock: newStock,
      notes: entry.notes || null,
      entered_by: entry.userName,
      user_id: entry.userId,
      warehouse_id: product.warehouse_id
    }

    const { data: stockEntry, error: entryError } = await supabase
      .from("stock_entries")
      .insert(stockEntryData)
      .select()
      .single()

    if (entryError) throw entryError

    // Update product stock
    const { error: updateError } = await supabase
      .from("products")
      .update({
        stock: newStock,
        updated_at: new Date().toISOString()
      })
      .eq("id", entry.productId)

    if (updateError) throw updateError

    return {
      ...stockEntry,
      entryDateFormatted: formatDate(stockEntry.entry_date),
      entryTimeFormatted: stockEntry.entry_time,
      entryDateTimeFormatted: formatDateTime(stockEntry.entry_datetime)
    }
  }, "Failed to create stock entry")
}

export async function getProductStockHistory(productId: number) {
  return withErrorHandling(async () => {
    const { data, error } = await supabase
      .from("stock_entries")
      .select("*")
      .eq("product_id", productId)
      .order("entry_datetime", { ascending: false })

    if (error) throw error

    return (data || []).map(entry => ({
      ...entry,
      entryDateFormatted: formatDate(entry.entry_date),
      entryTimeFormatted: formatTimeOnly(entry.entry_time),
      entryDateTimeFormatted: formatDateTime(entry.entry_datetime)
    }))
  }, "Failed to fetch product stock history")
}

export async function getStockEntriesCount(productId: number, startDate?: string, endDate?: string) {
  return withErrorHandling(async () => {
    let query = supabase
      .from("stock_entries")
      .select("id", { count: "exact" })
      .eq("product_id", productId)

    if (startDate) {
      query = query.gte("entry_date", startDate)
    }

    if (endDate) {
      query = query.lte("entry_date", endDate)
    }

    const { count, error } = await query

    if (error) throw error

    return count || 0
  }, "Failed to get stock entries count")
}

export async function getStockEntriesSummary(productId: number, startDate?: string, endDate?: string) {
  return withErrorHandling(async () => {
    let query = supabase
      .from("stock_entries")
      .select("quantity_added, entry_date")
      .eq("product_id", productId)

    if (startDate) {
      query = query.gte("entry_date", startDate)
    }

    if (endDate) {
      query = query.lte("entry_date", endDate)
    }

    const { data, error } = await query

    if (error) throw error

    const entries = data || []
    const totalQuantityAdded = entries.reduce((sum, entry) => sum + entry.quantity_added, 0)
    const entriesCount = entries.length
    const uniqueDates = new Set(entries.map(entry => entry.entry_date)).size

    return {
      totalQuantityAdded,
      entriesCount,
      uniqueDates,
      averagePerEntry: entriesCount > 0 ? Math.round(totalQuantityAdded / entriesCount) : 0
    }
  }, "Failed to get stock entries summary")
}

// Utility functions
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "EGP",
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function formatDateTime(dateTime: string | Date): string {
  return new Date(dateTime).toLocaleString("en-US", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })
}

export function formatDateOnly(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  })
}

export function formatTimeOnly(time: string): string {
  try {
    // إذا كان الوقت يحتوي على ثواني وميكروثانية، نقوم بتنظيفه
    const timeParts = time.split(':')
    if (timeParts.length >= 2) {
      let hours = parseInt(timeParts[0])
      const minutes = timeParts[1].split('.')[0] // إزالة الميكروثانية إن وجدت
      
      // إضافة 3 ساعات للتوقيت المصري (UTC+3 في الصيف، UTC+2 في الشتاء)
      // نستخدم UTC+3 لأن مصر تستخدم التوقيت الصيفي حالياً
      hours = (hours + 3) % 24
      
      // تحويل إلى تنسيق 12 ساعة
      const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
      const ampm = hours >= 12 ? 'PM' : 'AM'
      
      // التأكد من أن الدقائق تظهر بصيغة رقمين
      const formattedMinutes = minutes.padStart(2, '0')
      
      return `${hour12}:${formattedMinutes} ${ampm}`
    }
    
    return time
  } catch (error) {
    // في حالة حدوث خطأ، نعيد الوقت كما هو
    return time
  }
}

export function getCurrentEgyptTime(): string {
  // الحصول على التوقيت المصري (UTC+3 في الصيف)
  const now = new Date()
  const egyptTime = new Date(now.getTime() + (3 * 60 * 60 * 1000)) // إضافة 3 ساعات لـ UTC
  
  return egyptTime.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })
}

export function calculateStockValue(products: Product[]): number {
  return products.reduce((total, product) => {
    // Assuming each product has a cost field, otherwise default to 0
    const cost = (product as any).cost || 0
    return total + product.stock * cost
  }, 0)
}

// ==================== BRANCHES FUNCTIONS ====================

export async function getBranches() {
  return withErrorHandling(async () => {
    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .order("name", { ascending: true })

    if (error) throw error
    return data || []
  }, "Failed to fetch branches")
}

export async function createBranch(branch: BranchInsert) {
  return withErrorHandling(async () => {
    const sanitizedBranch = validateObject(branch)
    
    if (!sanitizedBranch.name || !sanitizedBranch.code) {
      throw new SecurityError("Missing required fields: name and code", "INVALID_INPUT")
    }

    const dbBranch: BranchInsert = {
      name: validateInput(sanitizedBranch.name),
      code: validateInput(sanitizedBranch.code),
      address: sanitizedBranch.address ? validateInput(sanitizedBranch.address) : null,
      phone: sanitizedBranch.phone ? validateInput(sanitizedBranch.phone) : null,
      manager_name: sanitizedBranch.manager_name ? validateInput(sanitizedBranch.manager_name) : null,
      is_active: sanitizedBranch.is_active !== undefined ? sanitizedBranch.is_active : true,
    }

    const { data, error } = await createSecureQuery("branches", "insert")
      .insert(dbBranch)
      .select()
      .single()

    if (error) throw error
    return data
  }, "Failed to create branch")
}

export async function updateBranch(id: number, updates: BranchUpdate) {
  return withErrorHandling(async () => {
    const sanitizedUpdates = validateObject(updates)
    const branchId = Number(id)
    
    if (!branchId || branchId <= 0) {
      throw new SecurityError("Invalid branch ID", "INVALID_INPUT")
    }

    const dbUpdates: BranchUpdate = {
      updated_at: new Date().toISOString(),
    }

    if (sanitizedUpdates.name !== undefined) dbUpdates.name = validateInput(sanitizedUpdates.name)
    if (sanitizedUpdates.code !== undefined) dbUpdates.code = validateInput(sanitizedUpdates.code)
    if (sanitizedUpdates.address !== undefined) {
      dbUpdates.address = sanitizedUpdates.address ? validateInput(sanitizedUpdates.address) : null
    }
    if (sanitizedUpdates.phone !== undefined) {
      dbUpdates.phone = sanitizedUpdates.phone ? validateInput(sanitizedUpdates.phone) : null
    }
    if (sanitizedUpdates.manager_name !== undefined) {
      dbUpdates.manager_name = sanitizedUpdates.manager_name ? validateInput(sanitizedUpdates.manager_name) : null
    }
    if (sanitizedUpdates.is_active !== undefined) dbUpdates.is_active = sanitizedUpdates.is_active

    const { data, error } = await createSecureQuery("branches", "update")
      .update(dbUpdates)
      .eq("id", branchId)
      .select()
      .single()

    if (error) throw error
    return data
  }, "Failed to update branch")
}

export async function deleteBranch(id: number) {
  return withErrorHandling(async () => {
    const branchId = Number(id)
    
    if (!branchId || branchId <= 0) {
      throw new SecurityError("Invalid branch ID", "INVALID_INPUT")
    }

    // Check if branch has related issuances
    const { data: relatedIssuances, error: checkError } = await supabase
      .from("issuances")
      .select("id")
      .eq("branch_id", branchId)
      .limit(1)

    if (checkError) throw checkError

    if (relatedIssuances && relatedIssuances.length > 0) {
      throw new Error("Cannot delete branch: There are issuances associated with this branch. Please reassign or delete the issuances first.")
    }

    const { error } = await createSecureQuery("branches", "delete")
      .delete()
      .eq("id", branchId)

    if (error) throw error
    return { success: true }
  }, "Failed to delete branch")
}

// ==================== CUSTOMERS FUNCTIONS ====================

export async function getCustomers() {
  return withErrorHandling(async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("name", { ascending: true })

    if (error) throw error
    return data || []
  }, "Failed to fetch customers")
}

export async function createCustomer(customer: CustomerInsert) {
  return withErrorHandling(async () => {
    const sanitizedCustomer = validateObject(customer)
    
    if (!sanitizedCustomer.name) {
      throw new SecurityError("Missing required field: name", "INVALID_INPUT")
    }

    const dbCustomer: CustomerInsert = {
      name: validateInput(sanitizedCustomer.name),
      code: sanitizedCustomer.code ? validateInput(sanitizedCustomer.code) : null,
      email: sanitizedCustomer.email ? validateInput(sanitizedCustomer.email) : null,
      phone: sanitizedCustomer.phone ? validateInput(sanitizedCustomer.phone) : null,
      address: sanitizedCustomer.address ? validateInput(sanitizedCustomer.address) : null,
      contact_person: sanitizedCustomer.contact_person ? validateInput(sanitizedCustomer.contact_person) : null,
      is_active: sanitizedCustomer.is_active !== undefined ? sanitizedCustomer.is_active : true,
    }

    const { data, error } = await createSecureQuery("customers", "insert")
      .insert(dbCustomer)
      .select()
      .single()

    if (error) throw error
    return data
  }, "Failed to create customer")
}

export async function updateCustomer(id: number, updates: CustomerUpdate) {
  return withErrorHandling(async () => {
    const sanitizedUpdates = validateObject(updates)
    const customerId = Number(id)
    
    if (!customerId || customerId <= 0) {
      throw new SecurityError("Invalid customer ID", "INVALID_INPUT")
    }

    const dbUpdates: CustomerUpdate = {
      updated_at: new Date().toISOString(),
    }

    if (sanitizedUpdates.name !== undefined) dbUpdates.name = validateInput(sanitizedUpdates.name)
    if (sanitizedUpdates.code !== undefined) {
      dbUpdates.code = sanitizedUpdates.code ? validateInput(sanitizedUpdates.code) : null
    }
    if (sanitizedUpdates.email !== undefined) {
      dbUpdates.email = sanitizedUpdates.email ? validateInput(sanitizedUpdates.email) : null
    }
    if (sanitizedUpdates.phone !== undefined) {
      dbUpdates.phone = sanitizedUpdates.phone ? validateInput(sanitizedUpdates.phone) : null
    }
    if (sanitizedUpdates.address !== undefined) {
      dbUpdates.address = sanitizedUpdates.address ? validateInput(sanitizedUpdates.address) : null
    }
    if (sanitizedUpdates.contact_person !== undefined) {
      dbUpdates.contact_person = sanitizedUpdates.contact_person ? validateInput(sanitizedUpdates.contact_person) : null
    }
    if (sanitizedUpdates.is_active !== undefined) dbUpdates.is_active = sanitizedUpdates.is_active

    const { data, error } = await createSecureQuery("customers", "update")
      .update(dbUpdates)
      .eq("id", customerId)
      .select()
      .single()

    if (error) throw error
    return data
  }, "Failed to update customer")
}

export async function deleteCustomer(id: number) {
  return withErrorHandling(async () => {
    const customerId = Number(id)
    
    if (!customerId || customerId <= 0) {
      throw new SecurityError("Invalid customer ID", "INVALID_INPUT")
    }

    const { error } = await createSecureQuery("customers", "delete")
      .delete()
      .eq("id", customerId)

    if (error) throw error
    return { success: true }
  }, "Failed to delete customer")
}

// ==================== WAREHOUSES FUNCTIONS ====================

// Generate next warehouse number in format WH-01, WH-02, etc.
export async function generateNextWarehouseNumber(): Promise<string> {
  return withErrorHandling(async () => {
    const { data, error } = await supabase
      .from("warehouses")
      .select("warehouse_number")
      .not("warehouse_number", "is", null)
      .order("id", { ascending: false })
      .limit(1)

    if (error) throw error

    let nextNumber = 1
    if (data && data.length > 0 && data[0].warehouse_number) {
      const lastNumber = data[0].warehouse_number
      const match = lastNumber.match(/WH-(\d+)$/)
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }

    return `WH-${nextNumber.toString().padStart(2, '0')}`
  }, "Failed to generate warehouse number")
}

export async function getWarehouses() {
  return withErrorHandling(async () => {
    const { data, error } = await supabase
      .from("warehouses")
      .select("*")
      .order("warehouse_number", { ascending: true })

    if (error) throw error
    return data || []
  }, "Failed to fetch warehouses")
}

export async function createWarehouse(warehouse: WarehouseInsert) {
  return withErrorHandling(async () => {
    const sanitizedWarehouse = validateObject(warehouse)
    
    if (!sanitizedWarehouse.name) {
      throw new SecurityError("Missing required field: name", "INVALID_INPUT")
    }

    // Generate warehouse number if not provided
    let warehouseNumber = sanitizedWarehouse.warehouse_number
    if (!warehouseNumber) {
      warehouseNumber = await generateNextWarehouseNumber()
    }

    const dbWarehouse: WarehouseInsert = {
      name: validateInput(sanitizedWarehouse.name),
      warehouse_number: warehouseNumber,
      location: sanitizedWarehouse.location ? validateInput(sanitizedWarehouse.location) : null,
      description: sanitizedWarehouse.description ? validateInput(sanitizedWarehouse.description) : null,
      is_active: sanitizedWarehouse.is_active !== undefined ? sanitizedWarehouse.is_active : true,
    }

    const { data, error } = await createSecureQuery("warehouses", "insert")
      .insert(dbWarehouse)
      .select()
      .single()

    if (error) throw error
    return data
  }, "Failed to create warehouse")
}

export async function updateWarehouse(id: number, updates: WarehouseUpdate) {
  return withErrorHandling(async () => {
    const sanitizedUpdates = validateObject(updates)
    const warehouseId = Number(id)
    
    if (!warehouseId || warehouseId <= 0) {
      throw new SecurityError("Invalid warehouse ID", "INVALID_INPUT")
    }

    const dbUpdates: WarehouseUpdate = {
      updated_at: new Date().toISOString(),
    }

    // Note: warehouse_number should not be updatable
    if (sanitizedUpdates.name !== undefined) dbUpdates.name = validateInput(sanitizedUpdates.name)
    if (sanitizedUpdates.location !== undefined) {
      dbUpdates.location = sanitizedUpdates.location ? validateInput(sanitizedUpdates.location) : null
    }
    if (sanitizedUpdates.description !== undefined) {
      dbUpdates.description = sanitizedUpdates.description ? validateInput(sanitizedUpdates.description) : null
    }
    if (sanitizedUpdates.is_active !== undefined) dbUpdates.is_active = sanitizedUpdates.is_active

    const { data, error } = await createSecureQuery("warehouses", "update")
      .update(dbUpdates)
      .eq("id", warehouseId)
      .select()
      .single()

    if (error) throw error
    return data
  }, "Failed to update warehouse")
}

export async function deleteWarehouse(id: number) {
  return withErrorHandling(async () => {
    const warehouseId = Number(id)
    
    if (!warehouseId || warehouseId <= 0) {
      throw new SecurityError("Invalid warehouse ID", "INVALID_INPUT")
    }

    const { error } = await createSecureQuery("warehouses", "delete")
      .delete()
      .eq("id", warehouseId)

    if (error) throw error
    return { success: true }
  }, "Failed to delete warehouse")
}

// ==================== SEARCH FUNCTIONS ====================

export async function searchByItemCode(itemCode: string) {
  return withErrorHandling(async () => {
    if (!itemCode.trim()) {
      throw new SecurityError("Item code is required", "INVALID_INPUT")
    }

    const sanitizedCode = validateInput(itemCode.trim())
    
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        warehouses:warehouse_id(id, warehouse_number, name, location)
      `)
      .ilike("item_code", `%${sanitizedCode}%`)
      .order("item_code", { ascending: true })

    if (error) throw error
    return data || []
  }, "Failed to search by item code")
}

export async function searchIssuancesByFilters(filters: {
  itemCode?: string
  branchName?: string
  customerName?: string
  serialNumber?: string
  startDate?: string
  endDate?: string
}) {
  return withErrorHandling(async () => {
    let query = supabase
      .from("issuances")
      .select(`
        *,
        branches:branch_id(id, name, code),
        customers:customer_id(id, name, code),
        warehouses:warehouse_id(id, warehouse_number, name)
      `)

    if (filters.itemCode) {
      query = query.ilike("item_code", `%${validateInput(filters.itemCode)}%`)
    }
    
    if (filters.branchName) {
      query = query.ilike("branch", `%${validateInput(filters.branchName)}%`)
    }
    
    if (filters.customerName) {
      query = query.ilike("customer_name", `%${validateInput(filters.customerName)}%`)
    }
    
    if (filters.serialNumber) {
      query = query.ilike("serial_number", `%${validateInput(filters.serialNumber)}%`)
    }
    
    if (filters.startDate) {
      query = query.gte("created_at", filters.startDate)
    }
    
    if (filters.endDate) {
      query = query.lte("created_at", filters.endDate)
    }

    query = query.order("created_at", { ascending: false })

    const { data, error } = await query
    if (error) throw error
    return data || []
  }, "Failed to search issuances")
}



// Users management functions
export async function getUsers() {
  return withErrorHandling(async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, name, role")
      .order("created_at", { ascending: false })

    if (error) throw error
    return data || []
  }, "Failed to fetch users")
}

export async function getUserById(userId: string) {
  return withErrorHandling(async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, name, role")
      .eq("id", userId)
      .single()

    if (error) throw error
    return data
  }, "Failed to fetch user")
}

// Categories CRUD operations
export async function getCategories() {
  return withErrorHandling(async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name", { ascending: true })

    if (error) throw error
    return data || []
  }, "Failed to fetch categories")
}

export async function createCategory(category: { name: string; description?: string; is_active?: boolean }) {
  return withErrorHandling(async () => {
    // Validate and sanitize input
    const sanitizedCategory = validateObject(category)
    
    // Validate required fields
    if (!sanitizedCategory.name || sanitizedCategory.name.trim().length === 0) {
      throw new SecurityError("Category name is required", "INVALID_INPUT")
    }

    // Check for duplicate category name
    const { data: existingCategory } = await supabase
      .from("categories")
      .select("id")
      .eq("name", sanitizedCategory.name.trim())
      .single()

    if (existingCategory) {
      throw new SecurityError("Category with this name already exists", "DUPLICATE_ENTRY")
    }

    const { data, error } = await supabase
      .from("categories")
      .insert({
        name: sanitizedCategory.name.trim(),
        description: sanitizedCategory.description?.trim() || null,
        is_active: sanitizedCategory.is_active ?? true
      })
      .select()
      .single()

    if (error) throw error
    return data
  }, "Failed to create category")
}

export async function updateCategory(id: number, updates: { name?: string; description?: string; is_active?: boolean }) {
  return withErrorHandling(async () => {
    // Validate and sanitize input
    const sanitizedUpdates = validateObject(updates)
    
    // Validate ID
    if (!id || id <= 0) {
      throw new SecurityError("Invalid category ID", "INVALID_INPUT")
    }

    // If updating name, check for duplicates
    if (sanitizedUpdates.name) {
      const { data: existingCategory } = await supabase
        .from("categories")
        .select("id")
        .eq("name", sanitizedUpdates.name.trim())
        .neq("id", id)
        .single()

      if (existingCategory) {
        throw new SecurityError("Category with this name already exists", "DUPLICATE_ENTRY")
      }
    }

    const updateData: any = {}
    if (sanitizedUpdates.name !== undefined) updateData.name = sanitizedUpdates.name.trim()
    if (sanitizedUpdates.description !== undefined) updateData.description = sanitizedUpdates.description?.trim() || null
    if (sanitizedUpdates.is_active !== undefined) updateData.is_active = sanitizedUpdates.is_active

    const { data, error } = await supabase
      .from("categories")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error
    return data
  }, "Failed to update category")
}

export async function deleteCategory(id: number) {
  return withErrorHandling(async () => {
    // Validate ID
    if (!id || id <= 0) {
      throw new SecurityError("Invalid category ID", "INVALID_INPUT")
    }

    // Check if category is being used by any products
    const { data: productsUsingCategory } = await supabase
      .from("products")
      .select("id")
      .eq("category", id)
      .limit(1)

    if (productsUsingCategory && productsUsingCategory.length > 0) {
      throw new SecurityError("Cannot delete category that is being used by products", "CONSTRAINT_VIOLATION")
    }

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", id)

    if (error) throw error
    return { success: true }
  }, "Failed to delete category")
}
