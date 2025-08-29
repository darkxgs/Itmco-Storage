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
import { Plus, Edit, Trash2, UserCheck, Search, AlertTriangle, RefreshCw } from "lucide-react"
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
      <div className="flex min-h-screen bg-slate-900">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
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
      <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Sidebar />
        <div className="flex-1 p-8">
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
            <div className="flex items-center space-x-4 space-x-reverse">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                <Input
                  placeholder="البحث في العملاء..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 w-80 bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-400 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 backdrop-blur-sm"
                />
              </div>
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
                        <TableHead className="text-slate-300 font-semibold py-4 px-6" style={{width: '200px'}}>اسم العميل</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6" style={{width: '120px'}}>الكود</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6" style={{width: '220px'}}>البريد الإلكتروني</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6" style={{width: '150px'}}>الهاتف</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6" style={{width: '180px'}}>الشخص المسؤول</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6 text-center" style={{width: '120px'}}>الحالة</TableHead>
                        <TableHead className="text-slate-300 font-semibold py-4 px-6 text-center" style={{width: '140px'}}>الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                     <TableBody>
                       {filteredCustomers.map((customer) => (
                         <TableRow 
                           key={customer.id}
                           className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors duration-200"
                         >
                           <TableCell className="font-medium text-white py-4 px-6 truncate" style={{width: '200px'}}>{customer.name}</TableCell>
                           <TableCell className="text-slate-300 py-4 px-6" style={{width: '120px'}}>{customer.code || "-"}</TableCell>
                           <TableCell className="text-slate-300 py-4 px-6 truncate" style={{width: '220px'}}>{customer.email || "-"}</TableCell>
                           <TableCell className="text-slate-300 py-4 px-6" style={{width: '150px'}}>{customer.phone || "-"}</TableCell>
                           <TableCell className="text-slate-300 py-4 px-6 truncate" style={{width: '180px'}}>{customer.contact_person || "-"}</TableCell>
                           <TableCell className="py-4 px-6 text-center" style={{width: '120px'}}>
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
                           <TableCell className="py-4 px-6" style={{width: '140px'}}>
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