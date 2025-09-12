"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  BarChart3,
  Download,
  Filter,
  Loader2,
} from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { getProducts, getWarehouses } from "@/lib/database"
import { ErrorBoundary } from "@/components/error-boundary"

interface ProfitMarginData {
  id: number
  name: string
  brand: string
  category: string
  warehouse_name: string
  purchase_price: number
  selling_price: number
  profit_margin: number
  profit_margin_percentage: number
  stock: number
  total_profit_potential: number
}

export default function ProfitMarginReportPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [profitData, setProfitData] = useState<ProfitMarginData[]>([])
  const [warehouseFilter, setWarehouseFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sortBy, setSortBy] = useState("profit_margin_percentage")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [minMarginFilter, setMinMarginFilter] = useState("")
  const [maxMarginFilter, setMaxMarginFilter] = useState("")

  const categories = [
    "آلات عد النقود",
    "آلات ربط النقود",
    "آلات فحص الشيكات",
    "ساعات الأمان",
    "أنظمة الحضور والانصراف",
    "ساعات السكرتارية",
    "بوابات الأمان",
  ]

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [productsData, warehousesData] = await Promise.all([
        getProducts(),
        getWarehouses()
      ])
      setProducts(productsData)
      setWarehouses(warehousesData)
      calculateProfitMargins(productsData, warehousesData)
    } catch (error: any) {
      console.error("Error loading data:", error)
      toast({
        title: "خطأ في تحميل البيانات",
        description: error.message || "حدث خطأ أثناء تحميل البيانات",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const calculateProfitMargins = (productsData: any[], warehousesData: any[]) => {
    const warehouseMap = new Map(warehousesData.map(w => [w.id, w.name]))
    
    const profitCalculations = productsData
      .filter(product => product.purchase_price && product.selling_price)
      .map(product => {
        const purchasePrice = parseFloat(product.purchase_price) || 0
        const sellingPrice = parseFloat(product.selling_price) || 0
        const profitMargin = sellingPrice - purchasePrice
        const profitMarginPercentage = purchasePrice > 0 ? (profitMargin / purchasePrice) * 100 : 0
        const totalProfitPotential = profitMargin * (product.stock || 0)

        return {
          id: product.id,
          name: product.name,
          brand: product.brand || "-",
          category: product.category || "-",
          warehouse_name: warehouseMap.get(product.warehouse_id) || "غير محدد",
          purchase_price: purchasePrice,
          selling_price: sellingPrice,
          profit_margin: profitMargin,
          profit_margin_percentage: profitMarginPercentage,
          stock: product.stock || 0,
          total_profit_potential: totalProfitPotential,
        }
      })

    setProfitData(profitCalculations)
  }

  const filteredData = useMemo(() => {
    return profitData.filter(item => {
      const matchesWarehouse = warehouseFilter === "all" || item.warehouse_name === warehouseFilter
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter
      const matchesMinMargin = !minMarginFilter || item.profit_margin_percentage >= parseFloat(minMarginFilter)
      const matchesMaxMargin = !maxMarginFilter || item.profit_margin_percentage <= parseFloat(maxMarginFilter)
      
      return matchesWarehouse && matchesCategory && matchesMinMargin && matchesMaxMargin
    })
  }, [profitData, warehouseFilter, categoryFilter, minMarginFilter, maxMarginFilter])

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const aValue = a[sortBy as keyof ProfitMarginData]
      const bValue = b[sortBy as keyof ProfitMarginData]
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
      }
      
      const aStr = String(aValue).toLowerCase()
      const bStr = String(bValue).toLowerCase()
      return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
    })
  }, [filteredData, sortBy, sortOrder])

  const summaryStats = useMemo(() => {
    if (filteredData.length === 0) {
      return {
        totalProducts: 0,
        averageMargin: 0,
        totalProfitPotential: 0,
        highestMargin: 0,
        lowestMargin: 0,
      }
    }

    const totalProfitPotential = filteredData.reduce((sum, item) => sum + item.total_profit_potential, 0)
    const averageMargin = filteredData.reduce((sum, item) => sum + item.profit_margin_percentage, 0) / filteredData.length
    const margins = filteredData.map(item => item.profit_margin_percentage)
    
    return {
      totalProducts: filteredData.length,
      averageMargin,
      totalProfitPotential,
      highestMargin: Math.max(...margins),
      lowestMargin: Math.min(...margins),
    }
  }, [filteredData])

  const exportToCSV = () => {
    const headers = [
      "اسم المنتج",
      "العلامة التجارية",
      "الفئة",
      "كود المنتج",
      "المخزن",
      "سعر الشراء",
      "سعر البيع",
      "هامش الربح",
      "نسبة هامش الربح %",
      "الكمية",
      "إجمالي الربح المحتمل",
      "الوصف"
    ]
    
    const csvContent = [
      headers.join(","),
      ...sortedData.map(item => [
        item.name,
        item.brand,
        item.category,
        item.item_code || '',
        item.warehouse_name,
        item.purchase_price.toFixed(2),
        item.selling_price.toFixed(2),
        item.profit_margin.toFixed(2),
        item.profit_margin_percentage.toFixed(2),
        item.stock,
        item.total_profit_potential.toFixed(2),
        item.description || ''
      ].join(","))
    ].join("\n")
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `profit-margin-report-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getMarginBadgeColor = (percentage: number) => {
    if (percentage >= 50) return "bg-green-500"
    if (percentage >= 25) return "bg-yellow-500"
    if (percentage >= 10) return "bg-orange-500"
    return "bg-red-500"
  }

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>جاري تحميل البيانات...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-slate-950 relative overflow-hidden">
        {/* Decorative background */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(700px_circle_at_100%_0%,rgba(37,99,235,0.20),transparent_60%),radial-gradient(700px_circle_at_0%_100%,rgba(14,165,233,0.20),transparent_60%),radial-gradient(500px_circle_at_50%_50%,rgba(34,197,94,0.10),transparent_60%)]" />
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-green-500/10 rounded-full blur-3xl" />
        </div>
        <Sidebar />
        <div className="flex-1 overflow-auto relative z-10">
          <div className="p-6">
            <div className="mb-8 relative">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl border border-blue-500/30 backdrop-blur-sm">
                  <BarChart3 className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">تقرير هامش الربح</h1>
                  <p className="text-slate-400">تحليل هوامش الربح للمنتجات بناءً على أسعار الشراء والبيع</p>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              <Card className="bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-white border border-blue-500/30 backdrop-blur-sm shadow-xl hover:shadow-blue-500/25 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-100">إجمالي المنتجات</p>
                      <p className="text-3xl font-bold text-white">{summaryStats.totalProducts}</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-full">
                      <Package className="h-8 w-8 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 text-white border border-emerald-500/30 backdrop-blur-sm shadow-xl hover:shadow-emerald-500/25 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-emerald-100">متوسط هامش الربح</p>
                      <p className="text-3xl font-bold text-white">{summaryStats.averageMargin.toFixed(1)}%</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-full">
                      <BarChart3 className="h-8 w-8 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-100">أعلى هامش ربح</p>
                      <p className="text-3xl font-bold text-white">{summaryStats.highestMargin.toFixed(1)}%</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-full">
                      <TrendingUp className="h-8 w-8 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-100">أقل هامش ربح</p>
                      <p className="text-3xl font-bold text-white">{summaryStats.lowestMargin.toFixed(1)}%</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-full">
                      <TrendingDown className="h-8 w-8 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-amber-500 to-amber-600 text-white border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-amber-100">إجمالي الربح المحتمل</p>
                      <p className="text-3xl font-bold text-white">{summaryStats.totalProfitPotential.toFixed(0)}</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-full">
                      <DollarSign className="h-8 w-8 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card className="mb-8 bg-slate-900/50 border-slate-700/50 backdrop-blur-sm shadow-2xl hover:shadow-blue-500/10 transition-all duration-300">
              <CardHeader className="border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Filter className="w-5 h-5 text-purple-400" />
                  </div>
                  <CardTitle className="text-white">فلاتر التقرير</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                  <div>
                    <Label htmlFor="warehouse-filter" className="text-white">المخزن</Label>
                    <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                      <SelectTrigger className="bg-slate-800/50 border-slate-600/50 text-white backdrop-blur-sm focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200">
                        <SelectValue placeholder="اختر المخزن" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800/90 border-slate-600/50 backdrop-blur-sm">
                        <SelectItem value="all" className="text-white hover:bg-slate-700/50">جميع المخازن</SelectItem>
                        {warehouses.map((warehouse) => (
                          <SelectItem key={warehouse.id} value={warehouse.name} className="text-white hover:bg-slate-700/50">
                            {warehouse.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="category-filter" className="text-white">الفئة</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="bg-slate-800/50 border-slate-600/50 text-white backdrop-blur-sm focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200">
                        <SelectValue placeholder="اختر الفئة" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800/90 border-slate-600/50 backdrop-blur-sm">
                        <SelectItem value="all" className="text-white hover:bg-slate-700/50">جميع الفئات</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category} className="text-white hover:bg-slate-700/50">
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="min-margin" className="text-white">أقل هامش ربح %</Label>
                    <Input
                      id="min-margin"
                      type="number"
                      placeholder="0"
                      value={minMarginFilter}
                      onChange={(e) => setMinMarginFilter(e.target.value)}
                      className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-400 backdrop-blur-sm focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                    />
                  </div>

                  <div>
                    <Label htmlFor="max-margin" className="text-white">أعلى هامش ربح %</Label>
                    <Input
                      id="max-margin"
                      type="number"
                      placeholder="100"
                      value={maxMarginFilter}
                      onChange={(e) => setMaxMarginFilter(e.target.value)}
                      className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-400 backdrop-blur-sm focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                    />
                  </div>

                  <div>
                    <Label htmlFor="sort-by" className="text-white">ترتيب حسب</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="bg-slate-800/50 border-slate-600/50 text-white backdrop-blur-sm focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800/90 border-slate-600/50 backdrop-blur-sm">
                        <SelectItem value="profit_margin_percentage" className="text-white hover:bg-slate-700/50">نسبة هامش الربح</SelectItem>
                        <SelectItem value="profit_margin" className="text-white hover:bg-slate-700/50">هامش الربح</SelectItem>
                        <SelectItem value="total_profit_potential" className="text-white hover:bg-slate-700/50">إجمالي الربح المحتمل</SelectItem>
                        <SelectItem value="name" className="text-white hover:bg-slate-700/50">اسم المنتج</SelectItem>
                        <SelectItem value="purchase_price" className="text-white hover:bg-slate-700/50">سعر الشراء</SelectItem>
                        <SelectItem value="selling_price" className="text-white hover:bg-slate-700/50">سعر البيع</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="sort-order" className="text-white">نوع الترتيب</Label>
                    <Select value={sortOrder} onValueChange={(value: "asc" | "desc") => setSortOrder(value)}>
                      <SelectTrigger className="bg-slate-800/50 border-slate-600/50 text-white backdrop-blur-sm focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800/90 border-slate-600/50 backdrop-blur-sm">
                        <SelectItem value="desc" className="text-white hover:bg-slate-700/50">تنازلي</SelectItem>
                        <SelectItem value="asc" className="text-white hover:bg-slate-700/50">تصاعدي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button onClick={exportToCSV} className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white border-0 shadow-lg hover:shadow-green-500/25 transition-all duration-200">
                    <Download className="h-4 w-4 mr-2" />
                    تصدير CSV
                  </Button>
                  <Button
                    onClick={() => {
                      setWarehouseFilter("all")
                      setCategoryFilter("all")
                      setMinMarginFilter("")
                      setMaxMarginFilter("")
                      setSortBy("profit_margin_percentage")
                      setSortOrder("desc")
                    }}
                    className="bg-slate-700/50 hover:bg-slate-600/50 text-white border border-slate-600/50 shadow-lg hover:shadow-slate-500/25 transition-all duration-200 backdrop-blur-sm"
                  >
                    إعادة تعيين الفلاتر
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Data Table */}
            <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm shadow-2xl hover:shadow-blue-500/10 transition-all duration-300">
              <CardHeader className="border-b border-slate-700/50">
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg">
                    <Package className="h-5 w-5 text-white" />
                  </div>
                  تفاصيل هامش الربح ({sortedData.length} منتج)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {sortedData.length === 0 ? (
                  <Alert className="bg-slate-700/50 border-slate-600/50 backdrop-blur-sm">
                    <AlertDescription className="text-slate-300">
                      لا توجد منتجات تحتوي على أسعار شراء وبيع محددة أو لا تطابق معايير الفلترة.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="rounded-lg overflow-hidden border border-slate-700/50">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-600/50 bg-slate-700/30">
                          <TableHead className="text-slate-200 font-semibold text-left w-[180px]">اسم المنتج</TableHead>
                           <TableHead className="text-slate-200 font-semibold text-left w-[140px]">العلامة التجارية</TableHead>
                           <TableHead className="text-slate-200 font-semibold text-left w-[120px]">الفئة</TableHead>
                           <TableHead className="text-slate-200 font-semibold text-center w-[140px]">المخزن</TableHead>
                           <TableHead className="text-slate-200 font-semibold text-right w-[120px]">سعر الشراء</TableHead>
                           <TableHead className="text-slate-200 font-semibold text-right w-[120px]">سعر البيع</TableHead>
                           <TableHead className="text-slate-200 font-semibold text-right w-[120px]">هامش الربح</TableHead>
                           <TableHead className="text-slate-200 font-semibold text-right w-[140px]">نسبة هامش الربح</TableHead>
                           <TableHead className="text-slate-200 font-semibold text-right w-[100px]">الكمية</TableHead>
                           <TableHead className="text-slate-200 font-semibold text-right w-[160px]">إجمالي الربح المحتمل</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedData.map((item) => (
                          <TableRow key={item.id} className="border-slate-600/50 hover:bg-slate-700/30 transition-colors duration-200">
                            <TableCell className="font-medium text-white text-left w-[180px]">{item.name}</TableCell>
                            <TableCell className="text-slate-300 text-left w-[140px]">{item.brand}</TableCell>
                            <TableCell className="text-slate-300 text-left w-[120px]">{item.category}</TableCell>
                            <TableCell className="text-slate-300 text-center w-[140px]">{item.warehouse_name}</TableCell>
                            <TableCell className="text-slate-300 font-mono text-right w-[120px]">{item.purchase_price.toFixed(2)}</TableCell>
                            <TableCell className="text-slate-300 font-mono text-right w-[120px]">{item.selling_price.toFixed(2)}</TableCell>
                            <TableCell className="text-right w-[120px]">
                              <span className={item.profit_margin >= 0 ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                                {item.profit_margin.toFixed(2)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right w-[140px]">
                              <Badge className={`${getMarginBadgeColor(item.profit_margin_percentage)} text-white`}>
                                {item.profit_margin_percentage.toFixed(1)}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-300 text-right w-[100px]">{item.stock}</TableCell>
                            <TableCell className="text-right w-[160px]">
                              <span className={item.total_profit_potential >= 0 ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                                {item.total_profit_potential.toFixed(2)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}