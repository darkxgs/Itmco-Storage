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
import { getMonthlyIssuances, getProductFrequency, getBranchPerformance, getIssuances } from "@/lib/database"
import { ErrorBoundary } from "@/components/error-boundary"

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth()
  const [selectedPeriod, setSelectedPeriod] = useState("monthly")
  const [selectedBranch, setSelectedBranch] = useState("all")
  const { toast } = useToast()

  const [monthlyData, setMonthlyData] = useState([])
  const [productFrequency, setProductFrequency] = useState([])
  const [branchData, setBranchData] = useState([])
  const [recentTransactions, setRecentTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user && !["admin", "inventory_manager"].includes(user.role)) {
      window.location.href = "/dashboard"
    }
  }, [user])

  useEffect(() => {
    const loadReportsData = async () => {
      if (!user) return

      try {
        setLoading(true)
        setError(null)

        const [monthly, products, branches, transactions] = await Promise.all([
          getMonthlyIssuances(),
          getProductFrequency(),
          getBranchPerformance(),
          getIssuances(),
        ])

        setMonthlyData(monthly)
        setProductFrequency(products)
        setBranchData(branches)
        setRecentTransactions(transactions.slice(0, 10))
      } catch (error) {
        console.error("Error loading reports data:", error)
        setError("فشل في تحميل بيانات التقارير")
      } finally {
        setLoading(false)
      }
    }

    loadReportsData()
  }, [user])

  const handleExportExcel = () => {
    // Create CSV content
    const csvData = [
      ["التاريخ", "المنتج", "العميل", "الفرع", "الكمية", "المهندس"],
      ...recentTransactions.map((t) => [
        new Date(t.created_at).toLocaleDateString("ar-SA"),
        t.product_name || t.productName,
        t.customer_name || t.customerName,
        t.branch,
        t.quantity,
        t.engineer,
      ]),
    ]

    const csvContent = csvData.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `reports_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "تصدير Excel",
      description: "تم تصدير التقرير بصيغة CSV بنجاح",
    })
  }

  const handleExportPDF = () => {
    toast({
      title: "تصدير PDF",
      description: "ميزة تصدير PDF ستكون متاحة قريباً",
    })
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
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="grid gap-2 flex-1">
                  <label className="text-sm text-slate-300">الفترة الزمنية</label>
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="daily">يومي</SelectItem>
                      <SelectItem value="weekly">أسبوعي</SelectItem>
                      <SelectItem value="monthly">شهري</SelectItem>
                      <SelectItem value="yearly">سنوي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 flex-1">
                  <label className="text-sm text-slate-300">الفرع</label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="all">جميع الفروع</SelectItem>
                      {branchData.map((branch) => (
                        <SelectItem key={branch.branch} value={branch.branch}>
                          {branch.branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700">
                    <Download className="w-4 h-4 ml-2" />
                    CSV
                  </Button>
                  <Button onClick={handleExportPDF} className="bg-red-600 hover:bg-red-700">
                    <FileText className="w-4 h-4 ml-2" />
                    PDF
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
                                {new Date(transaction.created_at).toLocaleDateString("ar-SA")}
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
