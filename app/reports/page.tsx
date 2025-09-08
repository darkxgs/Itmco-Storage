"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, Pie, PieChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { Download, FileText, Calendar, TrendingUp, Package, AlertTriangle } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { getMonthlyIssuances, getProductFrequency, getBranchPerformance, getFilteredIssuances, CATEGORIES, getBranches, getCustomers, getWarehouses } from "@/lib/database"
import { exportToCSV, exportToPDF, exportToExcel, validateExportData, generateSummaryStats } from "@/lib/export-utils"
import { ErrorBoundary } from "@/components/error-boundary"

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth()
  const [selectedPeriod, setSelectedPeriod] = useState("monthly")
  const [selectedBranch, setSelectedBranch] = useState("all")
  const { toast } = useToast()

  // Enhanced filtering state
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    branch: "all",
    category: "all",
    productName: "",
    engineer: "",
    customer: "",
    warehouse: "all",
    serialNumber: "",
    itemCode: ""
  })

  // New state for dynamic data
  const [branches, setBranches] = useState([])
  const [customers, setCustomers] = useState([])
  const [warehouses, setWarehouses] = useState([])

  const [monthlyData, setMonthlyData] = useState([])
  const [productFrequency, setProductFrequency] = useState([])
  const [branchData, setBranchData] = useState([])
  const [recentTransactions, setRecentTransactions] = useState([])
  const [allTransactions, setAllTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (user && !["admin", "inventory_manager"].includes(user.role)) {
      window.location.href = "/dashboard"
    }
  }, [user])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Load dynamic data first
      const [branchesData, customersData, warehousesData] = await Promise.all([
        getBranches(),
        getCustomers(),
        getWarehouses()
      ])
      
      setBranches(branchesData)
      setCustomers(customersData)
      setWarehouses(warehousesData)
      
      // Prepare filter parameters
      const filterParams = {
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        branch: filters.branch !== "all" ? filters.branch : undefined,
        category: filters.category !== "all" ? filters.category : undefined,
        productName: filters.productName || undefined,
        engineer: filters.engineer || undefined,
        customer: filters.customer || undefined,
        warehouse: filters.warehouse !== "all" ? filters.warehouse : undefined,
        serialNumber: filters.serialNumber || undefined,
        itemCode: filters.itemCode || undefined
      }
      
      const [monthly, frequency, branch, filtered, recent] = await Promise.all([
        getMonthlyIssuances(),
        getProductFrequency(filterParams.startDate, filterParams.endDate, filterParams.branch, filterParams.category),
        getBranchPerformance(filterParams.startDate, filterParams.endDate, filterParams.category, filterParams.productName),
        getFilteredIssuances(filterParams),
        getFilteredIssuances({ ...filterParams, limit: 10 })
      ])
      
      setMonthlyData(monthly)
      setProductFrequency(frequency)
      setBranchData(branch)
      setAllTransactions(filtered)
      setRecentTransactions(recent)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load report data')
      toast({
        title: "Error",
        description: "Failed to load report data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && user) {
      fetchData()
    }
  }, [authLoading, user, filters])

  const handleExportCSV = async () => {
    try {
      setExporting(true)
      
      // Validate data before export
      const validationResult = validateExportData(allTransactions)
      if (!validationResult.isValid) {
        toast({
          title: "خطأ في البيانات",
          description: validationResult.errors.join(', '),
          variant: "destructive",
        })
        return
      }
      
      // Generate summary statistics
      const summaryStats = generateSummaryStats(validationResult.data)
      
      await exportToCSV({
        data: validationResult.data,
        filename: `تقرير_الإصدارات_${new Date().toISOString().split('T')[0]}`,
        filters,
        summaryStats
      })

      toast({
        title: "تم التصدير بنجاح",
        description: "تم تصدير التقرير إلى ملف CSV مع تفاصيل كاملة",
      })
    } catch (error) {
      console.error('Error exporting to CSV:', error)
      toast({
        title: "خطأ في التصدير",
        description: "فشل في تصدير التقرير",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const handleExportExcel = async () => {
    try {
      setExporting(true)
      
      // Validate data before export
      const validationResult = validateExportData(allTransactions)
      if (!validationResult.isValid) {
        toast({
          title: "خطأ في البيانات",
          description: validationResult.errors.join(', '),
          variant: "destructive",
        })
        return
      }
      
      // Generate summary statistics
      const summaryStats = generateSummaryStats(validationResult.data)
      
      await exportToExcel({
        data: validationResult.data,
        filename: `تقرير_الإصدارات_${new Date().toISOString().split('T')[0]}`,
        filters,
        summaryStats
      })

      toast({
        title: "تم التصدير بنجاح",
        description: "تم تصدير التقرير إلى ملف Excel مع تفاصيل كاملة",
      })
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      toast({
        title: "خطأ في التصدير",
        description: "فشل في تصدير التقرير",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const handleExportPDF = async () => {
    try {
      setExporting(true)
      
      // Validate data before export
      const validationResult = validateExportData(allTransactions)
      if (!validationResult.isValid) {
        toast({
          title: "خطأ في البيانات",
          description: validationResult.errors.join(', '),
          variant: "destructive",
        })
        return
      }
      
      // Generate summary statistics
      const summaryStats = generateSummaryStats(validationResult.data)
      
      await exportToPDF({
        data: validationResult.data,
        filename: `تقرير_الإصدارات_${new Date().toISOString().split('T')[0]}`,
        filters,
        summaryStats,
        chartData: {
          monthlyData,
          productFrequency,
          branchData
        }
      })

      toast({
        title: "تم التصدير بنجاح",
        description: "تم تصدير التقرير إلى ملف PDF مع الرسوم البيانية",
      })
    } catch (error) {
      console.error('Error exporting to PDF:', error)
      toast({
        title: "خطأ في التصدير",
        description: "فشل في تصدير التقرير",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">جاري التحميل...</div>
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">خطأ في تحميل البيانات</h3>
            <p className="text-slate-400">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="page-container flex min-h-screen bg-slate-950 relative overflow-hidden">
        {/* Decorative background */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 [background:radial-gradient(700px_circle_at_100%_0%,rgba(37,99,235,0.20),transparent_60%),radial-gradient(700px_circle_at_0%_100%,rgba(14,165,233,0.20),transparent_60%),radial-gradient(500px_circle_at_50%_50%,rgba(34,197,94,0.10),transparent_60%)]" />
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-green-500/10 rounded-full blur-3xl" />
        </div>
        <Sidebar />
        <div className="flex-1 p-3 sm:p-4 md:p-6 relative">
          <div className="mb-6 sm:mb-8 relative">
            <div className="flex items-center gap-3 sm:gap-4 mb-4">
              <div className="p-2 sm:p-3 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl border border-blue-500/30 backdrop-blur-sm">
                <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">التقارير والتحليلات</h1>
                <p className="text-sm sm:text-base text-slate-300">تقارير شاملة وتحليلات متقدمة للمخزون</p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm mb-4 sm:mb-6 shadow-2xl hover:shadow-blue-500/10 transition-all duration-300">
            <CardHeader className="border-b border-slate-700/50 p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-blue-500/20 rounded-lg">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                </div>
                <CardTitle className="text-white text-sm sm:text-base">فلاتر التقارير</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {/* Enhanced Filtering Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div>
                  <label className="text-xs sm:text-sm text-slate-300">تاريخ البداية</label>
                  <input
                    type="date"
                    className="w-full bg-slate-700 border-slate-600 text-white rounded-md px-2 sm:px-3 py-1.5 sm:py-2 text-sm"
                    value={filters.startDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs sm:text-sm text-slate-300">تاريخ النهاية</label>
                  <input
                    type="date"
                    className="w-full bg-slate-700 border-slate-600 text-white rounded-md px-2 sm:px-3 py-1.5 sm:py-2 text-sm"
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs sm:text-sm text-slate-300">الفرع</label>
                  <Select value={filters.branch} onValueChange={(value) => setFilters(prev => ({ ...prev, branch: value }))}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white h-8 sm:h-10 text-sm">
                      <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="all">جميع الفروع</SelectItem>
                      {branches.map(branch => (
                        <SelectItem key={branch.id} value={branch.id.toString()}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs sm:text-sm text-slate-300">الفئة</label>
                  <Select value={filters.category} onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white h-8 sm:h-10 text-sm">
                      <SelectValue placeholder="اختر الفئة" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="all">جميع الفئات</SelectItem>
                      {CATEGORIES.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Additional Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div>
                  <label className="text-xs sm:text-sm text-slate-300">اسم المنتج</label>
                  <input
                    type="text"
                    className="w-full bg-slate-800/50 border-slate-600/50 text-white rounded-md px-2 sm:px-3 py-1.5 sm:py-2 backdrop-blur-sm focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm"
                    placeholder="البحث بالاسم أو رقم القطعة"
                    value={filters.productName}
                    onChange={(e) => setFilters(prev => ({ ...prev, productName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs sm:text-sm text-slate-300">كود الصنف</label>
                  <input
                    type="text"
                    className="w-full bg-slate-800/50 border-slate-600/50 text-white rounded-md px-2 sm:px-3 py-1.5 sm:py-2 backdrop-blur-sm focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm"
                    placeholder="أدخل كود الصنف"
                    value={filters.itemCode}
                    onChange={(e) => setFilters(prev => ({ ...prev, itemCode: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs sm:text-sm text-slate-300">الرقم التسلسلي</label>
                  <input
                    type="text"
                    className="w-full bg-slate-800/50 border-slate-600/50 text-white rounded-md px-2 sm:px-3 py-1.5 sm:py-2 backdrop-blur-sm focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm"
                    placeholder="أدخل الرقم التسلسلي"
                    value={filters.serialNumber}
                    onChange={(e) => setFilters(prev => ({ ...prev, serialNumber: e.target.value }))}
                  />
                </div>
              </div>
              
              {/* More Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div>
                  <label className="text-xs sm:text-sm text-slate-300">المهندس</label>
                  <input
                    type="text"
                    className="w-full bg-slate-800/50 border-slate-600/50 text-white rounded-md px-2 sm:px-3 py-1.5 sm:py-2 backdrop-blur-sm focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm"
                    placeholder="اسم المهندس"
                    value={filters.engineer}
                    onChange={(e) => setFilters(prev => ({ ...prev, engineer: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs sm:text-sm text-slate-300">العميل</label>
                  <Select value={filters.customer} onValueChange={(value) => setFilters(prev => ({ ...prev, customer: value }))}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white h-8 sm:h-10 text-sm">
                      <SelectValue placeholder="اختر العميل" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="all">جميع العملاء</SelectItem>
                      {customers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id.toString()}>{customer.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs sm:text-sm text-slate-300">المخزن</label>
                  <Select value={filters.warehouse} onValueChange={(value) => setFilters(prev => ({ ...prev, warehouse: value }))}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white h-8 sm:h-10 text-sm">
                      <SelectValue placeholder="اختر المخزن" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="all">جميع المخازن</SelectItem>
                      {warehouses.map(warehouse => (
                        <SelectItem key={warehouse.id} value={warehouse.id.toString()}>{warehouse.name} - {warehouse.warehouse_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Filter Actions */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start sm:items-center">
                  <Button 
                    variant="outline" 
                    className="border-slate-600/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500 transition-all duration-200 backdrop-blur-sm h-8 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm"
                    onClick={() => setFilters({
                      startDate: "",
                      endDate: "",
                      branch: "all",
                      category: "all",
                      productName: "",
                      engineer: "",
                      customer: "all",
                      warehouse: "all",
                      serialNumber: "",
                      itemCode: ""
                    })}
                  >
                    مسح الفلاتر
                  </Button>
                  <div className="text-xs sm:text-sm text-slate-400 flex items-center">
                    عدد النتائج: {allTransactions.length}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <Button 
                    onClick={handleExportCSV} 
                    className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-green-500/25 transition-all duration-200 h-8 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm"
                    disabled={exporting}
                  >
                    <Download className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                    {exporting ? "جاري التصدير..." : "CSV"}
                  </Button>
                  <Button 
                    onClick={handleExportExcel} 
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-blue-500/25 transition-all duration-200 h-8 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm"
                    disabled={exporting}
                  >
                    <Download className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                    {exporting ? "جاري التصدير..." : "Excel"}
                  </Button>
                  <Button 
                    onClick={handleExportPDF} 
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg hover:shadow-red-500/25 transition-all duration-200 h-8 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm"
                    disabled={exporting}
                  >
                    <FileText className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                    {exporting ? "جاري التصدير..." : "PDF"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-slate-800 border-slate-700 animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-slate-700 rounded mb-2"></div>
                    <div className="h-8 bg-slate-700 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
                <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm shadow-xl hover:shadow-blue-500/10 transition-all duration-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
                    <CardTitle className="text-xs sm:text-sm font-medium text-slate-300">إجمالي الإصدارات</CardTitle>
                    <Package className="h-3 w-3 sm:h-4 sm:w-4 text-blue-400" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4">
                    <div className="text-xl sm:text-2xl font-bold text-white">{recentTransactions.length}</div>
                    <p className="text-xs text-slate-400">هذا الشهر</p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm shadow-xl hover:shadow-green-500/10 transition-all duration-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
                    <CardTitle className="text-xs sm:text-sm font-medium text-slate-300">أكثر المنتجات طلباً</CardTitle>
                    <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-400" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4">
                    <div className="text-sm sm:text-lg font-bold text-white">
                      {productFrequency.length > 0 ? productFrequency[0].name : "لا توجد بيانات"}
                    </div>
                    <p className="text-xs text-slate-400">
                      {productFrequency.length > 0 ? `${productFrequency[0].count} إصدار` : ""}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm shadow-xl hover:shadow-purple-500/10 transition-all duration-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
                    <CardTitle className="text-xs sm:text-sm font-medium text-slate-300">أكثر الفروع نشاطاً</CardTitle>
                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-purple-400" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4">
                    <div className="text-sm sm:text-lg font-bold text-white">
                      {branchData.length > 0 ? branchData[0].branch : "لا توجد بيانات"}
                    </div>
                    <p className="text-xs text-slate-400">
                      {branchData.length > 0 ? `${branchData[0].count} إصدار` : ""}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm shadow-xl hover:shadow-orange-500/10 transition-all duration-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
                    <CardTitle className="text-xs sm:text-sm font-medium text-slate-300">معدل النمو</CardTitle>
                    <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-orange-400" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4">
                    <div className="text-xl sm:text-2xl font-bold text-green-400">--</div>
                    <p className="text-xs text-slate-400">يتطلب بيانات تاريخية</p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm shadow-xl hover:shadow-blue-500/10 transition-all duration-300">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-sm sm:text-base text-white">الإصدارات الشهرية</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    {monthlyData.length > 0 ? (
                      <ChartContainer
                        config={{
                          issued: {
                            label: "المصدر",
                            color: "#8884d8",
                          },
                        }}
                        className="h-[250px] sm:h-[300px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyData}>
                            <XAxis dataKey="month" stroke="#64748b" />
                            <YAxis stroke="#64748b" />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="issued" fill="#8884d8" />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <div className="h-[250px] sm:h-[300px] flex items-center justify-center text-slate-400 text-sm">
                        لا توجد بيانات للعرض
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm shadow-xl hover:shadow-green-500/10 transition-all duration-300">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-sm sm:text-base text-white">أكثر المنتجات طلباً</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    {productFrequency.length > 0 ? (
                      <ChartContainer
                        config={{
                          count: {
                            label: "العدد",
                          },
                        }}
                        className="h-[250px] sm:h-[300px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={productFrequency} cx="50%" cy="50%" outerRadius={80} dataKey="count">
                              {productFrequency.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 50%)`} />
                              ))}
                            </Pie>
                            <ChartTooltip content={<ChartTooltipContent />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <div className="h-[250px] sm:h-[300px] flex items-center justify-center text-slate-400 text-sm">
                        لا توجد بيانات للعرض
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Branch Performance */}
              <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm mb-4 sm:mb-6 shadow-xl hover:shadow-purple-500/10 transition-all duration-300">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-sm sm:text-base text-white">أداء الفروع</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  {branchData.length > 0 ? (
                    <ChartContainer
                      config={{
                        count: {
                          label: "عدد الإصدارات",
                          color: "#8884d8",
                        },
                      }}
                      className="h-[250px] sm:h-[300px]"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={branchData} layout="horizontal">
                          <XAxis type="number" stroke="#64748b" />
                          <YAxis dataKey="branch" type="category" stroke="#64748b" width={100} className="text-xs sm:text-sm" />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="count" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  ) : (
                    <div className="h-[250px] sm:h-[300px] flex items-center justify-center text-slate-400 text-sm">
                      لا توجد بيانات للعرض
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Transactions */}
              <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm shadow-xl hover:shadow-blue-500/10 transition-all duration-300">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-sm sm:text-base text-white">المعاملات الأخيرة</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  {recentTransactions.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700/50 bg-slate-800/30">
                            <TableHead className="text-slate-300 font-semibold text-xs sm:text-sm">التاريخ</TableHead>
                            <TableHead className="text-slate-300 font-semibold text-xs sm:text-sm">المنتج</TableHead>
                            <TableHead className="text-slate-300 font-semibold text-xs sm:text-sm hidden sm:table-cell">العميل</TableHead>
                            <TableHead className="text-slate-300 font-semibold text-xs sm:text-sm">الفرع</TableHead>
                            <TableHead className="text-slate-300 font-semibold text-xs sm:text-sm">الكمية</TableHead>
                            <TableHead className="text-slate-300 font-semibold text-xs sm:text-sm hidden md:table-cell">المهندس</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentTransactions.map((transaction) => (
                            <TableRow key={transaction.id} className="border-slate-700/50 hover:bg-slate-800/30 transition-colors duration-200">
                              <TableCell className="text-slate-300 text-xs sm:text-sm">
                                {new Date(transaction.created_at).toLocaleDateString("en-US")}
                              </TableCell>
                              <TableCell className="text-white font-medium text-xs sm:text-sm">
                                {transaction.product_name || transaction.productName}
                              </TableCell>
                              <TableCell className="text-slate-300 text-xs sm:text-sm hidden sm:table-cell">
                                {transaction.customer_name || transaction.customerName}
                              </TableCell>
                              <TableCell className="text-slate-300 text-xs sm:text-sm">{transaction.branch}</TableCell>
                              <TableCell className="text-white">
                                <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">{transaction.quantity}</Badge>
                              </TableCell>
                              <TableCell className="text-slate-300 text-xs sm:text-sm hidden md:table-cell">{transaction.engineer}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 sm:py-12 text-slate-400">
                      <Package className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-slate-500" />
                      <p className="text-base sm:text-lg font-medium mb-2">لا توجد معاملات للعرض</p>
                      <p className="text-xs sm:text-sm">قم بتعديل الفلاتر لعرض البيانات المطلوبة</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}
