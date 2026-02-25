"use client"

import { useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Package, Loader2 } from "lucide-react"
import { loadUserFromStorage } from "@/lib/utils"

export default function HomePage() {
  useEffect(() => {
    const checkAuth = () => {
      const user = loadUserFromStorage()
      if (user) {
        window.location.href = "/dashboard"
      } else {
        window.location.href = "/login"
      }
    }

    // Small delay to prevent flash
    const timer = setTimeout(checkAuth, 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center">
              <Package className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">نظام إدارة المخزون</h1>
          <p className="text-slate-300 mb-6">ITMCO</p>
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>جاري التحميل...</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
