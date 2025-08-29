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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 space-x-reverse">
          <Warehouse className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">إدارة المخازن</h1>
            <p className="text-gray-600">إدارة مخازن الشركة والمواقع</p>
          </div>
        </div>
        <div className="flex items-center space-x-4 space-x-reverse">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="البحث في المخازن..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 ml-2" />
                إضافة مخزن جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
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
                      className="bg-gray-100"
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warehouse-description">الوصف</Label>
                  <Textarea
                    id="warehouse-description"
                    value={form.description}
                    onChange={(e) => setForm({...form, description: e.target.value})}
                    placeholder="وصف المخزن والغرض منه..."
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
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button type="submit">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي المخازن</CardTitle>
              <Warehouse className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{warehouses.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">المخازن النشطة</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {warehouses.filter(w => w.is_active).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">المخازن غير النشطة</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {warehouses.filter(w => !w.is_active).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Warehouses Table */}
        <Card>
          <CardHeader>
            <CardTitle>قائمة المخازن</CardTitle>
            <CardDescription>
              جميع مخازن الشركة مع أرقامها التلقائية ومعلوماتها
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم المخزن</TableHead>
                  <TableHead>اسم المخزن</TableHead>
                  <TableHead>الموقع</TableHead>
                  <TableHead>الوصف</TableHead>
                  <TableHead>تاريخ الإنشاء</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWarehouses.map((warehouse) => (
                  <TableRow key={warehouse.id}>
                    <TableCell className="font-mono font-medium">
                      {warehouse.warehouse_number}
                    </TableCell>
                    <TableCell className="font-medium">{warehouse.name}</TableCell>
                    <TableCell>{warehouse.location || "-"}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {warehouse.description || "-"}
                    </TableCell>
                    <TableCell>
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
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(warehouse.id)}
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
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? "لا توجد مخازن مطابقة للبحث" : "لا توجد مخازن مضافة بعد"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}