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
import { Plus, Edit, Trash2, Building2, Search, AlertTriangle, RefreshCw } from "lucide-react"
import { getBranches, createBranch, updateBranch, deleteBranch } from "@/lib/database"
import type { Branch, BranchInsert } from "@/lib/supabase"
import { Sidebar } from "@/components/sidebar"
import { ErrorBoundary } from "@/components/error-boundary"
import { useAuth } from "@/hooks/use-auth"

interface BranchFormData {
  name: string
  code: string
  address: string
  phone: string
  manager_name: string
  is_active: boolean
}

export default function BranchesPage() {
  const { user, loading: authLoading } = useAuth()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [error, setError] = useState<string | null>(null)
  
  // Branch form state
  const [branchDialogOpen, setBranchDialogOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [branchForm, setBranchForm] = useState<BranchFormData>({
    name: "",
    code: "",
    address: "",
    phone: "",
    manager_name: "",
    is_active: true
  })

  useEffect(() => {
    if (user) {
      loadBranches()
    }
  }, [user])

  const loadBranches = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      setError(null)
      const branchesData = await getBranches()
      setBranches(branchesData)
    } catch (error) {
      console.error("Error loading branches:", error)
      setError("فشل في تحميل الفروع")
      toast.error("فشل في تحميل الفروع")
    } finally {
      setLoading(false)
    }
  }

  const handleBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingBranch) {
        await updateBranch(editingBranch.id, branchForm)
        toast.success("تم تحديث الفرع بنجاح")
      } else {
        await createBranch(branchForm as BranchInsert)
        toast.success("تم إضافة الفرع بنجاح")
      }
      setBranchDialogOpen(false)
      resetBranchForm()
      loadBranches()
    } catch (error) {
      console.error("Error saving branch:", error)
      toast.error("فشل في حفظ الفرع")
    }
  }

  const handleEditBranch = (branch: Branch) => {
    setEditingBranch(branch)
    setBranchForm({
      name: branch.name,
      code: branch.code,
      address: branch.address || "",
      phone: branch.phone || "",
      manager_name: branch.manager_name || "",
      is_active: branch.is_active
    })
    setBranchDialogOpen(true)
  }

  const handleDeleteBranch = async (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا الفرع؟")) {
      try {
        await deleteBranch(id)
        toast.success("تم حذف الفرع بنجاح")
        loadBranches()
      } catch (error) {
        console.error("Error deleting branch:", error)
        toast.error("فشل في حذف الفرع")
      }
    }
  }

  const resetBranchForm = () => {
    setBranchForm({
      name: "",
      code: "",
      address: "",
      phone: "",
      manager_name: "",
      is_active: true
    })
    setEditingBranch(null)
  }

  // Filter branches based on search term
  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  if (error && !loading) {
    return (
      <div className="flex min-h-screen bg-slate-950 relative overflow-hidden">
        {/* Decorative background */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 [background:radial-gradient(700px_circle_at_100%_0%,rgba(37,99,235,0.12),transparent_60%),radial-gradient(700px_circle_at_0%_100%,rgba(14,165,233,0.1),transparent_60%)]" />
        <Sidebar />
        <div className="flex-1 flex items-center justify-center relative">
          <Card className="bg-slate-800 border-slate-700 max-w-md">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">خطأ في تحميل البيانات</h3>
              <p className="text-slate-400 mb-4">{error}</p>
              <Button onClick={() => loadBranches()} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                إعادة المحاولة
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Decorative background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 [background:radial-gradient(700px_circle_at_100%_0%,rgba(37,99,235,0.12),transparent_60%),radial-gradient(700px_circle_at_0%_100%,rgba(14,165,233,0.1),transparent_60%)]" />
      <Sidebar />
      <div className="flex-1 p-4 md:p-6 lg:p-8 relative">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/30">
                <Building2 className="h-8 w-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white mb-1">إدارة الفروع</h1>
                <p className="text-slate-400 text-sm">إدارة وتنظيم جميع فروع الشركة</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="البحث في الفروع..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64 bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-400 focus:border-blue-500/50 focus:ring-blue-500/20 transition-all duration-200"
                />
              </div>
            </div>
          </div>

          {/* Main Content Card */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-2xl shadow-black/20">
            <CardHeader className="border-b border-slate-700/50 bg-slate-800/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-white text-xl font-semibold flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    قائمة الفروع
                  </CardTitle>
                  <CardDescription className="text-slate-400">إدارة جميع فروع الشركة ({filteredBranches.length} فرع)</CardDescription>
                </div>
                <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={resetBranchForm}
                      className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                    >
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة فرع جديد
                    </Button>
                  </DialogTrigger>
              <DialogContent className="max-w-2xl bg-slate-800 border-slate-700">
                <DialogHeader className="border-b border-slate-700 pb-4">
                  <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    {editingBranch ? "تعديل الفرع" : "إضافة فرع جديد"}
                  </DialogTitle>
                  <DialogDescription className="text-slate-400 mt-2">
                    {editingBranch ? "تعديل بيانات الفرع المحدد" : "إدخال بيانات الفرع الجديد في النظام"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleBranchSubmit} className="space-y-6 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="branch-name" className="text-slate-300 font-medium flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        اسم الفرع *
                      </Label>
                      <Input
                        id="branch-name"
                        value={branchForm.name}
                        onChange={(e) => setBranchForm({...branchForm, name: e.target.value})}
                        required
                        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-green-500 focus:ring-green-500/20"
                        placeholder="أدخل اسم الفرع"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="branch-code" className="text-slate-300 font-medium">كود الفرع *</Label>
                      <Input
                        id="branch-code"
                        value={branchForm.code}
                        onChange={(e) => setBranchForm({...branchForm, code: e.target.value})}
                        required
                        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-green-500 focus:ring-green-500/20"
                        placeholder="كود فريد للفرع"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="branch-address" className="text-slate-300 font-medium">العنوان</Label>
                    <Textarea
                      id="branch-address"
                      value={branchForm.address}
                      onChange={(e) => setBranchForm({...branchForm, address: e.target.value})}
                      rows={3}
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-green-500 focus:ring-green-500/20 resize-none"
                      placeholder="العنوان التفصيلي للفرع"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="branch-phone" className="text-slate-300 font-medium">الهاتف</Label>
                      <Input
                        id="branch-phone"
                        value={branchForm.phone}
                        onChange={(e) => setBranchForm({...branchForm, phone: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-green-500 focus:ring-green-500/20"
                        placeholder="رقم هاتف الفرع"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="branch-manager" className="text-slate-300 font-medium">اسم المدير</Label>
                      <Input
                        id="branch-manager"
                        value={branchForm.manager_name}
                        onChange={(e) => setBranchForm({...branchForm, manager_name: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-green-500 focus:ring-green-500/20"
                        placeholder="اسم مدير الفرع"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                    <div className="flex flex-col">
                      <Label htmlFor="branch-active" className="text-slate-300 font-medium mb-1">حالة الفرع</Label>
                      <span className="text-sm text-slate-400">تفعيل أو إلغاء تفعيل الفرع</span>
                    </div>
                    <Switch
                      id="branch-active"
                      checked={branchForm.is_active}
                      onCheckedChange={(checked) => setBranchForm({...branchForm, is_active: checked})}
                      className="data-[state=checked]:bg-green-600"
                    />
                  </div>
                  <DialogFooter className="gap-3 pt-6">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setBranchDialogOpen(false)}
                      className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      إلغاء
                    </Button>
                    <Button 
                      type="submit"
                      className="bg-green-600 hover:bg-green-700 text-white font-medium px-6"
                    >
                      {editingBranch ? 'تحديث الفرع' : 'إضافة الفرع'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                  <Table className="w-full table-fixed">
                    <TableHeader>
                      <TableRow className="border-b border-slate-700/50 bg-slate-800/30">
                        <TableHead className="text-slate-300 font-semibold py-4 px-6" style={{width: '180px'}}>اسم الفرع</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6" style={{width: '120px'}}>الكود</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6" style={{width: '240px'}}>العنوان</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6" style={{width: '150px'}}>الهاتف</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6" style={{width: '180px'}}>المدير</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6 text-center" style={{width: '120px'}}>الحالة</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6 text-center" style={{width: '140px'}}>الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {filteredBranches.map((branch) => (
                      <TableRow 
                        key={branch.id} 
                        className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors duration-200"
                      >
                        <TableCell className="font-medium text-white py-4 px-6 truncate" style={{width: '180px'}}>{branch.name}</TableCell>
                         <TableCell className="text-slate-300 py-4 px-6" style={{width: '120px'}}>{branch.code || "-"}</TableCell>
                         <TableCell className="text-slate-300 py-4 px-6 truncate" style={{width: '240px'}}>{branch.address || "-"}</TableCell>
                         <TableCell className="text-slate-300 py-4 px-6" style={{width: '150px'}}>{branch.phone || "-"}</TableCell>
                         <TableCell className="text-slate-300 py-4 px-6 truncate" style={{width: '180px'}}>{branch.manager_name || "-"}</TableCell>
                         <TableCell className="py-4 px-6 text-center" style={{width: '120px'}}>
                           <Badge 
                             variant={branch.is_active ? "default" : "secondary"}
                             className={branch.is_active ? "bg-green-600/20 text-green-400 border-green-600/30" : "bg-slate-600/20 text-slate-400 border-slate-600/30"}
                           >
                             {branch.is_active ? "نشط" : "غير نشط"}
                           </Badge>
                         </TableCell>
                         <TableCell className="py-4 px-6" style={{width: '140px'}}>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditBranch(branch)}
                              className="h-8 w-8 p-0 border-slate-600 hover:border-blue-500 hover:bg-blue-500/10 hover:text-blue-400 transition-all duration-200"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteBranch(branch.id)}
                              className="h-8 w-8 p-0 border-slate-600 hover:border-red-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filteredBranches.length === 0 && (
                <div className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-3 bg-slate-700/30 rounded-full">
                      <Building2 className="h-8 w-8 text-slate-400" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-slate-400 font-medium">لا توجد فروع مطابقة للبحث</p>
                      <p className="text-slate-500 text-sm">جرب تعديل مصطلحات البحث أو إضافة فرع جديد</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}