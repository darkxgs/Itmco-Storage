"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  LayoutDashboard,
  Package,
  FileText,
  Users,
  Settings,
  LogOut,
  Search,
  Database,
  ChevronLeft,
  ChevronRight,
  Bell,
  Menu,
  X,
  Building2,
  UserCheck,
  BarChart3,
  Warehouse,
  Tag,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
} from "lucide-react"
import { supabase } from "@/lib/supabase"

const navigation = [
  {
    name: "لوحة التحكم",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "inventory_manager", "engineer"],
  },
  {
    name: "إدارة المخزون",
    href: "/inventory",
    icon: Package,
    roles: ["admin", "inventory_manager"],
  },
  {
    name: "المخازن",
    href: "/warehouses",
    icon: Warehouse,
    roles: ["admin", "inventory_manager"],
  },
  {
    name: "الفئات",
    href: "/categories",
    icon: Tag,
    roles: ["admin", "inventory_manager"],
  },
  {
    name: "الإصدارات",
    href: "/issuance",
    icon: FileText,
    roles: ["admin", "engineer", "inventory_manager"],
  },
  {
    name: "البحث المتقدم",
    href: "/search",
    icon: Search,
    roles: ["admin", "inventory_manager", "engineer"],
  },
  {
    name: "إدارة المستخدمين",
    href: "/users",
    icon: Users,
    roles: ["admin"],
  },
  {
    name: "إدارة العملاء",
    href: "/customers",
    icon: UserCheck,
    roles: ["admin"],
  },
  {
    name: "إدارة الفروع",
    href: "/branches",
    icon: Building2,
    roles: ["admin"],
  },
  {
    name: "صلاحيات المخازن",
    href: "/warehouse-permissions",
    icon: UserCheck,
    roles: ["admin"],
  },
  {
    name: "التقارير",
    href: "/reports",
    icon: FileText,
    roles: ["admin", "inventory_manager"],
  },
  {
    name: "تقارير هامش الربح",
    href: "/reports/profit-margin",
    icon: BarChart3,
    roles: ["admin", "inventory_manager"],
  },
  {
    name: "النسخ الاحتياطي",
    href: "/backup",
    icon: Database,
    roles: ["admin"],
  },
  {
    name: "الإعدادات",
    href: "/settings",
    icon: Settings,
    roles: ["admin"],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifications, setNotifications] = useState<Array<{id: number, title: string, message: string, type: 'warning' | 'info' | 'success', time: string, read: boolean, productId?: number}>>([])
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [dismissedIds, setDismissedIds] = useState<number[]>([])

  // Load dismissed notifications from localStorage
  useEffect(() => {
    const dismissed = localStorage.getItem('dismissedNotifications')
    if (dismissed) {
      setDismissedIds(JSON.parse(dismissed))
    }
  }, [])

  // Fetch low stock products from database
  const fetchLowStockNotifications = useCallback(async () => {
    if (!user) return
    
    setLoadingNotifications(true)
    try {
      // Get all products and filter in JS (Supabase can't compare columns directly)
      const { data: allProducts, error } = await supabase
        .from('products')
        .select('id, name, stock, min_stock, item_code')
        .order('stock', { ascending: true })

      if (error) {
        console.error('Error fetching products:', error)
        return
      }

      // Filter products that are low stock (stock <= min_stock) or out of stock
      const lowStockProducts = (allProducts || []).filter(p => {
        const minStock = p.min_stock || 5
        return p.stock <= minStock
      })

      // Create alerts from low stock products (not dismissed)
      const alerts = lowStockProducts
        .filter(p => !dismissedIds.includes(p.id))
        .slice(0, 20) // Limit to 20
        .map((product) => ({
          id: product.id,
          productId: product.id,
          title: product.stock === 0 ? "⚠️ نفاد المخزون" : "تنبيه مخزون منخفض",
          message: `${product.name} ${product.item_code ? `(${product.item_code})` : ''} - الكمية: ${product.stock}`,
          type: product.stock === 0 ? 'warning' as const : 'info' as const,
          time: product.stock === 0 ? "نفاد كامل" : `الحد الأدنى: ${product.min_stock || 5}`,
          read: false
        }))

      setNotifications(alerts)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoadingNotifications(false)
    }
  }, [user, dismissedIds])

  // Fetch notifications on mount and when user changes
  useEffect(() => {
    fetchLowStockNotifications()
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchLowStockNotifications, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchLowStockNotifications])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAsRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? {...n, read: true} : n))
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({...n, read: true})))
  }

  const dismissNotification = (id: number) => {
    const newDismissed = [...dismissedIds, id]
    setDismissedIds(newDismissed)
    localStorage.setItem('dismissedNotifications', JSON.stringify(newDismissed))
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const clearAllDismissed = () => {
    setDismissedIds([])
    localStorage.removeItem('dismissedNotifications')
    fetchLowStockNotifications()
  }

  // Auto-collapse on medium widths and short heights to maximize content area
  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return
      const w = window.innerWidth
      const h = window.innerHeight
      const shouldCollapse = (w >= 1024 && w < 1280) || h < 700
      setCollapsed(shouldCollapse)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const handleLogout = () => {
    logout()
  }

  const filteredNavigation = navigation.filter((item) => (user ? item.roles.includes(user.role) : false))

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-slate-700">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div className="text-white font-semibold">ITMCO</div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-white hidden lg:flex"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMobileOpen(false)}
          className="text-slate-400 hover:text-white lg:hidden"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* User Info */}
      {user && user.name && !collapsed && (
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center">
              <span className="text-white font-medium text-sm">{user.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{user.name}</p>
              <p className="text-slate-400 text-sm truncate">
                {user.role === "admin" && "مدير النظام"}
                {user.role === "inventory_manager" && "مدير المخزون"}
                {user.role === "engineer" && "مهندس"}
              </p>
            </div>
            <Dialog open={notificationOpen} onOpenChange={setNotificationOpen}>
              <DialogTrigger asChild>
                <button className="relative p-2 rounded-lg hover:bg-slate-700 transition-colors">
                  <Bell className="w-5 h-5 text-slate-400 hover:text-white" />
                  {unreadCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-[10px]"
                    >
                      {unreadCount}
                    </Badge>
                  )}
                </button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                      <Bell className="w-5 h-5" />
                      تنبيهات المخزون
                    </div>
                    <button 
                      onClick={fetchLowStockNotifications}
                      disabled={loadingNotifications}
                      className="p-2 rounded hover:bg-slate-700 transition-colors"
                      title="تحديث"
                    >
                      <RefreshCw className={cn("w-4 h-4 text-slate-400", loadingNotifications && "animate-spin")} />
                    </button>
                  </DialogTitle>
                </DialogHeader>
                
                <div className="max-h-[400px] overflow-y-auto -mx-6 px-6">
                  {loadingNotifications ? (
                    <div className="p-6 text-center text-slate-400">
                      <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" />
                      <p>جاري تحميل التنبيهات...</p>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-400">
                      <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                      <p className="text-lg font-medium text-white">لا توجد تنبيهات</p>
                      <p className="text-sm mt-1">جميع المنتجات في مستوى آمن ✓</p>
                      {dismissedIds.length > 0 && (
                        <button 
                          onClick={clearAllDismissed}
                          className="text-sm text-blue-400 hover:text-blue-300 mt-4 underline"
                        >
                          إظهار التنبيهات المخفية ({dismissedIds.length})
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {unreadCount > 0 && (
                        <div className="flex justify-end mb-2">
                          <button 
                            onClick={markAllAsRead}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            تحديد الكل كمقروء
                          </button>
                        </div>
                      )}
                      {notifications.map((notification) => (
                        <div 
                          key={notification.id}
                          className={cn(
                            "p-3 rounded-lg border transition-colors",
                            !notification.read 
                              ? "bg-slate-700/50 border-slate-600" 
                              : "bg-slate-800/50 border-slate-700/50"
                          )}
                        >
                          <div className="flex gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                              notification.type === 'warning' && "bg-red-500/20",
                              notification.type === 'info' && "bg-yellow-500/20",
                              notification.type === 'success' && "bg-green-500/20"
                            )}>
                              {notification.type === 'warning' && <AlertTriangle className="w-5 h-5 text-red-400" />}
                              {notification.type === 'info' && <AlertTriangle className="w-5 h-5 text-yellow-400" />}
                              {notification.type === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={cn(
                                  "text-sm",
                                  notification.read ? "text-slate-300" : "text-white font-medium"
                                )}>
                                  {notification.title}
                                </p>
                                <button
                                  onClick={() => dismissNotification(notification.id)}
                                  className="text-slate-500 hover:text-slate-300 p-1 -mt-1 -mr-1"
                                  title="إخفاء"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              <p className="text-sm text-slate-400 mt-1">{notification.message}</p>
                              <p className="text-xs text-slate-500 mt-2">{notification.time}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between items-center pt-4 border-t border-slate-700 -mx-6 px-6">
                  <Link href="/inventory" onClick={() => setNotificationOpen(false)}>
                    <button className="text-sm text-blue-400 hover:text-blue-300">
                      عرض المخزون ←
                    </button>
                  </Link>
                  {dismissedIds.length > 0 && (
                    <button 
                      onClick={clearAllDismissed}
                      className="text-xs text-slate-400 hover:text-slate-300"
                    >
                      إظهار المخفية ({dismissedIds.length})
                    </button>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {filteredNavigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link key={item.name} href={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 text-right",
                  isActive ? "bg-slate-700 text-white" : "text-slate-300 hover:text-white hover:bg-slate-800",
                  collapsed && "justify-center px-2",
                )}
                onClick={() => setMobileOpen(false)}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </Button>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className={cn(
            "w-full justify-start gap-3 text-slate-300 hover:text-white hover:bg-slate-800",
            collapsed && "justify-center px-2",
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>تسجيل الخروج</span>}
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 right-4 z-50 lg:hidden bg-slate-800 text-white"
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Desktop sidebar */}
      <div
        className={cn(
          "hidden lg:flex flex-col bg-slate-900 border-l border-slate-700 transition-all duration-300 flex-shrink-0",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <SidebarContent />
      </div>

      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-64 bg-slate-900 border-l border-slate-700 transform transition-transform duration-300 lg:hidden flex-shrink-0",
          mobileOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <SidebarContent />
      </div>
    </>
  )
}
