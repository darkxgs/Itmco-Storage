"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
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
import { ShoppingCart, Calendar, User, Building, Edit, Trash2, Loader2, Plus, X, Search } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { getProducts, getIssuances, createIssuance, updateIssuance, deleteIssuance, getBranches, getCustomers, getWarehouses, searchByItemCode, searchIssuancesByFilters } from "@/lib/database"
import { logActivity } from "@/lib/auth"

type Product = {
  id: number
  name: string
  brand: string
  model: string
  stock: number
  product_code?: string
  item_code?: string
}

export default function IssuancePage() {
  const { user, loading: authLoading } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [issuances, setIssuances] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [customerName, setCustomerName] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState("")
  const [selectedBranch, setSelectedBranch] = useState("")
  const [selectedWarehouse, setSelectedWarehouse] = useState("")
  const [engineer, setEngineer] = useState("")
  const [serialNumber, setSerialNumber] = useState("")
  const [notes, setNotes] = useState("")
  const [editingIssuance, setEditingIssuance] = useState<any>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterBranch, setFilterBranch] = useState("")
  const [filterCustomer, setFilterCustomer] = useState("")
  const [filterWarehouse, setFilterWarehouse] = useState("")
  const [itemCodeSearch, setItemCodeSearch] = useState("")
  const [productCodeSearch, setProductCodeSearch] = useState("")
  const [selectedProducts, setSelectedProducts] = useState<Array<{id: number, name: string, brand: string, model: string, quantity: number, stock: number, product_code?: string}>>([])
  const [showProductSearch, setShowProductSearch] = useState(false)
  const { toast } = useToast()

  // Filter issuances based on search criteria
  const filteredIssuances = useMemo(() => {
    return issuances.filter((issuance) => {
      const matchesSearch = !searchTerm || 
        (issuance.customer_name || issuance.customerName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (issuance.engineer || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (issuance.serial_number || issuance.serialNumber || "").toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesBranch = !filterBranch || filterBranch === "all" || issuance.branch_id?.toString() === filterBranch
      const matchesCustomer = !filterCustomer || filterCustomer === "all" || issuance.customer_id?.toString() === filterCustomer
      const matchesWarehouse = !filterWarehouse || filterWarehouse === "all" || issuance.warehouse_id?.toString() === filterWarehouse
      const matchesItemCode = !itemCodeSearch || 
        (issuance.productCode || issuance.product_code || "").toLowerCase().includes(itemCodeSearch.toLowerCase())
      
      return matchesSearch && matchesBranch && matchesCustomer && matchesWarehouse && matchesItemCode
    })
  }, [issuances, searchTerm, filterBranch, filterCustomer, filterWarehouse, itemCodeSearch])

  useEffect(() => {
    const loadData = async () => {
      if (!user) return
      try {
        const [productsData, issuancesData, branchesData, customersData, warehousesData] = await Promise.all([
          getProducts(),
          getIssuances(),
          getBranches(),
          getCustomers(),
          getWarehouses()
        ])
        setProducts(productsData || [])
        setIssuances(issuancesData || [])
        setBranches(branchesData || [])
        setCustomers(customersData || [])
        setWarehouses(warehousesData || [])
      } catch (error) {
        console.error('Error loading data:', error)
        toast({
          title: "خطأ",
          description: "حدث خطأ في تحميل البيانات",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user, toast])

  useEffect(() => {
    const searchProducts = async () => {
      if (!itemCodeSearch.trim()) {
        // If no search term, load all products
        try {
          const productsData = await getProducts()
          setProducts(productsData || [])
        } catch (error) {
          console.error('Error loading products:', error)
        }
        return
      }

      try {
        const results = await searchByItemCode(itemCodeSearch)
        setProducts(results || [])
      } catch (error) {
        console.error('Error searching products:', error)
        toast({
          title: "خطأ",
          description: "حدث خطأ في البحث عن المنتجات",
          variant: "destructive",
        })
      }
    }

    const timeoutId = setTimeout(searchProducts, 300)
    return () => clearTimeout(timeoutId)
  }, [itemCodeSearch, toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check if we have products to issue
    if (selectedProducts.length === 0) {
      toast({
        title: "خطأ",
        description: "يرجى إضافة منتجات للإصدار",
        variant: "destructive",
      })
      return
    }

    if (!selectedCustomer && !customerName.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار عميل أو إدخال اسم العميل",
        variant: "destructive",
      })
      return
    }

    if (!selectedBranch) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار الفرع",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const branch = branches.find(b => b.id.toString() === selectedBranch)
      if (!branch) {
        throw new Error('الفرع غير موجود')
      }

      let finalCustomerName = customerName
      if (selectedCustomer) {
        const customer = customers.find(c => c.id.toString() === selectedCustomer)
        finalCustomerName = customer ? customer.name : customerName
      }

      // Check stock availability for all products
      for (const selectedProd of selectedProducts) {
        const product = products.find(p => p.id === selectedProd.id)
        if (!product) {
          throw new Error(`المنتج ${selectedProd.name} غير موجود`)
        }
        if (product.stock < selectedProd.quantity) {
          toast({
            title: "خطأ",
            description: `الكمية المطلوبة للمنتج ${selectedProd.name} غير متوفرة في المخزون`,
            variant: "destructive",
          })
          return
        }
      }

      // Create issuances for all selected products
      const issuancePromises = selectedProducts.map(async (selectedProd) => {
        const product = products.find(p => p.id === selectedProd.id)
        if (!product) return

        const issuanceData = {
          product_id: selectedProd.id,
          product_name: selectedProd.name,
          brand: selectedProd.brand,
          model: selectedProd.model,
          quantity: selectedProd.quantity,
          customer_id: selectedCustomer ? Number.parseInt(selectedCustomer) : null,
          customer_name: finalCustomerName,
          branch: branch.name,
          branch_id: Number.parseInt(selectedBranch),
          warehouse_id: selectedWarehouse && selectedWarehouse !== "none" ? Number.parseInt(selectedWarehouse) : null,
          engineer,
          serial_number: serialNumber,
          notes,
          issued_by: user.id,
          date: new Date().toISOString().split('T')[0]
        }

        await createIssuance(issuanceData)
        
        // Log the activity
        await logActivity(user.id, 'issuance_created', {
          product_name: selectedProd.name,
          quantity: selectedProd.quantity,
          customer: finalCustomerName
        })
      })

      await Promise.all(issuancePromises)

      toast({
        title: "نجح",
        description: `تم إصدار ${selectedProducts.length} منتج بنجاح`,
      })

      // Refresh data
      const [updatedProducts, updatedIssuances] = await Promise.all([
        getProducts(),
        getIssuances()
      ])
      setProducts(updatedProducts || [])
      setIssuances(updatedIssuances || [])
      
      resetForm()
    } catch (error) {
      console.error('Error creating issuance:', error)
      toast({
        title: "خطأ",
        description: "حدث خطأ في إصدار المنتجات",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const getAvailableStock = (productId: string) => {
    const product = products.find(p => p.id.toString() === productId)
    return product ? product.stock : 0
  }

  const handleEditIssuance = (issuance: any) => {
    setEditingIssuance(issuance)
    setSelectedProduct(issuance.product_id?.toString() || "")
    setQuantity(issuance.quantity || 1)
    setSelectedCustomer(issuance.customer_id?.toString() || "")
    setCustomerName(issuance.customer_name || "")
    setSelectedBranch(issuance.branch_id?.toString() || "")
    setSelectedWarehouse(issuance.warehouse_id?.toString() || "")
    setEngineer(issuance.engineer || "")
    setSerialNumber(issuance.serial_number || "")
    setNotes(issuance.notes || "")
    setIsEditDialogOpen(true)
  }

  const handleUpdateIssuance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingIssuance || !selectedProduct || quantity <= 0) {
      toast({
        title: "خطأ",
        description: "يرجى التأكد من صحة البيانات",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const updatedData = {
        product_id: Number.parseInt(selectedProduct),
        quantity,
        customer_id: selectedCustomer ? Number.parseInt(selectedCustomer) : null,
        customer_name: selectedCustomer ? null : customerName,
        branch_id: Number.parseInt(selectedBranch),
        warehouse_id: selectedWarehouse && selectedWarehouse !== "none" ? Number.parseInt(selectedWarehouse) : null,
        engineer,
        serial_number: serialNumber,
        notes
      }

      await updateIssuance(editingIssuance.id, updatedData)
      
      // Log the activity
      const product = products.find(p => p.id.toString() === selectedProduct)
      await logActivity(user.id, 'issuance_updated', {
        issuance_id: editingIssuance.id,
        product_name: product?.name
      })

      toast({
        title: "نجح",
        description: "تم تحديث الإصدار بنجاح",
      })

      // Refresh data
      const [updatedProducts, updatedIssuances] = await Promise.all([
        getProducts(),
        getIssuances()
      ])
      setProducts(updatedProducts || [])
      setIssuances(updatedIssuances || [])
      
      setIsEditDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error('Error updating issuance:', error)
      toast({
        title: "خطأ",
        description: "حدث خطأ في تحديث الإصدار",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteIssuance = async (issuance: any) => {
    try {
      await deleteIssuance(issuance.id)
      
      // Log the activity
      await logActivity(user.id, 'issuance_deleted', {
        issuance_id: issuance.id,
        product_name: issuance.product_name
      })

      toast({
        title: "نجح",
        description: "تم حذف الإصدار بنجاح",
      })

      // Refresh data
      const [updatedProducts, updatedIssuances] = await Promise.all([
        getProducts(),
        getIssuances()
      ])
      setProducts(updatedProducts || [])
      setIssuances(updatedIssuances || [])
    } catch (error) {
      console.error('Error deleting issuance:', error)
      toast({
        title: "خطأ",
        description: "حدث خطأ في حذف الإصدار",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setSelectedProduct("")
    setQuantity(1)
    setCustomerName("")
    setSelectedCustomer("")
    setSelectedBranch("")
    setSelectedWarehouse("")
    setEngineer("")
    setSerialNumber("")
    setNotes("")
    setSelectedProducts([])
    setProductCodeSearch("")
  }

  const addProductToList = () => {
    if (!selectedProduct || quantity <= 0) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار منتج وكمية صحيحة",
        variant: "destructive",
      })
      return
    }

    const product = products.find(p => p.id.toString() === selectedProduct)
    if (!product) return

    const existingProductIndex = selectedProducts.findIndex(p => p.id === product.id)
    if (existingProductIndex >= 0) {
      const updatedProducts = [...selectedProducts]
      updatedProducts[existingProductIndex].quantity += quantity
      setSelectedProducts(updatedProducts)
    } else {
      setSelectedProducts([...selectedProducts, {
        id: product.id,
        name: product.name,
        brand: product.brand,
        model: product.model,
        quantity: quantity,
        stock: product.stock,
        product_code: product.item_code || product.product_code
      }])
    }

    setSelectedProduct("")
    setQuantity(1)
  }

  const removeProductFromList = (productId: number) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== productId))
  }

  const updateProductQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeProductFromList(productId)
      return
    }
    setSelectedProducts(selectedProducts.map(p => 
      p.id === productId ? { ...p, quantity: newQuantity } : p
    ))
  }

  const searchProductByCode = (code: string) => {
    const product = products.find(p => p.item_code === code || p.product_code === code)
    if (product) {
      setSelectedProduct(product.id.toString())
      setProductCodeSearch("")
      setShowProductSearch(false)
    } else {
      toast({
        title: "لم يتم العثور على المنتج",
        description: `لا يوجد منتج بالكود ${code}`,
        variant: "destructive",
      })
    }
  }

  const filteredProductCodes = useMemo(() => {
    if (!productCodeSearch) return products.filter(p => p.item_code || p.product_code)
    return products.filter(p => {
      const code = p.item_code || p.product_code
      return code && code.toLowerCase().includes(productCodeSearch.toLowerCase())
    })
  }, [products, productCodeSearch])

  const selectProductByCode = (product: Product) => {
    setSelectedProduct(product.id.toString())
    setProductCodeSearch(product.item_code || product.product_code || "")
    setShowProductSearch(false)
  }

  const canEditOrDelete = (issuance: any) => {
    // Admin can edit/delete all issuances, others can only edit/delete their own
    return user?.role === "admin" || (issuance.issuedBy || issuance.issued_by) === user?.id
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

  if (!user || !["admin", "engineer"].includes(user.role)) {
    return (
      <div className="flex min-h-screen bg-slate-900" dir="rtl">
        <Sidebar />
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="text-center text-white">
            <h1 className="text-2xl font-bold mb-4">غير مخول للوصول</h1>
            <p>ليس لديك صلاحية للوصول إلى هذه الصفحة</p>
          </div>
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

        {/* Statistics Cards */}
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
                  <div className="flex gap-2">
                    <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-right flex-1">
                        <SelectValue placeholder="اختر المنتج" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id.toString()}>
                            <div className="flex justify-between items-center w-full">
                              <span>
                                {product.name} - {product.brand} {product.model}
                                {(product.item_code || product.product_code) && ` (${product.item_code || product.product_code})`}
                              </span>
                              <Badge variant="secondary" className="mr-2">
                                متوفر: {product.stock}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      onClick={() => setShowProductSearch(!showProductSearch)}
                      variant="outline"
                      size="icon"
                      className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {showProductSearch && (
                    <div className="mt-2 p-3 bg-slate-700 rounded-lg border border-slate-600">
                      <Label htmlFor="productCode" className="text-slate-300 text-right text-sm">
                        البحث بكود المنتج
                      </Label>
                      <div className="relative mt-1">
                        <Input
                          id="productCode"
                          value={productCodeSearch}
                          onChange={(e) => setProductCodeSearch(e.target.value)}
                          placeholder="أدخل كود المنتج (مثل: ITM-01)"
                          className="bg-slate-600 border-slate-500 text-white text-right"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && filteredProductCodes.length === 1) {
                              selectProductByCode(filteredProductCodes[0])
                            }
                          }}
                        />
                        {(productCodeSearch || filteredProductCodes.length > 0) && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-slate-600 border border-slate-500 rounded-lg max-h-40 overflow-y-auto z-10">
                            {filteredProductCodes.length > 0 ? (
                              filteredProductCodes.map((product) => (
                                <div
                                  key={product.id}
                                  className="p-2 hover:bg-slate-500 cursor-pointer border-b border-slate-500 last:border-b-0"
                                  onClick={() => selectProductByCode(product)}
                                  onDoubleClick={() => selectProductByCode(product)}
                                >
                                  <div className="text-white text-right text-sm font-medium">
                                    {product.item_code || product.product_code}
                                  </div>
                                  <div className="text-slate-300 text-right text-xs">
                                    {product.name} - {product.brand} {product.model}
                                  </div>
                                  <div className="text-slate-400 text-right text-xs">
                                    متوفر: {product.stock} قطعة
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="p-2 text-slate-400 text-right text-sm">
                                لا توجد منتجات تطابق البحث
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-slate-400 text-right">
                        اكتب للبحث أو انقر نقرة مزدوجة للاختيار
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="quantity" className="text-slate-300 text-right">
                    الكمية
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      max={selectedProduct ? getAvailableStock(selectedProduct) : 1}
                      value={quantity}
                      onChange={(e) => setQuantity(Number.parseInt(e.target.value) || 1)}
                      className="bg-slate-700 border-slate-600 text-white text-center flex-1"
                    />
                    <Button
                      type="button"
                      onClick={addProductToList}
                      disabled={!selectedProduct || quantity <= 0}
                      className="bg-green-600 hover:bg-green-700 px-4"
                    >
                      <Plus className="w-4 h-4 ml-1" />
                      إضافة
                    </Button>
                  </div>
                  {selectedProduct && (
                    <p className="text-xs text-slate-400">متوفر: {getAvailableStock(selectedProduct)} قطعة</p>
                  )}
                </div>

                {/* Selected Products List */}
                {selectedProducts.length > 0 && (
                  <div className="grid gap-2">
                    <Label className="text-slate-300 text-right">
                      المنتجات المضافة ({selectedProducts.length})
                    </Label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedProducts.map((product) => (
                        <div key={product.id} className="flex items-center justify-between bg-slate-700 p-3 rounded-lg border border-slate-600">
                          <div className="flex-1 text-right">
                            <div className="text-white text-sm font-medium">
                              {product.name} - {product.brand} {product.model}
                            </div>
                            {(product.item_code || product.product_code) && (
                              <div className="text-slate-400 text-xs">
                                كود: {product.item_code || product.product_code}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="1"
                              max={product.stock}
                              value={product.quantity}
                              onChange={(e) => updateProductQuantity(product.id, Number.parseInt(e.target.value) || 1)}
                              className="bg-slate-600 border-slate-500 text-white text-center w-16"
                            />
                            <Button
                              type="button"
                              onClick={() => removeProductFromList(product.id)}
                              variant="destructive"
                              size="sm"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label className="text-slate-300 text-right">
                    العميل
                  </Label>
                  <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-right">
                      <SelectValue placeholder="اختر العميل" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id.toString()}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="customer" className="text-slate-300 text-right">
                    اسم العميل (يدوي)
                  </Label>
                  <Input
                    id="customer"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="أدخل اسم العميل يدوياً"
                    className="bg-slate-700 border-slate-600 text-white text-right"
                    disabled={!!selectedCustomer}
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
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id.toString()}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label className="text-slate-300 text-right">
                    المخزن (اختياري)
                  </Label>
                  <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-right">
                      <SelectValue placeholder="اختر المخزن" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="none">بدون مخزن</SelectItem>
                      {warehouses.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                          {warehouse.name} - {warehouse.warehouse_number}
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

                <Button type="submit" disabled={submitting || selectedProducts.length === 0} className="w-full">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      جاري الإصدار...
                    </>
                  ) : (
                    selectedProducts.length > 0 ? `إصدار ${selectedProducts.length} منتج` : "إضافة منتجات للإصدار"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Search and Filters */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-right">البحث والفلترة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="search" className="text-slate-300 text-right">البحث</Label>
                <Input
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="البحث في العميل، المهندس، أو الرقم التسلسلي"
                  className="bg-slate-700 border-slate-600 text-white text-right"
                />
              </div>
              
              <div>
                <Label htmlFor="itemCode" className="text-slate-300 text-right">البحث بكود الصنف</Label>
                <Input
                  id="itemCode"
                  value={itemCodeSearch}
                  onChange={(e) => setItemCodeSearch(e.target.value)}
                  placeholder="أدخل كود الصنف للبحث"
                  className="bg-slate-700 border-slate-600 text-white text-right"
                />
              </div>
              
              <div>
                <Label className="text-slate-300 text-right">فلترة بالفرع</Label>
                <Select value={filterBranch} onValueChange={setFilterBranch}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-right">
                    <SelectValue placeholder="جميع الفروع" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="all">جميع الفروع</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-slate-300 text-right">فلترة بالعميل</Label>
                <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-right">
                    <SelectValue placeholder="جميع العملاء" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="all">جميع العملاء</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id.toString()}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-slate-300 text-right">فلترة بالمخزن</Label>
                <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-right">
                    <SelectValue placeholder="جميع المخازن" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="all">جميع المخازن</SelectItem>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                        {warehouse.name} - {warehouse.warehouse_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Issuances Table */}
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
                    <TableHead className="text-slate-300 text-right">المخزن</TableHead>
                    <TableHead className="text-slate-300 text-right">المهندس</TableHead>
                    <TableHead className="text-slate-300 text-right">الرقم التسلسلي</TableHead>
                    <TableHead className="text-slate-300 text-center">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIssuances.map((issuance) => {
                    const product = products.find(p => p.id === issuance.product_id)
                    const customer = customers.find(c => c.id === issuance.customer_id)
                    const branch = branches.find(b => b.id === issuance.branch_id)
                    const warehouse = warehouses.find(w => w.id === issuance.warehouse_id)
                    
                    return (
                      <TableRow key={issuance.id} className="border-slate-700">
                        <TableCell className="text-slate-300 text-right">{issuance.date}</TableCell>
                        <TableCell className="text-slate-300 text-right">{product?.name || 'غير محدد'}</TableCell>
                        <TableCell className="text-slate-300 text-right">
                          {product ? `${product.brand} ${product.model}` : 'غير محدد'}
                        </TableCell>
                        <TableCell className="text-slate-300 text-center">{issuance.quantity}</TableCell>
                        <TableCell className="text-slate-300 text-right">
                          {customer?.name || issuance.customer_name || 'غير محدد'}
                        </TableCell>
                        <TableCell className="text-slate-300 text-right">{branch?.name || 'غير محدد'}</TableCell>
                        <TableCell className="text-slate-300 text-right">
                          {warehouse ? `${warehouse.name} - ${warehouse.warehouse_number}` : 'غير محدد'}
                        </TableCell>
                        <TableCell className="text-slate-300 text-right">{issuance.engineer || 'غير محدد'}</TableCell>
                        <TableCell className="text-slate-300 text-right">{issuance.serial_number || 'غير محدد'}</TableCell>
                        <TableCell className="text-center">
                          {canEditOrDelete(issuance) && (
                            <div className="flex justify-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditIssuance(issuance)}
                                className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-slate-800 border-slate-700">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-white text-right">تأكيد الحذف</AlertDialogTitle>
                                    <AlertDialogDescription className="text-slate-300 text-right">
                                      هل أنت متأكد من حذف هذا الإصدار؟ لا يمكن التراجع عن هذا الإجراء.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-slate-700 text-white border-slate-600">
                                      إلغاء
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteIssuance(issuance)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      حذف
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
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
                <Label className="text-slate-300 text-right">
                  العميل
                </Label>
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-right">
                    <SelectValue placeholder="اختر العميل" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id.toString()}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-customer" className="text-slate-300 text-right">
                  اسم العميل (يدوي)
                </Label>
                <Input
                  id="edit-customer"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="أدخل اسم العميل يدوياً"
                  className="bg-slate-700 border-slate-600 text-white text-right"
                  disabled={!!selectedCustomer}
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
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-warehouse" className="text-slate-300 text-right">
                  المخزن
                </Label>
                <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-right">
                    <SelectValue placeholder="اختر المخزن" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                        {warehouse.name} - {warehouse.warehouse_number}
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
