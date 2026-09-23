import { supabase } from "./supabase"
import type { 
  Product, ProductInsert, ProductUpdate, 
  Issuance, IssuanceInsert,
  Branch, BranchInsert, BranchUpdate,
  Customer, CustomerInsert, CustomerUpdate,
  Warehouse, WarehouseInsert, WarehouseUpdate,
  ReleaseItem, ReleaseItemInsert, ReleaseItemUpdate,
  StockEntryInsert
} from "./supabase"
import { validateInput, validateObject, createSecureQuery, SecurityError } from "./security"
import { 
  getCurrentUserId, 
  getUserAccessibleWarehouses, 
  hasWarehousePermission, 
  checkWarehousePermission,
  filterByUserWarehouses 
} from "./warehouse-permissions"

// Enhanced error handling wrapper. The thrown error keeps the database's own message in
// `detail` (the stock functions raise readable Arabic messages) for errorDetail() below.
async function withErrorHandling<T>(operation: () => Promise<T>, errorMessage: string): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    console.error(`Database error: ${errorMessage}`, error)
    const detail = (error as any)?.message || "Unknown error"
    throw Object.assign(new Error(`${errorMessage}: ${detail}`), { detail })
  }
}

// The message worth showing the user for an error thrown by this module
export function errorDetail(error: unknown, fallback: string): string {
  const detail = (error as any)?.detail
  // Arabic messages come from our database functions; English ones are technical
  return typeof detail === "string" && /[\u0600-\u06FF]/.test(detail) ? detail : fallback
}

// Supabase returns at most 1000 rows per request (the project's max-rows setting),
// so a plain select silently drops everything past the first page. Read the total
// count first, then fetch the remaining pages in parallel. `build` must apply a
// deterministic order (end with an `id` tiebreaker) so pages don't overlap.
const PAGE_SIZE = 1000

export async function fetchAllRows<T = any>(
  table: string,
  columns: string,
  build: (query: any) => any = (query) => query,
): Promise<T[]> {
  const first = await build(supabase.from(table).select(columns, { count: "exact" })).range(0, PAGE_SIZE - 1)
  if (first.error) throw first.error

  const rows: any[] = [...(first.data || [])]
  const total: number = first.count ?? rows.length
  // The server may cap pages below PAGE_SIZE; step by what it actually returned.
  const step = rows.length
  if (step === 0 || rows.length >= total) return rows as T[]

  const pages = []
  for (let from = step; from < total; from += step) {
    pages.push(build(supabase.from(table).select(columns)).range(from, from + step - 1))
  }
  for (const page of await Promise.all(pages)) {
    if (page.error) throw page.error
    rows.push(...(page.data || []))
  }

  // A row inserted between page requests shifts the pages by one; drop the duplicate.
  if (rows.length > 0 && rows[0]?.id !== undefined) {
    const seen = new Set()
    return rows.filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true))) as T[]
  }
  return rows as T[]
}

const ISSUANCE_WITH_PRODUCT = `
  *,
  products(
    id,
    name,
    brand,
    model,
    item_code,
    purchase_price,
    selling_price,
    category
  )
`

function mapIssuance(item: any) {
  return {
    ...item,
    productId: item.product_id,
    productName: item.product_name,
    customerName: item.customer_name,
    serialNumber: item.serial_number,
    issuedBy: item.issued_by,
    date: item.date || item.created_at?.split("T")[0], // Use date field first, then fallback to created_at
    item_code: item.products?.item_code || null,
    purchase_price: item.products?.purchase_price || 0,
    selling_price: item.products?.selling_price || 0,
    category: item.products?.category || '',
  }
}

// Products with warehouse permission filtering
export async function getProducts() {
  return withErrorHandling(async () => {
    const data = await fetchAllRows("products", "*", (q) =>
      q.order("created_at", { ascending: false }).order("id", { ascending: false }),
    )

    // Filter products by user's warehouse permissions
    const filteredData = await filterByUserWarehouses(data, 'view')
    return filteredData
  }, "Failed to fetch products")
}

// Generate next item code in format ITM-01, ITM-02, etc.
// Uses the highest existing ITM number, not the newest product's code: products added with
// their own codes (e.g. from an Excel import) used to reset the sequence to ITM-01.
export async function generateNextItemCode(): Promise<string> {
  return withErrorHandling(async () => {
    const codes = await fetchAllRows<{ item_code: string }>("products", "id, item_code", (q) =>
      q.ilike("item_code", "ITM-%").order("id"),
    )

    const highest = codes.reduce((max, { item_code }) => {
      const match = item_code?.match(/^ITM-(\d+)$/i)
      return match ? Math.max(max, parseInt(match[1], 10)) : max
    }, 0)

    return `ITM-${(highest + 1).toString().padStart(2, '0')}`
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

    const initialStock = Math.max(0, Number(sanitizedProduct.stock) || 0)
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
      stock: initialStock,
      min_stock: Math.max(0, Number(sanitizedProduct.minStock) || 0),
      description: sanitizedProduct.description ? validateInput(sanitizedProduct.description) : null,
    }

    const { data, error } = await createSecureQuery("products", "insert").insert(dbProduct).select().single()

    if (error) throw error

    // Create initial stock entry if stock > 0
    if (initialStock > 0) {
      const stockEntryData: StockEntryInsert = {
        product_id: data.id,
        product_name: data.name,
        item_code: data.item_code,
        quantity_added: initialStock,
        previous_stock: 0,
        new_stock: initialStock,
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

// Stock is only changed when the caller says what it expected the stock to be
// (options.expectedStock): the database applies it only if nobody issued or added
// stock meanwhile, so saving an edit dialog can't undo an issuance.
export async function updateProduct(
  id: number,
  updates: ProductUpdate & { minStock?: number },
  options: { expectedStock?: number } = {},
) {
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
    if (sanitizedUpdates.item_code !== undefined) {
      dbUpdates.item_code = sanitizedUpdates.item_code ? validateInput(sanitizedUpdates.item_code) : null
    }
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

    // Stock first: if it changed meanwhile, nothing is saved and the user reopens the product
    if (sanitizedUpdates.stock !== undefined && options.expectedStock !== undefined) {
      const newStock = Math.max(0, Number(sanitizedUpdates.stock))
      if (newStock !== options.expectedStock) {
        const { error: stockError } = await supabase.rpc("set_product_stock", {
          p_product_id: productId,
          p_expected: options.expectedStock,
          p_new: newStock,
        })
        if (stockError) throw stockError
      }
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
    const data = await fetchAllRows("issuances", ISSUANCE_WITH_PRODUCT, (q) =>
      q.order("created_at", { ascending: false }).order("id", { ascending: false }),
    )
    return data.map(mapIssuance)
  }, "Failed to fetch issuances")
}

export async function getIssuancesByItemCode(itemCode: string) {
  return withErrorHandling(async () => {
    if (!itemCode || itemCode.trim() === '') return []

    // 1. Find the product id(s) for the given item code
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("id")
      .ilike("item_code", `%${itemCode.trim()}%`)

    if (productsError) throw productsError
    if (!productsData || productsData.length === 0) return []

    const productIds = productsData.map(p => p.id)

    // 2. Query issuances for those product ids
    const data = await fetchAllRows("issuances", ISSUANCE_WITH_PRODUCT, (q) =>
      q
        .in("product_id", productIds)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false }),
    )
    return data.map(mapIssuance)
  }, "Failed to fetch issuances by item code")
}

// Issuing, editing and deleting go through database functions (see
// supabase/migrations/20260923110000_stock_functions.sql) so the stock change and the
// issuance row are written in one transaction. The database checks stock inside the
// update itself, so two people issuing the same product at once can't oversell it, and
// issued_by is always the signed-in user.
function mapWrittenIssuance(data: any) {
  return {
    ...data,
    productId: data.product_id,
    productName: data.product_name,
    customerName: data.customer_name,
    serialNumber: data.serial_number,
    issuedBy: data.issued_by,
    date: data.date || data.created_at?.split("T")[0],
  }
}

// All items are issued, or none are
export async function createIssuances(items: Array<Partial<IssuanceInsert>>) {
  return withErrorHandling(async () => {
    const { data, error } = await supabase.rpc("issue_products", { p_items: items })
    if (error) throw error
    return ((data as any[]) || []).map(mapWrittenIssuance)
  }, "Failed to create issuance")
}

export async function createIssuance(issuance: Partial<IssuanceInsert>) {
  const [created] = await createIssuances([issuance])
  return created
}

// Changing quantity or product moves stock accordingly (admins and the issuer only)
export async function updateIssuance(id: number, updates: Partial<IssuanceInsert>) {
  return withErrorHandling(async () => {
    const { data, error } = await supabase.rpc("update_issuance", { p_id: id, p_changes: updates })
    if (error) throw error
    return mapWrittenIssuance(data)
  }, "Failed to update issuance")
}

// Puts the issued quantity back into stock (admins and the issuer only)
export async function deleteIssuance(id: number) {
  return withErrorHandling(async () => {
    const { error } = await supabase.rpc("delete_issuance", { p_id: id })
    if (error) throw error
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

export async function getDashboardStats(userId?: string) {
  return withErrorHandling(async () => {
    // Don't use cache if userId is provided (for warehouse-specific stats)
    if (!userId && dashboardStatsCache && Date.now() - dashboardStatsCache.timestamp < CACHE_DURATION) {
      return dashboardStatsCache.data
    }

    // Fetch fresh data with warehouse filtering
    let warehouseIds: number[] | null = null

    // If userId is provided, filter by user's accessible warehouses
    if (userId) {
      warehouseIds = await getUserAccessibleWarehouses(userId)

      if (warehouseIds.length === 0) {
        // No accessible warehouses, return empty stats
        return {
          totalProducts: 0,
          totalStock: 0,
          todayIssuances: 0,
          lowStockCount: 0,
        }
      }
    }

    // "Today" is the local calendar date, matching the issuance `date` column
    const today = new Date().toLocaleDateString("en-CA")
    let issuancesQuery = supabase.from("issuances").select("id", { count: "exact", head: true }).eq("date", today)
    if (warehouseIds) issuancesQuery = issuancesQuery.in("warehouse_id", warehouseIds)

    const [products, issuancesResult] = await Promise.all([
      fetchAllRows<{ stock: number; min_stock: number }>("products", "id, stock, min_stock, warehouse_id", (q) => {
        const scoped = warehouseIds ? q.in("warehouse_id", warehouseIds) : q
        return scoped.order("id")
      }),
      issuancesQuery,
    ])

    const totalProducts = products.length
    const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0)
    const lowStockCount = products.filter((p) => (p.stock || 0) <= (p.min_stock || 0) && (p.stock || 0) > 0).length
    const todayIssuances = issuancesResult.count || 0

    const stats = {
      totalProducts,
      totalStock,
      todayIssuances,
      lowStockCount,
    }

    // Update cache only for non-user-specific queries
    if (!userId) {
      dashboardStatsCache = {
        data: stats,
        timestamp: Date.now(),
      }
    }

    return stats
  }, "Failed to fetch dashboard stats")
}

// Enhanced chart data functions
export async function getMonthlyStockData(userId?: string) {
  return withErrorHandling(async () => {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    
    // Filter by user's warehouses if userId provided
    let warehouseIds: number[] | null = null
    if (userId) {
      warehouseIds = await getUserAccessibleWarehouses(userId)
      if (warehouseIds.length === 0) {
        return []
      }
    }
    const scope = (q: any) => (warehouseIds ? q.in("warehouse_id", warehouseIds) : q)
    const since = sixMonthsAgo.toISOString()

    const [issuances, stockEntries, products] = await Promise.all([
      fetchAllRows<{ created_at: string; quantity: number }>("issuances", "id, created_at, quantity", (q) =>
        scope(q.gte("created_at", since)).order("id"),
      ),
      fetchAllRows<{ created_at: string; quantity_added: number }>("stock_entries", "id, created_at, quantity_added", (q) =>
        scope(q.gte("created_at", since)).order("id"),
      ),
      fetchAllRows<{ stock: number }>("products", "id, stock", (q) => scope(q).order("id")),
    ])
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

      // Stock at the end of this month = current stock, plus what was issued since, minus what was added since
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1)
      const issuedSince = issuances
        .filter((issuance) => new Date(issuance.created_at) >= monthEnd)
        .reduce((sum, issuance) => sum + (issuance.quantity || 0), 0)
      const addedSince = stockEntries
        .filter((entry) => new Date(entry.created_at) >= monthEnd)
        .reduce((sum, entry) => sum + (entry.quantity_added || 0), 0)
      const stockAtMonth = Math.max(0, currentTotalStock + issuedSince - addedSince)

      monthlyData.push({
        name: monthName,
        stock: stockAtMonth,
      })
    }

    return monthlyData
  }, "Failed to fetch monthly stock data")
}

export async function getWeeklyIssuanceData(userId?: string) {
  return withErrorHandling(async () => {
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    let query = supabase
      .from("issuances")
      .select("created_at, quantity, warehouse_id")
      .gte("created_at", oneWeekAgo.toISOString())
    
    // Filter by user's warehouses if userId provided
    if (userId) {
      const accessibleWarehouses = await getUserAccessibleWarehouses(userId)
      const warehouseIds = accessibleWarehouses
      
      if (warehouseIds.length > 0) {
        query = query.in("warehouse_id", warehouseIds)
      } else {
        return []
      }
    }

    const { data: issuances } = await query

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
export type IssuanceReportFilters = {
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
}

export async function getFilteredIssuances(filters: IssuanceReportFilters = {}) {
  return withErrorHandling(async () => {
    const category = filters.category && filters.category !== "all" ? filters.category : undefined
    const itemCode = filters.itemCode?.trim()
    const productName = filters.productName?.trim().toLowerCase()

    // Only inner-join products when filtering on product columns, so issuances
    // whose product row is missing still show up in unfiltered reports.
    const productJoin = category || itemCode ? "products!inner" : "products"
    const columns = `
      *,
      ${productJoin}(
        id,
        name,
        brand,
        model,
        category,
        description,
        item_code,
        purchase_price,
        selling_price
      )
    `

    const applyFilters = (query: any) => {
      // Filter on the issuance date the user sees (and can edit), not on when the row was
      // inserted. `date` is a DATE column, so an end date of 2026-03-31 includes all of that day.
      if (filters.startDate) query = query.gte("date", filters.startDate)
      if (filters.endDate) query = query.lte("date", filters.endDate)

      if (filters.branch && filters.branch !== "all") {
        query = isNaN(Number(filters.branch)) ? query.eq("branch", filters.branch) : query.eq("branch_id", filters.branch)
      }
      if (filters.engineer) query = query.ilike("engineer", `%${filters.engineer}%`)
      if (filters.customer && filters.customer !== "all") {
        query = isNaN(Number(filters.customer))
          ? query.ilike("customer_name", `%${filters.customer}%`)
          : query.eq("customer_id", filters.customer)
      }
      if (filters.warehouse && filters.warehouse !== "all") query = query.eq("warehouse_id", filters.warehouse)
      if (filters.serialNumber) query = query.ilike("serial_number", `%${filters.serialNumber}%`)
      if (category) query = query.eq("products.category", category)
      if (itemCode) query = query.ilike("products.item_code", `%${itemCode}%`)

      return query
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
    }

    let results: any[]
    if (filters.limit && !productName) {
      const { data, error } = await applyFilters(supabase.from("issuances").select(columns)).limit(filters.limit)
      if (error) throw error
      results = data || []
    } else {
      results = await fetchAllRows("issuances", columns, applyFilters)
    }

    // Product name matches either the name stored on the issuance or the current product name
    if (productName) {
      results = results.filter(item =>
        item.product_name?.toLowerCase().includes(productName) ||
        item.products?.name?.toLowerCase().includes(productName)
      )
      if (filters.limit) results = results.slice(0, filters.limit)
    }

    // Get warehouses to map warehouse_id to warehouse name
    const { data: warehousesData } = await supabase.from("warehouses").select("id, name")
    const warehouseMap = new Map((warehousesData || []).map(w => [w.id, w.name]))

    // Map to enhanced format with product details
    return results.map(item => ({
      ...item,
      productId: item.product_id,
      productName: item.product_name,
      customerName: item.customer_name,
      serialNumber: item.serial_number,
      issuedBy: item.issued_by,
      date: item.date || item.created_at?.split("T")[0],
      item_code: item.products?.item_code || null,
      warehouseId: item.warehouse_id,
      warehouseName: item.warehouse_id ? warehouseMap.get(item.warehouse_id) || '' : '',
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

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
]

// Group by calendar month of the issuance date (Gregorian), oldest first,
// keeping the year so January 2025 and January 2026 stay separate.
export function summarizeMonthlyIssuances(issuances: any[]) {
  const byMonth = new Map<string, number>()
  for (const item of issuances) {
    const key = String(item.date || item.created_at || "").slice(0, 7) // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(key)) continue
    byMonth.set(key, (byMonth.get(key) || 0) + (item.quantity || 0))
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, issued]) => ({
      month: `${ARABIC_MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`,
      issued,
    }))
}

export function summarizeProductFrequency(issuances: any[], top = 10) {
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

  return Object.values(productData)
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, top)
}

export function summarizeBranchPerformance(issuances: any[]) {
  const branchData = issuances.reduce((acc: any, item) => {
    if (!acc[item.branch]) {
      acc[item.branch] = { branch: item.branch, count: 0 }
    }
    acc[item.branch].count += item.quantity || 0
    return acc
  }, {})

  return Object.values(branchData).sort((a: any, b: any) => b.count - a.count)
}

export async function getMonthlyIssuances(filters: IssuanceReportFilters = {}) {
  return withErrorHandling(
    async () => summarizeMonthlyIssuances(await getFilteredIssuances(filters)),
    "Failed to fetch monthly issuances",
  )
}

export async function getProductFrequency(filters: IssuanceReportFilters = {}) {
  return withErrorHandling(
    async () => summarizeProductFrequency(await getFilteredIssuances(filters)),
    "Failed to fetch product frequency",
  )
}

export async function getBranchPerformance(filters: IssuanceReportFilters = {}) {
  return withErrorHandling(
    async () => summarizeBranchPerformance(await getFilteredIssuances(filters)),
    "Failed to fetch branch performance",
  )
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
      entryTimeFormatted: formatTimeOnly(entry.entry_time, entry.entry_date),
      entryDateTimeFormatted: formatDateTime(entry.entry_datetime)
    }))
  }, "Failed to fetch stock entries")
}

export async function createStockEntry(entry: {
  productId: number
  quantityAdded: number
  notes?: string
  userId?: string
  userName?: string
}) {
  return withErrorHandling(async () => {
    // Check warehouse permission if product has warehouse
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("warehouse_id")
      .eq("id", entry.productId)
      .single()

    if (productError || !product) {
      throw new Error("Product not found")
    }
    if (product.warehouse_id) {
      await checkWarehousePermission(product.warehouse_id, 'edit')
    }

    // Stock and its history row are written together by the database (see add_stock);
    // who entered it is taken from the session, not from the client
    const { data: stockEntry, error } = await supabase.rpc("add_stock", {
      p_product_id: entry.productId,
      p_quantity: entry.quantityAdded,
      p_notes: entry.notes || null,
    })
    if (error) throw error

    return {
      ...stockEntry,
      entryDateFormatted: formatDate(stockEntry.entry_date),
      entryTimeFormatted: formatTimeOnly(stockEntry.entry_time, stockEntry.entry_date),
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
      entryTimeFormatted: formatTimeOnly(entry.entry_time, entry.entry_date),
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
export function parseSafeDate(dateStr: string | Date): Date {
  if (!dateStr) return new Date()
  if (dateStr instanceof Date) return dateStr
  
  // Replace dashes with slashes for Safari compatibility
  const formattedStr = typeof dateStr === 'string' 
    ? dateStr.replace(/-/g, '/') 
    : dateStr
    
  const parsed = new Date(formattedStr)
  if (isNaN(parsed.getTime())) {
    if (typeof dateStr === 'string') {
      const parts = dateStr.split(/[-/T :]/)
      if (parts.length >= 3) {
        const year = parseInt(parts[0])
        const month = parseInt(parts[1]) - 1
        const day = parseInt(parts[2])
        const hours = parts.length > 3 ? parseInt(parts[3]) : 0
        const minutes = parts.length > 4 ? parseInt(parts[4]) : 0
        const seconds = parts.length > 5 ? parseInt(parts[5]) : 0
        return new Date(year, month, day, hours, minutes, seconds)
      }
    }
    return new Date()
  }
  return parsed
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "EGP",
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return parseSafeDate(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function formatDateTime(dateTime: string | Date): string {
  return parseSafeDate(dateTime).toLocaleString("en-US", {
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
  return parseSafeDate(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  })
}

// entry_time is stored in UTC (the database's clock). Convert it with the real Cairo
// time zone, which also follows Egypt's summer time (UTC+3) and winter time (UTC+2);
// the previous version always added 3 hours.
export function formatTimeOnly(time: string, date?: string): string {
  try {
    if (!time) return '-'
    const [hours, minutes = '00'] = time.split('.')[0].split(':')
    const day = date || new Date().toISOString().split('T')[0]
    const utc = new Date(`${day}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00Z`)
    if (isNaN(utc.getTime())) return time

    return utc.toLocaleTimeString("en-US", {
      timeZone: "Africa/Cairo",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    })
  } catch (error) {
    // في حالة حدوث خطأ، نعيد الوقت كما هو
    return time
  }
}

export function getCurrentEgyptTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    timeZone: "Africa/Cairo",
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
    return await fetchAllRows("branches", "*", (q) => q.order("name", { ascending: true }).order("id"))
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
      customer_id: sanitizedBranch.customer_id ? Number(sanitizedBranch.customer_id) : null,
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
    if (sanitizedUpdates.customer_id !== undefined) {
      dbUpdates.customer_id = sanitizedUpdates.customer_id ? Number(sanitizedUpdates.customer_id) : null
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
    return await fetchAllRows("customers", "*", (q) => q.order("name", { ascending: true }).order("id"))
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
    return await fetchAllRows("warehouses", "*", (q) => q.order("warehouse_number", { ascending: true }).order("id"))
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
    
    return await fetchAllRows(
      "products",
      `
        *,
        warehouses:warehouse_id(id, warehouse_number, name, location)
      `,
      (q) => q.ilike("item_code", `%${sanitizedCode}%`).order("item_code", { ascending: true }).order("id"),
    )
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
    const applyFilters = (query: any) => {
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
        query = query.gte("date", filters.startDate)
      }
    
      if (filters.endDate) {
        query = query.lte("date", filters.endDate)
      }

      return query.order("date", { ascending: false }).order("id", { ascending: false })
    }

    return await fetchAllRows(
      "issuances",
      `
        *,
        branches:branch_id(id, name, code),
        customers:customer_id(id, name, code),
        warehouses:warehouse_id(id, warehouse_number, name)
      `,
      applyFilters,
    )
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
      throw new Error("Category with this name already exists")
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
        throw new Error("Category with this name already exists")
      }
    }

    const updateData: any = {}
    if (sanitizedUpdates.name !== undefined) updateData.name = sanitizedUpdates.name.trim()
    if (sanitizedUpdates.description !== undefined) updateData.description = sanitizedUpdates.description?.trim() || null
    if (sanitizedUpdates.is_active !== undefined) updateData.is_active = sanitizedUpdates.is_active

    // Products store the category by name, so a rename has to carry over to them
    const { data: previous } = await supabase.from("categories").select("name").eq("id", id).single()

    const { data, error } = await supabase
      .from("categories")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    if (previous?.name && updateData.name && previous.name !== updateData.name) {
      const { error: renameError } = await supabase
        .from("products")
        .update({ category: updateData.name, updated_at: new Date().toISOString() })
        .eq("category", previous.name)
      if (renameError) throw renameError
    }
    return data
  }, "Failed to update category")
}

export async function deleteCategory(id: number) {
  return withErrorHandling(async () => {
    // Validate ID
    if (!id || id <= 0) {
      throw new SecurityError("Invalid category ID", "INVALID_INPUT")
    }

    // Products reference the category by name (not id), so look it up by name
    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("name")
      .eq("id", id)
      .single()
    if (categoryError) throw categoryError

    const { count, error: countError } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category", category.name)
    if (countError) throw countError

    if (count && count > 0) {
      throw new Error(`لا يمكن حذف فئة مستخدمة في ${count} منتج. انقل المنتجات لفئة أخرى أو عطّل الفئة بدلاً من حذفها`)
    }

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", id)

    if (error) throw error
    return { success: true }
  }, "Failed to delete category")
}
