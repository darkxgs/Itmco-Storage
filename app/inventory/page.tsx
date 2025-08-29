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
    price: "",
    stock: 0,
    minStock: 5,
    description: "",
  })
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (user && !["admin", "inventory_manager"].includes(user.role)) {
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
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [filteredProducts, currentPage])

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)

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
      const product = await createProduct(newProduct)
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
      const updatedProduct = await updateProduct(editingProduct.id, editingProduct)
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
      toast({
        title: "فشل في تحديث المنتج",
        description: error.message || "حدث خطأ أثناء تحديث المنتج. يرجى المحاولة مرة أخرى",
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
      await deleteProduct(id)
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

      await Promise.all(selectedProducts.map((id) => deleteProduct(id)))
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
      <div className="flex min-h-screen bg-slate-900" dir="rtl">
        <Sidebar />
        <div className="flex-1 p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">إدارة المخزون</h1>
            <p className="text-slate-300">إضافة وتعديل وحذف المنتجات</p>
          </div>

          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-300 text-right flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  إجمالي المنتجات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white text-right">{products.length}</div>
                <p className="text-xs text-slate-400 text-right">منتج مسجل</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-300 text-right flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  المنتجات المتوفرة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400 text-right">
                  {products.filter((p) => p.stock > (p.min_stock || p.minStock)).length}
                </div>
                <p className="text-xs text-slate-400 text-right">في المخزون</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-orange-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-300 text-right flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  مخزون منخفض
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-400 text-right">
                  {products.filter((p) => p.stock <= (p.min_stock || p.minStock) && p.stock > 0).length}
                </div>
                <p className="text-xs text-slate-400 text-right">يحتاج تجديد</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-300 text-right flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  نفد المخزون
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-400 text-right">
                  {products.filter((p) => p.stock === 0).length}
                </div>
                <p className="text-xs text-slate-400 text-right">غير متوفر</p>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Controls */}
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle className="text-white text-right">قائمة المنتجات ({filteredProducts.length})</CardTitle>
                <div className="flex flex-wrap gap-2">
                  {selectedProducts.length > 0 && (
                    <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
                      <AlertDialogTrigger asChild>
                        <Button onClick={handleBulkDelete} variant="destructive" size="sm">
                          <Trash2 className="w-4 h-4 ml-2" />
                          حذف المحدد ({selectedProducts.length})
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
                  <Button onClick={handleExportProducts} variant="outline" size="sm" className="bg-transparent">
                    <Download className="w-4 h-4 ml-2" />
                    تصدير CSV
                  </Button>
                  <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="w-4 h-4 ml-2" />
                        إضافة منتج
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl" dir="rtl">
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
                            className="bg-slate-700 border-slate-600 text-right"
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
                              className="bg-slate-700 border-slate-600 text-right"
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
                              className="bg-slate-700 border-slate-600 text-right"
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
                            <SelectTrigger className="bg-slate-700 border-slate-600 text-right">
                              <SelectValue placeholder="اختر الفئة" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-700 border-slate-600">
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
                                className="bg-slate-700 border-slate-600 text-right font-mono flex-1"
                                placeholder="مثل: ITM-01"
                              />
                              <Button
                                type="button"
                                onClick={handleGenerateItemCode}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3"
                                size="sm"
                              >
                                إنشاء تلقائي
                              </Button>
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="warehouse" className="text-right">
                              المخزن *
                            </Label>
                            <Select
                              value={newProduct.warehouse_id}
                              onValueChange={(value) => setNewProduct({ ...newProduct, warehouse_id: value })}
                            >
                              <SelectTrigger className="bg-slate-700 border-slate-600 text-right">
                                <SelectValue placeholder="اختر المخزن" />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-700 border-slate-600">
                                {warehouses.map((warehouse) => (
                                  <SelectItem key={warehouse.id} value={warehouse.id} className="text-right">
                                    {warehouse.name} - {warehouse.warehouse_number}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="price" className="text-right">
                              السعر (اختياري)
                            </Label>
                            <Input
                              id="price"
                              type="number"
                              min="0"
                              step="0.01"
                              value={newProduct.price}
                              onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                              className="bg-slate-700 border-slate-600 text-center"
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
                              className="bg-slate-700 border-slate-600 text-center"
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
                            className="bg-slate-700 border-slate-600 text-right"
                            rows={3}
                            placeholder="وصف اختياري للمنتج"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={submitting}>
                          إلغاء
                        </Button>
                        <Button onClick={handleAddProduct} disabled={submitting}>
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
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filters */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    placeholder="البحث بالاسم أو كود الصنف..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-slate-700 border-slate-600 text-white text-right"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-right">
                    <SelectValue placeholder="جميع الفئات" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="all" className="text-right">
                      جميع الفئات
                    </SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category} className="text-right">
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-right">
                    <SelectValue placeholder="جميع المخازن" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="all" className="text-right">
                      جميع المخازن
                    </SelectItem>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id} className="text-right">
                        {warehouse.name} - {warehouse.warehouse_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-right">
                    <SelectValue placeholder="جميع الحالات" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="all" className="text-right">
                      جميع الحالات
                    </SelectItem>
                    <SelectItem value="available" className="text-right">
                      متوفر
                    </SelectItem>
                    <SelectItem value="low" className="text-right">
                      مخزون منخفض
                    </SelectItem>
                    <SelectItem value="out" className="text-right">
                      نفد المخزون
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={clearFilters} variant="outline" className="bg-transparent">
                  <Filter className="w-4 h-4 ml-2" />
                  مسح الفلاتر
                </Button>
              </div>

              {/* Products Table */}
              <div className="overflow-x-auto rounded-lg border border-slate-700">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 bg-slate-800/50">
                      <TableHead className="w-12 text-center">
                        <Checkbox
                          checked={selectedProducts.length === paginatedProducts.length && paginatedProducts.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedProducts(paginatedProducts.map((p) => p.id))
                            } else {
                              setSelectedProducts([])
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="text-slate-300 text-right min-w-[180px]">اسم المنتج</TableHead>
                      <TableHead className="text-slate-300 text-right min-w-[100px]">كود الصنف</TableHead>
                      <TableHead className="text-slate-300 text-right min-w-[100px]">العلامة التجارية</TableHead>
                      <TableHead className="text-slate-300 text-right min-w-[80px]">الموديل</TableHead>
                      <TableHead className="text-slate-300 text-right min-w-[120px]">الفئة</TableHead>
                      <TableHead className="text-slate-300 text-right min-w-[100px]">المخزن</TableHead>
                      <TableHead className="text-slate-300 text-center min-w-[80px]">السعر</TableHead>
                      <TableHead className="text-slate-300 text-center min-w-[80px]">المخزون</TableHead>
                      <TableHead className="text-slate-300 text-center min-w-[100px]">الحالة</TableHead>
                      <TableHead className="text-slate-300 text-center min-w-[120px]">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12">
                          <div className="flex items-center justify-center gap-2 text-slate-400">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>جاري تحميل المنتجات...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : paginatedProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12">
                          <div className="text-center">
                            <Package className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-white mb-2">لا توجد منتجات</h3>
                            <p className="text-slate-400 mb-4">
                              {searchTerm || categoryFilter !== "all" || stockFilter !== "all"
                                ? "لا توجد منتجات تطابق معايير البحث"
                                : "ابدأ بإضافة منتجات جديدة"}
                            </p>
                            {(searchTerm || categoryFilter !== "all" || stockFilter !== "all") && (
                              <Button onClick={clearFilters} variant="outline" className="bg-transparent">
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
                          <TableRow key={product.id} className="border-slate-700 hover:bg-slate-800/30">
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
                              />
                            </TableCell>
                            <TableCell className="text-white font-medium text-right py-4">
                              <div>
                                <div className="font-medium">{product.name}</div>
                                {product.description && (
                                  <div className="text-sm text-slate-400 mt-1">{product.description}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-300 text-right py-4">
                              <span className="font-mono text-blue-400">{product.item_code || '-'}</span>
                            </TableCell>
                            <TableCell className="text-slate-300 text-right py-4">{product.brand}</TableCell>
                            <TableCell className="text-slate-300 text-right py-4">{product.model}</TableCell>
                            <TableCell className="text-slate-300 text-right py-4">{product.category}</TableCell>
                            <TableCell className="text-slate-300 text-right py-4">
                              {warehouse ? `${warehouse.name} - ${warehouse.warehouse_number}` : '-'}
                            </TableCell>
                            <TableCell className="text-center py-4">
                              <span className="text-green-400 font-medium">
                                {product.price ? `${Number(product.price).toLocaleString()} ج.م` : '-'}
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-4">
                              <div className="flex items-center justify-center gap-2">
                                <span className={`${status.color} font-medium`}>{product.stock.toLocaleString()}</span>
                                {product.stock <= (product.min_stock || product.minStock) && product.stock > 0 && (
                                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center py-4">
                              <Badge variant={status.variant} className="flex items-center gap-1 w-fit mx-auto">
                                <StatusIcon className="w-3 h-3" />
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center py-4">
                              <div className="flex gap-2 justify-center">
                                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setEditingProduct({
                                          ...product,
                                          minStock: product.minStock || product.min_stock || 5,
                                          description: product.description || ""
                                        })
                                        setIsEditDialogOpen(true)
                                      }}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent
                                    className="bg-slate-800 border-slate-700 text-white max-w-2xl"
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
                                            className="bg-slate-700 border-slate-600 text-right"
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
                                              className="bg-slate-700 border-slate-600 text-right"
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
                                              className="bg-slate-700 border-slate-600 text-right"
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
                                            <SelectTrigger className="bg-slate-700 border-slate-600 text-right">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-700 border-slate-600">
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
                                              className="bg-slate-700 border-slate-600 text-right font-mono"
                                            />
                                          </div>
                                          <div className="grid gap-2">
                                            <Label htmlFor="edit-warehouse" className="text-right">
                                              المخزن
                                            </Label>
                                            <Select
                                              value={editingProduct.warehouse_id || ''}
                                              onValueChange={(value) =>
                                                setEditingProduct({ ...editingProduct, warehouse_id: value })
                                              }
                                            >
                                              <SelectTrigger className="bg-slate-700 border-slate-600 text-right">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent className="bg-slate-700 border-slate-600">
                                                {warehouses.map((warehouse) => (
                                                  <SelectItem key={warehouse.id} value={warehouse.id} className="text-right">
                                                    {warehouse.name} - {warehouse.warehouse_number}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                        <div className="grid gap-2">
                                          <Label htmlFor="edit-price" className="text-right">
                                            السعر (اختياري)
                                          </Label>
                                          <Input
                                            id="edit-price"
                                            type="number"
                                            step="0.01"
                                            value={editingProduct.price || ''}
                                            onChange={(e) =>
                                              setEditingProduct({ ...editingProduct, price: e.target.value ? parseFloat(e.target.value) : null })
                                            }
                                            className="bg-slate-700 border-slate-600 text-right"
                                            placeholder="أدخل السعر"
                                          />
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
                                              className="bg-slate-700 border-slate-600 text-center"
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
                                              className="bg-slate-700 border-slate-600 text-center"
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
                                            className="bg-slate-700 border-slate-600 text-right"
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
                                      >
                                        إلغاء
                                      </Button>
                                      <Button onClick={handleEditProduct} disabled={submitting}>
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
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteProduct(product.id, product.name)}
                                  className="text-red-400 hover:text-red-300 hover:border-red-400"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center mt-6">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    showInfo={true}
                    totalItems={filteredProducts.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ErrorBoundary>
  )
}
