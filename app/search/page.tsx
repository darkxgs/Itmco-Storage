"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { Search, Filter, Download } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import { getCategories } from "@/lib/database"

// Types for search results
interface ProductResult {
  id: number
  name: string
  brand: string
  model: string
  category: string
  item_code?: string
  stock: number
  min_stock: number
  purchase_price?: number
  selling_price?: number
  description?: string
  created_at: string
}

interface IssuanceResult {
  id: number
  product_name: string
  customer_name: string
  branch: string
  quantity: number
  engineer: string
  serial_number?: string
  warranty_type?: string
  invoice_number?: string
  notes?: string
  date?: string
  created_at: string
}

interface UserResult {
  id: number
  name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

type SearchResult = ProductResult | IssuanceResult | UserResult

export default function SearchPage() {
  const { user } = useAuth()
  const [searchType, setSearchType] = useState("products")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedBranch, setSelectedBranch] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
  const [dateRange, setDateRange] = useState<any>(null)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<{id: number, name: string}[]>([])
  const [branches, setBranches] = useState<{id: number, name: string}[]>([])
  const { toast } = useToast()

  // Load categories and branches from database
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load categories
        const categoriesData = await getCategories()
        setCategories(categoriesData.filter((c: any) => c.is_active !== false))
        
        // Load branches
        const { data: branchesData } = await supabase
          .from('branches')
          .select('id, name')
          .eq('is_active', true)
          .order('name')
        setBranches(branchesData || [])
      } catch (error) {
        console.error('Error loading data:', error)
      }
    }
    loadData()
  }, [])

  const handleSearch = async () => {
    setLoading(true)
    try {
      let query
      let data

      if (searchType === "products") {
        const { data: productsData, error } = await supabase
          .from("products")
          .select("*")
          .order("created_at", { ascending: false })

        if (error) throw error

        let filtered = productsData ?? []

        if (searchTerm) {
          const s = searchTerm.toLowerCase()
          filtered = filtered.filter(
            (p) =>
              p.name.toLowerCase().includes(s) ||
              p.brand.toLowerCase().includes(s) ||
              p.model.toLowerCase().includes(s) ||
              p.category.toLowerCase().includes(s) ||
              (p.item_code && p.item_code.toLowerCase().includes(s)),
          )
        }

        if (selectedCategory !== "all") {
          filtered = filtered.filter((p) => p.category === selectedCategory)
        }

        // client-side stock filters
        if (stockFilter === "low") {
          filtered = filtered.filter((p) => p.stock <= p.min_stock && p.stock > 0)
        } else if (stockFilter === "out") {
          filtered = filtered.filter((p) => p.stock === 0)
        } else if (stockFilter === "available") {
          filtered = filtered.filter((p) => p.stock > 0)
        }

        data = filtered
      } else if (searchType === "issuances") {
        query = supabase.from("issuances").select("*")

        if (searchTerm) {
          query = query.or(
            `product_name.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%,engineer.ilike.%${searchTerm}%,serial_number.ilike.%${searchTerm}%`,
          )
        }

        if (selectedBranch !== "all") {
          query = query.eq("branch", selectedBranch)
        }

        if (dateRange?.from) {
          query = query.gte("created_at", dateRange.from.toISOString())
        }

        if (dateRange?.to) {
          query = query.lte("created_at", dateRange.to.toISOString())
        }

        const { data: issuancesData, error } = await query.order("created_at", { ascending: false })
        if (error) throw error
        data = issuancesData
      } else if (searchType === "users") {
        if (user.role !== "admin") {
          toast({
            title: "خطأ",
            description: "ليس لديك صلاحية للبحث في المستخدمين",
            variant: "destructive",
          })
          setLoading(false)
          return
        }

        query = supabase.from("users").select("*")

        if (searchTerm) {
          query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        }

        const { data: usersData, error } = await query.order("created_at", { ascending: false })
        if (error) throw error
        data = usersData
      }

      setResults((data || []) as SearchResult[])

      toast({
        title: "تم البحث",
        description: `تم العثور على ${data?.length || 0} نتيجة`,
      })
    } catch (error: any) {
      console.error("Search error:", error)
      toast({
        title: "خطأ في البحث",
        description: error?.message || "حدث خطأ أثناء البحث",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    // Convert results to Excel
    if (results.length === 0) {
      toast({
        title: "لا توجد بيانات",
        description: "لا توجد نتائج للتصدير",
        variant: "destructive",
      })
      return
    }

    try {
      // Import ExcelJS library dynamically
      const ExcelJS = (await import('exceljs')).default
      const workbook = new ExcelJS.Workbook()
      
      // Create worksheet
      const worksheet = workbook.addWorksheet('نتائج البحث', {
        views: [{ rightToLeft: true }]
      })
      
      // Define headers based on search type
      if (searchType === 'products') {
        worksheet.columns = [
          { header: 'الرقم', key: 'id', width: 10 },
          { header: 'اسم المنتج', key: 'name', width: 30 },
          { header: 'العلامة التجارية', key: 'brand', width: 20 },
          { header: 'الموديل', key: 'model', width: 20 },
          { header: 'الفئة', key: 'category', width: 25 },
          { header: 'كود المنتج', key: 'item_code', width: 15 },
          { header: 'الكمية', key: 'stock', width: 12 },
          { header: 'الحد الأدنى', key: 'min_stock', width: 12 },
          { header: 'سعر الشراء', key: 'purchase_price', width: 15 },
          { header: 'سعر البيع', key: 'selling_price', width: 15 },
          { header: 'الوصف', key: 'description', width: 40 },
        ]
        
        // Add data rows
        results.forEach((product: any) => {
          worksheet.addRow({
            id: product.id,
            name: product.name || '',
            brand: product.brand || '',
            model: product.model || '',
            category: product.category || '',
            item_code: product.item_code || '',
            stock: product.stock || 0,
            min_stock: product.min_stock || 0,
            purchase_price: product.purchase_price || '',
            selling_price: product.selling_price || '',
            description: product.description || '',
          })
        })
      } else {
        // Issuances
        worksheet.columns = [
          { header: 'الرقم', key: 'id', width: 10 },
          { header: 'التاريخ', key: 'date', width: 15 },
          { header: 'اسم المنتج', key: 'product_name', width: 30 },
          { header: 'العميل', key: 'customer_name', width: 25 },
          { header: 'الفرع', key: 'branch', width: 20 },
          { header: 'الكمية', key: 'quantity', width: 12 },
          { header: 'المهندس', key: 'engineer', width: 20 },
          { header: 'رقم سريال الماكينة', key: 'serial_number', width: 20 },
          { header: 'نوع الضمان', key: 'warranty_type', width: 15 },
          { header: 'رقم الفاتورة', key: 'invoice_number', width: 15 },
          { header: 'ملاحظات', key: 'notes', width: 30 },
        ]
        
        // Add data rows
        results.forEach((issuance: any) => {
          worksheet.addRow({
            id: issuance.id,
            date: issuance.date ? new Date(issuance.date).toLocaleDateString('en-GB') : '',
            product_name: issuance.product_name || '',
            customer_name: issuance.customer_name || '',
            branch: issuance.branch || '',
            quantity: issuance.quantity || 0,
            engineer: issuance.engineer || '',
            serial_number: issuance.serial_number || '',
            warranty_type: issuance.warranty_type === 'comprehensive' ? 'عقد شامل' :
                          issuance.warranty_type === 'warranty' ? 'ضمان' :
                          issuance.warranty_type === 'custody' ? 'عهدة' :
                          issuance.warranty_type === 'no_warranty' ? 'بدون ضمان' : '',
            invoice_number: issuance.invoice_number || '',
            notes: issuance.notes || '',
          })
        })
      }
      
      // Style header row
      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' }
      }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25
      
      // Add borders to all cells
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
          }
          if (rowNumber > 1) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' }
          }
        })
      })
      
      // Generate and download the file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `نتائج_البحث_${searchType === 'products' ? 'المنتجات' : 'الإصدارات'}_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "تم التصدير بنجاح",
        description: `تم تصدير ${results.length} نتيجة إلى ملف Excel`,
      })
    } catch (error) {
      console.error("Export error:", error)
      toast({
        title: "فشل في التصدير",
        description: "حدث خطأ أثناء تصدير البيانات",
        variant: "destructive",
      })
    }
  }

  const clearFilters = () => {
    setSearchTerm("")
    setSelectedCategory("all")
    setSelectedBranch("all")
    setStockFilter("all")
    setDateRange(null)
    setResults([])
  }

  if (!user) {
    return <div>جاري التحميل...</div>
  }

  return (
    <div className="flex min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Decorative background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 [background:radial-gradient(700px_circle_at_100%_0%,rgba(37,99,235,0.12),transparent_60%),radial-gradient(700px_circle_at_0%_100%,rgba(14,165,233,0.1),transparent_60%)]" />
      <Sidebar />
      <div className="flex-1 p-6 relative">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">البحث المتقدم</h1>
          <p className="text-slate-300">البحث والفلترة في جميع بيانات النظام</p>
        </div>

        {/* Search Controls */}
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Search className="w-5 h-5" />
              معايير البحث
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Type */}
            <div className="grid gap-2">
              <Label className="text-slate-300">نوع البحث</Label>
              <Select value={searchType} onValueChange={setSearchType}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="products">المنتجات</SelectItem>
                  <SelectItem value="issuances">الإصدارات</SelectItem>
                  {user.role === "admin" && <SelectItem value="users">المستخدمين</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {/* Search Term */}
            <div className="grid gap-2">
              <Label className="text-slate-300">كلمة البحث</Label>
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  searchType === "products"
                    ? "البحث في اسم المنتج، العلامة التجارية، أو الموديل..."
                    : searchType === "issuances"
                      ? "البحث في اسم المنتج، العميل، المهندس، أو الرقم التسلسلي..."
                      : "البحث في اسم المستخدم أو البريد الإلكتروني..."
                }
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            {/* Filters based on search type */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchType === "products" && (
                <>
                  <div className="grid gap-2">
                    <Label className="text-slate-300">الفئة</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="جميع الفئات" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="all">جميع الفئات</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.name}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-slate-300">حالة المخزون</Label>
                    <Select value={stockFilter} onValueChange={setStockFilter}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="جميع الحالات" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="all">جميع الحالات</SelectItem>
                        <SelectItem value="available">متوفر</SelectItem>
                        <SelectItem value="low">مخزون منخفض</SelectItem>
                        <SelectItem value="out">نفد المخزون</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {searchType === "issuances" && (
                <>
                  <div className="grid gap-2">
                    <Label className="text-slate-300">الفرع</Label>
                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="جميع الفروع" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="all">جميع الفروع</SelectItem>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.name}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-slate-300">نطاق التاريخ</Label>
                    <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSearch} disabled={loading} className="flex-1">
                {loading ? "جاري البحث..." : "بحث"}
              </Button>
              <Button variant="outline" onClick={clearFilters} className="bg-transparent">
                <Filter className="w-4 h-4 ml-2" />
                مسح الفلاتر
              </Button>
              {results.length > 0 && (
                <Button variant="secondary" onClick={handleExport}>
                  <Download className="w-4 h-4 ml-2" />
                  تصدير
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">نتائج البحث ({results.length} نتيجة)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      {searchType === "products" && (
                        <>
                          <TableHead className="text-slate-300">اسم المنتج</TableHead>
                          <TableHead className="text-slate-300">العلامة التجارية</TableHead>
                          <TableHead className="text-slate-300">الموديل</TableHead>
                          <TableHead className="text-slate-300">الفئة</TableHead>
                          <TableHead className="text-slate-300">المخزون</TableHead>
                          <TableHead className="text-slate-300">الحالة</TableHead>
                        </>
                      )}
                      {searchType === "issuances" && (
                        <>
                          <TableHead className="text-slate-300">التاريخ</TableHead>
                          <TableHead className="text-slate-300">المنتج</TableHead>
                          <TableHead className="text-slate-300">العميل</TableHead>
                          <TableHead className="text-slate-300">الفرع</TableHead>
                          <TableHead className="text-slate-300">الكمية</TableHead>
                          <TableHead className="text-slate-300">المهندس</TableHead>
                          <TableHead className="text-slate-300">الرقم التسلسلي</TableHead>
                        </>
                      )}
                      {searchType === "users" && (
                        <>
                          <TableHead className="text-slate-300">الاسم</TableHead>
                          <TableHead className="text-slate-300">البريد الإلكتروني</TableHead>
                          <TableHead className="text-slate-300">الدور</TableHead>
                          <TableHead className="text-slate-300">الحالة</TableHead>
                          <TableHead className="text-slate-300">تاريخ الإنشاء</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((item: any, index) => (
                      <TableRow key={index} className="border-slate-700">
                        {searchType === "products" && (
                          <>
                            <TableCell className="text-white font-medium">{item.name}</TableCell>
                            <TableCell className="text-slate-300">{item.brand}</TableCell>
                            <TableCell className="text-slate-300">{item.model}</TableCell>
                            <TableCell className="text-slate-300">{item.category}</TableCell>
                            <TableCell className="text-white">{item.stock}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  item.stock === 0
                                    ? "destructive"
                                    : item.stock <= item.min_stock
                                      ? "secondary"
                                      : "default"
                                }
                              >
                                {item.stock === 0
                                  ? "نفد المخزون"
                                  : item.stock <= item.min_stock
                                    ? "مخزون منخفض"
                                    : "متوفر"}
                              </Badge>
                            </TableCell>
                          </>
                        )}
                        {searchType === "issuances" && (
                          <>
                            <TableCell className="text-slate-300">
                              {new Date(item.created_at).toLocaleDateString("en-GB")}
                            </TableCell>
                            <TableCell className="text-white font-medium">{item.product_name}</TableCell>
                            <TableCell className="text-slate-300">{item.customer_name}</TableCell>
                            <TableCell className="text-slate-300">{item.branch}</TableCell>
                            <TableCell className="text-white">{item.quantity}</TableCell>
                            <TableCell className="text-slate-300">{item.engineer}</TableCell>
                            <TableCell className="text-slate-300">{item.serial_number}</TableCell>
                          </>
                        )}
                        {searchType === "users" && (
                          <>
                            <TableCell className="text-white font-medium">{item.name}</TableCell>
                            <TableCell className="text-slate-300">{item.email}</TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  item.role === "admin"
                                    ? "bg-red-500"
                                    : item.role === "inventory_manager"
                                      ? "bg-blue-500"
                                      : "bg-green-500"
                                }
                              >
                                {item.role === "admin"
                                  ? "مدير النظام"
                                  : item.role === "inventory_manager"
                                    ? "مدير المخزون"
                                    : "مهندس"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={item.is_active ? "default" : "destructive"}>
                                {item.is_active ? "نشط" : "معطل"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-300">
                              {new Date(item.created_at).toLocaleDateString("en-GB")}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Results */}
        {results.length === 0 && !loading && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="text-center py-12">
              <Search className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">لا توجد نتائج</h3>
              <p className="text-slate-400">جرب تعديل معايير البحث للحصول على نتائج</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
