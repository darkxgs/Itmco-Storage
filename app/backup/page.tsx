"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Download,
  Upload,
  Database,
  Clock,
  Shield,
  AlertTriangle,
  CheckCircle,
  Calendar,
  HardDrive,
  Loader2,
} from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { apiFetch } from "@/lib/api-client"

interface StoredBackup {
  name: string
  size: number
  createdAt: string
  type: "auto" | "manual"
}

// Rows per restore request; keeps each request well under Vercel's ~4.5 MB body limit
const RESTORE_CHUNK_ROWS = 1000

const TABLE_NAMES: Record<string, string> = {
  warehouses: "المخازن",
  categories: "الفئات",
  customers: "العملاء",
  branches: "الفروع",
  users: "المستخدمين",
  products: "المنتجات",
  issuances: "الإصدارات",
  release_items: "عناصر الإصدار",
  stock_entries: "إدخالات المخزون",
  user_warehouse_permissions: "صلاحيات المخازن",
  activity_logs: "سجل النشاطات",
}

const formatFileSize = (bytes: number) => {
  if (!bytes) return "0 KB"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

const formatTimestamp = (iso: string) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        timeZone: "Africa/Cairo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-"

// Backups are saved gzipped; older ones may be plain JSON
async function readBackupFile(file: File) {
  if (file.name.endsWith(".gz")) {
    const stream = file.stream().pipeThrough(new DecompressionStream("gzip"))
    return JSON.parse(await new Response(stream).text())
  }
  return JSON.parse(await file.text())
}

export default function BackupPage() {
  const { user } = useAuth()
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreProgress, setRestoreProgress] = useState("")
  const [restoreData, setRestoreData] = useState<any>(null)
  const [backups, setBackups] = useState<StoredBackup[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const { toast } = useToast()

  const loadBackups = useCallback(async () => {
    setLoadingList(true)
    try {
      const response = await apiFetch("/api/backup")
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "فشل تحميل قائمة النسخ")
      setBackups(result.backups || [])
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" })
    } finally {
      setLoadingList(false)
    }
  }, [toast])

  useEffect(() => {
    if (user && user.role !== "admin") {
      toast({
        title: "غير مصرح لك",
        description: "ليس لديك صلاحية للوصول إلى هذه الصفحة",
        variant: "destructive",
      })
      window.location.href = "/dashboard"
      return
    }
    if (user) loadBackups()
  }, [user, toast, loadBackups])

  const startDownload = (url: string) => {
    const a = document.createElement("a")
    a.href = url
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleCreateBackup = async () => {
    setCreating(true)
    try {
      const response = await apiFetch("/api/backup", { method: "POST" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "فشل في إنشاء النسخة الاحتياطية")

      startDownload(result.url)
      await loadBackups()

      const total = Object.values(result.recordCounts as Record<string, number>).reduce((a, b) => a + b, 0)
      toast({
        title: "تم إنشاء النسخة الاحتياطية",
        description: `تم حفظ ${total.toLocaleString("en-US")} سجل على السيرفر وتحميل نسخة منها`,
      })
    } catch (error: any) {
      toast({ title: "خطأ في النسخ الاحتياطي", description: error.message, variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const handleDownload = async (name: string) => {
    try {
      const response = await apiFetch(`/api/backup?download=${encodeURIComponent(name)}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "فشل التحميل")
      startDownload(result.url)
    } catch (error: any) {
      toast({ title: "خطأ في التحميل", description: error.message, variant: "destructive" })
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setRestoreData(null)
    if (!file) return
    try {
      const data = await readBackupFile(file)
      if (!data?.metadata || !data?.data) throw new Error()
      setRestoreData(data)
    } catch {
      toast({
        title: "خطأ في قراءة الملف",
        description: "ملف النسخة الاحتياطية غير صالح",
        variant: "destructive",
      })
    }
  }

  const handleRestore = async () => {
    if (!restoreData) return

    setRestoring(true)
    let sent = 0
    const failed: string[] = []
    try {
      // Table by table in the file's order (parents first), in chunks
      const tables = Object.keys(restoreData.data).filter(
        (table) => table !== "users" && Array.isArray(restoreData.data[table]),
      )
      const totalRows = tables.reduce((sum, table) => sum + restoreData.data[table].length, 0)

      for (const table of tables) {
        const rows: any[] = restoreData.data[table]
        for (let i = 0; i < rows.length; i += RESTORE_CHUNK_ROWS) {
          setRestoreProgress(`${TABLE_NAMES[table] || table}: ${sent.toLocaleString("en-US")} / ${totalRows.toLocaleString("en-US")}`)
          const response = await apiFetch("/api/restore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              metadata: restoreData.metadata,
              data: { [table]: rows.slice(i, i + RESTORE_CHUNK_ROWS) },
              final: false,
            }),
          })
          const result = await response.json()
          if (!response.ok) throw new Error(result.error || "فشل في الاستعادة")
          if (result.results?.errors?.[table] && !failed.includes(table)) failed.push(table)
          sent += Math.min(RESTORE_CHUNK_ROWS, rows.length - i)
        }
      }

      // Last call: move id sequences past the restored rows and log the restore
      await apiFetch("/api/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: restoreData.metadata, data: {}, final: true }),
      })

      if (failed.length === 0) {
        toast({ title: "تمت الاستعادة", description: `تمت مراجعة ${sent.toLocaleString("en-US")} سجل وإضافة الناقص منها` })
      } else {
        toast({
          title: "تمت الاستعادة مع أخطاء",
          description: `تعذرت استعادة: ${failed.map((t) => TABLE_NAMES[t] || t).join("، ")}`,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({ title: "خطأ في الاستعادة", description: error.message, variant: "destructive" })
    } finally {
      setRestoring(false)
      setRestoreProgress("")
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        جاري التحميل...
      </div>
    )
  }

  const latest = backups[0]
  const latestAuto = backups.find((b) => b.type === "auto")

  return (
    <div className="flex min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Decorative background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 [background:radial-gradient(700px_circle_at_100%_0%,rgba(37,99,235,0.12),transparent_60%),radial-gradient(700px_circle_at_0%_100%,rgba(14,165,233,0.1),transparent_60%)]" />
      <Sidebar />
      <div className="flex-1 p-6 relative">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">إدارة النسخ الاحتياطية</h1>
          <p className="text-slate-300">نسخة كاملة تلقائية كل يوم، محفوظة على السيرفر لمدة 30 يوماً</p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                آخر نسخة احتياطية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-white font-medium">{latest ? formatTimestamp(latest.createdAt) : "لا توجد"}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                النسخ المحفوظة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-white font-medium">{backups.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                النسخ التلقائي
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {latestAuto ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-medium">يعمل يومياً</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-orange-400" />
                    <span className="text-orange-400 font-medium">لم يعمل بعد</span>
                  </>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {latestAuto ? `آخر تشغيل: ${formatTimestamp(latestAuto.createdAt)}` : "يحتاج CRON_SECRET في Vercel"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Database className="w-4 h-4" />
                حجم آخر نسخة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-white font-medium">{latest ? formatFileSize(latest.size) : "-"}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Create Backup */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Download className="w-5 h-5" />
                إنشاء نسخة احتياطية الآن
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-300">
                نسخة كاملة من كل الجداول (المنتجات، الإصدارات، إدخالات المخزون، المخازن، الفئات، العملاء، الفروع،
                الصلاحيات، سجل النشاطات). تُحفظ على السيرفر ويتم تحميل نسخة منها لجهازك.
              </p>
              <p className="text-xs text-slate-400">كلمات المرور لا تُحفظ في النسخ الاحتياطية.</p>
              <Button onClick={handleCreateBackup} disabled={creating} className="w-full">
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري إنشاء النسخة...
                  </>
                ) : (
                  "إنشاء وتحميل نسخة احتياطية"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Restore Backup */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Upload className="w-5 h-5" />
                استعادة نسخة احتياطية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-amber-900/20 border-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-amber-200">
                  الاستعادة تضيف السجلات الناقصة فقط ولا تعدّل أو تحذف البيانات الحالية. المستخدمون لا تتم استعادتهم.
                </AlertDescription>
              </Alert>

              <div className="grid gap-2">
                <Label htmlFor="backup-file" className="text-slate-300">
                  اختر ملف النسخة الاحتياطية (.json.gz أو .json)
                </Label>
                <Input
                  id="backup-file"
                  type="file"
                  accept=".gz,.json,application/gzip,application/json"
                  onChange={handleFileUpload}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>

              {restoreData && (
                <div className="p-3 bg-slate-700 rounded-lg">
                  <h4 className="text-white font-medium mb-2">معلومات النسخة الاحتياطية:</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-300">التاريخ:</span>
                      <span className="text-white">{formatTimestamp(restoreData.metadata.timestamp)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">السجلات:</span>
                      <span className="text-white">
                        {Object.values(restoreData.data as Record<string, any[]>)
                          .reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0)
                          .toLocaleString("en-US")}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {restoreProgress && <p className="text-sm text-slate-300">{restoreProgress}</p>}

              <Button onClick={handleRestore} disabled={restoring || !restoreData} variant="destructive" className="w-full">
                {restoring ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري الاستعادة...
                  </>
                ) : (
                  "استعادة النسخة الاحتياطية"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Stored backups */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              النسخ المحفوظة على السيرفر
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingList ? (
              <div className="flex items-center justify-center gap-2 py-8 text-slate-300">
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري التحميل...
              </div>
            ) : backups.length > 0 ? (
              <div className="space-y-3">
                {backups.map((backup) => (
                  <div key={backup.name} className="flex items-center justify-between gap-3 p-3 bg-slate-700 rounded-lg">
                    <div>
                      <div className="text-white font-medium">{formatTimestamp(backup.createdAt)}</div>
                      <div className="text-slate-300 text-sm">{formatFileSize(backup.size)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{backup.type === "auto" ? "تلقائي" : "يدوي"}</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-500 text-slate-200"
                        onClick={() => handleDownload(backup.name)}
                        aria-label={`تحميل نسخة ${formatTimestamp(backup.createdAt)}`}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Database className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">لا توجد نسخ احتياطية</h3>
                <p className="text-slate-400">أول نسخة تلقائية تتعمل بعد منتصف الليل (حوالي الساعة 3-4 الفجر)، أو اعمل نسخة الآن</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
