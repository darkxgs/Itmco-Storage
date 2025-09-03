"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
} from "lucide-react"

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
    name: "الإصدارات",
    href: "/issuance",
    icon: FileText,
    roles: ["admin", "engineer"],
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
  const [notifications, setNotifications] = useState(0)

  useEffect(() => {
    // Simulate notifications count
    setNotifications(3)
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
            {notifications > 0 && (
              <div className="relative">
                <Bell className="w-5 h-5 text-slate-400" />
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 w-5 h-5 p-0 flex items-center justify-center text-xs"
                >
                  {notifications}
                </Badge>
              </div>
            )}
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
          "hidden lg:flex flex-col bg-slate-900 border-l border-slate-700 transition-all duration-300",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <SidebarContent />
      </div>

      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-64 bg-slate-900 border-l border-slate-700 transform transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <SidebarContent />
      </div>
    </>
  )
}
