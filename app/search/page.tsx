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

const categories = [
  "آلات عد النقود",
  "آلات ربط النقود",
  "آلات فحص الشيكات",
  "ساعات الأمان",
  "أنظمة الحضور والانصراف",
  "ساعات السكرتارية",
  "بوابات الأمان",
]

const branches = [
  "الفرع الرئيسي - الرياض",
  "فرع جدة",
  "فرع الدمام",
  "فرع مكة المكرمة",
  "فرع المدينة المنورة",
  "فرع الطائف",
  "فرع أبها",
  "فرع تبوك",
]

export default function SearchPage() {
  const { user, loading: authLoading } = useAuth()
  const [searchType, setSearchType] = useState("products")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedBranch, setSelectedBranch] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
  const [dateRange, setDateRange] = useState<any>(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // User authentication is handled by useAuth hook

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

      setResults(data || [])

      toast({
        title: "تم البحث",
        description: `تم العثور على ${data?.length || 0} نتيجة`,
      })
    } catch (error) {
      console.error("Search error:", error)
      toast({
        title: "خطأ في البحث",
        description: error.message || "حدث خطأ أثناء البحث",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    // Convert results to CSV
    if (results.length === 0) {
      toast({
        title: "لا توجد بيانات",
        description: "لا توجد نتائج للتصدير",
        variant: "destructive",
      })
      return
    }

    // Define proper Arabic headers based on search type
    const getHeaders = () => {
      if (searchType === 'products') {
        return ["الرقم", "التاريخ", "اسم المنتج", "الفئة", "كود المنتج", "رقم القطعة", "العلامة التجارية", "اسم العميل", "الفرع", "اسم المستودع", "الكمية", "المهندس", "الرقم التسلسلي", "نوع الضمان", "رقم الفاتورة", "سعر الشراء", "سعر البيع", "الملاحظات"]
      } else {
        return ["الرقم", "التاريخ", "اسم المنتج", "الفئة", "كود المنتج", "رقم القطعة", "العلامة التجارية", "اسم العميل", "الفرع", "اسم المستودع", "الكمية", "المهندس", "الرقم التسلسلي", "نوع الضمان", "رقم الفاتورة", "سعر الشراء", "سعر البيع", "الملاحظات"]
      }
    }

    const headers = getHeaders().join(",")
    const csvContent = [
      headers,
      ...results.map((row) => {
        const values = [
          row.id || '',
          row.date || row.created_at || '',
          row.product_name || row.productName || '',
          row.category || '',
          row.item_code || '',
          row.part_number || '',
          row.brand || '',
          row.customer_name || '',
          row.branch || '',
          row.warehouse_name || '',
          row.quantity || '',
          row.engineer || '',
          row.serial_number || '',
          row.warranty_type || '',
          row.invoice_number || '',
          row.purchase_price || '',
          row.selling_price || '',
          row.notes || ''
        ]
        return values.map((value) => `"${value}"`).join(",")
      }),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `search_results_${searchType}_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "تم التصدير",
      description: "تم تصدير النتائج بنجاح",
    })
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
                          <SelectItem key={category} value={category}>
                            {category}
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
                          <SelectItem key={branch} value={branch}>
                            {branch}
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
                    {results.map((item, index) => (
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
                              {new Date(item.created_at).toLocaleDateString("ar-SA")}
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
                              {new Date(item.created_at).toLocaleDateString("ar-SA")}
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
