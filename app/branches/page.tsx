"use client"

import { useState, useEffect, useRef } from "react"
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
import { Plus, Edit, Trash2, Building2, Search, AlertTriangle, RefreshCw, Upload, FileSpreadsheet, Download } from "lucide-react"
import { getBranches, createBranch, updateBranch, deleteBranch, getCustomers } from "@/lib/database"
import type { Branch, BranchInsert, Customer } from "@/lib/supabase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/sidebar"
import { ErrorBoundary } from "@/components/error-boundary"
import { useAuth } from "@/hooks/use-auth"
import * as XLSX from 'xlsx'

interface BranchFormData {
  name: string
  code: string
  address: string
  phone: string
  manager_name: string
  customer_id: string
  is_active: boolean
}

export default function BranchesPage() {
  const { user, loading: authLoading } = useAuth()
  const [branches, setBranches] = useState<Branch[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
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
    customer_id: "",
    is_active: true
  })

  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      const [branchesData, customersData] = await Promise.all([
        getBranches(),
        getCustomers()
      ])
      setBranches(branchesData)
      setCustomers(customersData)
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
      const branchData = {
        ...branchForm,
        customer_id: branchForm.customer_id ? parseInt(branchForm.customer_id) : null
      }
      if (editingBranch) {
        await updateBranch(editingBranch.id, branchData)
        toast.success("تم تحديث الفرع بنجاح")
      } else {
        await createBranch(branchData as BranchInsert)
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
      customer_id: branch.customer_id?.toString() || "",
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
        const errorMessage = error instanceof Error ? error.message : "فشل في حذف الفرع"
        
        if (errorMessage.includes("issuances associated with this branch")) {
          toast.error("لا يمكن حذف الفرع: يوجد إصدارات مرتبطة بهذا الفرع. يرجى إعادة تعيين أو حذف الإصدارات أولاً")
        } else {
          toast.error("فشل في حذف الفرع")
        }
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
      customer_id: "",
      is_active: true
    })
    setEditingBranch(null)
  }

  // Handle Excel file import
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      console.log('Excel data:', jsonData) // للتصحيح
      console.log('Available customers:', customers) // للتصحيح

      // Map Excel columns to branch fields
      const mappedData = jsonData.map((row: any) => {
        // Find customer by name if provided - البحث بطرق متعددة
        const customerName = row['العميل'] || row['اسم العميل'] || row['customer'] || row['Customer'] || ''
        const customerNameStr = customerName.toString().trim()
        
        // البحث عن العميل بعدة طرق:
        // 1. مطابقة كاملة (case-insensitive)
        // 2. البحث إذا كان اسم العميل يحتوي على النص المدخل
        // 3. البحث إذا كان النص المدخل يحتوي على اسم العميل
        let customer = null
        if (customerNameStr) {
          const searchName = customerNameStr.toLowerCase()
          customer = customers.find(c => {
            const cName = c.name.toLowerCase().trim()
            return cName === searchName || 
                   cName.includes(searchName) || 
                   searchName.includes(cName)
          })
          
          console.log(`Searching for customer: "${customerNameStr}", Found:`, customer) // للتصحيح
        }

        return {
          name: row['اسم الفرع'] || row['الفرع'] || row['name'] || row['Name'] || '',
          code: row['كود الفرع'] || row['الكود'] || row['code'] || row['Code'] || '',
          address: row['العنوان'] || row['address'] || row['Address'] || '',
          phone: row['الهاتف'] || row['رقم الهاتف'] || row['phone'] || row['Phone'] || '',
          manager_name: row['المدير'] || row['اسم المدير'] || row['manager'] || row['Manager'] || '',
          customer_id: customer?.id?.toString() || '',
          customer_name: customerNameStr,
          customer_found: !!customer, // لعرض حالة العثور على العميل
          is_active: true
        }
      }).filter((item: any) => item.name) // Filter out empty rows

      setImportPreview(mappedData)
      setImportDialogOpen(true)
    } catch (error) {
      console.error('Error reading Excel file:', error)
      toast.error('فشل في قراءة ملف Excel')
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Import branches from preview
  const handleImportBranches = async () => {
    if (importPreview.length === 0) {
      toast.error('لا توجد بيانات للاستيراد')
      return
    }

    setImporting(true)
    let successCount = 0
    let errorCount = 0

    try {
      for (const branch of importPreview) {
        try {
          await createBranch({
            name: branch.name,
            code: branch.code || `BR-${Date.now()}`,
            address: branch.address,
            phone: branch.phone,
            manager_name: branch.manager_name,
            customer_id: branch.customer_id ? parseInt(branch.customer_id) : null,
            is_active: true
          } as BranchInsert)
          successCount++
        } catch (err) {
          console.error('Error importing branch:', branch.name, err)
          errorCount++
        }
      }

      if (successCount > 0) {
        toast.success(`تم استيراد ${successCount} فرع بنجاح`)
        loadBranches()
      }
      if (errorCount > 0) {
        toast.error(`فشل استيراد ${errorCount} فرع`)
      }

      setImportDialogOpen(false)
      setImportPreview([])
    } catch (error) {
      console.error('Error importing branches:', error)
      toast.error('فشل في استيراد الفروع')
    } finally {
      setImporting(false)
    }
  }

  // Download Excel template
  const downloadTemplate = () => {
    const templateData = [
      {
        'اسم الفرع': 'فرع القاهرة',
        'كود الفرع': 'CAI-001',
        'العنوان': 'شارع التحرير، القاهرة',
        'الهاتف': '0123456789',
        'المدير': 'أحمد محمد',
        'العميل': 'شركة ABC'
      }
    ]

    const worksheet = XLSX.utils.json_to_sheet(templateData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'الفروع')
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 20 }, // اسم الفرع
      { wch: 15 }, // كود الفرع
      { wch: 30 }, // العنوان
      { wch: 15 }, // الهاتف
      { wch: 20 }, // المدير
      { wch: 20 }, // العميل
    ]

    XLSX.writeFile(workbook, 'قالب_استيراد_الفروع.xlsx')
    toast.success('تم تحميل القالب بنجاح')
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
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="البحث في الفروع..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10 w-64 bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-400 focus:border-blue-500/50 focus:ring-blue-500/20 transition-all duration-200"
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
                <div className="flex items-center gap-2">
                  {/* Hidden file input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".xlsx,.xls"
                    className="hidden"
                  />
                  
                  {/* Download Template Button */}
                  <Button
                    variant="outline"
                    onClick={downloadTemplate}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                  >
                    <Download className="h-4 w-4 ml-2" />
                    تحميل القالب
                  </Button>
                  
                  {/* Import Button */}
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="border-green-600 text-green-400 hover:bg-green-600/20 hover:text-green-300"
                  >
                    <Upload className="h-4 w-4 ml-2" />
                    استيراد من Excel
                  </Button>
                  
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
                  <div className="space-y-3">
                    <Label htmlFor="branch-customer" className="text-slate-300 font-medium">العميل (اختياري)</Label>
                    <Select 
                      value={branchForm.customer_id || "none"} 
                      onValueChange={(value) => setBranchForm({...branchForm, customer_id: value === "none" ? "" : value})}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="اختر العميل المرتبط بالفرع" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        <SelectItem value="none">بدون عميل</SelectItem>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id.toString()}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-400">ربط الفرع بعميل معين سيجعله يظهر فقط عند اختيار هذا العميل في الصادرات</p>
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
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                  <Table className="w-full table-fixed">
                    <TableHeader>
                      <TableRow className="border-b border-slate-700/50 bg-slate-800/30">
                        <TableHead className="text-slate-300 font-semibold py-4 px-6 text-right" style={{width: '180px'}}>اسم الفرع</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6 text-right" style={{width: '120px'}}>الكود</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6 text-right" style={{width: '240px'}}>العنوان</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6 text-right" style={{width: '150px'}}>الهاتف</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6 text-right" style={{width: '180px'}}>المدير</TableHead>
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
                        <TableCell className="font-medium text-white py-4 px-6 truncate text-right" style={{width: '180px'}}>{branch.name}</TableCell>
                         <TableCell className="text-slate-300 py-4 px-6 text-right" style={{width: '120px'}}>{branch.code || "-"}</TableCell>
                         <TableCell className="text-slate-300 py-4 px-6 truncate text-right" style={{width: '240px'}}>{branch.address || "-"}</TableCell>
                         <TableCell className="text-slate-300 py-4 px-6 text-right" style={{width: '150px'}}>{branch.phone || "-"}</TableCell>
                         <TableCell className="text-slate-300 py-4 px-6 truncate text-right" style={{width: '180px'}}>{branch.manager_name || "-"}</TableCell>
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

          {/* Import Preview Dialog */}
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogContent className="max-w-4xl bg-slate-800 border-slate-700 max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader className="border-b border-slate-700 pb-4">
                <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-green-400" />
                  معاينة البيانات قبل الاستيراد
                </DialogTitle>
                <DialogDescription className="text-slate-400 mt-2">
                  تم العثور على {importPreview.length} فرع. راجع البيانات قبل الاستيراد.
                  {importPreview.some(b => b.customer_name && !b.customer_found) && (
                    <span className="block mt-1 text-yellow-400">
                      ⚠️ بعض أسماء العملاء غير موجودة في النظام - سيتم إضافة الفروع بدون ربط بعميل
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex-1 overflow-auto py-4">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-700">
                      <TableHead className="text-slate-300 text-right">اسم الفرع</TableHead>
                      <TableHead className="text-slate-300 text-right">الكود</TableHead>
                      <TableHead className="text-slate-300 text-right">العنوان</TableHead>
                      <TableHead className="text-slate-300 text-right">الهاتف</TableHead>
                      <TableHead className="text-slate-300 text-right">المدير</TableHead>
                      <TableHead className="text-slate-300 text-right">العميل</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.map((branch, index) => (
                      <TableRow key={index} className="border-b border-slate-700/30">
                        <TableCell className="text-white">{branch.name}</TableCell>
                        <TableCell className="text-slate-300">{branch.code || '-'}</TableCell>
                        <TableCell className="text-slate-300">{branch.address || '-'}</TableCell>
                        <TableCell className="text-slate-300">{branch.phone || '-'}</TableCell>
                        <TableCell className="text-slate-300">{branch.manager_name || '-'}</TableCell>
                        <TableCell className="text-slate-300">
                          {branch.customer_found ? (
                            <Badge className="bg-green-600/20 text-green-400 border border-green-600/30">
                              ✓ {customers.find(c => c.id.toString() === branch.customer_id)?.name}
                            </Badge>
                          ) : branch.customer_name ? (
                            <Badge className="bg-yellow-600/20 text-yellow-400 border border-yellow-600/30">
                              ⚠️ {branch.customer_name} (غير موجود)
                            </Badge>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter className="border-t border-slate-700 pt-4 gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setImportDialogOpen(false)
                    setImportPreview([])
                  }}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleImportBranches}
                  disabled={importing || importPreview.length === 0}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
                      جاري الاستيراد...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 ml-2" />
                      استيراد {importPreview.length} فرع
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}