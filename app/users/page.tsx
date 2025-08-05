"use client"

import "./users.css"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { RTLSwitch } from "@/components/ui/rtl-switch"
import { SimpleRTLSwitch } from "@/components/ui/simple-rtl-switch"
import { Plus, Search, Edit, Trash2, Users, UserCheck, UserX, Shield, Loader2 } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import { logActivity, hashPassword } from "@/lib/auth"
import { validateEmail, validatePassword } from "@/lib/validation"
import { formatDate } from "@/lib/utils"

const roles = [
  { value: "admin", label: "مدير النظام", color: "bg-red-500" },
  { value: "inventory_manager", label: "مدير المخزون", color: "bg-blue-500" },
  { value: "engineer", label: "مهندس", color: "bg-green-500" },
]

export default function UsersPage() {
  const { user, loading: authLoading } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "",
    password: "",
    is_active: true,
  })
  const { toast } = useToast()

  useEffect(() => {
    if (user && user.role !== "admin") {
      toast({
        title: "غير مصرح",
        description: "ليس لديك صلاحية للوصول إلى هذه الصفحة",
        variant: "destructive",
      })
      window.location.href = "/dashboard"
    }
  }, [user, toast])

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false })

        if (error) throw error
        setUsers(data || [])
      } catch (error) {
        console.error("Error loading users:", error)
        toast({
          title: "خطأ في التحميل",
          description: "فشل في تحميل قائمة المستخدمين. يرجى المحاولة مرة أخرى.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      loadUsers()
    }
  }, [user, toast])

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const validateUserForm = (userData: any, isEdit = false) => {
    if (!userData.name.trim()) {
      toast({
        title: "خطأ في البيانات",
        description: "يرجى إدخال اسم المستخدم",
        variant: "destructive",
      })
      return false
    }

    if (!validateEmail(userData.email)) {
      toast({
        title: "خطأ في البيانات",
        description: "يرجى إدخال بريد إلكتروني صحيح",
        variant: "destructive",
      })
      return false
    }

    if (!userData.role) {
      toast({
        title: "خطأ في البيانات",
        description: "يرجى اختيار دور المستخدم",
        variant: "destructive",
      })
      return false
    }

    if (!isEdit && userData.password) {
      const passwordValidation = validatePassword(userData.password)
      if (!passwordValidation.isValid) {
        toast({
          title: "خطأ في كلمة المرور",
          description: passwordValidation.message,
          variant: "destructive",
        })
        return false
      }
    }

    return true
  }

  const handleAddUser = async () => {
    if (!validateUserForm(newUser)) return

    try {
      setSubmitting(true)

      // Check if email already exists
      const { data: existingUser } = await supabase.from("users").select("id").eq("email", newUser.email).single()

      if (existingUser) {
        toast({
          title: "خطأ في البيانات",
          description: "البريد الإلكتروني مستخدم بالفعل",
          variant: "destructive",
        })
        return
      }

      const passwordHash = await hashPassword(newUser.password)

      const { data, error } = await supabase
        .from("users")
        .insert({
          name: newUser.name.trim(),
          email: newUser.email.toLowerCase().trim(),
          role: newUser.role,
          password_hash: passwordHash,
          is_active: newUser.is_active,
        })
        .select()
        .single()

      if (error) throw error

      setUsers([data, ...users])

      await logActivity(
        user.id,
        user.name,
        "إضافة مستخدم جديد",
        "إدارة المستخدمين",
        `تم إضافة المستخدم: ${newUser.name} (${newUser.email})`,
      )

      setNewUser({
        name: "",
        email: "",
        role: "",
        password: "",
        is_active: true,
      })
      setIsAddDialogOpen(false)

      toast({
        title: "تم بنجاح",
        description: `تم إضافة المستخدم ${newUser.name} بنجاح`,
        variant: "success",
      })
    } catch (error) {
      console.error("Error adding user:", error)
      toast({
        title: "خطأ في الإضافة",
        description: "فشل في إضافة المستخدم. يرجى المحاولة مرة أخرى.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditUser = async () => {
    if (!validateUserForm(editingUser, true)) return

    try {
      setSubmitting(true)

      // Check if email already exists for other users
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", editingUser.email)
        .neq("id", editingUser.id)
        .single()

      if (existingUser) {
        toast({
          title: "خطأ في البيانات",
          description: "البريد الإلكتروني مستخدم بالفعل",
          variant: "destructive",
        })
        return
      }

      const updateData = {
        name: editingUser.name.trim(),
        email: editingUser.email.toLowerCase().trim(),
        role: editingUser.role,
        is_active: editingUser.is_active,
        updated_at: new Date().toISOString(),
      }

      if (editingUser.password) {
        updateData.password_hash = await hashPassword(editingUser.password)
      }

      const { data, error } = await supabase.from("users").update(updateData).eq("id", editingUser.id).select().single()

      if (error) throw error

      setUsers(users.map((u) => (u.id === editingUser.id ? data : u)))

      await logActivity(
        user.id,
        user.name,
        "تعديل مستخدم",
        "إدارة المستخدمين",
        `تم تعديل المستخدم: ${editingUser.name} (${editingUser.email})`,
      )

      setEditingUser(null)

      toast({
        title: "تم بنجاح",
        description: `تم تحديث بيانات المستخدم ${editingUser.name} بنجاح`,
        variant: "success",
      })
    } catch (error) {
      console.error("Error updating user:", error)
      toast({
        title: "خطأ في التحديث",
        description: "فشل في تحديث بيانات المستخدم. يرجى المحاولة مرة أخرى.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (userId === user.id) {
      toast({
        title: "عملية غير مسموحة",
        description: "لا يمكنك حذف حسابك الخاص",
        variant: "destructive",
      })
      return
    }

    if (!confirm(`هل أنت متأكد من حذف المستخدم "${userName}"؟`)) {
      return
    }

    try {
      const { error } = await supabase.from("users").delete().eq("id", userId)

      if (error) throw error

      setUsers(users.filter((u) => u.id !== userId))

      await logActivity(user.id, user.name, "حذف مستخدم", "إدارة المستخدمين", `تم حذف المستخدم: ${userName}`)

      toast({
        title: "تم بنجاح",
        description: `تم حذف المستخدم ${userName} بنجاح`,
        variant: "success",
      })
    } catch (error) {
      console.error("Error deleting user:", error)
      toast({
        title: "خطأ في الحذف",
        description: "فشل في حذف المستخدم. يرجى المحاولة مرة أخرى.",
        variant: "destructive",
      })
    }
  }

  const toggleUserStatus = async (userId: string, currentStatus: boolean, userName: string) => {
    if (userId === user.id) {
      toast({
        title: "عملية غير مسموحة",
        description: "لا يمكنك تعديل حالة حسابك الخاص",
        variant: "destructive",
      })
      return
    }

    try {
      const { data, error } = await supabase
        .from("users")
        .update({
          is_active: !currentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select()
        .single()

      if (error) throw error

      setUsers(users.map((u) => (u.id === userId ? data : u)))

      const action = !currentStatus ? "تفعيل مستخدم" : "إلغاء تفعيل مستخدم"
      const statusText = !currentStatus ? "تفعيل" : "إلغاء تفعيل"

      await logActivity(user.id, user.name, action, "إدارة المستخدمين", `تم ${statusText} المستخدم: ${userName}`)

      toast({
        title: "تم بنجاح",
        description: `تم ${statusText} المستخدم ${userName} بنجاح`,
        variant: "success",
      })
    } catch (error) {
      console.error("Error updating user status:", error)
      toast({
        title: "خطأ في التحديث",
        description: "فشل في تحديث حالة المستخدم. يرجى المحاولة مرة أخرى.",
        variant: "destructive",
      })
    }
  }

  const getRoleInfo = (role: string) => {
    return roles.find((r) => r.value === role) || { label: role, color: "bg-gray-500" }
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="flex items-center gap-2 text-white">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>جاري التحميل...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-900" dir="rtl">
      <Sidebar />
      <div className="flex-1 p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">إدارة المستخدمين</h1>
          <p className="text-slate-300">إضافة وتعديل وحذف حسابات المستخدمين في النظام</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Users className="w-4 h-4" />
                إجمالي المستخدمين
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{users.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                المستخدمين النشطين
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">{users.filter((u) => u.is_active).length}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <UserX className="w-4 h-4" />
                المستخدمين المعطلين
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-400">{users.filter((u) => !u.is_active).length}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                المديرين
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-400">{users.filter((u) => u.role === "admin").length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardHeader>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <CardTitle className="text-white text-xl">قائمة المستخدمين ({filteredUsers.length})</CardTitle>
              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    placeholder="البحث في المستخدمين..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-slate-700 border-slate-600 text-white w-full sm:w-64 text-right"
                  />
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white">
                      <Plus className="w-4 h-4 ml-2" />
                      إضافة مستخدم جديد
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md" dir="rtl">
                    <DialogHeader>
                      <DialogTitle>إضافة مستخدم جديد</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2 form-field">
                        <Label htmlFor="name">الاسم الكامل *</Label>
                        <Input
                          id="name"
                          value={newUser.name}
                          onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                          className="bg-slate-700 border-slate-600 text-right"
                          placeholder="أدخل الاسم الكامل"
                        />
                      </div>
                      <div className="grid gap-2 form-field">
                        <Label htmlFor="email">البريد الإلكتروني *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                          className="bg-slate-700 border-slate-600 text-right"
                          placeholder="example@company.com"
                        />
                      </div>
                      <div className="grid gap-2 form-field">
                        <Label htmlFor="role">الدور *</Label>
                        <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                          <SelectTrigger className="bg-slate-700 border-slate-600">
                            <SelectValue placeholder="اختر الدور" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-700 border-slate-600">
                            {roles.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2 form-field">
                        <Label htmlFor="password">كلمة المرور *</Label>
                        <Input
                          id="password"
                          type="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          className="bg-slate-700 border-slate-600 text-right"
                          placeholder="كلمة مرور قوية"
                        />
                        <p className="text-xs text-slate-400">
                          يجب أن تحتوي على 8 أحرف على الأقل مع أحرف كبيرة وصغيرة ورقم
                        </p>
                      </div>
                      <div className="switch-field">
                        <div className="flex items-center gap-3" dir="rtl">
                          <label className="text-sm font-medium text-slate-300">حساب نشط</label>
                          <SimpleRTLSwitch
                            checked={newUser.is_active}
                            onCheckedChange={(checked) => setNewUser({ ...newUser, is_active: checked })}
                            size="md"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button 
                        variant="outline" 
                        onClick={() => setIsAddDialogOpen(false)} 
                        disabled={submitting}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        إلغاء
                      </Button>
                      <Button 
                        onClick={handleAddUser} 
                        disabled={submitting} 
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                            جاري الإضافة...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 ml-2" />
                            إضافة المستخدم
                          </>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 bg-slate-800/50">
                    <TableHead className="text-slate-300 text-right min-w-[150px] py-4 px-6">الاسم</TableHead>
                    <TableHead className="text-slate-300 text-right min-w-[200px] py-4 px-6">البريد الإلكتروني</TableHead>
                    <TableHead className="text-slate-300 text-center min-w-[120px] py-4 px-6">الدور</TableHead>
                    <TableHead className="text-slate-300 text-center min-w-[100px] py-4 px-6">الحالة</TableHead>
                    <TableHead className="text-slate-300 text-center min-w-[120px] py-4 px-6">تاريخ الإنشاء</TableHead>
                    <TableHead className="text-slate-300 text-center min-w-[120px] py-4 px-6">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-400 py-12">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                          <span className="text-lg">جاري تحميل المستخدمين...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-400 py-12">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Users className="h-12 w-12 text-slate-500" />
                          <div className="text-center">
                            <h3 className="text-lg font-medium text-white mb-2">
                              {searchTerm ? "لا توجد نتائج للبحث" : "لا توجد مستخدمين"}
                            </h3>
                            <p className="text-slate-400">
                              {searchTerm ? "جرب البحث بكلمات مختلفة" : "ابدأ بإضافة مستخدم جديد"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((u) => {
                      const roleInfo = getRoleInfo(u.role)
                      return (
                        <TableRow key={u.id} className="border-slate-700 hover:bg-slate-700/30 transition-colors">
                          <TableCell className="text-white font-medium text-right py-4 px-6">{u.name}</TableCell>
                          <TableCell className="text-slate-300 text-right py-4 px-6">{u.email}</TableCell>
                          <TableCell className="text-center py-4 px-6">
                            <Badge className={`${roleInfo.color} text-white px-3 py-1 rounded-full text-xs`}>{roleInfo.label}</Badge>
                          </TableCell>
                          <TableCell className="text-center py-4 px-6">
                            <div className="status-indicator">
                              <span className={`status-text ${u.is_active ? "active" : "inactive"}`}>
                                {u.is_active ? "نشط" : "معطل"}
                              </span>
                              <SimpleRTLSwitch
                                checked={u.is_active}
                                onCheckedChange={() => toggleUserStatus(u.id, u.is_active, u.name)}
                                disabled={u.id === user.id}
                                size="md"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-300 text-center py-4 px-6 text-sm">{formatDate(u.created_at)}</TableCell>
                          <TableCell className="text-center py-4 px-6">
                            <div className="flex gap-2 justify-center">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setEditingUser({ ...u, password: "" })}
                                    className="hover:bg-blue-600 hover:text-white border-slate-600 text-slate-300"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md" dir="rtl">
                                  <DialogHeader>
                                    <DialogTitle>تعديل المستخدم</DialogTitle>
                                  </DialogHeader>
                                  {editingUser && (
                                    <div className="grid gap-4 py-4">
                                      <div className="grid gap-2 form-field">
                                        <Label htmlFor="edit-name">الاسم الكامل *</Label>
                                        <Input
                                          id="edit-name"
                                          value={editingUser.name}
                                          onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                                          className="bg-slate-700 border-slate-600 text-right"
                                        />
                                      </div>
                                      <div className="grid gap-2 form-field">
                                        <Label htmlFor="edit-email">البريد الإلكتروني *</Label>
                                        <Input
                                          id="edit-email"
                                          type="email"
                                          value={editingUser.email}
                                          onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                                          className="bg-slate-700 border-slate-600 text-right"
                                        />
                                      </div>
                                      <div className="grid gap-2 form-field">
                                        <Label htmlFor="edit-role">الدور *</Label>
                                        <Select
                                          value={editingUser.role}
                                          onValueChange={(value) => setEditingUser({ ...editingUser, role: value })}
                                        >
                                          <SelectTrigger className="bg-slate-700 border-slate-600">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent className="bg-slate-700 border-slate-600">
                                            {roles.map((role) => (
                                              <SelectItem key={role.value} value={role.value}>
                                                {role.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="grid gap-2 form-field">
                                        <Label htmlFor="edit-password">كلمة المرور الجديدة (اختياري)</Label>
                                        <Input
                                          id="edit-password"
                                          type="password"
                                          value={editingUser.password}
                                          onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                                          className="bg-slate-700 border-slate-600 text-right"
                                          placeholder="اتركه فارغاً للاحتفاظ بكلمة المرور الحالية"
                                        />
                                      </div>
                                      <div className="switch-field">
                                        <div className="flex items-center gap-3" dir="rtl">
                                          <label className="text-sm font-medium text-slate-300">حساب نشط</label>
                                          <SimpleRTLSwitch
                                            checked={editingUser.is_active}
                                            onCheckedChange={(checked) =>
                                              setEditingUser({ ...editingUser, is_active: checked })
                                            }
                                            size="md"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      onClick={() => setEditingUser(null)}
                                      disabled={submitting}
                                    >
                                      إلغاء
                                    </Button>
                                    <Button onClick={handleEditUser} disabled={submitting} className="btn-primary">
                                      {submitting ? (
                                        <>
                                          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                                          جاري الحفظ...
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
                                onClick={() => handleDeleteUser(u.id, u.name)}
                                className="text-red-400 hover:text-white hover:bg-red-600 border-slate-600 disabled:opacity-50"
                                disabled={u.id === user.id}
                                title={u.id === user.id ? "لا يمكن حذف حسابك الخاص" : "حذف المستخدم"}
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
