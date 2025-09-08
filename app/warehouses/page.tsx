"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Plus, Edit, Trash2, Warehouse, Search, Package } from "lucide-react"
import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from "@/lib/database"
import type { Warehouse, WarehouseInsert } from "@/lib/supabase"

interface WarehouseFormData {
  name: string
  location: string
  description: string
  is_active: boolean
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [form, setForm] = useState<WarehouseFormData>({
    name: "",
    location: "",
    description: "",
    is_active: true
  })

  useEffect(() => {
    loadWarehouses()
  }, [])

  const loadWarehouses = async () => {
    try {
      setLoading(true)
      const data = await getWarehouses()
      setWarehouses(data)
    } catch (error) {
      console.error("Error loading warehouses:", error)
      toast.error("فشل في تحميل المخازن")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingWarehouse) {
        await updateWarehouse(editingWarehouse.id, form)
        toast.success("تم تحديث المخزن بنجاح")
      } else {
        await createWarehouse(form as WarehouseInsert)
        toast.success("تم إضافة المخزن بنجاح")
      }
      setDialogOpen(false)
      resetForm()
      loadWarehouses()
    } catch (error) {
      console.error("Error saving warehouse:", error)
      toast.error("فشل في حفظ المخزن")
    }
  }

  const handleEdit = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse)
    setForm({
      name: warehouse.name,
      location: warehouse.location || "",
      description: warehouse.description || "",
      is_active: warehouse.is_active
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا المخزن؟ سيؤثر هذا على جميع المنتجات المرتبطة به.")) {
      try {
        await deleteWarehouse(id)
        toast.success("تم حذف المخزن بنجاح")
        loadWarehouses()
      } catch (error) {
        console.error("Error deleting warehouse:", error)
        toast.error("فشل في حذف المخزن")
      }
    }
  }

  const resetForm = () => {
    setForm({
      name: "",
      location: "",
      description: "",
      is_active: true
    })
    setEditingWarehouse(null)
  }

  const filteredWarehouses = warehouses.filter(warehouse =>
    warehouse.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    warehouse.warehouse_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (warehouse.location && warehouse.location.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      
      <div className="relative container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 space-x-reverse">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
            <Warehouse className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">إدارة المخازن</h1>
            <p className="text-slate-400">إدارة مخازن الشركة والمواقع</p>
          </div>
        </div>
        <div className="flex items-center space-x-4 space-x-reverse">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="البحث في المخازن..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-400 focus:bg-slate-800 focus:border-slate-600 transition-all duration-200"
            />
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={resetForm}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Plus className="h-4 w-4 ml-2" />
                إضافة مخزن جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-slate-800/95 border-slate-700/50 backdrop-blur-sm">
              <DialogHeader>
                <DialogTitle>
                  {editingWarehouse ? "تعديل المخزن" : "إضافة مخزن جديد"}
                </DialogTitle>
                <DialogDescription>
                  {editingWarehouse 
                    ? "تعديل بيانات المخزن. رقم المخزن لا يمكن تعديله."
                    : "إدخال بيانات المخزن الجديد. سيتم إنشاء رقم المخزن تلقائياً."
                  }
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {editingWarehouse && (
                  <div className="space-y-2">
                    <Label>رقم المخزن</Label>
                    <Input
                      value={editingWarehouse.warehouse_number}
                      disabled
                      className="bg-slate-700/50 border-slate-600/50 text-slate-400"
                    />
                    <p className="text-sm text-gray-500">رقم المخزن لا يمكن تعديله</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="warehouse-name">اسم المخزن *</Label>
                  <Input
                    id="warehouse-name"
                    value={form.name}
                    onChange={(e) => setForm({...form, name: e.target.value})}
                    placeholder="مثال: المخزن الرئيسي"
                    className="bg-slate-700/50 border-slate-600/50 text-white focus:bg-slate-700 focus:border-slate-500 transition-colors"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warehouse-location">الموقع</Label>
                  <Input
                    id="warehouse-location"
                    value={form.location}
                    onChange={(e) => setForm({...form, location: e.target.value})}
                    placeholder="مثال: الطابق الأول - المبنى الرئيسي"
                    className="bg-slate-700/50 border-slate-600/50 text-white focus:bg-slate-700 focus:border-slate-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warehouse-description">الوصف</Label>
                  <Textarea
                    id="warehouse-description"
                    value={form.description}
                    onChange={(e) => setForm({...form, description: e.target.value})}
                    placeholder="وصف المخزن والغرض منه..."
                    className="bg-slate-700/50 border-slate-600/50 text-white focus:bg-slate-700 focus:border-slate-500 transition-colors"
                    rows={3}
                  />
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Switch
                    id="warehouse-active"
                    checked={form.is_active}
                    onCheckedChange={(checked) => setForm({...form, is_active: checked})}
                  />
                  <Label htmlFor="warehouse-active">مخزن نشط</Label>
                </div>
                <DialogFooter className="gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setDialogOpen(false)}
                    className="border-slate-600/50 hover:border-slate-500 hover:bg-slate-700/50 transition-all duration-200"
                  >
                    إلغاء
                  </Button>
                  <Button 
                    type="submit"
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    {editingWarehouse ? "تحديث" : "إضافة"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/70 transition-all duration-200 hover:shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">إجمالي المخازن</CardTitle>
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Warehouse className="h-4 w-4 text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{warehouses.length}</div>
              <p className="text-xs text-slate-400 mt-1">جميع المخازن المسجلة</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/70 transition-all duration-200 hover:shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">المخازن النشطة</CardTitle>
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Package className="h-4 w-4 text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">
                {warehouses.filter(w => w.is_active).length}
              </div>
              <p className="text-xs text-slate-400 mt-1">مخازن جاهزة للاستخدام</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/70 transition-all duration-200 hover:shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">المخازن غير النشطة</CardTitle>
              <div className="p-2 bg-red-500/20 rounded-lg">
                <Package className="h-4 w-4 text-red-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-400">
                {warehouses.filter(w => !w.is_active).length}
              </div>
              <p className="text-xs text-slate-400 mt-1">مخازن معطلة مؤقتاً</p>
            </CardContent>
          </Card>
        </div>

        {/* Warehouses Table */}
        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Warehouse className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-white">قائمة المخازن</CardTitle>
                <CardDescription className="text-slate-400">
                  جميع مخازن الشركة مع أرقامها التلقائية ومعلوماتها
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/50 hover:bg-slate-700/30">
                  <TableHead className="text-slate-300 font-semibold">رقم المخزن</TableHead>
                  <TableHead className="text-slate-300 font-semibold">اسم المخزن</TableHead>
                  <TableHead className="text-slate-300 font-semibold">الموقع</TableHead>
                  <TableHead className="text-slate-300 font-semibold">الوصف</TableHead>
                  <TableHead className="text-slate-300 font-semibold">تاريخ الإنشاء</TableHead>
                  <TableHead className="text-slate-300 font-semibold">الحالة</TableHead>
                  <TableHead className="text-slate-300 font-semibold">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWarehouses.map((warehouse) => (
                  <TableRow key={warehouse.id} className="border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <TableCell className="font-mono font-medium text-blue-400">
                      {warehouse.warehouse_number}
                    </TableCell>
                    <TableCell className="font-medium text-white">{warehouse.name}</TableCell>
                    <TableCell className="text-slate-300">{warehouse.location || "-"}</TableCell>
                    <TableCell className="max-w-xs truncate text-slate-300">
                      {warehouse.description || "-"}
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {new Date(warehouse.created_at).toLocaleDateString('ar-SA')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={warehouse.is_active ? "default" : "secondary"}>
                        {warehouse.is_active ? "نشط" : "غير نشط"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(warehouse)}
                          className="border-slate-600/50 hover:border-blue-500 hover:bg-blue-500/10 hover:text-blue-400 transition-all duration-200"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(warehouse.id)}
                          className="border-slate-600/50 hover:border-red-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredWarehouses.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Warehouse className="h-12 w-12 mx-auto mb-4 text-slate-500" />
                <p className="text-lg font-medium mb-2">
                  {searchTerm ? "لا توجد مخازن مطابقة للبحث" : "لا توجد مخازن مضافة بعد"}
                </p>
                <p className="text-sm">
                  {searchTerm ? "جرب البحث بكلمات مختلفة" : "ابدأ بإضافة مخزن جديد"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  )
}