"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Plus, Edit, Trash2, Building2, Users, Search } from "lucide-react"
import { getBranches, createBranch, updateBranch, deleteBranch, getCustomers, createCustomer, updateCustomer, deleteCustomer } from "@/lib/database"
import type { Branch, Customer, BranchInsert, CustomerInsert } from "@/lib/supabase"

interface BranchFormData {
  name: string
  code: string
  address: string
  phone: string
  manager_name: string
  is_active: boolean
}

interface CustomerFormData {
  name: string
  code: string
  email: string
  phone: string
  address: string
  contact_person: string
  is_active: boolean
}

export default function AdminPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  
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
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [branchesData, customersData] = await Promise.all([
        getBranches(),
        getCustomers()
      ])
      setBranches(branchesData)
      setCustomers(customersData)
    } catch (error) {
      console.error("Error loading data:", error)
      toast.error("فشل في تحميل البيانات")
    } finally {
      setLoading(false)
    }
  }

  // Branch functions
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
      loadData()
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
        loadData()
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

  // Customer functions
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
      loadData()
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
        loadData()
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

  // Filter data based on search term
  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.code && customer.code.toLowerCase().includes(searchTerm.toLowerCase()))
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
        <h1 className="text-3xl font-bold">لوحة التحكم الإدارية</h1>
        <div className="flex items-center space-x-4 space-x-reverse">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="البحث..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="branches" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="branches" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            الفروع
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            العملاء
          </TabsTrigger>
        </TabsList>

        {/* Branches Tab */}
        <TabsContent value="branches" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>إدارة الفروع</CardTitle>
                  <CardDescription>إضافة وتعديل وحذف فروع الشركة</CardDescription>
                </div>
                <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={resetBranchForm}>
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة فرع جديد
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        {editingBranch ? "تعديل الفرع" : "إضافة فرع جديد"}
                      </DialogTitle>
                      <DialogDescription>
                        {editingBranch ? "تعديل بيانات الفرع" : "إدخال بيانات الفرع الجديد"}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleBranchSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="branch-name">اسم الفرع *</Label>
                          <Input
                            id="branch-name"
                            value={branchForm.name}
                            onChange={(e) => setBranchForm({...branchForm, name: e.target.value})}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="branch-code">كود الفرع *</Label>
                          <Input
                            id="branch-code"
                            value={branchForm.code}
                            onChange={(e) => setBranchForm({...branchForm, code: e.target.value})}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="branch-address">العنوان</Label>
                        <Textarea
                          id="branch-address"
                          value={branchForm.address}
                          onChange={(e) => setBranchForm({...branchForm, address: e.target.value})}
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="branch-phone">الهاتف</Label>
                          <Input
                            id="branch-phone"
                            value={branchForm.phone}
                            onChange={(e) => setBranchForm({...branchForm, phone: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="branch-manager">اسم المدير</Label>
                          <Input
                            id="branch-manager"
                            value={branchForm.manager_name}
                            onChange={(e) => setBranchForm({...branchForm, manager_name: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <Switch
                          id="branch-active"
                          checked={branchForm.is_active}
                          onCheckedChange={(checked) => setBranchForm({...branchForm, is_active: checked})}
                        />
                        <Label htmlFor="branch-active">فرع نشط</Label>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setBranchDialogOpen(false)}>
                          إلغاء
                        </Button>
                        <Button type="submit">
                          {editingBranch ? "تحديث" : "إضافة"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>اسم الفرع</TableHead>
                    <TableHead>الكود</TableHead>
                    <TableHead>العنوان</TableHead>
                    <TableHead>الهاتف</TableHead>
                    <TableHead>المدير</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBranches.map((branch) => (
                    <TableRow key={branch.id}>
                      <TableCell className="font-medium">{branch.name}</TableCell>
                      <TableCell>{branch.code}</TableCell>
                      <TableCell>{branch.address || "-"}</TableCell>
                      <TableCell>{branch.phone || "-"}</TableCell>
                      <TableCell>{branch.manager_name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={branch.is_active ? "default" : "secondary"}>
                          {branch.is_active ? "نشط" : "غير نشط"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditBranch(branch)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteBranch(branch.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredBranches.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  لا توجد فروع مطابقة للبحث
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>إدارة العملاء</CardTitle>
                  <CardDescription>إضافة وتعديل وحذف عملاء الشركة</CardDescription>
                </div>
                <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={resetCustomerForm}>
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة عميل جديد
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        {editingCustomer ? "تعديل العميل" : "إضافة عميل جديد"}
                      </DialogTitle>
                      <DialogDescription>
                        {editingCustomer ? "تعديل بيانات العميل" : "إدخال بيانات العميل الجديد"}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCustomerSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="customer-name">اسم العميل *</Label>
                          <Input
                            id="customer-name"
                            value={customerForm.name}
                            onChange={(e) => setCustomerForm({...customerForm, name: e.target.value})}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="customer-code">كود العميل</Label>
                          <Input
                            id="customer-code"
                            value={customerForm.code}
                            onChange={(e) => setCustomerForm({...customerForm, code: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="customer-email">البريد الإلكتروني</Label>
                          <Input
                            id="customer-email"
                            type="email"
                            value={customerForm.email}
                            onChange={(e) => setCustomerForm({...customerForm, email: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="customer-phone">الهاتف</Label>
                          <Input
                            id="customer-phone"
                            value={customerForm.phone}
                            onChange={(e) => setCustomerForm({...customerForm, phone: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="customer-address">العنوان</Label>
                        <Textarea
                          id="customer-address"
                          value={customerForm.address}
                          onChange={(e) => setCustomerForm({...customerForm, address: e.target.value})}
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="customer-contact">الشخص المسؤول</Label>
                        <Input
                          id="customer-contact"
                          value={customerForm.contact_person}
                          onChange={(e) => setCustomerForm({...customerForm, contact_person: e.target.value})}
                        />
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <Switch
                          id="customer-active"
                          checked={customerForm.is_active}
                          onCheckedChange={(checked) => setCustomerForm({...customerForm, is_active: checked})}
                        />
                        <Label htmlFor="customer-active">عميل نشط</Label>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setCustomerDialogOpen(false)}>
                          إلغاء
                        </Button>
                        <Button type="submit">
                          {editingCustomer ? "تحديث" : "إضافة"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>اسم العميل</TableHead>
                    <TableHead>الكود</TableHead>
                    <TableHead>البريد الإلكتروني</TableHead>
                    <TableHead>الهاتف</TableHead>
                    <TableHead>الشخص المسؤول</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.code || "-"}</TableCell>
                      <TableCell>{customer.email || "-"}</TableCell>
                      <TableCell>{customer.phone || "-"}</TableCell>
                      <TableCell>{customer.contact_person || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={customer.is_active ? "default" : "secondary"}>
                          {customer.is_active ? "نشط" : "غير نشط"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditCustomer(customer)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteCustomer(customer.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredCustomers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  لا توجد عملاء مطابقون للبحث
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}