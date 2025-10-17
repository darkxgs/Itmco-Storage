"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Plus, Edit, Trash2, Loader2, Search, Tag } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { getCategories, createCategory, updateCategory, deleteCategory } from "@/lib/database"

type Category = {
  id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function CategoriesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  
  // Form states
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const data = await getCategories()
      setCategories(data)
    } catch (error) {
      console.error('Error loading categories:', error)
      toast({
        title: "خطأ",
        description: "حدث خطأ في تحميل الفئات",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setName("")
    setDescription("")
    setIsActive(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      toast({
        title: "خطأ",
        description: "اسم الفئة مطلوب",
        variant: "destructive",
      })
      return
    }

    try {
      setSubmitting(true)
      
      await createCategory({
        name: name.trim(),
        description: description.trim() || undefined,
        is_active: isActive
      })
      
      toast({
        title: "نجح",
        description: "تم إضافة الفئة بنجاح",
      })
      
      setIsDialogOpen(false)
      resetForm()
      loadCategories()
    } catch (error) {
      console.error('Error saving category:', error)
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ في حفظ الفئة",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }





  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-900">
        <Sidebar />
        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-2 text-white">جاري تحميل الفئات...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setName(category.name)
    setDescription(category.description || "")
    setIsActive(category.is_active)
    setIsEditDialogOpen(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingCategory || !name.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى التأكد من صحة البيانات",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      await updateCategory(editingCategory.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        is_active: isActive
      })
      
      toast({
        title: "نجح",
        description: "تم تحديث الفئة بنجاح",
      })
      
      setIsEditDialogOpen(false)
      resetForm()
      setEditingCategory(null)
      loadCategories()
    } catch (error) {
      console.error('Error updating category:', error)
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ في تحديث الفئة",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (categoryId: number) => {
    try {
      await deleteCategory(categoryId)
      
      toast({
        title: "نجح",
        description: "تم حذف الفئة بنجاح",
      })
      
      loadCategories()
    } catch (error) {
      console.error('Error deleting category:', error)
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ في حذف الفئة",
        variant: "destructive",
      })
    }
  }

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-900">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-900">
      <Sidebar />
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Tag className="w-8 h-8 text-blue-500" />
              <h1 className="text-3xl font-bold text-white">إدارة الفئات</h1>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة فئة جديدة
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700 text-white">
                <DialogHeader>
                  <DialogTitle className="text-right">إضافة فئة جديدة</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-slate-300 text-right">
                      اسم الفئة *
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="أدخل اسم الفئة"
                      className="bg-slate-700/50 border-slate-600/50 text-white text-right"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description" className="text-slate-300 text-right">
                      الوصف (اختياري)
                    </Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="أدخل وصف الفئة"
                      className="bg-slate-700/50 border-slate-600/50 text-white text-right"
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="isActive" className="text-slate-300">
                      فئة نشطة
                    </Label>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" disabled={submitting} className="flex-1">
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                          جاري الحفظ...
                        </>
                      ) : (
                        "حفظ الفئة"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      className="flex-1"
                    >
                      إلغاء
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search */}
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="البحث في الفئات..."
                  className="bg-slate-700/50 border-slate-600/50 text-white text-right"
                />
              </div>
            </CardContent>
          </Card>

          {/* Categories Table */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-right">
                الفئات ({filteredCategories.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300 text-right">الإجراءات</TableHead>
                      <TableHead className="text-slate-300 text-right">الحالة</TableHead>
                      <TableHead className="text-slate-300 text-right">تاريخ الإنشاء</TableHead>
                      <TableHead className="text-slate-300 text-right">الوصف</TableHead>
                      <TableHead className="text-slate-300 text-right">اسم الفئة</TableHead>
                      <TableHead className="text-slate-300 text-right">#</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCategories.map((category) => (
                      <TableRow key={category.id} className="border-slate-700 hover:bg-slate-700/50">
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(category)}
                              className="bg-blue-600/20 border-blue-600/50 text-blue-400 hover:bg-blue-600/30"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-red-600/20 border-red-600/50 text-red-400 hover:bg-red-600/30"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-slate-800 border-slate-700">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-white text-right">
                                    تأكيد الحذف
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="text-slate-300 text-right">
                                    هل أنت متأكد من حذف الفئة "{category.name}"؟ لا يمكن التراجع عن هذا الإجراء.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600">
                                    إلغاء
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(category.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    حذف
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={category.is_active ? "default" : "secondary"}
                            className={category.is_active ? "bg-green-600/20 text-green-400" : "bg-gray-600/20 text-gray-400"}
                          >
                            {category.is_active ? "نشط" : "غير نشط"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-300 text-right">
                          {new Date(category.created_at).toLocaleDateString('en-US')}
                        </TableCell>
                        <TableCell className="text-slate-300 text-right">
                          {category.description || "-"}
                        </TableCell>
                        <TableCell className="text-white text-right font-medium">
                          {category.name}
                        </TableCell>
                        <TableCell className="text-slate-300 text-right">
                          {category.id}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="bg-slate-800 border-slate-700 text-white">
              <DialogHeader>
                <DialogTitle className="text-right">تعديل الفئة</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name" className="text-slate-300 text-right">
                    اسم الفئة *
                  </Label>
                  <Input
                    id="edit-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="أدخل اسم الفئة"
                    className="bg-slate-700/50 border-slate-600/50 text-white text-right"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-description" className="text-slate-300 text-right">
                    الوصف (اختياري)
                  </Label>
                  <Textarea
                    id="edit-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="أدخل وصف الفئة"
                    className="bg-slate-700/50 border-slate-600/50 text-white text-right"
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="edit-isActive" className="text-slate-300">
                    فئة نشطة
                  </Label>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        جاري التحديث...
                      </>
                    ) : (
                      "تحديث الفئة"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                    className="flex-1"
                  >
                    إلغاء
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}