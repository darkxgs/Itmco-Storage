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
import { getUserAccessibleWarehousesWithData } from "@/lib/warehouse-permissions"
import { logActivity } from "@/lib/auth"

type Product = {
  id: number
  name: string
  brand: string
  model: string
  stock: number
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
  const [serialNumber, setSerialNumber] = useState('')
  const [machineModel, setMachineModel] = useState('')
  const [warrantyType, setWarrantyType] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceValue, setInvoiceValue] = useState('')
  const [customSellingPrice, setCustomSellingPrice] = useState('')
  const [issuanceDate, setIssuanceDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [editingIssuance, setEditingIssuance] = useState<any>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterBranch, setFilterBranch] = useState("")
  const [filterCustomer, setFilterCustomer] = useState("")
  const [filterWarehouse, setFilterWarehouse] = useState("")
  const [branchSearchTerm, setBranchSearchTerm] = useState("")
  const [customerSearchTerm, setCustomerSearchTerm] = useState("")
  const [warehouseSearchTerm, setWarehouseSearchTerm] = useState("")
  const [formBranchSearch, setFormBranchSearch] = useState("")
  const [formCustomerSearch, setFormCustomerSearch] = useState("")
  const [itemCodeSearch, setItemCodeSearch] = useState("")
  const [productCodeSearch, setProductCodeSearch] = useState("")
  const [selectedProducts, setSelectedProducts] = useState<Array<{id: number, name: string, brand: string, model: string, quantity: number, stock: number, item_code?: string, customPrice?: string}>>([])  
  const [itemSearchResults, setItemSearchResults] = useState<Product[]>([])
  const [isItemSearching, setIsItemSearching] = useState(false)
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const { toast } = useToast()

  // Filter issuances based on search criteria
  const filteredIssuances = useMemo(() => {
    return issuances.filter((issuance) => {
      // البحث في اسم العميل، المهندس، أو رقم السريال
      const customerName = (issuance.customer_name || issuance.customerName || "").toLowerCase()
      const engineerName = (issuance.engineer || "").toLowerCase()
      const serialNum = (issuance.serial_number || issuance.serialNumber || "").toLowerCase()
      const productName = (issuance.product_name || issuance.productName || "").toLowerCase()
      const searchLower = searchTerm.toLowerCase().trim()
      
      const matchesSearch = !searchTerm || searchLower === "" ||
        customerName.includes(searchLower) ||
        engineerName.includes(searchLower) ||
        serialNum.includes(searchLower) ||
        productName.includes(searchLower)
      
      const matchesBranch = !filterBranch || filterBranch === "all" || issuance.branch_id?.toString() === filterBranch
      const matchesCustomer = !filterCustomer || filterCustomer === "all" || issuance.customer_id?.toString() === filterCustomer
      const matchesWarehouse = !filterWarehouse || filterWarehouse === "all" || issuance.warehouse_id?.toString() === filterWarehouse
      
      // Find the product associated with this issuance to check item_code
      const product = products.find(p => p.id === issuance.product_id)
      const productItemCode = (product?.item_code || issuance.item_code || "").toLowerCase()
      const itemCodeSearchLower = itemCodeSearch.toLowerCase().trim()
      const matchesItemCode = !itemCodeSearch || itemCodeSearchLower === "" ||
        productItemCode.includes(itemCodeSearchLower)
      
      return matchesSearch && matchesBranch && matchesCustomer && matchesWarehouse && matchesItemCode
    })
  }, [issuances, products, searchTerm, filterBranch, filterCustomer, filterWarehouse, itemCodeSearch])

  useEffect(() => {
    const loadData = async () => {
      if (!user) return
      try {
        // Get warehouses based on user permissions
        const warehousesData = await getUserAccessibleWarehousesWithData(user.id)
        
        const [productsData, issuancesData, branchesData, customersData] = await Promise.all([
          getProducts(),
          getIssuances(),
          getBranches(),
          getCustomers()
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
          model: machineModel || selectedProd.model,
          quantity: selectedProd.quantity,
          customer_id: selectedCustomer ? Number.parseInt(selectedCustomer) : null,
          customer_name: finalCustomerName,
          branch: branch.name,
          branch_id: Number.parseInt(selectedBranch),
          warehouse_id: selectedWarehouse && selectedWarehouse !== "none" ? Number.parseInt(selectedWarehouse) : null,
          engineer,
          serial_number: serialNumber,
          warranty_type: warrantyType,
          invoice_number: warrantyType === 'no_warranty' ? invoiceNumber : null,
          notes: warrantyType === 'no_warranty' ? `${notes ? notes + ' | ' : ''}${invoiceValue ? 'قيمة الفاتورة: ' + invoiceValue : ''}${selectedProd.customPrice ? ' | سعر البيع: ' + selectedProd.customPrice + ' | إجمالي: ' + (selectedProd.quantity * Number(selectedProd.customPrice)) : ''}`.replace(/^\s*\|\s*/, '').replace(/\s*\|\s*$/, '') : notes,
          issued_by: user?.id || '',
          date: issuanceDate
        }

        await createIssuance(issuanceData)
        
        // Log the activity
        await logActivity(user?.id || '', user?.name || user?.email || '', 'issuance_created', 'issuance', JSON.stringify({
          product_name: selectedProd.name,
          quantity: selectedProd.quantity,
          customer: finalCustomerName
        }))
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
    setMachineModel(issuance.model || "")
    setSerialNumber(issuance.serial_number || "")
    setWarrantyType(issuance.warranty_type || "")
    setInvoiceNumber(issuance.invoice_number || "")
    setIssuanceDate(issuance.date || new Date().toISOString().split('T')[0])
    // Extract invoice value and selling price from notes if present
    const notesText = issuance.notes || ""
    const invoiceMatch = notesText.match(/قيمة الفاتورة:\s*(\d+)/)
    const sellingPriceMatch = notesText.match(/سعر البيع:\s*(\d+)/)
    setInvoiceValue(invoiceMatch ? invoiceMatch[1] : "")
    setCustomSellingPrice(sellingPriceMatch ? sellingPriceMatch[1] : "")
    // Clean notes from extracted values
    const cleanNotes = notesText
      .replace(/\s*\|\s*قيمة الفاتورة:\s*\d+/g, "")
      .replace(/قيمة الفاتورة:\s*\d+\s*\|?\s*/g, "")
      .replace(/\s*\|\s*سعر البيع:\s*\d+/g, "")
      .replace(/سعر البيع:\s*\d+\s*\|?\s*/g, "")
      .trim()
    setNotes(cleanNotes)
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
        model: machineModel,
        customer_id: selectedCustomer ? Number.parseInt(selectedCustomer) : null,
        customer_name: selectedCustomer ? undefined : customerName,
        branch_id: Number.parseInt(selectedBranch),
        warehouse_id: selectedWarehouse && selectedWarehouse !== "none" ? Number.parseInt(selectedWarehouse) : null,
        engineer,
        serial_number: serialNumber,
        warranty_type: warrantyType,
        invoice_number: warrantyType === 'no_warranty' ? invoiceNumber : null,
        date: issuanceDate,
        notes: warrantyType === 'no_warranty' ? `${notes ? notes + ' | ' : ''}${invoiceValue ? 'قيمة الفاتورة: ' + invoiceValue : ''}${customSellingPrice ? ' | سعر البيع: ' + customSellingPrice : ''}`.replace(/^\s*\|\s*/, '').replace(/\s*\|\s*$/, '') : notes
      }

      await updateIssuance(editingIssuance.id, updatedData, editingIssuance.quantity)
      
      // Log the activity
      const product = products.find(p => p.id.toString() === selectedProduct)
      await logActivity(user?.id || '', user?.name || user?.email || '', 'issuance_updated', 'issuance', JSON.stringify({
        issuance_id: editingIssuance.id,
        product_name: product?.name
      }))

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
      await logActivity(user?.id || '', user?.name || user?.email || '', 'issuance_deleted', 'issuance', JSON.stringify({
        issuance_id: issuance.id,
        product_name: issuance.product_name
      }))

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
    setMachineModel("")
    setSerialNumber("")
    setWarrantyType("")
    setInvoiceNumber("")
    setInvoiceValue("")
    setCustomSellingPrice("")
    setIssuanceDate(new Date().toISOString().split('T')[0])
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
        item_code: product.item_code
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

  const updateProductCustomPrice = (productId: number, price: string) => {
    setSelectedProducts(selectedProducts.map(p => 
      p.id === productId ? { ...p, customPrice: price } : p
    ))
  }

  const searchProductByCode = async (code: string) => {
    // First try local search
    const localProduct = products.find(p => p.item_code === code)
    if (localProduct) {
      setSelectedProduct(localProduct.id.toString())
      setProductCodeSearch("")
      setShowProductSearch(false)
      return
    }
    
    // If not found locally, search in database
    setIsSearching(true)
    try {
      const results = await searchByItemCode(code)
      if (results.length > 0) {
        const product = results[0]
        setSelectedProduct(product.id.toString())
        setProductCodeSearch("")
        setShowProductSearch(false)
        // Update search results for dropdown
        setSearchResults(results)
      } else {
        toast({
          title: "لم يتم العثور على المنتج",
          description: `لا يوجد منتج بالكود ${code}`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error searching by item code:', error)
      toast({
        title: "خطأ في البحث",
        description: "حدث خطأ أثناء البحث عن المنتج",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Auto-search when productCodeSearch changes
  useEffect(() => {
    const searchInDatabase = async () => {
      if (productCodeSearch.trim() && productCodeSearch.length >= 2) {
        setIsSearching(true)
        try {
          const results = await searchByItemCode(productCodeSearch)
          setSearchResults(results)
        } catch (error) {
          console.error('Error searching by item code:', error)
          setSearchResults([])
        } finally {
          setIsSearching(false)
        }
      } else {
        setSearchResults([])
      }
    }

    const timeoutId = setTimeout(searchInDatabase, 300) // Debounce search
    return () => clearTimeout(timeoutId)
  }, [productCodeSearch])

  // Auto-search when itemCodeSearch changes (for filter section)
  useEffect(() => {
    const searchInDatabase = async () => {
      if (itemCodeSearch.trim() && itemCodeSearch.length >= 2) {
        setIsItemSearching(true)
        try {
          const results = await searchByItemCode(itemCodeSearch)
          setItemSearchResults(results)
        } catch (error) {
          console.error('Error searching by item code:', error)
          setItemSearchResults([])
        } finally {
          setIsItemSearching(false)
        }
      } else {
        setItemSearchResults([])
      }
    }

    const timeoutId = setTimeout(searchInDatabase, 300) // Debounce search
    return () => clearTimeout(timeoutId)
  }, [itemCodeSearch])

  const filteredProductCodes = useMemo(() => {
    if (!productCodeSearch || productCodeSearch.trim().length === 0) return []
    
    const searchTerm = productCodeSearch.toLowerCase().trim()
    
    // Enhanced local search with multiple field matching
    const localResults = products.filter(p => {
      if (!p.item_code) return false
      
      const itemCode = p.item_code.toLowerCase()
      const name = p.name.toLowerCase()
      const brand = p.brand.toLowerCase()
      const model = p.model.toLowerCase()
      
      // Search in multiple fields for better results
      return itemCode.includes(searchTerm) ||
             name.includes(searchTerm) ||
             brand.includes(searchTerm) ||
             model.includes(searchTerm) ||
             itemCode.startsWith(searchTerm) // Prioritize exact matches
    })
    
    // Sort results by relevance
    const sortedResults = localResults.sort((a, b) => {
      const aCode = a.item_code?.toLowerCase() || ''
      const bCode = b.item_code?.toLowerCase() || ''
      
      // Exact matches first
      if (aCode === searchTerm) return -1
      if (bCode === searchTerm) return 1
      
      // Starts with search term
      if (aCode.startsWith(searchTerm) && !bCode.startsWith(searchTerm)) return -1
      if (bCode.startsWith(searchTerm) && !aCode.startsWith(searchTerm)) return 1
      
      // Alphabetical order
      return aCode.localeCompare(bCode)
    })
    
    // If we have search results from database, merge and deduplicate
    if (searchResults.length > 0) {
      const combined = [...searchResults, ...sortedResults]
      const unique = combined.filter((item, index, self) => 
        index === self.findIndex(t => t.id === item.id)
      )
      return unique.slice(0, 10) // Limit to 10 results for performance
    }
    
    return sortedResults.slice(0, 10) // Limit to 10 results for performance
  }, [products, productCodeSearch, searchResults])

  const selectProductByCode = (product: Product) => {
    // Set the selected product
    setSelectedProduct(product.id.toString())
    
    // Clear search and hide dropdown with smooth transition
    setProductCodeSearch("")
    setShowProductSearch(false)
    
    // Show success feedback
    toast({
      title: "تم اختيار المنتج",
      description: `${product.item_code} - ${product.name}`,
      duration: 2000,
    })
    
    // Focus back to quantity field for better UX
    setTimeout(() => {
      const quantityInput = document.getElementById('quantity')
      if (quantityInput) {
        quantityInput.focus()
      }
    }, 100)
  }

  const filteredItemCodes = useMemo(() => {
    // Return empty array if no search term
    if (!itemCodeSearch || itemCodeSearch.trim() === '') return []
    
    // First try local search for immediate feedback
    const localResults = products.filter(p => {
      const code = p.item_code
      return code && code.toLowerCase().includes(itemCodeSearch.toLowerCase())
    })
    
    // If we have search results from database, use them, otherwise use local results
    return itemSearchResults.length > 0 ? itemSearchResults : localResults
  }, [products, itemCodeSearch, itemSearchResults])

  const selectItemByCode = (product: Product) => {
    // Keep the selected product code in the search field
    setItemCodeSearch(product.item_code || "")
    setIsDropdownOpen(false)
    setSelectedIndex(-1)
    
    // Show success feedback with enhanced styling
    toast({
      title: "✅ تم اختيار المنتج بنجاح",
      description: `${product.item_code} - ${product.name}`,
      duration: 3000,
    })
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

  if (!user || !["admin", "engineer", "inventory_manager"].includes(user.role)) {
    return (
      <div className="flex min-h-screen bg-slate-950 relative overflow-hidden" dir="rtl">
        {/* Decorative background */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 [background:radial-gradient(700px_circle_at_100%_0%,rgba(37,99,235,0.12),transparent_60%),radial-gradient(700px_circle_at_0%_100%,rgba(14,165,233,0.1),transparent_60%)]" />
        <Sidebar />
        <div className="flex-1 p-6 flex items-center justify-center relative">
          <div className="text-center text-white">
            <h1 className="text-2xl font-bold mb-4">غير مخول للوصول</h1>
            <p>ليس لديك صلاحية للوصول إلى هذه الصفحة</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-950 relative overflow-hidden" dir="rtl">
      {/* Decorative background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 [background:radial-gradient(700px_circle_at_100%_0%,rgba(37,99,235,0.12),transparent_60%),radial-gradient(700px_circle_at_0%_100%,rgba(14,165,233,0.1),transparent_60%)]" />
      <Sidebar />
      <div className="flex-1 p-6 relative">
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
                                {product.item_code && ` (${product.item_code})`}
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
                    <div className="mt-2 p-4 bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl border border-slate-600 shadow-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <Search className="w-4 h-4 text-blue-400" />
                        <Label htmlFor="productCode" className="text-slate-200 text-right text-sm font-medium">
                          البحث السريع بكود المنتج
                        </Label>
                      </div>
                      <div className="relative">
                        <Input
                          id="productCode"
                          value={productCodeSearch}
                          onChange={(e) => setProductCodeSearch(e.target.value)}
                          placeholder="ابدأ الكتابة للبحث... (مثل: ITM-01)"
                          className="bg-slate-600/80 border-slate-500 text-white text-right pr-10 pl-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && filteredProductCodes.length === 1) {
                              selectProductByCode(filteredProductCodes[0])
                            }
                            if (e.key === 'Escape') {
                              setProductCodeSearch('')
                            }
                          }}
                        />
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        
                        {productCodeSearch && productCodeSearch.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-700 border border-slate-500 rounded-xl shadow-2xl max-h-64 overflow-hidden z-20">
                            {filteredProductCodes.length > 0 ? (
                              <>
                                <div className="p-2 bg-slate-600 border-b border-slate-500">
                                  <div className="text-xs text-slate-300 text-right">
                                    {filteredProductCodes.length} نتيجة موجودة
                                  </div>
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                  {filteredProductCodes.map((product, index) => (
                                    <div
                                      key={product.id}
                                      className="p-3 hover:bg-slate-600 cursor-pointer border-b border-slate-600 last:border-b-0 transition-colors duration-150 group"
                                      onClick={() => selectProductByCode(product)}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="text-right flex-1">
                                          <div className="text-white text-sm font-semibold mb-1 group-hover:text-blue-300">
                                            {product.item_code}
                                          </div>
                                          <div className="text-slate-300 text-xs mb-1">
                                            {product.name}
                                          </div>
                                          <div className="text-slate-400 text-xs">
                                            {product.brand} {product.model}
                                          </div>
                                        </div>
                                        <div className="text-left ml-3">
                                          <div className={`text-xs px-2 py-1 rounded-full ${
                                            product.stock > 10 
                                              ? 'bg-green-500/20 text-green-400' 
                                              : product.stock > 0 
                                              ? 'bg-yellow-500/20 text-yellow-400'
                                              : 'bg-red-500/20 text-red-400'
                                          }`}>
                                            {product.stock} قطعة
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <div className="p-4 text-center">
                                <div className="text-slate-400 text-sm mb-2">
                                  🔍 لا توجد منتجات تطابق البحث
                                </div>
                                <div className="text-slate-500 text-xs">
                                  جرب كلمات مختلفة أو تأكد من الإملاء
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                        <div className="text-right">
                          💡 اكتب للبحث الفوري • Enter للاختيار • Esc للإلغاء
                        </div>
                        {productCodeSearch && (
                          <Button
                            type="button"
                            onClick={() => setProductCodeSearch('')}
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-slate-400 hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
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
                      className="bg-slate-700/50 border-slate-600/50 text-white text-center flex-1 focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                    />
                    <Button
                      type="button"
                      onClick={addProductToList}
                      disabled={!selectedProduct || quantity <= 0}
                      className="bg-green-900/20 border border-green-700/50 text-green-400 hover:bg-green-900/30 hover:border-green-600/50 hover:text-green-300 transition-all duration-200 px-4"
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
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedProducts.map((product) => (
                        <div key={product.id} className="bg-slate-700 p-3 rounded-lg border border-slate-600">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 text-right">
                              <div className="text-white text-sm font-medium">
                                {product.name} - {product.brand} {product.model}
                              </div>
                              {product.item_code && (
                                <div className="text-xs text-slate-400">
                                  كود: {product.item_code}
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
                                className="bg-slate-600/50 border-slate-500/50 text-white text-center w-16 focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                                title="الكمية"
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
                          {/* سعر البيع المخصص لكل منتج - يظهر فقط عند بدون ضمان */}
                          {warrantyType === 'no_warranty' && (
                            <div className="mt-2 pt-2 border-t border-slate-600/50">
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  value={product.customPrice || ''}
                                  onChange={(e) => updateProductCustomPrice(product.id, e.target.value)}
                                  placeholder="سعر البيع"
                                  className="bg-slate-600/50 border-slate-500/50 text-white text-right w-28 focus:border-green-500/50 focus:ring-green-500/20 transition-colors text-sm"
                                />
                                <span className="text-slate-400 text-xs">ج.م</span>
                                {product.customPrice && (
                                  <div className="flex-1 text-left">
                                    <span className="text-green-400 text-sm font-medium">
                                      الإجمالي: {(product.quantity * Number(product.customPrice)).toLocaleString()} ج.م
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* إجمالي كل المنتجات */}
                    {warrantyType === 'no_warranty' && selectedProducts.some(p => p.customPrice) && (
                      <div className="mt-2 p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
                        <div className="text-green-400 text-sm font-medium text-right">
                          إجمالي جميع المنتجات: {selectedProducts.reduce((sum, p) => sum + (p.quantity * Number(p.customPrice || 0)), 0).toLocaleString()} ج.م
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid gap-2">
                  <Label className="text-slate-300 text-right">
                    العميل
                  </Label>
                  <Select value={selectedCustomer} onValueChange={(value) => {
                    setSelectedCustomer(value)
                    setSelectedBranch("") // Reset branch when customer changes
                  }}>
                    <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors">
                      <SelectValue placeholder="اختر العميل" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800/95 border-slate-600/50 backdrop-blur-sm max-h-[300px]">
                      <div className="p-2 sticky top-0 bg-slate-800 z-10">
                        <Input
                          placeholder="ابحث عن عميل..."
                          value={formCustomerSearch}
                          onChange={(e) => setFormCustomerSearch(e.target.value)}
                          className="bg-slate-700 border-slate-600 text-white text-right h-8"
                        />
                      </div>
                      {customers
                        .filter(customer => customer.name.toLowerCase().includes(formCustomerSearch.toLowerCase()))
                        .map((customer) => (
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
                    className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                    disabled={!!selectedCustomer}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="branch" className="text-slate-300 text-right">
                    الفرع {selectedCustomer && "(فروع العميل المحدد)"}
                  </Label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors">
                      <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800/95 border-slate-600/50 backdrop-blur-sm max-h-[300px]">
                      <div className="p-2 sticky top-0 bg-slate-800 z-10">
                        <Input
                          placeholder="ابحث عن فرع..."
                          value={formBranchSearch}
                          onChange={(e) => setFormBranchSearch(e.target.value)}
                          className="bg-slate-700 border-slate-600 text-white text-right h-8"
                        />
                      </div>
                      {branches
                        .filter(branch => {
                          // Filter by customer if selected
                          if (selectedCustomer && branch.customer_id) {
                            return branch.customer_id.toString() === selectedCustomer
                          }
                          // Show all branches if no customer selected or branch has no customer
                          return !selectedCustomer || !branch.customer_id
                        })
                        .filter(branch => branch.name.toLowerCase().includes(formBranchSearch.toLowerCase()))
                        .map((branch) => (
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
                    <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors">
                      <SelectValue placeholder="اختر المخزن" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800/95 border-slate-600/50 backdrop-blur-sm">
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
                    className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="issuanceDate" className="text-slate-300 text-right">
                    تاريخ الإصدار
                  </Label>
                  <Input
                    id="issuanceDate"
                    type="date"
                    value={issuanceDate}
                    onChange={(e) => setIssuanceDate(e.target.value)}
                    className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="machineModel" className="text-slate-300 text-right">
                    موديل الماكينة
                  </Label>
                  <Input
                    id="machineModel"
                    value={machineModel}
                    onChange={(e) => setMachineModel(e.target.value)}
                    placeholder="أدخل موديل/نوع الماكينة"
                    className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="serial" className="text-slate-300 text-right">
                    رقم سريال الماكينة
                  </Label>
                  <Input
                    id="serial"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="أدخل رقم سريال الماكينة"
                    className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="warranty" className="text-slate-300 text-right">
                    نوع الضمان
                  </Label>
                  <Select value={warrantyType} onValueChange={(value) => {
                    setWarrantyType(value)
                    // Auto-set invoice value to 0 for warranty types other than no_warranty
                    if (value !== 'no_warranty') {
                      setInvoiceValue('0')
                    } else {
                      setInvoiceValue('')
                    }
                  }}>
                    <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors">
                      <SelectValue placeholder="اختر نوع الضمان" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800/95 border-slate-600/50 backdrop-blur-sm">
                      <SelectItem value="comprehensive">عقد شامل لقطع الغيار</SelectItem>
                      <SelectItem value="warranty">ضمان</SelectItem>
                      <SelectItem value="custody">عهدة</SelectItem>
                      <SelectItem value="no_warranty">بدون ضمان</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {warrantyType === 'no_warranty' && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="invoice" className="text-slate-300 text-right">
                        رقم الفاتورة
                      </Label>
                      <Input
                        id="invoice"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="رقم فاتورة قطع الغيار"
                        className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                      />
                    </div>
                    {/* ملاحظة: سعر البيع المخصص موجود الآن بجانب كل منتج في قائمة المنتجات المضافة */}
                    <div className="p-2 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                      <p className="text-blue-400 text-xs text-right">
                        💡 يمكنك إضافة سعر بيع مخصص لكل منتج من قائمة "المنتجات المضافة" أعلاه
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="invoiceValue" className="text-slate-300 text-right">
                        قيمة الفاتورة
                      </Label>
                      <Input
                        id="invoiceValue"
                        type="number"
                        value={invoiceValue}
                        onChange={(e) => setInvoiceValue(e.target.value)}
                        placeholder="أدخل قيمة الفاتورة"
                        className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                      />
                    </div>
                  </>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="notes" className="text-slate-300 text-right">
                    ملاحظات (اختياري)
                  </Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="أدخل أي ملاحظات إضافية"
                    className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
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
                  placeholder="البحث في العميل، المهندس، أو رقم سريال الماكينة"
                  className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                />
              </div>
              
              <div>
                <Label htmlFor="itemCode" className="text-slate-300 text-right">البحث بكود المنتج</Label>
                <div className="relative">
                  <div className="relative">
                    <Input
                      id="itemCode"
                      value={itemCodeSearch}
                      onChange={(e) => {
                        setItemCodeSearch(e.target.value)
                        setIsDropdownOpen(e.target.value.trim() !== '')
                        setSelectedIndex(-1)
                      }}
                      onFocus={() => {
                        if (itemCodeSearch.trim() !== '') {
                          setIsDropdownOpen(true)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setIsDropdownOpen(false)
                          setSelectedIndex(-1)
                        } else if (e.key === 'ArrowDown') {
                          e.preventDefault()
                          setSelectedIndex(prev => 
                            prev < filteredItemCodes.length - 1 ? prev + 1 : prev
                          )
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
                        } else if (e.key === 'Enter') {
                          e.preventDefault()
                          if (selectedIndex >= 0 && filteredItemCodes[selectedIndex]) {
                            selectItemByCode(filteredItemCodes[selectedIndex])
                          } else if (filteredItemCodes.length === 1) {
                            selectItemByCode(filteredItemCodes[0])
                          }
                        }
                      }}
                      placeholder="أدخل كود المنتج للبحث (مثل: ITM-06)"
                      className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-all duration-200 pr-10"
                    />
                    {itemCodeSearch && (
                      <button
                        onClick={() => {
                          setItemCodeSearch('')
                          setIsDropdownOpen(false)
                          setSelectedIndex(-1)
                        }}
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {/* Modern Dropdown */}
                  {isDropdownOpen && itemCodeSearch.trim() !== '' && (
                    <>
                      {/* Backdrop */}
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => {
                          setIsDropdownOpen(false)
                          setSelectedIndex(-1)
                        }}
                      />
                      
                      {/* Dropdown */}
                      <div className="absolute top-full left-0 right-0 mt-2 z-20 animate-in slide-in-from-top-2 duration-200">
                        <div className="bg-slate-800/95 backdrop-blur-sm border border-slate-600/50 rounded-xl shadow-2xl overflow-hidden">
                          {/* Header */}
                          <div className="px-4 py-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-slate-600/50">
                            <div className="flex items-center justify-between">
                              <div className="text-sm text-slate-300 text-right">
                                {filteredItemCodes.length > 0 
                                  ? `تم العثور على ${filteredItemCodes.length} منتج`
                                  : 'لا توجد نتائج'
                                }
                              </div>
                              <Search className="w-4 h-4 text-blue-400" />
                            </div>
                          </div>
                          
                          {/* Results */}
                          <div className="max-h-64 overflow-y-auto">
                            {filteredItemCodes.length > 0 ? (
                              filteredItemCodes.map((product, index) => (
                                <div
                                  key={product.id}
                                  className={`p-4 cursor-pointer transition-all duration-150 border-b border-slate-700/50 last:border-b-0 ${
                                    index === selectedIndex 
                                      ? 'bg-blue-600/20 border-blue-500/30' 
                                      : 'hover:bg-slate-700/50'
                                  }`}
                                  onClick={() => selectItemByCode(product)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="text-right flex-1">
                                      <div className="text-white font-medium text-sm mb-1">
                                        {product.item_code}
                                      </div>
                                      <div className="text-slate-300 text-xs mb-1">
                                        {product.name} - {product.brand} {product.model}
                                      </div>
                                      <div className="flex items-center justify-end gap-2">
                                        <Badge 
                                          variant={product.stock > 10 ? "default" : product.stock > 0 ? "secondary" : "destructive"}
                                          className="text-xs"
                                        >
                                          متوفر: {product.stock}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="mr-3">
                                      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="p-6 text-center">
                                <div className="text-slate-400 text-sm mb-2">لا توجد منتجات تطابق البحث</div>
                                <div className="text-slate-500 text-xs">جرب البحث بكود مختلف</div>
                              </div>
                            )}
                          </div>
                          
                          {/* Footer */}
                          {filteredItemCodes.length > 0 && (
                            <div className="px-4 py-2 bg-slate-900/50 border-t border-slate-600/50">
                              <div className="text-xs text-slate-400 text-center">
                                استخدم ↑↓ للتنقل، Enter للاختيار، Esc للإغلاق
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div>
                <Label className="text-slate-300 text-right">فلترة بالفرع</Label>
                <Select value={filterBranch} onValueChange={setFilterBranch}>
                  <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors">
                    <SelectValue placeholder="جميع الفروع" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800/95 border-slate-600/50 backdrop-blur-sm max-h-[300px]">
                    <div className="p-2 sticky top-0 bg-slate-800 z-10">
                      <Input
                        placeholder="ابحث عن فرع..."
                        value={branchSearchTerm}
                        onChange={(e) => setBranchSearchTerm(e.target.value)}
                        className="bg-slate-700 border-slate-600 text-white text-right h-8"
                      />
                    </div>
                    <SelectItem value="all">جميع الفروع</SelectItem>
                    {branches
                      .filter(branch => branch.name.toLowerCase().includes(branchSearchTerm.toLowerCase()))
                      .map((branch) => (
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
                  <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors">
                    <SelectValue placeholder="جميع العملاء" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800/95 border-slate-600/50 backdrop-blur-sm max-h-[300px]">
                    <div className="p-2 sticky top-0 bg-slate-800 z-10">
                      <Input
                        placeholder="ابحث عن عميل..."
                        value={customerSearchTerm}
                        onChange={(e) => setCustomerSearchTerm(e.target.value)}
                        className="bg-slate-700 border-slate-600 text-white text-right h-8"
                      />
                    </div>
                    <SelectItem value="all">جميع العملاء</SelectItem>
                    {customers
                      .filter(customer => customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()))
                      .map((customer) => (
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
                  <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors">
                    <SelectValue placeholder="جميع المخازن" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800/95 border-slate-600/50 backdrop-blur-sm max-h-[300px]">
                    <div className="p-2 sticky top-0 bg-slate-800 z-10">
                      <Input
                        placeholder="ابحث عن مخزن..."
                        value={warehouseSearchTerm}
                        onChange={(e) => setWarehouseSearchTerm(e.target.value)}
                        className="bg-slate-700 border-slate-600 text-white text-right h-8"
                      />
                    </div>
                    <SelectItem value="all">جميع المخازن</SelectItem>
                    {warehouses
                      .filter(warehouse => 
                        warehouse.name.toLowerCase().includes(warehouseSearchTerm.toLowerCase()) ||
                        warehouse.warehouse_number?.toLowerCase().includes(warehouseSearchTerm.toLowerCase())
                      )
                      .map((warehouse) => (
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
                    <TableHead className="text-slate-300 text-right">كود القطعة</TableHead>
                    <TableHead className="text-slate-300 text-right">المنتج</TableHead>
                    <TableHead className="text-slate-300 text-right">موديل الماكينة</TableHead>
                    <TableHead className="text-slate-300 text-center">الكمية</TableHead>
                    <TableHead className="text-slate-300 text-right">العميل</TableHead>
                    <TableHead className="text-slate-300 text-right">الفرع</TableHead>
                    <TableHead className="text-slate-300 text-right">المخزن</TableHead>
                    <TableHead className="text-slate-300 text-right">المهندس</TableHead>
                    <TableHead className="text-slate-300 text-right">سريال الماكينة</TableHead>
                    <TableHead className="text-slate-300 text-right">نوع الضمان</TableHead>
                    <TableHead className="text-slate-300 text-right">رقم الفاتورة</TableHead>
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
                        <TableCell className="text-blue-400 text-right font-mono text-sm">{issuance.item_code || product?.item_code || '-'}</TableCell>
                        <TableCell className="text-slate-300 text-right">{product?.name || 'غير محدد'}</TableCell>
                        <TableCell className="text-slate-300 text-right">{issuance.model || '-'}</TableCell>
                        <TableCell className="text-slate-300 text-center">{issuance.quantity}</TableCell>
                        <TableCell className="text-slate-300 text-right">
                          {customer?.name || issuance.customer_name || 'غير محدد'}
                        </TableCell>
                        <TableCell className="text-slate-300 text-right">{branch?.name || 'غير محدد'}</TableCell>
                        <TableCell className="text-slate-300 text-right">
                          {warehouse ? `${warehouse.name} - ${warehouse.warehouse_number}` : 'غير محدد'}
                        </TableCell>
                        <TableCell className="text-slate-300 text-right">{issuance.engineer || 'غير محدد'}</TableCell>
                        <TableCell className="text-slate-300 text-right">{issuance.serial_number || '-'}</TableCell>
                        <TableCell className="text-slate-300 text-right">
                          {issuance.warranty_type === 'comprehensive' ? 'عقد شامل' :
                           issuance.warranty_type === 'warranty' ? 'ضمان' :
                           issuance.warranty_type === 'custody' ? 'عهدة' :
                           issuance.warranty_type === 'no_warranty' ? 'بدون ضمان' : '-'}
                        </TableCell>
                        <TableCell className="text-slate-300 text-right">{issuance.invoice_number || '-'}</TableCell>
                        <TableCell className="text-center">
                          {canEditOrDelete(issuance) && (
                            <div className="flex justify-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditIssuance(issuance)}
                                className="bg-blue-900/20 border-blue-700/50 text-blue-400 hover:bg-blue-900/30 hover:border-blue-600/50 hover:text-blue-300 transition-all duration-200"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-red-900/20 border-red-700/50 text-red-400 hover:bg-red-900/30 hover:border-red-600/50 hover:text-red-300 transition-all duration-200"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-slate-800/95 border-slate-700/50 backdrop-blur-sm shadow-2xl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-white text-right">تأكيد الحذف</AlertDialogTitle>
                                    <AlertDialogDescription className="text-slate-300 text-right">
                                      هل أنت متأكد من حذف هذا الإصدار؟ لا يمكن التراجع عن هذا الإجراء.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-slate-700/50 text-white border-slate-600/50 hover:bg-slate-600/50 hover:border-slate-500/50 transition-colors">
                                    إلغاء
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteIssuance(issuance)}
                                    className="bg-red-900/20 border border-red-700/50 text-red-400 hover:bg-red-900/30 hover:border-red-600/50 hover:text-red-300 transition-all duration-200"
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
          <DialogContent className="bg-slate-800/95 border-slate-700/50 text-white max-w-2xl backdrop-blur-sm shadow-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right">تعديل الإصدار</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateIssuance} className="space-y-4 max-h-96 overflow-y-auto">
              <div className="grid gap-2">
                <Label htmlFor="edit-product" className="text-slate-300 text-right">
                  المنتج
                </Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors">
                      <SelectValue placeholder="اختر المنتج" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800/95 border-slate-600/50 backdrop-blur-sm">
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
                    className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                  />
              </div>

              <div className="grid gap-2">
                <Label className="text-slate-300 text-right">
                  العميل
                </Label>
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                    <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors">
                      <SelectValue placeholder="اختر العميل" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800/95 border-slate-600/50 backdrop-blur-sm">
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
                    className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                    disabled={!!selectedCustomer}
                  />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-branch" className="text-slate-300 text-right">
                  الفرع
                </Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors">
                      <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800/95 border-slate-600/50 backdrop-blur-sm">
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
                    <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors">
                      <SelectValue placeholder="اختر المخزن" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800/95 border-slate-600/50 backdrop-blur-sm">
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
                    className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                  />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-issuanceDate" className="text-slate-300 text-right">
                  تاريخ الإصدار
                </Label>
                <Input
                    id="edit-issuanceDate"
                    type="date"
                    value={issuanceDate}
                    onChange={(e) => setIssuanceDate(e.target.value)}
                    className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                  />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-machineModel" className="text-slate-300 text-right">
                  موديل الماكينة
                </Label>
                <Input
                    id="edit-machineModel"
                    value={machineModel}
                    onChange={(e) => setMachineModel(e.target.value)}
                    placeholder="أدخل موديل/نوع الماكينة"
                    className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                  />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-serial" className="text-slate-300 text-right">
                  رقم سريال الماكينة
                </Label>
                <Input
                    id="edit-serial"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="أدخل رقم سريال الماكينة"
                    className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                  />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-warranty" className="text-slate-300 text-right">
                  نوع الضمان
                </Label>
                <Select value={warrantyType} onValueChange={setWarrantyType}>
                  <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors">
                    <SelectValue placeholder="اختر نوع الضمان" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800/95 border-slate-600/50 backdrop-blur-sm">
                    <SelectItem value="comprehensive">عقد شامل لقطع الغيار</SelectItem>
                    <SelectItem value="warranty">ضمان</SelectItem>
                    <SelectItem value="custody">عهدة</SelectItem>
                    <SelectItem value="no_warranty">بدون ضمان</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {warrantyType === 'no_warranty' && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-invoice" className="text-slate-300 text-right">
                      رقم الفاتورة
                    </Label>
                    <Input
                        id="edit-invoice"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="أدخل رقم الفاتورة"
                        className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                      />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-customSellingPrice" className="text-slate-300 text-right">
                      سعر البيع المخصص (اختياري)
                    </Label>
                    <Input
                        id="edit-customSellingPrice"
                        type="number"
                        value={customSellingPrice}
                        onChange={(e) => setCustomSellingPrice(e.target.value)}
                        placeholder="أدخل سعر البيع المخصص"
                        className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                      />
                    {quantity > 0 && customSellingPrice && (
                      <div className="mt-2 p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
                        <div className="text-green-400 text-sm font-medium">
                          إجمالي السعر: {(quantity * Number(customSellingPrice)).toLocaleString()} ج.م
                        </div>
                        <div className="text-slate-400 text-xs mt-1">
                          ({quantity} قطعة × {Number(customSellingPrice).toLocaleString()} ج.م)
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-invoiceValue" className="text-slate-300 text-right">
                      قيمة الفاتورة
                    </Label>
                    <Input
                        id="edit-invoiceValue"
                        type="number"
                        value={invoiceValue}
                        onChange={(e) => setInvoiceValue(e.target.value)}
                        placeholder="أدخل قيمة الفاتورة"
                        className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                      />
                  </div>
                </>
              )}

              <div className="grid gap-2">
                <Label htmlFor="edit-notes" className="text-slate-300 text-right">
                  ملاحظات (اختياري)
                </Label>
                <Textarea
                    id="edit-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="أدخل أي ملاحظات إضافية"
                    className="bg-slate-700/50 border-slate-600/50 text-white text-right focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                    rows={3}
                  />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={submitting}
                  className="bg-slate-700/50 border-slate-600/50 text-slate-300 hover:bg-slate-600/50 hover:border-slate-500/50 hover:text-white transition-all duration-200"
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
