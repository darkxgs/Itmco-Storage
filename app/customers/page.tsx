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
import { Plus, Edit, Trash2, UserCheck, Search, AlertTriangle, RefreshCw, Upload, Download } from "lucide-react"
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from "@/lib/database"
import type { Customer, CustomerInsert } from "@/lib/supabase"
import { Sidebar } from "@/components/sidebar"
import { ErrorBoundary } from "@/components/error-boundary"
import { useAuth } from "@/hooks/use-auth"

interface CustomerFormData {
  name: string
  code: string
  email: string
  phone: string
  address: string
  contact_person: string
  is_active: boolean
}

export default function CustomersPage() {
  const { user, loading: authLoading } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [error, setError] = useState<string | null>(null)
  
  // Customer form state
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [customerForm, setCustomerForm] = useState<CustomerFormData>({
    name: "",
    code: "",
    email: "",
    phone: "",
    address: "",
    contact_person: "",
    is_active: true
  })
  
  // Excel import state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (user) {
      loadCustomers()
    }
  }, [user])

  const loadCustomers = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      setError(null)
      const customersData = await getCustomers()
      setCustomers(customersData)
    } catch (error) {
      console.error("Error loading customers:", error)
      setError("فشل في تحميل العملاء")
      toast.error("فشل في تحميل العملاء")
    } finally {
      setLoading(false)
    }
  }

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, customerForm)
        toast.success("تم تحديث العميل بنجاح")
      } else {
        await createCustomer(customerForm as CustomerInsert)
        toast.success("تم إضافة العميل بنجاح")
      }
      setCustomerDialogOpen(false)
      resetCustomerForm()
      loadCustomers()
    } catch (error) {
      console.error("Error saving customer:", error)
      toast.error("فشل في حفظ العميل")
    }
  }

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer)
    setCustomerForm({
      name: customer.name,
      code: customer.code || "",
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      contact_person: customer.contact_person || "",
      is_active: customer.is_active
    })
    setCustomerDialogOpen(true)
  }

  const handleDeleteCustomer = async (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا العميل؟")) {
      try {
        await deleteCustomer(id)
        toast.success("تم حذف العميل بنجاح")
        loadCustomers()
      } catch (error) {
        console.error("Error deleting customer:", error)
        toast.error("فشل في حذف العميل")
      }
    }
  }

  const resetCustomerForm = () => {
    setCustomerForm({
      name: "",
      code: "",
      email: "",
      phone: "",
      address: "",
      contact_person: "",
      is_active: true
    })
    setEditingCustomer(null)
  }

  const handleDownloadTemplate = async () => {
    try {
      const ExcelJS = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      
      // Create main data sheet
      const worksheet = workbook.addWorksheet('العملاء')
      
      // Add headers with styling
      const headers = ['اسم العميل *', 'كود العميل', 'البريد الإلكتروني', 'الهاتف', 'العنوان', 'الشخص المسؤول', 'الحالة']
      const headerRow = worksheet.addRow(headers)
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 12 }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '366092' }
      }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25
      
      // Add sample data rows
      const sampleData = [
        ['شركة ABC للتجارة', 'CUST-001', 'info@abc.com', '01234567890', 'القاهرة، مصر', 'أحمد محمد', 'نشط'],
        ['مؤسسة XYZ', 'CUST-002', 'contact@xyz.com', '01098765432', 'الجيزة، مصر', 'محمد علي', 'نشط'],
        ['شركة التقنية الحديثة', 'CUST-003', 'info@tech.com', '01555555555', 'الإسكندرية، مصر', 'سارة أحمد', 'غير نشط']
      ]
      
      sampleData.forEach((data, index) => {
        const row = worksheet.addRow(data)
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: index % 2 === 0 ? 'F0F8FF' : 'FFFFFF' }
        }
        row.alignment = { horizontal: 'right', vertical: 'middle' }
      })
      
      // Set column widths
      worksheet.columns = [
        { width: 30 }, // اسم العميل
        { width: 15 }, // كود العميل
        { width: 25 }, // البريد الإلكتروني
        { width: 15 }, // الهاتف
        { width: 35 }, // العنوان
        { width: 20 }, // الشخص المسؤول
        { width: 12 }  // الحالة
      ]
      
      // Add data validation for "الحالة" column (column G)
      worksheet.dataValidations.add('G2:G1000', {
        type: 'list',
        allowBlank: false,
        formulae: ['"نشط,غير نشط"'],
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'قيمة غير صحيحة',
        error: 'يرجى اختيار "نشط" أو "غير نشط" من القائمة المنسدلة',
        showInputMessage: true,
        promptTitle: 'اختر الحالة',
        prompt: 'اختر "نشط" أو "غير نشط"'
      })
      
      // Add borders to all cells
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'CCCCCC' } },
            left: { style: 'thin', color: { argb: 'CCCCCC' } },
            bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
            right: { style: 'thin', color: { argb: 'CCCCCC' } }
          }
        })
      })
      
      // Create instructions sheet
      const instructionsSheet = workbook.addWorksheet('التعليمات')
      const instructions = [
        ['تعليمات استيراد العملاء'],
        [''],
        ['الحقول المطلوبة (يجب ملؤها):'],
        ['• اسم العميل: اسم العميل أو الشركة (مطلوب)'],
        [''],
        ['الحقول الاختيارية:'],
        ['• كود العميل: كود فريد للعميل (اختياري)'],
        ['• البريد الإلكتروني: البريد الإلكتروني للعميل'],
        ['• الهاتف: رقم هاتف العميل'],
        ['• العنوان: العنوان التفصيلي للعميل'],
        ['• الشخص المسؤول: اسم الشخص المسؤول عن التواصل'],
        ['• الحالة: اختر "نشط" أو "غير نشط" من القائمة المنسدلة'],
        [''],
        ['ملاحظات مهمة:'],
        ['• استخدم القائمة المنسدلة لعمود "الحالة" (لا تكتب يدوياً)'],
        ['• احذف الصفوف النموذجية قبل إضافة بياناتك'],
        ['• تأكد من حفظ الملف بصيغة Excel (.xlsx)'],
        ['• يمكنك إضافة عدد غير محدود من العملاء'],
        ['• في حالة وجود أخطاء، سيتم عرض رسالة توضح الصف الذي به مشكلة'],
        [''],
        ['أمثلة على البيانات الصحيحة:'],
        ['• اسم العميل: شركة ABC للتجارة'],
        ['• كود العميل: CUST-001 (أو اتركه فارغاً)'],
        ['• البريد الإلكتروني: info@company.com'],
        ['• الهاتف: 01234567890'],
        ['• العنوان: القاهرة، شارع التحرير، مبنى 5'],
        ['• الشخص المسؤول: أحمد محمد'],
        ['• الحالة: نشط (اختر من القائمة)']
      ]
      
      instructions.forEach((instruction, index) => {
        const row = instructionsSheet.addRow(instruction)
        if (index === 0) {
          row.font = { bold: true, size: 16, color: { argb: '366092' } }
        } else if (instruction[0]?.includes('•')) {
          row.font = { size: 11 }
        } else if (instruction[0]?.includes(':')) {
          row.font = { bold: true, size: 12 }
        }
      })
      
      instructionsSheet.getColumn(1).width = 80
      
      // Generate file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `قالب_استيراد_العملاء_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success("تم تحميل القالب بنجاح")
    } catch (error) {
      console.error("Error downloading template:", error)
      toast.error("فشل في تحميل القالب")
    }
  }

  const handleImportExcel = async () => {
    if (!importFile) {
      toast.error("يرجى اختيار ملف Excel")
      return
    }

    setImporting(true)
    try {
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

      const columnMap = {
        name: headers.findIndex(h => h?.includes('اسم العميل') || h?.includes('name')),
        code: headers.findIndex(h => h?.includes('كود') || h?.includes('code')),
        email: headers.findIndex(h => h?.includes('البريد') || h?.includes('email')),
        phone: headers.findIndex(h => h?.includes('الهاتف') || h?.includes('phone')),
        address: headers.findIndex(h => h?.includes('العنوان') || h?.includes('address')),
        contact_person: headers.findIndex(h => h?.includes('الشخص المسؤول') || h?.includes('contact')),
        is_active: headers.findIndex(h => h?.includes('الحالة') || h?.includes('نشط') || h?.includes('active'))
      }

      if (columnMap.name === -1) {
        throw new Error("الملف يجب أن يحتوي على عمود 'اسم العميل'")
      }

      const importedCustomers = []
      const errors = []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        if (!row || row.length === 0) continue

        try {
          // Parse is_active status with better validation
          let isActive = true // default value
          if (columnMap.is_active !== -1 && row[columnMap.is_active] !== undefined && row[columnMap.is_active] !== null) {
            const statusValue = row[columnMap.is_active]?.toString()?.trim()?.toLowerCase()
            
            // Accept multiple formats
            if (statusValue === 'نشط' || statusValue === 'active' || statusValue === 'نعم' || 
                statusValue === 'yes' || statusValue === 'true' || statusValue === '1') {
              isActive = true
            } else if (statusValue === 'غير نشط' || statusValue === 'inactive' || statusValue === 'لا' || 
                       statusValue === 'no' || statusValue === 'false' || statusValue === '0') {
              isActive = false
            } else if (statusValue !== '') {
              // If value is not empty and not recognized, show warning but continue
              errors.push(`الصف ${i + 2}: تحذير - قيمة الحالة "${row[columnMap.is_active]}" غير معروفة، تم استخدام "نشط" كقيمة افتراضية`)
            }
          }

          const customerData: CustomerInsert = {
            name: row[columnMap.name]?.toString()?.trim() || '',
            code: row[columnMap.code]?.toString()?.trim() || null,
            email: row[columnMap.email]?.toString()?.trim() || null,
            phone: row[columnMap.phone]?.toString()?.trim() || null,
            address: row[columnMap.address]?.toString()?.trim() || null,
            contact_person: row[columnMap.contact_person]?.toString()?.trim() || null,
            is_active: isActive
          }

          if (!customerData.name) {
            errors.push(`الصف ${i + 2}: اسم العميل مطلوب`)
            continue
          }

          // Validate email format if provided
          if (customerData.email && !customerData.email.includes('@')) {
            errors.push(`الصف ${i + 2}: تحذير - البريد الإلكتروني "${customerData.email}" قد يكون غير صحيح`)
          }

          const newCustomer = await createCustomer(customerData)
          importedCustomers.push(newCustomer)
        } catch (error: any) {
          errors.push(`الصف ${i + 2}: ${error.message}`)
        }
      }

      if (importedCustomers.length > 0) {
        loadCustomers()
      }

      if (errors.length > 0) {
        toast.error(`تم استيراد ${importedCustomers.length} عميل مع ${errors.length} خطأ`)
      } else {
        toast.success(`تم استيراد ${importedCustomers.length} عميل بنجاح`)
      }

      setIsImportDialogOpen(false)
      setImportFile(null)
    } catch (error: any) {
      console.error("Error importing Excel:", error)
      toast.error(error.message || "حدث خطأ أثناء استيراد الملف")
    } finally {
      setImporting(false)
    }
  }

  const handleExportCustomers = async () => {
    try {
      const ExcelJS = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('العملاء')
      
      // Add title
      worksheet.mergeCells('A1:G1')
      const titleCell = worksheet.getCell('A1')
      titleCell.value = 'قائمة العملاء'
      titleCell.font = { bold: true, size: 16, color: { argb: '366092' } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'E8F4F8' }
      }
      worksheet.getRow(1).height = 30
      
      // Add export date
      worksheet.mergeCells('A2:G2')
      const dateCell = worksheet.getCell('A2')
      dateCell.value = `تاريخ التصدير: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' })}`
      dateCell.font = { size: 10, color: { argb: '666666' } }
      dateCell.alignment = { horizontal: 'center', vertical: 'middle' }
      worksheet.getRow(2).height = 20
      
      // Add headers
      const headers = ['اسم العميل', 'كود العميل', 'البريد الإلكتروني', 'الهاتف', 'العنوان', 'الشخص المسؤول', 'الحالة']
      const headerRow = worksheet.addRow(headers)
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 12 }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '366092' }
      }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25
      
      // Add data with alternating colors
      filteredCustomers.forEach((customer, index) => {
        const row = worksheet.addRow([
          customer.name,
          customer.code || '-',
          customer.email || '-',
          customer.phone || '-',
          customer.address || '-',
          customer.contact_person || '-',
          customer.is_active ? 'نشط' : 'غير نشط'
        ])
        
        // Alternating row colors
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: index % 2 === 0 ? 'F0F8FF' : 'FFFFFF' }
        }
        
        row.alignment = { horizontal: 'right', vertical: 'middle' }
        
        // Color code for status
        const statusCell = row.getCell(7)
        if (customer.is_active) {
          statusCell.font = { color: { argb: '008000' }, bold: true }
        } else {
          statusCell.font = { color: { argb: 'FF0000' }, bold: true }
        }
      })
      
      // Set column widths
      worksheet.columns = [
        { width: 30 }, // اسم العميل
        { width: 15 }, // كود العميل
        { width: 25 }, // البريد الإلكتروني
        { width: 15 }, // الهاتف
        { width: 35 }, // العنوان
        { width: 20 }, // الشخص المسؤول
        { width: 12 }  // الحالة
      ]
      
      // Add borders to all cells
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 2) { // Skip title and date rows
          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'CCCCCC' } },
              left: { style: 'thin', color: { argb: 'CCCCCC' } },
              bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
              right: { style: 'thin', color: { argb: 'CCCCCC' } }
            }
          })
        }
      })
      
      // Add summary at the bottom
      const summaryRow = worksheet.addRow([])
      summaryRow.getCell(1).value = `إجمالي العملاء: ${filteredCustomers.length}`
      summaryRow.getCell(1).font = { bold: true, size: 11 }
      summaryRow.getCell(1).alignment = { horizontal: 'right' }
      
      const activeCount = filteredCustomers.filter(c => c.is_active).length
      const inactiveCount = filteredCustomers.length - activeCount
      summaryRow.getCell(2).value = `نشط: ${activeCount}`
      summaryRow.getCell(2).font = { color: { argb: '008000' }, bold: true }
      summaryRow.getCell(3).value = `غير نشط: ${inactiveCount}`
      summaryRow.getCell(3).font = { color: { argb: 'FF0000' }, bold: true }
      
      // Generate file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `العملاء_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success(`تم تصدير ${filteredCustomers.length} عميل بنجاح`)
    } catch (error) {
      console.error("Error exporting customers:", error)
      toast.error("فشل في تصدير العملاء")
    }
  }

  // Filter customers based on search term
  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.code.toLowerCase().includes(searchTerm.toLowerCase())
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
              <Button onClick={() => loadCustomers()} disabled={loading}>
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
    <ErrorBoundary>
      <div className="flex min-h-screen bg-slate-950 relative overflow-hidden">
        {/* Decorative background */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 [background:radial-gradient(700px_circle_at_100%_0%,rgba(37,99,235,0.12),transparent_60%),radial-gradient(700px_circle_at_0%_100%,rgba(14,165,233,0.1),transparent_60%)]" />
        <Sidebar />
        <div className="flex-1 p-8 relative">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-10 gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/30">
                <UserCheck className="h-8 w-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white mb-1">إدارة العملاء</h1>
                <p className="text-slate-400">إدارة وتنظيم بيانات العملاء</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                <Input
                  placeholder="البحث في العملاء..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 w-80 bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-400 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 backdrop-blur-sm"
                />
              </div>
              <Button
                onClick={handleExportCustomers}
                variant="outline"
                className="border-green-500/30 text-green-400 hover:bg-green-500/20"
              >
                <Download className="h-4 w-4 ml-2" />
                تصدير Excel
              </Button>
              <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                  >
                    <Upload className="h-4 w-4 ml-2" />
                    استيراد Excel
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-800 border-slate-700 text-white">
                  <DialogHeader>
                    <DialogTitle className="text-right">استيراد عملاء من ملف Excel</DialogTitle>
                    <DialogDescription className="text-slate-400 text-right">
                      قم بتحميل ملف Excel يحتوي على بيانات العملاء
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="import-file" className="text-slate-300">
                        اختر ملف Excel
                      </Label>
                      <Input
                        id="import-file"
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleDownloadTemplate}
                        variant="outline"
                        className="flex-1 border-slate-600 text-slate-300"
                      >
                        <Download className="h-4 w-4 ml-2" />
                        تحميل القالب
                      </Button>
                    </div>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsImportDialogOpen(false)}
                      className="border-slate-600 text-slate-300"
                    >
                      إلغاء
                    </Button>
                    <Button
                      onClick={handleImportExcel}
                      disabled={!importFile || importing}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {importing ? "جاري الاستيراد..." : "استيراد"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm shadow-2xl shadow-black/20">
            <CardHeader className="border-b border-slate-700/50 bg-slate-800/30">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <CardTitle className="text-white text-xl">قائمة العملاء</CardTitle>
                  </div>
                  <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600">
                    {filteredCustomers.length} عميل
                  </Badge>
                </div>
                <CardDescription className="text-slate-400 lg:hidden">إدارة جميع عملاء الشركة</CardDescription>
                <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={resetCustomerForm}
                      className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                    >
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة عميل جديد
                    </Button>
                  </DialogTrigger>
              <DialogContent className="max-w-2xl bg-slate-800 border-slate-700">
                <DialogHeader className="border-b border-slate-700 pb-4">
                  <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    {editingCustomer ? "تعديل العميل" : "إضافة عميل جديد"}
                  </DialogTitle>
                  <DialogDescription className="text-slate-400 mt-2">
                    {editingCustomer ? "تعديل بيانات العميل المحدد" : "إدخال بيانات العميل الجديد في النظام"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCustomerSubmit} className="space-y-6 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="customer-name" className="text-slate-300 font-medium flex items-center gap-2">
                        <UserCheck className="w-4 h-4" />
                        اسم العميل *
                      </Label>
                      <Input
                        id="customer-name"
                        value={customerForm.name}
                        onChange={(e) => setCustomerForm({...customerForm, name: e.target.value})}
                        required
                        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20"
                        placeholder="أدخل اسم العميل"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="customer-code" className="text-slate-300 font-medium">كود العميل</Label>
                      <Input
                        id="customer-code"
                        value={customerForm.code}
                        onChange={(e) => setCustomerForm({...customerForm, code: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20"
                        placeholder="كود اختياري للعميل"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="customer-email" className="text-slate-300 font-medium">البريد الإلكتروني</Label>
                      <Input
                        id="customer-email"
                        type="email"
                        value={customerForm.email}
                        onChange={(e) => setCustomerForm({...customerForm, email: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20"
                        placeholder="example@company.com"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="customer-phone" className="text-slate-300 font-medium">الهاتف</Label>
                      <Input
                        id="customer-phone"
                        value={customerForm.phone}
                        onChange={(e) => setCustomerForm({...customerForm, phone: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20"
                        placeholder="رقم الهاتف"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="customer-address" className="text-slate-300 font-medium">العنوان</Label>
                    <Textarea
                      id="customer-address"
                      value={customerForm.address}
                      onChange={(e) => setCustomerForm({...customerForm, address: e.target.value})}
                      rows={2}
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20 resize-none"
                      placeholder="العنوان التفصيلي للعميل"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="customer-contact" className="text-slate-300 font-medium">الشخص المسؤول</Label>
                    <Input
                      id="customer-contact"
                      value={customerForm.contact_person}
                      onChange={(e) => setCustomerForm({...customerForm, contact_person: e.target.value})}
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20"
                      placeholder="اسم الشخص المسؤول"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
                    <div className="flex items-center space-x-3 space-x-reverse">
                      <Switch
                        id="customer-active"
                        checked={customerForm.is_active}
                        onCheckedChange={(checked) => setCustomerForm({...customerForm, is_active: checked})}
                        className="data-[state=checked]:bg-blue-600"
                      />
                      <Label htmlFor="customer-active" className="text-slate-300 font-medium cursor-pointer">
                        عميل نشط
                      </Label>
                    </div>
                    <div className="text-xs text-slate-400">
                      {customerForm.is_active ? "العميل متاح للتعامل" : "العميل غير متاح"}
                    </div>
                  </div>
                  <DialogFooter className="gap-3 pt-6 border-t border-slate-700">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setCustomerDialogOpen(false)}
                      className="bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      إلغاء
                    </Button>
                    <Button 
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      {editingCustomer ? "تحديث العميل" : "إضافة العميل"}
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
                        <TableHead className="text-slate-300 font-semibold py-4 px-6 text-left w-[200px]">اسم العميل</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6 text-center w-[120px]">الكود</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6 text-left w-[220px]">البريد الإلكتروني</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6 text-center w-[150px]">الهاتف</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6 text-left w-[180px]">الشخص المسؤول</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6 text-center w-[120px]">الحالة</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6 text-center w-[140px]">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                     <TableBody>
                       {filteredCustomers.map((customer) => (
                         <TableRow 
                           key={customer.id}
                           className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors duration-200"
                         >
                           <TableCell className="font-medium text-white py-4 px-6 truncate text-left w-[200px]">{customer.name}</TableCell>
                           <TableCell className="text-slate-300 py-4 px-6 text-center w-[120px]">{customer.code || "-"}</TableCell>
                           <TableCell className="text-slate-300 py-4 px-6 truncate text-left w-[220px]">{customer.email || "-"}</TableCell>
                           <TableCell className="text-slate-300 py-4 px-6 text-center w-[150px]">{customer.phone || "-"}</TableCell>
                           <TableCell className="text-slate-300 py-4 px-6 truncate text-left w-[180px]">{customer.contact_person || "-"}</TableCell>
                           <TableCell className="py-4 px-6 text-center w-[120px]">
                             <Badge 
                               variant={customer.is_active ? "default" : "secondary"}
                               className={customer.is_active 
                                 ? "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30 transition-colors" 
                                 : "bg-slate-600/20 text-slate-400 border-slate-600/30"
                               }
                             >
                               {customer.is_active ? "نشط" : "غير نشط"}
                             </Badge>
                           </TableCell>
                           <TableCell className="py-4 px-6 text-center w-[140px]">
                             <div className="flex items-center justify-center space-x-2 space-x-reverse">
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => handleEditCustomer(customer)}
                                 className="border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/50 transition-all duration-200"
                               >
                                 <Edit className="h-4 w-4" />
                               </Button>
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => handleDeleteCustomer(customer.id)}
                                 className="border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-all duration-200"
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
                  {filteredCustomers.length === 0 && (
                    <div className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-3 bg-slate-700/30 rounded-full">
                          <UserCheck className="h-8 w-8 text-slate-400" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-slate-400 font-medium">لا توجد عملاء مطابقون للبحث</p>
                          <p className="text-slate-500 text-sm">جرب تعديل مصطلحات البحث أو إضافة عميل جديد</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </ErrorBoundary>
  )
}