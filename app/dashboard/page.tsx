"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, TrendingUp, AlertTriangle, Users, RefreshCw, BarChart3 as BarChartIcon } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, Line, LineChart, Pie, PieChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import {
  getDashboardStats,
  getMonthlyIssuances,
  getProductFrequency,
  getBranchPerformance,
  getActivityLogs,
  getMonthlyStockData,
  getWeeklyIssuanceData,
} from "@/lib/database"
import { ErrorBoundary } from "@/components/error-boundary"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()

  const [stats, setStats] = useState({
    totalProducts: 0,
    totalStock: 0,
    todayIssuances: 0,
    lowStockCount: 0,
  })
  const [monthlyStockData, setMonthlyStockData] = useState([])
  const [weeklyIssuanceData, setWeeklyIssuanceData] = useState([])
  const [monthlyData, setMonthlyData] = useState([])
  const [productData, setProductData] = useState([])
  const [branchData, setBranchData] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Remove the manual user loading effect since useAuth handles it

  const loadDashboardData = async (showRefreshToast = false) => {
    if (!user) return

    try {
      setLoading(!showRefreshToast)
      setRefreshing(showRefreshToast)
      setError(null)

      const [statsData, monthlyStats, productStats, branchStats, activityData, stockData, issuanceData] =
        await Promise.all([
          getDashboardStats(),
          getMonthlyIssuances(),
          getProductFrequency(),
          getBranchPerformance(),
          getActivityLogs(10),
          getMonthlyStockData(),
          getWeeklyIssuanceData(),
        ])

      setStats(statsData)
      setMonthlyData(monthlyStats)
      setProductData(productStats)
      setBranchData(branchStats)
      setRecentActivity(activityData)
      setMonthlyStockData(stockData)
      setWeeklyIssuanceData(issuanceData)

      if (showRefreshToast) {
        toast({
          title: "تم التحديث",
          description: "تم تحديث بيانات لوحة التحكم بنجاح",
        })
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error)
      setError("فشل في تحميل بيانات لوحة التحكم")
      toast({
        title: "خطأ في التحميل",
        description: "فشل في تحميل بيانات لوحة التحكم",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [user])

  const handleRefresh = () => {
    loadDashboardData(true)
  }

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  if (error && !loading) {
    return (
      <div className="flex min-h-screen bg-slate-900">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Card className="bg-slate-800 border-slate-700 max-w-md">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">خطأ في تحميل البيانات</h3>
              <p className="text-slate-400 mb-4">{error}</p>
              <Button onClick={() => loadDashboardData()} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                إعادة المحاولة
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen bg-slate-950 relative overflow-hidden">
        {/* Decorative background */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 [background:radial-gradient(700px_circle_at_100%_0%,rgba(37,99,235,0.12),transparent_60%),radial-gradient(700px_circle_at_0%_100%,rgba(14,165,233,0.1),transparent_60%)]" />
        <Sidebar />
        <div className="flex-1 p-3 sm:p-4 lg:p-6 relative">
          {/* Header */}
          <div className="mb-4 sm:mb-6 lg:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 sm:mb-2">لوحة التحكم</h1>
              <p className="text-sm sm:text-base text-slate-300">مرحباً {user.name} - نظرة عامة على النظام</p>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white border-transparent hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg text-sm sm:text-base px-3 sm:px-4 py-2 sm:py-2.5 w-full sm:w-auto"
            >
              <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              تحديث
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-slate-800 border-slate-700 animate-pulse">
                  <CardContent className="p-3 sm:p-4 lg:p-6">
                    <div className="h-3 sm:h-4 bg-slate-700 rounded mb-2"></div>
                    <div className="h-6 sm:h-8 bg-slate-700 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {/* Stats Cards with improved styling */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20 hover:border-blue-500/40 rounded-xl shadow-md hover:shadow-xl transition-all hover:-translate-y-0.5">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-4 lg:p-6">
                    <CardTitle className="text-xs sm:text-sm font-medium text-slate-300">إجمالي المخزون</CardTitle>
                    <Package className="h-3 w-3 sm:h-4 sm:w-4 text-blue-400" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold text-white">{stats.totalStock.toLocaleString()}</div>
                    <p className="text-xs text-slate-400">المنتجات المتوفرة</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20 hover:border-green-500/40 rounded-xl shadow-md hover:shadow-xl transition-all hover:-translate-y-0.5">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-4 lg:p-6">
                    <CardTitle className="text-xs sm:text-sm font-medium text-slate-300">المنتجات المصدرة اليوم</CardTitle>
                    <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-400" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold text-white">{stats.todayIssuances}</div>
                    <p className="text-xs text-slate-400">إصدارات اليوم</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-orange-500/20 hover:border-orange-500/40 rounded-xl shadow-md hover:shadow-xl transition-all hover:-translate-y-0.5">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-4 lg:p-6">
                    <CardTitle className="text-xs sm:text-sm font-medium text-slate-300">تنبيهات المخزون المنخفض</CardTitle>
                    <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-orange-400" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-400">{stats.lowStockCount}</div>
                    <p className="text-xs text-slate-400">يتطلب إعادة تموين</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20 hover:border-purple-500/40 rounded-xl shadow-md hover:shadow-xl transition-all hover:-translate-y-0.5">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-4 lg:p-6">
                    <CardTitle className="text-xs sm:text-sm font-medium text-slate-300">إجمالي المنتجات</CardTitle>
                    <Users className="h-3 w-3 sm:h-4 sm:w-4 text-purple-400" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold text-white">{stats.totalProducts}</div>
                    <p className="text-xs text-slate-400">أنواع المنتجات</p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts with improved empty states */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
                <Card className="bg-slate-800/70 backdrop-blur border-slate-700 rounded-xl shadow-md">
                  <CardHeader className="p-3 sm:p-4 lg:p-6">
                    <CardTitle className="text-white text-sm sm:text-base lg:text-lg">حركة المخزون الشهرية</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                    {monthlyStockData.length > 0 ? (
                      <ChartContainer
                        config={{
                          stock: {
                            label: "المخزون",
                            color: "#8884d8",
                          },
                        }}
                        className="h-[200px] sm:h-[250px] lg:h-[300px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={monthlyStockData}>
                            <XAxis dataKey="name" stroke="#64748b" />
                            <YAxis stroke="#64748b" />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Line type="monotone" dataKey="stock" stroke="#8884d8" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <div className="h-[200px] sm:h-[250px] lg:h-[300px] flex flex-col items-center justify-center text-slate-400">
                        <Package className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 mb-3 sm:mb-4 opacity-50" />
                        <p className="text-sm sm:text-base lg:text-lg font-medium mb-1 sm:mb-2">لا توجد بيانات للعرض</p>
                        <p className="text-xs sm:text-sm text-center px-4">ابدأ بإضافة منتجات لرؤية الإحصائيات</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/70 backdrop-blur border-slate-700 rounded-xl shadow-md">
                  <CardHeader className="p-3 sm:p-4 lg:p-6">
                    <CardTitle className="text-white text-sm sm:text-base lg:text-lg">توزيع المنتجات</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                    {productData.length > 0 ? (
                      <ChartContainer
                        config={{
                          value: {
                            label: "النسبة",
                          },
                        }}
                        className="h-[200px] sm:h-[250px] lg:h-[300px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={productData} cx="50%" cy="50%" outerRadius={80} dataKey="count">
                              {productData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 50%)`} />
                              ))}
                            </Pie>
                            <ChartTooltip content={<ChartTooltipContent />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <div className="h-[200px] sm:h-[250px] lg:h-[300px] flex flex-col items-center justify-center text-slate-400">
                        <TrendingUp className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 mb-3 sm:mb-4 opacity-50" />
                        <p className="text-sm sm:text-base lg:text-lg font-medium mb-1 sm:mb-2">لا توجد بيانات للعرض</p>
                        <p className="text-xs sm:text-sm text-center px-4">ابدأ بإصدار منتجات لرؤية التوزيع</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity & Weekly Issuances */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                <Card className="bg-slate-800/70 backdrop-blur border-slate-700 rounded-xl shadow-md xl:col-span-2">
                  <CardHeader className="p-3 sm:p-4 lg:p-6">
                    <CardTitle className="text-white text-sm sm:text-base lg:text-lg">الإصدارات الأسبوعية</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                    {weeklyIssuanceData.length > 0 ? (
                      <ChartContainer
                        config={{
                          issued: {
                            label: "المصدر",
                            color: "#82ca9d",
                          },
                        }}
                        className="h-[200px] sm:h-[250px] lg:h-[300px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={weeklyIssuanceData}>
                            <XAxis dataKey="name" stroke="#64748b" />
                            <YAxis stroke="#64748b" />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="issued" fill="#82ca9d" />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <div className="h-[200px] sm:h-[250px] lg:h-[300px] flex flex-col items-center justify-center text-slate-400">
                        <BarChartIcon className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 mb-3 sm:mb-4 opacity-50" />
                        <p className="text-sm sm:text-base lg:text-lg font-medium mb-1 sm:mb-2">لا توجد إصدارات هذا الأسبوع</p>
                        <p className="text-xs sm:text-sm text-center px-4">ابدأ بإصدار منتجات لرؤية الإحصائيات</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/70 backdrop-blur border-slate-700 rounded-xl shadow-md">
                  <CardHeader className="p-3 sm:p-4 lg:p-6">
                    <CardTitle className="text-white text-sm sm:text-base lg:text-lg">النشاط الأخير</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                    <div className="space-y-3 sm:space-y-4 max-h-[200px] sm:max-h-[250px] lg:max-h-[300px] overflow-y-auto">
                      {recentActivity.length > 0 ? (
                        recentActivity.map((activity) => (
                          <div
                            key={activity.id}
                            className="flex items-start space-x-3 sm:space-x-4 space-x-reverse p-2.5 sm:p-3.5 bg-slate-700/30 hover:bg-slate-700/40 transition-colors rounded-lg"
                          >
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full mt-1.5 sm:mt-2 flex-shrink-0"></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm text-white font-medium truncate">{activity.action}</p>
                              <p className="text-xs text-slate-400 mt-1">
                                {activity.user_name} • {new Date(activity.created_at).toLocaleString("ar-SA")}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-slate-400 py-6 sm:py-8">
                          <Users className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-xs sm:text-sm">لا توجد أنشطة حديثة</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}
