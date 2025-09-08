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
  Package,
  TrendingUp,
  TrendingDown,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { getProducts, createProduct, updateProduct, deleteProduct, getWarehouses, searchByItemCode, generateNextItemCode } from "@/lib/database"
import { logActivity } from "@/lib/auth"
import { validateData, productSchema } from "@/lib/validation"
import { Pagination } from "@/components/ui/pagination"
import { ErrorBoundary } from "@/components/error-boundary"

const categories = [
  "آلات عد النقود",
  "آلات ربط النقود",
  "آلات فحص الشيكات",
  "ساعات الأمان",
  "أنظمة الحضور والانصراف",
  "ساعات السكرتارية",
  "بوابات الأمان",
]

const ITEMS_PER_PAGE = 10

export default function InventoryPage() {
  const { user, loading: authLoading } = useAuth()
  const [products, setProducts] = useState([])
  const [warehouses, setWarehouses] = useState<any[]>([])
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
        
        // Load all products and warehouses for all authorized users
        const [productsData, warehousesData] = await Promise.all([
          getProducts(),
          getWarehouses()
        ])
        setProducts(productsData)
        setWarehouses(warehousesData)

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
      const product = await createProduct(newProduct, user.id)
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

  const handleExportProducts = () => {
    try {
      const csvData = [
        ["اسم المنتج", "العلامة التجارية", "الموديل", "الفئة", "المخزون", "الحد الأدنى", "الوصف"],
        ...filteredProducts.map((product) => [
          product.name,
          product.brand,
          product.model,
          product.category,
          product.stock,
          product.min_stock || product.minStock,
          product.description || "",
        ]),
      ]

      const csvContent = csvData.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `products_${new Date().toISOString().split("T")[0]}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "تم التصدير بنجاح",
        description: `تم تصدير ${filteredProducts.length} منتج إلى ملف CSV`,
      })
    } catch (error) {
      toast({
        title: "فشل في التصدير",
        description: "حدث خطأ أثناء تصدير البيانات",
        variant: "destructive",
      })
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
                    <span className="hidden sm:inline">تصدير CSV</span>
                    <span className="sm:hidden">تصدير</span>
                  </Button>
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
                              {categories.map((category) => (
                                <SelectItem key={category} value={category} className="text-right">
                                  {category}
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
                    {categories.map((category) => (
                      <SelectItem key={category} value={category} className="text-right text-sm sm:text-base">
                        {category}
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
                              <span className="font-mono text-blue-400 text-xs sm:text-sm">{product.item_code || '-'}</span>
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
                                              {categories.map((category) => (
                                                <SelectItem key={category} value={category} className="text-right">
                                                  {category}
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
    </ErrorBoundary>
  )
}
