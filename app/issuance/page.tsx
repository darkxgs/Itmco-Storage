"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { ShoppingCart, Calendar, User, Building, Edit, Trash2, Loader2 } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { getProducts, getIssuances, createIssuance, updateIssuance, deleteIssuance, BRANCHES } from "@/lib/database"
import { logActivity } from "@/lib/auth"



export default function IssuancePage() {
  const { user, loading: authLoading } = useAuth()
  const [products, setProducts] = useState([])
  const [issuances, setIssuances] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [customerName, setCustomerName] = useState("")
  const [selectedBranch, setSelectedBranch] = useState("")
  const [engineer, setEngineer] = useState("")
  const [serialNumber, setSerialNumber] = useState("")
  const [notes, setNotes] = useState("")
  const [editingIssuance, setEditingIssuance] = useState(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (user && !["admin", "engineer"].includes(user.role)) {
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
      try {
        const [productsData, issuancesData] = await Promise.all([getProducts(), getIssuances()])
        setProducts(productsData)
        setIssuances(issuancesData)
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      loadData()
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedProduct || !customerName || !selectedBranch || !engineer || !serialNumber) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive",
      })
      return
    }

    const product = products.find((p) => p.id.toString() === selectedProduct)
    if (!product) {
      toast({
        title: "خطأ",
        description: "المنتج المحدد غير موجود",
        variant: "destructive",
      })
      return
    }

    if (quantity > product.stock) {
      toast({
        title: "خطأ",
        description: "الكمية المطلوبة أكبر من المتوفر في المخزون",
        variant: "destructive",
      })
      return
    }

    try {
      const newIssuance = {
        product_id: product.id,
        product_name: product.name,
        brand: product.brand,
        model: product.model,
        quantity,
        customer_name: customerName,
        branch: selectedBranch,
        engineer,
        serial_number: serialNumber,
        notes,
        issued_by: user.id,
      }

      const createdIssuance = await createIssuance(newIssuance)
      setIssuances([createdIssuance, ...issuances])

      // Update local product stock
      setProducts(products.map((p) => (p.id === product.id ? { ...p, stock: p.stock - quantity } : p)))

      // Log activity
      await logActivity(
        user.id,
        user.name,
        "إصدار منتج",
        "الإصدار",
        `تم إصدار ${quantity} من ${product.name} للعميل ${customerName}`,
      )

      // Reset form
      resetForm()

      toast({
        title: "تم بنجاح",
        description: "تم إصدار المنتج بنجاح",
      })
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في إصدار المنتج",
        variant: "destructive",
      })
    }
  }

  const getAvailableStock = (productId: string) => {
    const product = products.find((p) => p.id.toString() === productId)
    return product ? product.stock : 0
  }

  const handleEditIssuance = (issuance: any) => {
    setEditingIssuance(issuance)
    setSelectedProduct(issuance.productId?.toString() || issuance.product_id?.toString() || "")
    setQuantity(issuance.quantity)
    setCustomerName(issuance.customerName || issuance.customer_name || "")
    setSelectedBranch(issuance.branch)
    setEngineer(issuance.engineer)
    setSerialNumber(issuance.serialNumber || issuance.serial_number || "")
    setNotes(issuance.notes || "")
    setIsEditDialogOpen(true)
  }

  const handleUpdateIssuance = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingIssuance || !selectedProduct || !customerName || !selectedBranch || !engineer || !serialNumber) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive",
      })
      return
    }

    const product = products.find((p) => p.id.toString() === selectedProduct)
    if (!product) {
      toast({
        title: "خطأ",
        description: "المنتج المحدد غير موجود",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const updates = {
        product_id: product.id,
        product_name: product.name,
        brand: product.brand,
        model: product.model,
        quantity,
        customer_name: customerName,
        branch: selectedBranch,
        engineer,
        serial_number: serialNumber,
        notes,
      }

      const updatedIssuance = await updateIssuance(editingIssuance.id, updates, editingIssuance.quantity)
      
      // Update local state
      setIssuances(issuances.map((i) => (i.id === editingIssuance.id ? updatedIssuance : i)))
      
      // Update local product stock if quantity changed
      if (quantity !== editingIssuance.quantity) {
        const stockDifference = quantity - editingIssuance.quantity
        setProducts(products.map((p) => (p.id === product.id ? { ...p, stock: p.stock - stockDifference } : p)))
      }

      // Log activity
      await logActivity(
        user.id,
        user.name,
        "تعديل إصدار",
        "الإصدار",
        `تم تعديل إصدار ${product.name} للعميل ${customerName}`,
      )

      setIsEditDialogOpen(false)
      setEditingIssuance(null)
      resetForm()

      toast({
        title: "تم بنجاح",
        description: "تم تحديث الإصدار بنجاح",
      })
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في تحديث الإصدار",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteIssuance = async (issuance: any) => {
    try {
      await deleteIssuance(issuance.id)
      
      // Update local state
      setIssuances(issuances.filter((i) => i.id !== issuance.id))
      
      // Return stock to product
      const product = products.find((p) => p.id === (issuance.productId || issuance.product_id))
      if (product) {
        setProducts(products.map((p) => (p.id === product.id ? { ...p, stock: p.stock + issuance.quantity } : p)))
      }

      // Log activity
      await logActivity(
        user.id,
        user.name,
        "حذف إصدار",
        "الإصدار",
        `تم حذف إصدار ${issuance.productName || issuance.product_name} للعميل ${issuance.customerName || issuance.customer_name}`,
      )

      toast({
        title: "تم بنجاح",
        description: "تم حذف الإصدار بنجاح",
      })
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في حذف الإصدار",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setSelectedProduct("")
    setQuantity(1)
    setCustomerName("")
    setSelectedBranch("")
    setEngineer("")
    setSerialNumber("")
    setNotes("")
  }

  const canEditOrDelete = (issuance: any) => {
    // Admin can edit/delete all issuances, others can only edit/delete their own
    return user.role === "admin" || (issuance.issuedBy || issuance.issued_by) === user.id
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen bg-slate-900 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-900" dir="rtl">
      <Sidebar />
      <div className="flex-1 p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">إصدار المنتجات</h1>
          <p className="text-slate-300">إصدار المنتجات للعملاء والفروع</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">إصدارات اليوم</CardTitle>
              <ShoppingCart className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {issuances.filter((i) => i.date === new Date().toISOString().split("T")[0]).length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">إجمالي الإصدارات</CardTitle>
              <Calendar className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{issuances.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">الكمية المصدرة</CardTitle>
              <Building className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{issuances.reduce((sum, i) => sum + i.quantity, 0)}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Issuance Form */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-right">نموذج إصدار منتج</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="product" className="text-slate-300 text-right">
                    المنتج
                  </Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-right">
                      <SelectValue placeholder="اختر المنتج" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          <div className="flex justify-between items-center w-full">
                            <span>
                              {product.name} - {product.brand} {product.model}
                            </span>
                            <Badge variant="secondary" className="mr-2">
                              متوفر: {product.stock}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="quantity" className="text-slate-300 text-right">
                    الكمية
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    max={selectedProduct ? getAvailableStock(selectedProduct) : 1}
                    value={quantity}
                    onChange={(e) => setQuantity(Number.parseInt(e.target.value) || 1)}
                    className="bg-slate-700 border-slate-600 text-white text-center"
                  />
                  {selectedProduct && (
                    <p className="text-xs text-slate-400">متوفر: {getAvailableStock(selectedProduct)} قطعة</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="customer" className="text-slate-300 text-right">
                    اسم العميل
                  </Label>
                  <Input
                    id="customer"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="أدخل اسم العميل"
                    className="bg-slate-700 border-slate-600 text-white text-right"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="branch" className="text-slate-300 text-right">
                    الفرع
                  </Label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-right">
                      <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {BRANCHES.map((branch) => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="engineer" className="text-slate-300 text-right">
                    المهندس المستلم
                  </Label>
                  <Input
                    id="engineer"
                    value={engineer}
                    onChange={(e) => setEngineer(e.target.value)}
                    placeholder="أدخل اسم المهندس"
                    className="bg-slate-700 border-slate-600 text-white text-right"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="serial" className="text-slate-300 text-right">
                    الرقم التسلسلي
                  </Label>
                  <Input
                    id="serial"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="أدخل الرقم التسلسلي"
                    className="bg-slate-700 border-slate-600 text-white text-right"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="notes" className="text-slate-300 text-right">
                    ملاحظات (اختياري)
                  </Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="أدخل أي ملاحظات إضافية"
                    className="bg-slate-700 border-slate-600 text-white text-right"
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full">
                  إصدار المنتج
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Recent Issuances */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-right">الإصدارات الأخيرة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {issuances.slice(0, 10).map((issuance) => (
                  <div key={issuance.id} className="p-4 bg-slate-700/50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-white">{issuance.productName}</h4>
                      <Badge variant="outline" className="text-xs">
                        {issuance.quantity} قطعة
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-300 mb-1">
                      <User className="w-3 h-3 inline ml-1" />
                      {issuance.customerName}
                    </p>
                    <p className="text-sm text-slate-300 mb-1">
                      <Building className="w-3 h-3 inline ml-1" />
                      {issuance.branch}
                    </p>
                    <p className="text-sm text-slate-300 mb-1">المهندس: {issuance.engineer}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-slate-400">{issuance.date}</span>
                      <span className="text-xs text-slate-400">{issuance.serialNumber}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* All Issuances Table */}
        <Card className="bg-slate-800 border-slate-700 mt-6">
          <CardHeader>
            <CardTitle className="text-white text-right">سجل الإصدارات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-300 text-right">التاريخ</TableHead>
                    <TableHead className="text-slate-300 text-right">المنتج</TableHead>
                    <TableHead className="text-slate-300 text-right">العلامة/الموديل</TableHead>
                    <TableHead className="text-slate-300 text-center">الكمية</TableHead>
                    <TableHead className="text-slate-300 text-right">العميل</TableHead>
                    <TableHead className="text-slate-300 text-right">الفرع</TableHead>
                    <TableHead className="text-slate-300 text-right">المهندس</TableHead>
                    <TableHead className="text-slate-300 text-right">الرقم التسلسلي</TableHead>
                    <TableHead className="text-slate-300 text-center">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issuances.map((issuance) => (
                    <TableRow key={issuance.id} className="border-slate-700">
                      <TableCell className="text-slate-300 text-right">{issuance.date}</TableCell>
                      <TableCell className="text-white font-medium text-right">{issuance.productName || issuance.product_name}</TableCell>
                      <TableCell className="text-slate-300 text-right">
                        {issuance.brand} {issuance.model}
                      </TableCell>
                      <TableCell className="text-white text-center">{issuance.quantity}</TableCell>
                      <TableCell className="text-slate-300 text-right">{issuance.customerName || issuance.customer_name}</TableCell>
                      <TableCell className="text-slate-300 text-right">{issuance.branch}</TableCell>
                      <TableCell className="text-slate-300 text-right">{issuance.engineer}</TableCell>
                      <TableCell className="text-slate-300 text-right">{issuance.serialNumber || issuance.serial_number}</TableCell>
                      <TableCell className="text-center">
                        {canEditOrDelete(issuance) && (
                          <div className="flex justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditIssuance(issuance)}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-slate-800 border-slate-700 text-white" dir="rtl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-right">تأكيد الحذف</AlertDialogTitle>
                                  <AlertDialogDescription className="text-slate-300 text-right">
                                    هل أنت متأكد من حذف هذا الإصدار؟ سيتم إرجاع الكمية إلى المخزون.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex-row-reverse">
                                  <AlertDialogAction
                                    onClick={() => handleDeleteIssuance(issuance)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    حذف
                                  </AlertDialogAction>
                                  <AlertDialogCancel className="bg-slate-700 hover:bg-slate-600">
                                    إلغاء
                                  </AlertDialogCancel>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Edit Issuance Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right">تعديل الإصدار</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateIssuance} className="space-y-4 max-h-96 overflow-y-auto">
              <div className="grid gap-2">
                <Label htmlFor="edit-product" className="text-slate-300 text-right">
                  المنتج
                </Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-right">
                    <SelectValue placeholder="اختر المنتج" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id.toString()}>
                        <div className="flex justify-between items-center w-full">
                          <span>
                            {product.name} - {product.brand} {product.model}
                          </span>
                          <Badge variant="secondary" className="mr-2">
                            متوفر: {product.stock}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-quantity" className="text-slate-300 text-right">
                  الكمية
                </Label>
                <Input
                  id="edit-quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Number.parseInt(e.target.value) || 1)}
                  className="bg-slate-700 border-slate-600 text-white text-right"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-customer" className="text-slate-300 text-right">
                  اسم العميل
                </Label>
                <Input
                  id="edit-customer"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="أدخل اسم العميل"
                  className="bg-slate-700 border-slate-600 text-white text-right"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-branch" className="text-slate-300 text-right">
                  الفرع
                </Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-right">
                    <SelectValue placeholder="اختر الفرع" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {BRANCHES.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        {branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-engineer" className="text-slate-300 text-right">
                  المهندس المستلم
                </Label>
                <Input
                  id="edit-engineer"
                  value={engineer}
                  onChange={(e) => setEngineer(e.target.value)}
                  placeholder="أدخل اسم المهندس"
                  className="bg-slate-700 border-slate-600 text-white text-right"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-serial" className="text-slate-300 text-right">
                  الرقم التسلسلي
                </Label>
                <Input
                  id="edit-serial"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="أدخل الرقم التسلسلي"
                  className="bg-slate-700 border-slate-600 text-white text-right"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-notes" className="text-slate-300 text-right">
                  ملاحظات (اختياري)
                </Label>
                <Textarea
                  id="edit-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أدخل أي ملاحظات إضافية"
                  className="bg-slate-700 border-slate-600 text-white text-right"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={submitting}
                  className="bg-transparent"
                >
                  إلغاء
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      جاري التحديث...
                    </>
                  ) : (
                    "تحديث الإصدار"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
