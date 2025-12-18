"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Plus,
  Search,
  Edit,
  Trash2,
  AlertTriangle,
  Filter,
  Download,
  Upload,
  Package,
  TrendingUp,
  TrendingDown,
  Loader2,
  CheckCircle,
  XCircle,
  Calendar,
  Clock,
} from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { getProducts, createProduct, updateProduct, deleteProduct, getWarehouses, getCategories, searchByItemCode, generateNextItemCode } from "@/lib/database"
import { logActivity } from "@/lib/auth"
import { validateData, productSchema } from "@/lib/validation"
import { Pagination } from "@/components/ui/pagination"
import { ErrorBoundary } from "@/components/error-boundary"
import { StockEntriesDialog } from "@/components/stock-entries-dialog"

const ITEMS_PER_PAGE = 10

export default function InventoryPage() {
  const { user, loading: authLoading } = useAuth()
  const [products, setProducts] = useState([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
  const [warehouseFilter, setWarehouseFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE)
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [newProduct, setNewProduct] = useState({
    name: "",
    brand: "",
    model: "",
    category: "",
    item_code: "",
    warehouse_id: "",
    purchase_price: "",
    selling_price: "",
    stock: 0,
    minStock: 5,
    description: "",
  })
  const [formErrors, setFormErrors] = useState<string[]>([])  
  const [submitting, setSubmitting] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [isStockEntriesDialogOpen, setIsStockEntriesDialogOpen] = useState(false)
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<any>(null)
  const [editingItemCodeId, setEditingItemCodeId] = useState<number | null>(null)
  const [editingItemCodeValue, setEditingItemCodeValue] = useState("")
  const { toast } = useToast()

  // Simple role-based access check
  useEffect(() => {
    if (!user) return
    
    // Only allow admin, inventory_manager, and engineer roles
    if (!["admin", "inventory_manager", "engineer"].includes(user.role)) {
      toast({
        title: "غير مصرح لك",
        description: "ليس لديك صلاحية للوصول إلى هذه الصفحة",
        variant: "destructive",
      })
      window.location.href = "/dashboard"
    }
  }, [user, toast])

  useEffect(() => {
    const loadData = async () => {
      if (!user) return

      try {
        setLoading(true)
        
        // Load all products, warehouses and categories for all authorized users
        const [productsData, warehousesData, categoriesData] = await Promise.all([
          getProducts(),
          getWarehouses(),
          getCategories()
        ])
        setProducts(productsData)
        setWarehouses(warehousesData)
        setCategories(categoriesData)

        toast({
          title: "تم تحميل البيانات",
          description: `تم تحميل ${productsData.length} منتج بنجاح`,
        })
      } catch (error) {
        console.error("Error loading data:", error)
        toast({
          title: "خطأ في التحميل",
          description: "فشل في تحميل البيانات. يرجى إعادة المحاولة",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user, toast])

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.item_code && product.item_code.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesCategory = categoryFilter === "all" || product.category === categoryFilter

      const matchesWarehouse = warehouseFilter === "all" || product.warehouse_id === warehouseFilter

      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "low" && product.stock <= (product.min_stock || product.minStock) && product.stock > 0) ||
        (stockFilter === "out" && product.stock === 0) ||
        (stockFilter === "available" && product.stock > (product.min_stock || product.minStock))

      return matchesSearch && matchesCategory && matchesWarehouse && matchesStock
    })
  }, [products, searchTerm, categoryFilter, warehouseFilter, stockFilter])

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredProducts, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)

  const validateForm = (productData: any) => {
    if (!productData) {
      setFormErrors(["بيانات المنتج مطلوبة"])
      return false
    }
    
    const validation = validateData(productSchema, productData)
    if (!validation.success) {
      setFormErrors(validation.errors || [])
      return false
    }
    setFormErrors([])
    return true
  }
  
  // Helper function to check if user can edit a product
  const canEditProduct = (product: any) => {
    if (!user) return false
    return ["admin", "inventory_manager"].includes(user.role)
  }

  // Helper function to check if user can add products
  const canAddProduct = () => {
    if (!user) return false
    return ["admin", "inventory_manager"].includes(user.role)
  }

  const handleGenerateItemCode = async () => {
    try {
      const newItemCode = await generateNextItemCode()
      setNewProduct({ ...newProduct, item_code: newItemCode })
      toast({
        title: "تم إنشاء كود الصنف",
        description: `كود الصنف الجديد: ${newItemCode}`,
      })
    } catch (error: any) {
      toast({
        title: "فشل في إنشاء كود الصنف",
        description: error.message || "حدث خطأ أثناء إنشاء كود الصنف",
        variant: "destructive",
      })
    }
  }

  const handleAddProduct = async () => {
    if (!validateForm(newProduct)) {
      toast({
        title: "بيانات غير صحيحة",
        description: "يرجى تصحيح الأخطاء في النموذج",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const product = await createProduct(newProduct, user.id, user.name)
      setProducts([product, ...products])

      // Log activity
      await logActivity(
        user.id,
        user.name,
        "إضافة منتج",
        "إدارة المخزون",
        `تم إضافة المنتج: ${newProduct.name} - الكمية: ${newProduct.stock}`,
      )

      setNewProduct({
        name: "",
        brand: "",
        model: "",
        category: "",
        item_code: "",
        warehouse_id: "",
        price: "",
        stock: 0,
        minStock: 5,
        description: "",
      })
      setIsAddDialogOpen(false)

      toast({
        title: "تمت الإضافة بنجاح",
        description: `تم إضافة المنتج "${newProduct.name}" إلى المخزون`,
      })
    } catch (error: any) {
      console.error("Error adding product:", error)
      toast({
        title: "فشل في إضافة المنتج",
        description: error.message || "حدث خطأ أثناء إضافة المنتج. يرجى المحاولة مرة أخرى",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditProduct = async () => {
    if (!editingProduct) {
      toast({
        title: "خطأ",
        description: "لم يتم تحديد منتج للتعديل",
        variant: "destructive",
      })
      return
    }

    if (!validateForm(editingProduct)) {
      toast({
        title: "بيانات غير صحيحة",
        description: "يرجى تصحيح الأخطاء في النموذج",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const updatedProduct = await updateProduct(editingProduct.id, editingProduct, user.id)
      setProducts(products.map((p) => (p.id === editingProduct.id ? updatedProduct : p)))

      // Log activity
      await logActivity(user.id, user.name, "تعديل منتج", "إدارة المخزون", `تم تعديل المنتج: ${editingProduct.name}`)

      setEditingProduct(null)
      setIsEditDialogOpen(false)

      toast({
        title: "تم التحديث بنجاح",
        description: `تم تحديث بيانات المنتج "${editingProduct.name}"`
      })
    } catch (error: any) {
      console.error("Error updating product:", error)
      
      let errorMessage = "حدث خطأ أثناء تحديث المنتج. يرجى المحاولة مرة أخرى"
      
      if (error.message && error.message.includes("Access denied: You don't have edit permission for this warehouse")) {
        errorMessage = "ليس لديك صلاحية تعديل المنتجات في هذا المخزن. يرجى التواصل مع المدير لمنحك الصلاحيات المطلوبة."
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast({
        title: "فشل في تحديث المنتج",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteProduct = async (id: number, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف المنتج "${name}"؟`)) {
      return
    }

    try {
      await deleteProduct(id, user.id)
      setProducts(products.filter((p) => p.id !== id))
      setSelectedProducts(selectedProducts.filter((pid) => pid !== id))

      // Log activity
      await logActivity(user.id, user.name, "حذف منتج", "إدارة المخزون", `تم حذف المنتج: ${name}`)

      toast({
        title: "تم الحذف بنجاح",
        description: `تم حذف المنتج "${name}" من المخزون`,
      })
    } catch (error: any) {
      console.error("Error deleting product:", error)
      
      let errorMessage = "حدث خطأ أثناء حذف المنتج. يرجى المحاولة مرة أخرى"
      
      if (error.message && error.message.includes("Cannot delete product with existing issuances")) {
        errorMessage = "لا يمكن حذف هذا المنتج لأنه مرتبط بعمليات إصدار موجودة. يرجى حذف عمليات الإصدار أولاً أو تحويلها لمنتج آخر."
      } else if (error.message && error.message.includes("Access denied: You don't have delete permission for this warehouse")) {
        errorMessage = "ليس لديك صلاحية حذف المنتجات من هذا المخزن. يرجى التواصل مع المدير لمنحك الصلاحيات المطلوبة."
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast({
        title: "فشل في حذف المنتج",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const handleBulkDelete = () => {
    if (selectedProducts.length === 0) return
    setIsBulkDeleteDialogOpen(true)
  }

  const confirmBulkDelete = async () => {
    try {
      const deletedNames = selectedProducts.map((id) => products.find((p) => p.id === id)?.name).filter(Boolean)

      await Promise.all(selectedProducts.map((id) => deleteProduct(id, user.id)))
      setProducts(products.filter((p) => !selectedProducts.includes(p.id)))

      // Log activity
      await logActivity(user.id, user.name, "حذف متعدد", "إدارة المخزون", `تم حذف ${selectedProducts.length} منتج`)

      setSelectedProducts([])
      setIsBulkDeleteDialogOpen(false)

      toast({
        title: "تم الحذف بنجاح",
        description: `تم حذف ${selectedProducts.length} منتج من المخزون`,
      })
    } catch (error: any) {
      console.error("Error bulk deleting products:", error)
      
      let errorMessage = "حدث خطأ أثناء حذف المنتجات. يرجى المحاولة مرة أخرى"
      
      if (error.message && error.message.includes("Cannot delete product with existing issuances")) {
        errorMessage = "لا يمكن حذف بعض المنتجات لأنها مرتبطة بعمليات إصدار موجودة. يرجى حذف عمليات الإصدار أولاً أو تحويلها لمنتجات أخرى."
      }
      
      setIsBulkDeleteDialogOpen(false)
      
      toast({
        title: "فشل في الحذف المتعدد",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const handleExportProducts = async () => {
    try {
      // Import ExcelJS library dynamically
      const ExcelJS = (await import('exceljs')).default
      const workbook = new ExcelJS.Workbook()
      
      // Create main products sheet
      const worksheet = workbook.addWorksheet('المنتجات', {
        views: [{ rightToLeft: true }]
      })
      
      // Define columns with same format as import template
      worksheet.columns = [
        { header: 'اسم المنتج', key: 'name', width: 30 },
        { header: 'العلامة التجارية', key: 'brand', width: 20 },
        { header: 'الموديل', key: 'model', width: 20 },
        { header: 'الفئة', key: 'category', width: 25 },
        { header: 'كود المنتج', key: 'item_code', width: 15 },
        { header: 'رقم المخزن', key: 'warehouse_number', width: 15 },
        { header: 'الكمية', key: 'stock', width: 12 },
        { header: 'الحد الأدنى', key: 'min_stock', width: 12 },
        { header: 'سعر الشراء', key: 'purchase_price', width: 15 },
        { header: 'سعر البيع', key: 'selling_price', width: 15 },
        { header: 'الوصف', key: 'description', width: 40 },
      ]
      
      // Style header row
      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' }
      }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25
      
      // Add data rows
      filteredProducts.forEach((product, index) => {
        const warehouse = warehouses.find(w => w.id === product.warehouse_id)
        const row = worksheet.addRow({
          name: product.name,
          brand: product.brand,
          model: product.model,
          category: product.category,
          item_code: product.item_code || '',
          warehouse_number: warehouse?.warehouse_number || '',
          stock: product.stock,
          min_stock: product.min_stock || product.minStock || 0,
          purchase_price: product.purchase_price || '',
          selling_price: product.selling_price || '',
          description: product.description || '',
        })
        
        // Zebra striping
        if (index % 2 === 1) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' }
          }
        }
        row.alignment = { horizontal: 'right', vertical: 'middle' }
      })
      
      // Add borders to all cells
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
          }
        })
      })
      
      // Generate and download the file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `قطع_الغيار_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "تم التصدير بنجاح",
        description: `تم تصدير ${filteredProducts.length} منتج إلى ملف Excel`,
      })
    } catch (error) {
      console.error("Export error:", error)
      toast({
        title: "فشل في التصدير",
        description: "حدث خطأ أثناء تصدير البيانات",
        variant: "destructive",
      })
    }
  }

  const handleImportExcel = async () => {
    if (!importFile) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار ملف Excel",
        variant: "destructive",
      })
      return
    }

    setImporting(true)
    try {
      // Import xlsx library dynamically
      const XLSX = await import('xlsx')
      
      const data = await importFile.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      if (jsonData.length < 2) {
        throw new Error("الملف فارغ أو لا يحتوي على بيانات")
      }

      const headers = jsonData[0] as string[]
      const rows = jsonData.slice(1) as any[][]

      // Map column indices
      const columnMap = {
        name: headers.findIndex(h => h?.includes('اسم المنتج') || h?.includes('name')),
        brand: headers.findIndex(h => h?.includes('العلامة التجارية') || h?.includes('brand')),
        model: headers.findIndex(h => h?.includes('الموديل') || h?.includes('model')),
        category: headers.findIndex(h => h?.includes('الفئة') || h?.includes('category')),
        item_code: headers.findIndex(h => h?.includes('كود الصنف') || h?.includes('item_code')),
        warehouse: headers.findIndex(h => h?.includes('المخزن') || h?.includes('warehouse')),
        purchase_price: headers.findIndex(h => h?.includes('سعر الشراء') || h?.includes('purchase_price')),
        selling_price: headers.findIndex(h => h?.includes('سعر البيع') || h?.includes('selling_price')),
        stock: headers.findIndex(h => h?.includes('الكمية') || h?.includes('stock')),
        minStock: headers.findIndex(h => h?.includes('الحد الأدنى') || h?.includes('min_stock')),
        description: headers.findIndex(h => h?.includes('الوصف') || h?.includes('description'))
      }

      // Validate required columns
      if (columnMap.name === -1 || columnMap.brand === -1 || columnMap.category === -1) {
        throw new Error("الملف يجب أن يحتوي على الأعمدة المطلوبة: اسم المنتج، العلامة التجارية، الفئة")
      }

      const importedProducts = []
      const errors = []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        if (!row || row.length === 0) continue

        try {
          // Find warehouse by name
          const warehouseName = row[columnMap.warehouse]?.toString()?.trim()
          const warehouse = warehouses.find(w => w.name === warehouseName)
          
          const productData = {
            name: row[columnMap.name]?.toString()?.trim() || '',
            brand: row[columnMap.brand]?.toString()?.trim() || '',
            model: row[columnMap.model]?.toString()?.trim() || '',
            category: row[columnMap.category]?.toString()?.trim() || '',
            item_code: row[columnMap.item_code]?.toString()?.trim() || '',
            warehouse_id: warehouse?.id?.toString() || warehouses[0]?.id?.toString() || '',
            purchase_price: row[columnMap.purchase_price]?.toString() || '',
            selling_price: row[columnMap.selling_price]?.toString() || '',
            stock: parseInt(row[columnMap.stock]?.toString()) || 0,
            minStock: parseInt(row[columnMap.minStock]?.toString()) || 5,
            description: row[columnMap.description]?.toString()?.trim() || ''
          }

          // Validate required fields
          if (!productData.name || !productData.brand || !productData.category) {
            errors.push(`الصف ${i + 2}: بيانات مطلوبة مفقودة (اسم المنتج، العلامة التجارية، الفئة)`)
            continue
          }

          // Generate item code if not provided
          if (!productData.item_code) {
            productData.item_code = await generateNextItemCode()
          }

          const newProduct = await createProduct(productData, user.id, user.name)
          importedProducts.push(newProduct)

        } catch (error: any) {
          errors.push(`الصف ${i + 2}: ${error.message}`)
        }
      }

      // Update products list
      if (importedProducts.length > 0) {
        setProducts([...importedProducts, ...products])
        
        // Log activity
        await logActivity(
          user.id,
          user.name,
          "استيراد منتجات",
          "إدارة المخزون",
          `تم استيراد ${importedProducts.length} منتج من ملف Excel`
        )
      }

      // Show results
      if (errors.length > 0) {
        toast({
          title: `تم استيراد ${importedProducts.length} منتج مع ${errors.length} خطأ`,
          description: errors.slice(0, 3).join('\n') + (errors.length > 3 ? '\n...' : ''),
          variant: "destructive",
        })
      } else {
        toast({
          title: "تم الاستيراد بنجاح",
          description: `تم استيراد ${importedProducts.length} منتج بنجاح`,
        })
      }

      // Close dialog and reset
      setIsImportDialogOpen(false)
      setImportFile(null)

    } catch (error: any) {
      console.error("Error importing Excel:", error)
      toast({
        title: "فشل في الاستيراد",
        description: error.message || "حدث خطأ أثناء استيراد الملف",
        variant: "destructive",
      })
    } finally {
      setImporting(false)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      // Import ExcelJS library dynamically
      const ExcelJS = await import('exceljs')
      
      // Fetch fresh categories and warehouses from database
      const [categoriesData, warehousesData] = await Promise.all([
        getCategories(),
        getWarehouses()
      ])
      
      // Create a new workbook
      const workbook = new ExcelJS.Workbook()
      
      // Create the main data sheet
      const worksheet = workbook.addWorksheet('المنتجات')
      
      // Add headers with styling
      const headers = [
        'اسم المنتج',
        'العلامة التجارية', 
        'الموديل',
        'الفئة',
        'كود الصنف',
        'المخزن',
        'سعر الشراء',
        'سعر البيع',
        'الكمية',
        'الحد الأدنى',
        'الوصف'
      ]
      
      const headerRow = worksheet.addRow(headers)
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '366092' }
      }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      
      // Add sample data row
      const sampleData = [
        'آلة عد النقود ABC-123',
        'ABC Company',
        'Model-2024',
        'آلات عد النقود',
        'ITM-001',
        'المخزن الرئيسي',
        '1500',
        '2000',
        '10',
        '5',
        'آلة عد النقود عالية الجودة'
      ]
      
      const sampleRow = worksheet.addRow(sampleData)
      sampleRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'F0F8FF' }
      }
      
      // Set column widths
      worksheet.columns = [
        { width: 25 }, // اسم المنتج
        { width: 20 }, // العلامة التجارية
        { width: 15 }, // الموديل
        { width: 20 }, // الفئة
        { width: 15 }, // كود الصنف
        { width: 20 }, // المخزن
        { width: 12 }, // سعر الشراء
        { width: 12 }, // سعر البيع
        { width: 10 }, // الكمية
        { width: 12 }, // الحد الأدنى
        { width: 30 }  // الوصف
      ]
      
      // Add data validation for categories (column D - الفئة)
      if (categoriesData && categoriesData.length > 0) {
        const categoryNames = categoriesData.map(cat => cat.name).join(',')
        worksheet.dataValidations.add('D2:D1000', {
          type: 'list',
          allowBlank: true,
          formulae: [`"${categoryNames}"`],
          showErrorMessage: true,
          errorTitle: 'خطأ في الفئة',
          error: 'يرجى اختيار فئة من القائمة المنسدلة'
        })
      }
      
      // Add data validation for warehouses (column F - المخزن)
      if (warehousesData && warehousesData.length > 0) {
        const warehouseNames = warehousesData.map(warehouse => warehouse.name).join(',')
        worksheet.dataValidations.add('F2:F1000', {
          type: 'list',
          allowBlank: true,
          formulae: [`"${warehouseNames}"`],
          showErrorMessage: true,
          errorTitle: 'خطأ في المخزن',
          error: 'يرجى اختيار مخزن من القائمة المنسدلة'
        })
      }
      
      // Create categories reference sheet
      const categoriesSheet = workbook.addWorksheet('الفئات')
      categoriesSheet.addRow(['الفئات المتاحة'])
      if (categoriesData && categoriesData.length > 0) {
        categoriesData.forEach(cat => {
          categoriesSheet.addRow([cat.name])
        })
      }
      categoriesSheet.getRow(1).font = { bold: true }
      categoriesSheet.getColumn(1).width = 30
      
      // Create warehouses reference sheet
      const warehousesSheet = workbook.addWorksheet('المخازن')
      warehousesSheet.addRow(['المخازن المتاحة'])
      if (warehousesData && warehousesData.length > 0) {
        warehousesData.forEach(warehouse => {
          warehousesSheet.addRow([warehouse.name])
        })
      }
      warehousesSheet.getRow(1).font = { bold: true }
      warehousesSheet.getColumn(1).width = 30
      
      // Create instructions sheet
      const instructionsSheet = workbook.addWorksheet('التعليمات')
      const instructions = [
        ['تعليمات استيراد المنتجات'],
        [''],
        ['الحقول المطلوبة (يجب ملؤها):'],
        ['• اسم المنتج'],
        ['• العلامة التجارية'],
        ['• الفئة (اختر من القائمة المنسدلة)'],
        [''],
        ['الحقول الاختيارية:'],
        ['• الموديل'],
        ['• كود الصنف (سيتم إنشاؤه تلقائياً إذا ترك فارغاً)'],
        ['• المخزن (اختر من القائمة المنسدلة)'],
        ['• سعر الشراء'],
        ['• سعر البيع'],
        ['• الكمية (افتراضي: 0)'],
        ['• الحد الأدنى (افتراضي: 5)'],
        ['• الوصف'],
        [''],
        ['ملاحظات مهمة:'],
        ['• استخدم القوائم المنسدلة للفئات والمخازن'],
        ['• احذف الصف النموذجي قبل إضافة بياناتك'],
        ['• تأكد من حفظ الملف بصيغة Excel (.xlsx)'],
        ['• يمكنك مراجعة الفئات والمخازن المتاحة في الأوراق المرجعية']
      ]
      
      instructions.forEach(instruction => {
        instructionsSheet.addRow(instruction)
      })
      
      instructionsSheet.getRow(1).font = { bold: true, size: 14 }
      instructionsSheet.getColumn(1).width = 60
      
      // Generate and download the file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `قالب_استيراد_المنتجات_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast({
        title: "تم تحميل القالب",
        description: "تم تحميل قالب Excel مع القوائم المنسدلة بنجاح. يرجى ملء البيانات واستيرادها.",
      })
      
    } catch (error: any) {
      console.error("Error downloading template:", error)
      toast({
        title: "فشل في تحميل القالب",
        description: "حدث خطأ أثناء إنشاء قالب Excel",
        variant: "destructive",
      })
    }
  }

  // دالة لحفظ كود الصنف مباشرة (inline editing)
  const handleSaveItemCode = async (productId: number, newItemCode: string) => {
    const product = products.find((p: any) => p.id === productId)
    if (!product) return
    
    // إذا لم يتغير الكود، لا نحفظ
    if (product.item_code === newItemCode) {
      setEditingItemCodeId(null)
      setEditingItemCodeValue("")
      return
    }
    
    try {
      const updatedProduct = await updateProduct(productId, { ...product, item_code: newItemCode }, user?.id)
      setProducts(products.map((p: any) => (p.id === productId ? updatedProduct : p)))
      
      toast({
        title: "تم التحديث",
        description: `تم تحديث كود الصنف إلى: ${newItemCode}`,
      })
      
      // Log activity
      if (user) {
        await logActivity(user.id, user.name || '', "تعديل كود الصنف", "إدارة المخزون", `تم تعديل كود الصنف للمنتج: ${product.name} إلى ${newItemCode}`)
      }
    } catch (error: any) {
      console.error("Error updating item code:", error)
      toast({
        title: "فشل في التحديث",
        description: error.message || "حدث خطأ أثناء تحديث كود الصنف",
        variant: "destructive",
      })
    } finally {
      setEditingItemCodeId(null)
      setEditingItemCodeValue("")
    }
  }

  const getStockStatus = (stock: number, minStock: number) => {
    if (stock === 0)
      return {
        label: "نفد المخزون",
        variant: "destructive" as const,
        color: "text-red-400",
        icon: XCircle,
      }
    if (stock <= minStock)
      return {
        label: "مخزون منخفض",
        variant: "secondary" as const,
        color: "text-orange-400",
        icon: AlertTriangle,
      }
    return {
      label: "متوفر",
      variant: "default" as const,
      color: "text-green-400",
      icon: CheckCircle,
    }
  }

  const clearFilters = () => {
    setSearchTerm("")
    setCategoryFilter("all")
    setStockFilter("all")
    setWarehouseFilter("all")
    setCurrentPage(1)

    toast({
      title: "تم مسح الفلاتر",
      description: "تم إعادة تعيين جميع فلاتر البحث",
    })
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen bg-slate-900 items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <div className="text-white text-lg">جاري التحميل...</div>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen bg-slate-950 relative overflow-hidden" dir="rtl">
        {/* Decorative background */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 [background:radial-gradient(700px_circle_at_100%_0%,rgba(37,99,235,0.12),transparent_60%),radial-gradient(700px_circle_at_0%_100%,rgba(14,165,233,0.1),transparent_60%)]" />
        <Sidebar />
        <div className="flex-1 p-3 sm:p-4 lg:p-6 relative">
          <div className="mb-4 sm:mb-6 lg:mb-8">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 sm:mb-2">إدارة المخزون</h1>
            <p className="text-slate-300 text-sm sm:text-base">إضافة وتعديل وحذف المنتجات</p>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span className="text-slate-400 text-sm">
                  التاريخ الميلادي: {new Date().toLocaleDateString("en-US", {
                    year: "numeric", 
                    month: "numeric",
                    day: "numeric"
                  })} - {new Date().toLocaleDateString("en-US", {
                    weekday: "long"
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-green-400" />
                <span className="text-slate-400 text-sm">
                  التوقيت المصري: {(() => {
                    const now = new Date()
                    // إضافة 3 ساعات للتوقيت المصري
                    const egyptTime = new Date(now.getTime() + (3 * 60 * 60 * 1000))
                    return egyptTime.toLocaleString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true
                    })
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20 hover:border-blue-500/40 rounded-xl shadow-md hover:shadow-xl transition-all hover:-translate-y-0.5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-4 lg:p-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-slate-300">إجمالي المنتجات</CardTitle>
                <Package className="h-3 w-3 sm:h-4 sm:w-4 text-blue-400" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-white">{products.length}</div>
                <p className="text-xs text-slate-400">منتج مسجل</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20 hover:border-green-500/40 rounded-xl shadow-md hover:shadow-xl transition-all hover:-translate-y-0.5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-4 lg:p-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-slate-300">المنتجات المتوفرة</CardTitle>
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-400" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-white">
                  {products.filter((p) => p.stock > (p.min_stock || p.minStock)).length}
                </div>
                <p className="text-xs text-slate-400">في المخزون</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-orange-500/20 hover:border-orange-500/40 rounded-xl shadow-md hover:shadow-xl transition-all hover:-translate-y-0.5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-4 lg:p-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-slate-300">مخزون منخفض</CardTitle>
                <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-orange-400" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-400">
                  {products.filter((p) => p.stock <= (p.min_stock || p.minStock) && p.stock > 0).length}
                </div>
                <p className="text-xs text-slate-400">يحتاج تجديد</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-500/20 hover:border-red-500/40 rounded-xl shadow-md hover:shadow-xl transition-all hover:-translate-y-0.5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-4 lg:p-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-slate-300">نفد المخزون</CardTitle>
                <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-red-400" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-red-400">
                  {products.filter((p) => p.stock === 0).length}
                </div>
                <p className="text-xs text-slate-400">غير متوفر</p>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Controls */}
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm mb-3 sm:mb-4 lg:mb-6 rounded-xl shadow-lg">
            <CardHeader className="p-3 sm:p-4 lg:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                <CardTitle className="text-white text-right text-sm sm:text-base lg:text-lg">قائمة المنتجات ({filteredProducts.length})</CardTitle>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {selectedProducts.length > 0 && (
                    <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
                      <AlertDialogTrigger asChild>
                        <Button onClick={handleBulkDelete} variant="destructive" size="sm" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2">
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                          <span className="hidden sm:inline">حذف المحدد ({selectedProducts.length})</span>
                          <span className="sm:hidden">حذف ({selectedProducts.length})</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                          <AlertDialogDescription>
                            هل أنت متأكد من حذف {selectedProducts.length} منتج؟ هذا الإجراء لا يمكن التراجع عنه.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction onClick={confirmBulkDelete} className="bg-red-600 hover:bg-red-700">
                            حذف
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <Button onClick={handleExportProducts} variant="outline" size="sm" className="bg-slate-700/50 border-slate-600/50 hover:bg-slate-600/50 hover:border-slate-500/50 transition-colors text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2">
                    <Download className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                    <span className="hidden sm:inline">تصدير Excel</span>
                    <span className="sm:hidden">تصدير</span>
                  </Button>
                  {canAddProduct() && (
                    <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="bg-green-600/80 hover:bg-green-600 border-green-500/50 hover:border-green-500 transition-colors shadow-lg text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2">
                          <Upload className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                          <span className="hidden sm:inline">استيراد Excel</span>
                          <span className="sm:hidden">استيراد</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-slate-800/95 border-slate-700/50 text-white max-w-2xl backdrop-blur-sm shadow-2xl" dir="rtl">
                        <DialogHeader>
                          <DialogTitle className="text-right">استيراد منتجات من ملف Excel</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Alert className="bg-green-900/20 border-green-800">
                            <Download className="h-4 w-4" />
                            <AlertDescription className="text-green-300">
                              <div className="font-medium mb-3">ابدأ بتحميل القالب الجاهز:</div>
                              <Button
                                onClick={handleDownloadTemplate}
                                variant="outline"
                                className="bg-green-700/30 border-green-600/50 hover:bg-green-600/40 text-green-200 hover:text-green-100 mb-3"
                              >
                                <Download className="w-4 h-4 ml-2" />
                                تحميل قالب Excel
                              </Button>
                              <div className="text-sm text-green-400">
                                القالب يحتوي على جميع الأعمدة المطلوبة وقوائم مرجعية للفئات والمخازن
                              </div>
                            </AlertDescription>
                          </Alert>
                          <Alert className="bg-blue-900/20 border-blue-800">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription className="text-blue-300">
                              <div className="font-medium mb-2">تعليمات مهمة:</div>
                              <ul className="list-disc list-inside space-y-1 text-sm">
                                <li><strong>الحقول المطلوبة:</strong> اسم المنتج، العلامة التجارية، الفئة</li>
                                <li><strong>الفئة والمخزن:</strong> يجب أن تطابق تماماً الأسماء في القوائم المرجعية</li>
                                <li><strong>كود الصنف:</strong> سيتم إنشاؤه تلقائياً إذا ترك فارغاً</li>
                                <li><strong>صيغة الملف:</strong> .xlsx أو .xls فقط</li>
                                <li><strong>احذف الصف النموذجي</strong> من القالب قبل إضافة بياناتك</li>
                              </ul>
                            </AlertDescription>
                          </Alert>
                          <div className="grid gap-4">
                            <div className="grid gap-2">
                              <Label htmlFor="excel-file" className="text-right">
                                اختر ملف Excel *
                              </Label>
                              <Input
                                id="excel-file"
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                                className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 focus:ring-blue-500/20 text-right transition-colors"
                              />
                            </div>
                            <div className="flex gap-3 justify-end">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setIsImportDialogOpen(false)
                                  setImportFile(null)
                                }}
                                className="bg-slate-700/50 border-slate-600/50 hover:bg-slate-600/50"
                              >
                                إلغاء
                              </Button>
                              <Button
                                onClick={handleImportExcel}
                                disabled={!importFile || importing}
                                className="bg-green-600/80 hover:bg-green-600 border-green-500/50 hover:border-green-500"
                              >
                                {importing ? (
                                  <>
                                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                                    جاري الاستيراد...
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-4 h-4 ml-2" />
                                    استيراد البيانات
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                  {canAddProduct() && (
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="bg-blue-600/80 hover:bg-blue-600 border-blue-500/50 hover:border-blue-500 transition-colors shadow-lg text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2">
                          <Plus className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                          <span className="hidden sm:inline">إضافة منتج</span>
                          <span className="sm:hidden">إضافة</span>
                        </Button>
                      </DialogTrigger>
                    <DialogContent className="bg-slate-800/95 border-slate-700/50 text-white max-w-2xl backdrop-blur-sm shadow-2xl" dir="rtl">
                      <DialogHeader>
                        <DialogTitle className="text-right">إضافة منتج جديد</DialogTitle>
                      </DialogHeader>

                      {formErrors.length > 0 && (
                        <Alert className="bg-red-900/20 border-red-800">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-red-300">
                            <div className="font-medium mb-2">يرجى تصحيح الأخطاء التالية:</div>
                            <ul className="list-disc list-inside space-y-1">
                              {formErrors.map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="grid gap-4 py-4 max-h-96 overflow-y-auto">
                        <div className="grid gap-2">
                          <Label htmlFor="name" className="text-right">
                            اسم المنتج *
                          </Label>
                          <Input
                            id="name"
                            value={newProduct.name}
                            onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                            className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 focus:ring-blue-500/20 text-right transition-colors"
                            placeholder="أدخل اسم المنتج"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="brand" className="text-right">
                              العلامة التجارية *
                            </Label>
                            <Input
                              id="brand"
                              value={newProduct.brand}
                              onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                              className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 focus:ring-blue-500/20 text-right transition-colors"
                              placeholder="مثل: Canon"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="model" className="text-right">
                              الموديل *
                            </Label>
                            <Input
                              id="model"
                              value={newProduct.model}
                              onChange={(e) => setNewProduct({ ...newProduct, model: e.target.value })}
                              className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 focus:ring-blue-500/20 text-right transition-colors"
                              placeholder="مثل: CC-2000"
                            />
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="category" className="text-right">
                            الفئة *
                          </Label>
                          <Select
                            value={newProduct.category}
                            onValueChange={(value) => setNewProduct({ ...newProduct, category: value })}
                          >
                            <SelectTrigger className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 text-right transition-colors">
                              <SelectValue placeholder="اختر الفئة" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                              {categories.filter(cat => cat.is_active).map((category) => (
                                <SelectItem key={category.id} value={category.name} className="text-right">
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="item_code" className="text-right">
                              كود الصنف *
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                id="item_code"
                                value={newProduct.item_code}
                                onChange={(e) => setNewProduct({ ...newProduct, item_code: e.target.value })}
                                className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 focus:ring-blue-500/20 text-right font-mono flex-1 transition-colors"
                                placeholder="مثل: ITM-01"
                              />
                              <Button
                                type="button"
                                onClick={handleGenerateItemCode}
                                className="bg-blue-600/80 hover:bg-blue-600 border-blue-500/50 hover:border-blue-500 text-white px-3 transition-colors"
                                size="sm"
                              >
                                إنشاء تلقائي
                              </Button>
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="warehouse" className="text-right">
                              المخزون *
                            </Label>
                            <Select
                              value={newProduct.warehouse_id}
                              onValueChange={(value) => setNewProduct({ ...newProduct, warehouse_id: value })}
                            >
                              <SelectTrigger className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 text-right transition-colors">
                                <SelectValue placeholder="اختر المخزون" />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-700">
                                {warehouses.map((warehouse) => (
                                  <SelectItem key={warehouse.id} value={warehouse.id} className="text-right">
                                    {warehouse.name} - {warehouse.warehouse_number}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="purchase_price" className="text-right">
                              سعر الشراء
                            </Label>
                            <Input
                              id="purchase_price"
                              type="number"
                              min="0"
                              step="0.01"
                              value={newProduct.purchase_price}
                              onChange={(e) => setNewProduct({ ...newProduct, purchase_price: e.target.value })}
                              className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 focus:ring-blue-500/20 text-center transition-colors"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="selling_price" className="text-right">
                              سعر البيع
                            </Label>
                            <Input
                              id="selling_price"
                              type="number"
                              min="0"
                              step="0.01"
                              value={newProduct.selling_price}
                              onChange={(e) => setNewProduct({ ...newProduct, selling_price: e.target.value })}
                              className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 focus:ring-blue-500/20 text-center transition-colors"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="stock" className="text-right">
                              الكمية المتوفرة
                            </Label>
                            <Input
                              id="stock"
                              type="number"
                              min="0"
                              value={newProduct.stock}
                              onChange={(e) =>
                                setNewProduct({ ...newProduct, stock: Number.parseInt(e.target.value) || 0 })
                              }
                              className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 focus:ring-blue-500/20 text-center transition-colors"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="minStock" className="text-right">
                              الحد الأدنى للمخزون
                            </Label>
                            <Input
                              id="minStock"
                              type="number"
                              min="0"
                              value={newProduct.minStock}
                              onChange={(e) =>
                                setNewProduct({ ...newProduct, minStock: Number.parseInt(e.target.value) || 0 })
                              }
                              className="bg-slate-700 border-slate-600 text-center"
                            />
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="description" className="text-right">
                            الوصف
                          </Label>
                          <Textarea
                            id="description"
                            value={newProduct.description}
                            onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                            className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 focus:ring-blue-500/20 text-right transition-colors"
                            rows={3}
                            placeholder="وصف اختياري للمنتج"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={submitting} className="bg-slate-700/50 border-slate-600/50 hover:bg-slate-600/50 hover:border-slate-500/50 transition-colors">
                          إلغاء
                        </Button>
                        <Button onClick={handleAddProduct} disabled={submitting} className="bg-blue-600/80 hover:bg-blue-600 border-blue-500/50 hover:border-blue-500 transition-colors shadow-lg">
                          {submitting ? (
                            <>
                              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                              جاري الإضافة...
                            </>
                          ) : (
                            "إضافة المنتج"
                          )}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4 p-2 sm:p-3 lg:p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
                <div className="relative sm:col-span-2 lg:col-span-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-3 w-3 sm:h-4 sm:w-4" />
                  <Input
                    placeholder="البحث بالاسم أو كود الصنف..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 sm:pl-10 bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 transition-colors text-sm sm:text-base h-8 sm:h-9 lg:h-10"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 transition-colors text-sm sm:text-base h-8 sm:h-9 lg:h-10">
                    <SelectValue placeholder="جميع الفئات" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="all" className="text-right text-sm sm:text-base">
                      جميع الفئات
                    </SelectItem>
                    {categories.filter(cat => cat.is_active).map((category) => (
                      <SelectItem key={category.id} value={category.name} className="text-right text-sm sm:text-base">
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                  <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 transition-colors text-sm sm:text-base h-8 sm:h-9 lg:h-10">
                    <SelectValue placeholder="جميع المخازن" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="all" className="text-right text-sm sm:text-base">
                      جميع المخازن
                    </SelectItem>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id} className="text-right text-sm sm:text-base">
                        {warehouse.name} - {warehouse.warehouse_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 transition-colors text-sm sm:text-base h-8 sm:h-9 lg:h-10">
                    <SelectValue placeholder="جميع الحالات" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="all" className="text-right text-sm sm:text-base">
                      جميع الحالات
                    </SelectItem>
                    <SelectItem value="available" className="text-right text-sm sm:text-base">
                      متوفر
                    </SelectItem>
                    <SelectItem value="low" className="text-right text-sm sm:text-base">
                      مخزون منخفض
                    </SelectItem>
                    <SelectItem value="out" className="text-right text-sm sm:text-base">
                      نفد المخزون
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={clearFilters} variant="outline" className="bg-slate-700/50 border-slate-600/50 hover:bg-slate-600/50 transition-colors text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 h-8 sm:h-9 lg:h-10">
                  <Filter className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                  <span className="hidden sm:inline">مسح الفلاتر</span>
                  <span className="sm:hidden">مسح</span>
                </Button>
              </div>

              {/* Products Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-900/30 backdrop-blur-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700/50 bg-slate-800/70 hover:bg-slate-800/90 transition-colors">
                      <TableHead className="w-8 sm:w-12 text-center">
                        <Checkbox
                          checked={selectedProducts.length === paginatedProducts.length && paginatedProducts.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedProducts(paginatedProducts.map((p) => p.id))
                            } else {
                              setSelectedProducts([])
                            }
                          }}
                          className="h-3 w-3 sm:h-4 sm:w-4"
                        />
                      </TableHead>
                      <TableHead className="text-slate-300 text-right min-w-[120px] sm:min-w-[180px] text-xs sm:text-sm">اسم المنتج</TableHead>
                      <TableHead className="text-slate-300 text-right min-w-[80px] sm:min-w-[100px] text-xs sm:text-sm hidden sm:table-cell">كود الصنف</TableHead>
                      <TableHead className="text-slate-300 text-right min-w-[80px] sm:min-w-[100px] text-xs sm:text-sm hidden md:table-cell">العلامة التجارية</TableHead>
                      <TableHead className="text-slate-300 text-right min-w-[60px] sm:min-w-[80px] text-xs sm:text-sm hidden lg:table-cell">الموديل</TableHead>
                      <TableHead className="text-slate-300 text-right min-w-[80px] sm:min-w-[120px] text-xs sm:text-sm hidden md:table-cell">الفئة</TableHead>
                      <TableHead className="text-slate-300 text-right min-w-[80px] sm:min-w-[100px] text-xs sm:text-sm hidden lg:table-cell">المخزن</TableHead>
                      <TableHead className="text-slate-300 text-center min-w-[60px] sm:min-w-[80px] text-xs sm:text-sm hidden lg:table-cell">سعر الشراء</TableHead>
                      <TableHead className="text-slate-300 text-center min-w-[60px] sm:min-w-[80px] text-xs sm:text-sm hidden lg:table-cell">سعر البيع</TableHead>
                      <TableHead className="text-slate-300 text-center min-w-[60px] sm:min-w-[80px] text-xs sm:text-sm">المخزون</TableHead>
                      <TableHead className="text-slate-300 text-center min-w-[80px] sm:min-w-[100px] text-xs sm:text-sm">الحالة</TableHead>
                      <TableHead className="text-slate-300 text-center min-w-[80px] sm:min-w-[120px] text-xs sm:text-sm">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-8 sm:py-12">
                          <div className="flex items-center justify-center gap-2 text-slate-400">
                            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                            <span className="text-sm sm:text-base">جاري تحميل المنتجات...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : paginatedProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-8 sm:py-12">
                          <div className="text-center">
                            <Package className="w-8 h-8 sm:w-12 sm:h-12 text-slate-400 mx-auto mb-3 sm:mb-4" />
                            <h3 className="text-base sm:text-lg font-medium text-white mb-2">لا توجد منتجات</h3>
                            <p className="text-slate-400 mb-3 sm:mb-4 text-sm sm:text-base">
                              {searchTerm || categoryFilter !== "all" || stockFilter !== "all"
                                ? "لا توجد منتجات تطابق معايير البحث"
                                : "ابدأ بإضافة منتجات جديدة"}
                            </p>
                            {(searchTerm || categoryFilter !== "all" || stockFilter !== "all") && (
                              <Button onClick={clearFilters} variant="outline" className="bg-slate-700/50 border-slate-600/50 hover:bg-slate-600/50 hover:border-slate-500/50 transition-colors text-xs sm:text-sm">
                                مسح الفلاتر
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedProducts.map((product) => {
                        const status = getStockStatus(product.stock, product.min_stock || product.minStock)
                        const StatusIcon = status.icon
                        const warehouse = warehouses.find(w => w.id === product.warehouse_id)
                        return (
                          <TableRow key={product.id} className={`border-slate-700/50 hover:bg-slate-800/50 transition-colors ${status.label === 'نفد المخزون' ? 'bg-red-500/10' : status.label === 'مخزون منخفض' ? 'bg-orange-500/10' : 'bg-slate-900/20'}`}>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={selectedProducts.includes(product.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedProducts([...selectedProducts, product.id])
                                  } else {
                                    setSelectedProducts(selectedProducts.filter((id) => id !== product.id))
                                  }
                                }}
                                className="h-3 w-3 sm:h-4 sm:w-4"
                              />
                            </TableCell>
                            <TableCell className="text-white font-medium text-right py-2 sm:py-4">
                              <div>
                                <div className="font-medium text-xs sm:text-sm lg:text-base">{product.name}</div>
                                {product.description && (
                                  <div className="text-xs sm:text-sm text-slate-400 mt-1">{product.description}</div>
                                )}
                                {/* Show hidden info on mobile */}
                                <div className="sm:hidden mt-1 space-y-1">
                                  <div className="text-xs text-blue-400 font-mono">{product.item_code || '-'}</div>
                                  <div className="text-xs text-slate-400">{product.category}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-300 text-right py-2 sm:py-4 hidden sm:table-cell">
                              {editingItemCodeId === product.id ? (
                                <Input
                                  value={editingItemCodeValue}
                                  onChange={(e) => setEditingItemCodeValue(e.target.value)}
                                  onBlur={() => handleSaveItemCode(product.id, editingItemCodeValue)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSaveItemCode(product.id, editingItemCodeValue)
                                    } else if (e.key === 'Escape') {
                                      setEditingItemCodeId(null)
                                      setEditingItemCodeValue("")
                                    }
                                  }}
                                  autoFocus
                                  className="bg-slate-700/50 border-blue-500/50 text-blue-400 text-xs sm:text-sm font-mono h-7 w-24 text-center focus:ring-blue-500/20"
                                  placeholder="ITM-XX"
                                />
                              ) : (
                                <span 
                                  className="font-mono text-blue-400 text-xs sm:text-sm cursor-pointer hover:bg-slate-700/50 px-2 py-1 rounded transition-colors"
                                  onClick={() => {
                                    if (canEditProduct(product)) {
                                      setEditingItemCodeId(product.id)
                                      setEditingItemCodeValue(product.item_code || "")
                                    }
                                  }}
                                  title={canEditProduct(product) ? "انقر للتعديل" : ""}
                                >
                                  {product.item_code || '-'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-slate-300 text-right py-2 sm:py-4 hidden md:table-cell text-xs sm:text-sm">{product.brand}</TableCell>
                            <TableCell className="text-slate-300 text-right py-2 sm:py-4 hidden lg:table-cell text-xs sm:text-sm">{product.model}</TableCell>
                            <TableCell className="text-slate-300 text-right py-2 sm:py-4 hidden md:table-cell text-xs sm:text-sm">{product.category}</TableCell>
                            <TableCell className="text-slate-300 text-right py-2 sm:py-4 hidden lg:table-cell text-xs sm:text-sm">
                              {warehouse ? `${warehouse.name} - ${warehouse.warehouse_number}` : '-'}
                            </TableCell>
                            <TableCell className="text-center py-2 sm:py-4 hidden lg:table-cell">
                              <span className="text-blue-400 font-medium text-xs sm:text-sm">
                                {product.purchase_price ? `${Number(product.purchase_price).toLocaleString()} ج.م` : '-'}
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-2 sm:py-4 hidden lg:table-cell">
                              <span className="text-green-400 font-medium text-xs sm:text-sm">
                                {product.selling_price ? `${Number(product.selling_price).toLocaleString()} ج.م` : '-'}
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-2 sm:py-4">
                              <div className="flex items-center justify-center gap-1 sm:gap-2">
                                <span className={`${status.color} font-medium text-xs sm:text-sm`}>{product.stock.toLocaleString()}</span>
                                {product.stock <= (product.min_stock || product.minStock) && product.stock > 0 && (
                                  <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-orange-400" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center py-2 sm:py-4">
                              <Badge variant={status.variant} className="flex items-center gap-1 w-fit mx-auto text-xs">
                                <StatusIcon className="w-2 h-2 sm:w-3 sm:h-3" />
                                <span className="hidden sm:inline">{status.label}</span>
                                <span className="sm:hidden">{status.label === 'متوفر' ? 'متوفر' : status.label === 'مخزون منخفض' ? 'منخفض' : 'نفد'}</span>
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center py-2 sm:py-4">
                              <div className="flex gap-1 sm:gap-2 justify-center">
                                {canEditProduct(product) && (
                                  <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="bg-slate-700/50 border-slate-600/50 hover:bg-slate-600/50 hover:border-slate-500/50 transition-colors h-6 w-6 sm:h-8 sm:w-8 p-0"
                                        onClick={() => {
                                          setEditingProduct({
                                            ...product,
                                            minStock: product.minStock || product.min_stock || 5,
                                            description: product.description || ""
                                          })
                                          setIsEditDialogOpen(true)
                                        }}
                                      >
                                        <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                                      </Button>
                                    </DialogTrigger>
                                  <DialogContent
                                    className="bg-slate-800/95 border-slate-700/50 text-white max-w-2xl backdrop-blur-sm shadow-2xl"
                                    dir="rtl"
                                  >
                                    <DialogHeader>
                                      <DialogTitle className="text-right">تعديل المنتج</DialogTitle>
                                    </DialogHeader>

                                    {formErrors.length > 0 && (
                                      <Alert className="bg-red-900/20 border-red-800">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertDescription className="text-red-300">
                                          <div className="font-medium mb-2">يرجى تصحيح الأخطاء التالية:</div>
                                          <ul className="list-disc list-inside space-y-1">
                                            {formErrors.map((error, index) => (
                                              <li key={index}>{error}</li>
                                            ))}
                                          </ul>
                                        </AlertDescription>
                                      </Alert>
                                    )}

                                    {editingProduct && (
                                      <div className="grid gap-4 py-4 max-h-96 overflow-y-auto">
                                        <div className="grid gap-2">
                                          <Label htmlFor="edit-name" className="text-right">
                                            اسم المنتج
                                          </Label>
                                          <Input
                                            id="edit-name"
                                            value={editingProduct.name}
                                            onChange={(e) =>
                                              setEditingProduct({ ...editingProduct, name: e.target.value })
                                            }
                                            className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 focus:ring-blue-500/20 text-right transition-colors"
                                          />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="grid gap-2">
                                            <Label htmlFor="edit-brand" className="text-right">
                                              العلامة التجارية
                                            </Label>
                                            <Input
                                              id="edit-brand"
                                              value={editingProduct.brand}
                                              onChange={(e) =>
                                                setEditingProduct({ ...editingProduct, brand: e.target.value })
                                              }
                                              className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 focus:ring-blue-500/20 text-right transition-colors"
                                            />
                                          </div>
                                          <div className="grid gap-2">
                                            <Label htmlFor="edit-model" className="text-right">
                                              الموديل
                                            </Label>
                                            <Input
                                              id="edit-model"
                                              value={editingProduct.model}
                                              onChange={(e) =>
                                                setEditingProduct({ ...editingProduct, model: e.target.value })
                                              }
                                              className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 focus:ring-blue-500/20 text-right transition-colors"
                                            />
                                          </div>
                                        </div>
                                        <div className="grid gap-2">
                                          <Label htmlFor="edit-category" className="text-right">
                                            الفئة
                                          </Label>
                                          <Select
                                            value={editingProduct.category}
                                            onValueChange={(value) =>
                                              setEditingProduct({ ...editingProduct, category: value })
                                            }
                                          >
                                            <SelectTrigger className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 text-right transition-colors">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-800 border-slate-700">
                                              {categories.filter(cat => cat.is_active).map((category) => (
                                                <SelectItem key={category.id} value={category.name} className="text-right">
                                                  {category.name}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="grid gap-2">
                                            <Label htmlFor="edit-item-code" className="text-right">
                                              كود الصنف
                                            </Label>
                                            <Input
                                              id="edit-item-code"
                                              value={editingProduct.item_code || ''}
                                              onChange={(e) =>
                                                setEditingProduct({ ...editingProduct, item_code: e.target.value })
                                              }
                                              className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 focus:ring-blue-500/20 text-right font-mono transition-colors"
                                            />
                                          </div>
                                          <div className="grid gap-2">
                                            <Label htmlFor="edit-warehouse" className="text-right">
                                              المخزون
                                            </Label>
                                            <Select
                                              value={editingProduct.warehouse_id || ''}
                                              onValueChange={(value) =>
                                                setEditingProduct({ ...editingProduct, warehouse_id: value })
                                              }
                                            >
                                              <SelectTrigger className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 text-right transition-colors">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent className="bg-slate-800 border-slate-700">
                                                {warehouses.map((warehouse) => (
                                                  <SelectItem key={warehouse.id} value={warehouse.id} className="text-right">
                                                    {warehouse.name} - {warehouse.warehouse_number}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="grid gap-2">
                                            <Label htmlFor="edit-purchase-price" className="text-right">
                                              سعر الشراء
                                            </Label>
                                            <Input
                                              id="edit-purchase-price"
                                              type="number"
                                              step="0.01"
                                              value={editingProduct.purchase_price || ''}
                                              onChange={(e) =>
                                                setEditingProduct({ ...editingProduct, purchase_price: e.target.value ? parseFloat(e.target.value) : null })
                                              }
                                              className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 focus:ring-blue-500/20 text-center transition-colors"
                                              placeholder="0.00"
                                            />
                                          </div>
                                          <div className="grid gap-2">
                                            <Label htmlFor="edit-selling-price" className="text-right">
                                              سعر البيع
                                            </Label>
                                            <Input
                                              id="edit-selling-price"
                                              type="number"
                                              step="0.01"
                                              value={editingProduct.selling_price || ''}
                                              onChange={(e) =>
                                                setEditingProduct({ ...editingProduct, selling_price: e.target.value ? parseFloat(e.target.value) : null })
                                              }
                                              className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 focus:ring-blue-500/20 text-center transition-colors"
                                              placeholder="0.00"
                                            />
                                          </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="grid gap-2">
                                            <Label htmlFor="edit-stock" className="text-right">
                                              الكمية المتوفرة
                                            </Label>
                                            <Input
                                              id="edit-stock"
                                              type="number"
                                              min="0"
                                              value={editingProduct.stock}
                                              onChange={(e) =>
                                                setEditingProduct({
                                                  ...editingProduct,
                                                  stock: Number.parseInt(e.target.value) || 0,
                                                })
                                              }
                                              className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 focus:ring-blue-500/20 text-center transition-colors"
                                            />
                                          </div>
                                          <div className="grid gap-2">
                                            <Label htmlFor="edit-minStock" className="text-right">
                                              الحد الأدنى للمخزون
                                            </Label>
                                            <Input
                                              id="edit-minStock"
                                              type="number"
                                              min="0"
                                              value={editingProduct.minStock || editingProduct.min_stock}
                                              onChange={(e) =>
                                                setEditingProduct({
                                                  ...editingProduct,
                                                  minStock: Number.parseInt(e.target.value) || 0,
                                                  min_stock: Number.parseInt(e.target.value) || 0,
                                                })
                                              }
                                              className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 focus:ring-blue-500/20 text-center transition-colors"
                                            />
                                          </div>
                                        </div>
                                        <div className="grid gap-2">
                                          <Label htmlFor="edit-description" className="text-right">
                                            الوصف
                                          </Label>
                                          <Textarea
                                            id="edit-description"
                                            value={editingProduct.description || ""}
                                            onChange={(e) =>
                                              setEditingProduct({ ...editingProduct, description: e.target.value })
                                            }
                                            className="bg-slate-700/50 border-slate-600/50 focus:border-blue-500/50 focus:ring-blue-500/20 text-right transition-colors"
                                            rows={3}
                                          />
                                        </div>
                                      </div>
                                    )}
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="outline"
                                        onClick={() => setEditingProduct(null)}
                                        disabled={submitting}
                                        className="bg-slate-700/50 border-slate-600/50 hover:bg-slate-600/50 hover:border-slate-500/50 transition-colors"
                                      >
                                        إلغاء
                                      </Button>
                                      <Button onClick={handleEditProduct} disabled={submitting} className="bg-blue-600/80 hover:bg-blue-600 border-blue-500/50 hover:border-blue-500 transition-colors shadow-lg">
                                        {submitting ? (
                                          <>
                                            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                                            جاري التحديث...
                                          </>
                                        ) : (
                                          "حفظ التغييرات"
                                        )}
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                                )}
                                
                                {/* زر تاريخ إدخال الكميات */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedProductForHistory({
                                      id: product.id,
                                      name: product.name,
                                      item_code: product.item_code,
                                      stock: product.stock
                                    })
                                    setIsStockEntriesDialogOpen(true)
                                  }}
                                  className="bg-purple-900/20 border-purple-700/50 text-purple-400 hover:bg-purple-900/30 hover:text-purple-300 hover:border-purple-600/50 transition-colors h-6 w-6 sm:h-8 sm:w-8 p-0"
                                  title="عرض تاريخ إدخال الكميات"
                                >
                                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                                </Button>
                                
                                {canEditProduct(product) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteProduct(product.id, product.name)}
                                    className="bg-red-900/20 border-red-700/50 text-red-400 hover:bg-red-900/30 hover:text-red-300 hover:border-red-600/50 transition-colors h-6 w-6 sm:h-8 sm:w-8 p-0"
                                  >
                                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                  </Button>
                                )}
                                {!canEditProduct(product) && (
                                  <span className="text-slate-500 text-xs sm:text-sm">عرض فقط</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Page size + Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between mt-4 sm:mt-6 gap-3">
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-xs sm:text-sm">عدد العناصر في الصفحة:</span>
                  <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
                    <SelectTrigger className="w-[80px] sm:w-[110px] bg-slate-700/50 border-slate-600/50 hover:bg-slate-700/70 transition-colors text-xs sm:text-sm h-8 sm:h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-auto">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    showInfo={true}
                    totalItems={filteredProducts.length}
                    itemsPerPage={itemsPerPage}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog لعرض تاريخ إدخال الكميات */}
      <StockEntriesDialog
        isOpen={isStockEntriesDialogOpen}
        onClose={() => {
          setIsStockEntriesDialogOpen(false)
          setSelectedProductForHistory(null)
        }}
        product={selectedProductForHistory}
        user={user}
        onStockUpdated={() => {
          // إعادة تحميل المنتجات عند تحديث المخزون
          const loadData = async () => {
            try {
              const productsData = await getProducts()
              setProducts(productsData)
            } catch (error) {
              console.error("Error reloading products:", error)
            }
          }
          loadData()
        }}
      />
    </ErrorBoundary>
  )
}
