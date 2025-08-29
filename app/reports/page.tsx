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
      <div className="flex min-h-screen bg-slate-900">
        <Sidebar />
        <div className="flex-1 p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">التقارير والتحليلات</h1>
            <p className="text-slate-300">تقارير شاملة وتحليلات متقدمة للمخزون</p>
          </div>

          {/* Controls */}
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white">فلاتر التقارير</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Enhanced Filtering Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="text-sm text-slate-300">تاريخ البداية</label>
                  <input
                    type="date"
                    className="w-full bg-slate-700 border-slate-600 text-white rounded-md px-3 py-2"
                    value={filters.startDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-300">تاريخ النهاية</label>
                  <input
                    type="date"
                    className="w-full bg-slate-700 border-slate-600 text-white rounded-md px-3 py-2"
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-300">الفرع</label>
                  <Select value={filters.branch} onValueChange={(value) => setFilters(prev => ({ ...prev, branch: value }))}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
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
                  <label className="text-sm text-slate-300">الفئة</label>
                  <Select value={filters.category} onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="text-sm text-slate-300">اسم المنتج</label>
                  <input
                    type="text"
                    className="w-full bg-slate-700 border-slate-600 text-white rounded-md px-3 py-2"
                    placeholder="البحث بالاسم أو رقم القطعة"
                    value={filters.productName}
                    onChange={(e) => setFilters(prev => ({ ...prev, productName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-300">كود الصنف</label>
                  <input
                    type="text"
                    className="w-full bg-slate-700 border-slate-600 text-white rounded-md px-3 py-2"
                    placeholder="أدخل كود الصنف"
                    value={filters.itemCode}
                    onChange={(e) => setFilters(prev => ({ ...prev, itemCode: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-300">الرقم التسلسلي</label>
                  <input
                    type="text"
                    className="w-full bg-slate-700 border-slate-600 text-white rounded-md px-3 py-2"
                    placeholder="أدخل الرقم التسلسلي"
                    value={filters.serialNumber}
                    onChange={(e) => setFilters(prev => ({ ...prev, serialNumber: e.target.value }))}
                  />
                </div>
              </div>
              
              {/* More Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="text-sm text-slate-300">المهندس</label>
                  <input
                    type="text"
                    className="w-full bg-slate-700 border-slate-600 text-white rounded-md px-3 py-2"
                    placeholder="اسم المهندس"
                    value={filters.engineer}
                    onChange={(e) => setFilters(prev => ({ ...prev, engineer: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-300">العميل</label>
                  <Select value={filters.customer} onValueChange={(value) => setFilters(prev => ({ ...prev, customer: value }))}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
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
                  <label className="text-sm text-slate-300">المخزن</label>
                  <Select value={filters.warehouse} onValueChange={(value) => setFilters(prev => ({ ...prev, warehouse: value }))}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
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
              <div className="flex gap-2 items-center justify-between">
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
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
                  <div className="text-sm text-slate-400 flex items-center">
                    عدد النتائج: {allTransactions.length}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleExportCSV} 
                    className="bg-green-600 hover:bg-green-700"
                    disabled={exporting}
                  >
                    <Download className="w-4 h-4 ml-2" />
                    {exporting ? "جاري التصدير..." : "CSV"}
                  </Button>
                  <Button 
                    onClick={handleExportExcel} 
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={exporting}
                  >
                    <Download className="w-4 h-4 ml-2" />
                    {exporting ? "جاري التصدير..." : "Excel"}
                  </Button>
                  <Button 
                    onClick={handleExportPDF} 
                    className="bg-red-600 hover:bg-red-700"
                    disabled={exporting}
                  >
                    <FileText className="w-4 h-4 ml-2" />
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-300">إجمالي الإصدارات</CardTitle>
                    <Package className="h-4 w-4 text-blue-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">{recentTransactions.length}</div>
                    <p className="text-xs text-slate-400">هذا الشهر</p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-300">أكثر المنتجات طلباً</CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-white">
                      {productFrequency.length > 0 ? productFrequency[0].name : "لا توجد بيانات"}
                    </div>
                    <p className="text-xs text-slate-400">
                      {productFrequency.length > 0 ? `${productFrequency[0].count} إصدار` : ""}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-300">أكثر الفروع نشاطاً</CardTitle>
                    <Calendar className="h-4 w-4 text-purple-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-white">
                      {branchData.length > 0 ? branchData[0].branch : "لا توجد بيانات"}
                    </div>
                    <p className="text-xs text-slate-400">
                      {branchData.length > 0 ? `${branchData[0].count} إصدار` : ""}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-300">معدل النمو</CardTitle>
                    <TrendingUp className="h-4 w-4 text-orange-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-400">--</div>
                    <p className="text-xs text-slate-400">يتطلب بيانات تاريخية</p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">الإصدارات الشهرية</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {monthlyData.length > 0 ? (
                      <ChartContainer
                        config={{
                          issued: {
                            label: "المصدر",
                            color: "#8884d8",
                          },
                        }}
                        className="h-[300px]"
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
                      <div className="h-[300px] flex items-center justify-center text-slate-400">
                        لا توجد بيانات للعرض
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">أكثر المنتجات طلباً</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {productFrequency.length > 0 ? (
                      <ChartContainer
                        config={{
                          count: {
                            label: "العدد",
                          },
                        }}
                        className="h-[300px]"
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
                      <div className="h-[300px] flex items-center justify-center text-slate-400">
                        لا توجد بيانات للعرض
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Branch Performance */}
              <Card className="bg-slate-800 border-slate-700 mb-6">
                <CardHeader>
                  <CardTitle className="text-white">أداء الفروع</CardTitle>
                </CardHeader>
                <CardContent>
                  {branchData.length > 0 ? (
                    <ChartContainer
                      config={{
                        count: {
                          label: "عدد الإصدارات",
                          color: "#8884d8",
                        },
                      }}
                      className="h-[300px]"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={branchData} layout="horizontal">
                          <XAxis type="number" stroke="#64748b" />
                          <YAxis dataKey="branch" type="category" stroke="#64748b" width={150} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="count" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-slate-400">
                      لا توجد بيانات للعرض
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Transactions */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">المعاملات الأخيرة</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentTransactions.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700">
                            <TableHead className="text-slate-300">التاريخ</TableHead>
                            <TableHead className="text-slate-300">المنتج</TableHead>
                            <TableHead className="text-slate-300">العميل</TableHead>
                            <TableHead className="text-slate-300">الفرع</TableHead>
                            <TableHead className="text-slate-300">الكمية</TableHead>
                            <TableHead className="text-slate-300">المهندس</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentTransactions.map((transaction) => (
                            <TableRow key={transaction.id} className="border-slate-700">
                              <TableCell className="text-slate-300">
                                {new Date(transaction.created_at).toLocaleDateString("en-US")}
                              </TableCell>
                              <TableCell className="text-white font-medium">
                                {transaction.product_name || transaction.productName}
                              </TableCell>
                              <TableCell className="text-slate-300">
                                {transaction.customer_name || transaction.customerName}
                              </TableCell>
                              <TableCell className="text-slate-300">{transaction.branch}</TableCell>
                              <TableCell className="text-white">
                                <Badge variant="secondary">{transaction.quantity}</Badge>
                              </TableCell>
                              <TableCell className="text-slate-300">{transaction.engineer}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400">لا توجد معاملات للعرض</div>
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
