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
      "المخزن",
      "سعر الشراء",
      "سعر البيع",
      "هامش الربح",
      "نسبة هامش الربح %",
      "الكمية",
      "إجمالي الربح المحتمل"
    ]
    
    const csvContent = [
      headers.join(","),
      ...sortedData.map(item => [
        item.name,
        item.brand,
        item.category,
        item.warehouse_name,
        item.purchase_price.toFixed(2),
        item.selling_price.toFixed(2),
        item.profit_margin.toFixed(2),
        item.profit_margin_percentage.toFixed(2),
        item.stock,
        item.total_profit_potential.toFixed(2)
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
      <div className="flex h-screen bg-slate-900">
        <Sidebar />
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="mb-8">
              <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 p-6">
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                  تقرير هامش الربح
                </h1>
                <p className="text-slate-300">تحليل هوامش الربح للمنتجات بناءً على أسعار الشراء والبيع</p>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 shadow-lg hover:shadow-xl transition-shadow">
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

              <Card className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-0 shadow-lg hover:shadow-xl transition-shadow">
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
            <Card className="mb-8 shadow-lg border-slate-700 bg-slate-800">
              <CardHeader className="bg-slate-700 border-b border-slate-600">
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                    <Filter className="h-5 w-5 text-white" />
                  </div>
                  فلاتر التقرير
                </CardTitle>
              </CardHeader>
              <CardContent className="bg-slate-800">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                  <div>
                    <Label htmlFor="warehouse-filter" className="text-white">المخزن</Label>
                    <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="اختر المخزن" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="all" className="text-white hover:bg-slate-600">جميع المخازن</SelectItem>
                        {warehouses.map((warehouse) => (
                          <SelectItem key={warehouse.id} value={warehouse.name} className="text-white hover:bg-slate-600">
                            {warehouse.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="category-filter" className="text-white">الفئة</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="اختر الفئة" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="all" className="text-white hover:bg-slate-600">جميع الفئات</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category} className="text-white hover:bg-slate-600">
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
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
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
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <Label htmlFor="sort-by" className="text-white">ترتيب حسب</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="profit_margin_percentage" className="text-white hover:bg-slate-600">نسبة هامش الربح</SelectItem>
                        <SelectItem value="profit_margin" className="text-white hover:bg-slate-600">هامش الربح</SelectItem>
                        <SelectItem value="total_profit_potential" className="text-white hover:bg-slate-600">إجمالي الربح المحتمل</SelectItem>
                        <SelectItem value="name" className="text-white hover:bg-slate-600">اسم المنتج</SelectItem>
                        <SelectItem value="purchase_price" className="text-white hover:bg-slate-600">سعر الشراء</SelectItem>
                        <SelectItem value="selling_price" className="text-white hover:bg-slate-600">سعر البيع</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="sort-order" className="text-white">نوع الترتيب</Label>
                    <Select value={sortOrder} onValueChange={(value: "asc" | "desc") => setSortOrder(value)}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="desc" className="text-white hover:bg-slate-600">تنازلي</SelectItem>
                        <SelectItem value="asc" className="text-white hover:bg-slate-600">تصاعدي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button onClick={exportToCSV} className="bg-green-600 hover:bg-green-700 text-white border-0 shadow-md">
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
                    className="bg-slate-600 hover:bg-slate-700 text-white border-0 shadow-md"
                  >
                    إعادة تعيين الفلاتر
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Data Table */}
            <Card className="shadow-lg border-slate-700 bg-slate-800">
              <CardHeader className="bg-slate-700 border-b border-slate-600">
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg">
                    <Package className="h-5 w-5 text-white" />
                  </div>
                  تفاصيل هامش الربح ({sortedData.length} منتج)
                </CardTitle>
              </CardHeader>
              <CardContent className="bg-slate-800">
                {sortedData.length === 0 ? (
                  <Alert className="bg-slate-700 border-slate-600">
                    <AlertDescription className="text-slate-300">
                      لا توجد منتجات تحتوي على أسعار شراء وبيع محددة أو لا تطابق معايير الفلترة.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-600">
                          <TableHead className="text-slate-300">اسم المنتج</TableHead>
                          <TableHead className="text-slate-300">العلامة التجارية</TableHead>
                          <TableHead className="text-slate-300">الفئة</TableHead>
                          <TableHead className="text-slate-300">المخزن</TableHead>
                          <TableHead className="text-slate-300">سعر الشراء</TableHead>
                          <TableHead className="text-slate-300">سعر البيع</TableHead>
                          <TableHead className="text-slate-300">هامش الربح</TableHead>
                          <TableHead className="text-slate-300">نسبة هامش الربح</TableHead>
                          <TableHead className="text-slate-300">الكمية</TableHead>
                          <TableHead className="text-slate-300">إجمالي الربح المحتمل</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedData.map((item) => (
                          <TableRow key={item.id} className="border-slate-600 hover:bg-slate-700">
                            <TableCell className="font-medium text-white">{item.name}</TableCell>
                            <TableCell className="text-slate-300">{item.brand}</TableCell>
                            <TableCell className="text-slate-300">{item.category}</TableCell>
                            <TableCell className="text-slate-300">{item.warehouse_name}</TableCell>
                            <TableCell className="text-slate-300">{item.purchase_price.toFixed(2)}</TableCell>
                            <TableCell className="text-slate-300">{item.selling_price.toFixed(2)}</TableCell>
                            <TableCell>
                              <span className={item.profit_margin >= 0 ? "text-green-400" : "text-red-400"}>
                                {item.profit_margin.toFixed(2)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${getMarginBadgeColor(item.profit_margin_percentage)} text-white`}>
                                {item.profit_margin_percentage.toFixed(1)}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-300">{item.stock}</TableCell>
                            <TableCell>
                              <span className={item.total_profit_potential >= 0 ? "text-green-400 font-medium" : "text-red-400 font-medium"}>
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