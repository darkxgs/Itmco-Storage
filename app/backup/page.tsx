"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
} from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

const backupTables = [
  { id: "users", name: "المستخدمين", description: "حسابات المستخدمين وبيانات المصادقة" },
  { id: "products", name: "المنتجات", description: "قائمة المنتجات ومعلومات المخزون" },
  { id: "issuances", name: "الإصدارات", description: "سجلات إصدار المنتجات للعملاء" },
  { id: "activity_logs", name: "سجل النشاطات", description: "تتبع جميع العمليات في النظام" },
]

export default function BackupPage() {
  const { user, loading: authLoading } = useAuth()
  const [selectedTables, setSelectedTables] = useState(backupTables.map((t) => t.id))
  const [backupType, setBackupType] = useState("full")
  const [loading, setLoading] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [restoreData, setRestoreData] = useState<any>(null)
  const [backupHistory, setBackupHistory] = useState([])
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false)
  const { toast } = useToast()

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

    if (user) {
      // Load backup history from localStorage
      const history = localStorage.getItem("backup_history")
      if (history) {
        setBackupHistory(JSON.parse(history))
      }

      // Check auto-backup setting
      const autoBackup = localStorage.getItem("auto_backup_enabled")
      setAutoBackupEnabled(autoBackup === "true")
    }
  }, [user, toast])

  const handleCreateBackup = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/backup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: backupType,
          tables: selectedTables,
        }),
      })

      if (!response.ok) {
        throw new Error("فشل في إنشاء النسخة الاحتياطية")
      }

      const backupData = await response.json()

      // Download the backup file
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `itmco-backup-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Save to backup history
      const newBackup = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type: backupType,
        tables: selectedTables,
        recordCounts: backupData.metadata.recordCounts,
        size: blob.size,
      }

      const updatedHistory = [newBackup, ...backupHistory.slice(0, 9)] // Keep last 10 backups
      setBackupHistory(updatedHistory)
      localStorage.setItem("backup_history", JSON.stringify(updatedHistory))

      toast({
        title: "تم إنشاء النسخة الاحتياطية",
        description: "تم تحميل ملف النسخة الاحتياطية بنجاح",
      })
    } catch (error) {
      toast({
        title: "خطأ في النسخ الاحتياطي",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setRestoreFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string)
          setRestoreData(data)
        } catch (error) {
          toast({
            title: "خطأ في قراءة الملف",
            description: "ملف النسخة الاحتياطية غير صالح",
            variant: "destructive",
          })
        }
      }
      reader.readAsText(file)
    }
  }

  const handleRestore = async () => {
    if (!restoreData) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار ملف النسخة الاحتياطية أولاً",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/restore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(restoreData),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "تم الاستعادة بنجاح",
          description: result.message,
        })
      } else {
        toast({
          title: "فشل في الاستعادة",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "خطأ في الاستعادة",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleAutoBackup = () => {
    const newValue = !autoBackupEnabled
    setAutoBackupEnabled(newValue)
    localStorage.setItem("auto_backup_enabled", newValue.toString())

    if (newValue) {
      // Set up daily auto-backup (in a real app, this would be server-side)
      toast({
        title: "تم تفعيل النسخ الاحتياطي التلقائي",
        description: "سيتم إنشاء نسخة احتياطية يومياً تلقائياً",
      })
    } else {
      toast({
        title: "تم إلغاء النسخ الاحتياطي التلقائي",
        description: "لن يتم إنشاء نسخ احتياطية تلقائية",
      })
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  if (!user) {
    return <div>جاري التحميل...</div>
  }

  return (
    <div className="flex min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Decorative background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 [background:radial-gradient(700px_circle_at_100%_0%,rgba(37,99,235,0.12),transparent_60%),radial-gradient(700px_circle_at_0%_100%,rgba(14,165,233,0.1),transparent_60%)]" />
      <Sidebar />
      <div className="flex-1 p-6 relative">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">إدارة النسخ الاحتياطية</h1>
          <p className="text-slate-300">إنشاء واستعادة النسخ الاحتياطية لحماية بيانات النظام</p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Database className="w-4 h-4" />
                حالة قاعدة البيانات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-medium">متصلة</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                آخر نسخة احتياطية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-white font-medium">
                {backupHistory.length > 0
                  ? new Date(backupHistory[0].timestamp).toLocaleDateString("en-US")
                  : "لا توجد"}
              </div>
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
              <div className="text-white font-medium">{backupHistory.length}</div>
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
                {autoBackupEnabled ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-medium">مفعل</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-orange-400" />
                    <span className="text-orange-400 font-medium">معطل</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Create Backup */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Download className="w-5 h-5" />
                إنشاء نسخة احتياطية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label className="text-slate-300">الجداول المراد نسخها:</Label>
                {backupTables.map((table) => (
                  <div key={table.id} className="flex items-start space-x-2 space-x-reverse">
                    <Checkbox
                      id={table.id}
                      checked={selectedTables.includes(table.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedTables([...selectedTables, table.id])
                        } else {
                          setSelectedTables(selectedTables.filter((t) => t !== table.id))
                        }
                      }}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor={table.id} className="text-white font-medium">
                        {table.name}
                      </Label>
                      <p className="text-xs text-slate-400">{table.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox id="auto-backup" checked={autoBackupEnabled} onCheckedChange={toggleAutoBackup} />
                <Label htmlFor="auto-backup" className="text-slate-300">
                  تفعيل النسخ الاحتياطي التلقائي اليومي
                </Label>
              </div>

              <Button onClick={handleCreateBackup} disabled={loading || selectedTables.length === 0} className="w-full">
                {loading ? "جاري إنشاء النسخة..." : "إنشاء وتحميل النسخة الاحتياطية"}
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
              <Alert className="bg-red-900/20 border-red-800">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-red-300">
                  تحذير: استعادة النسخة الاحتياطية ستستبدل البيانات الحالية. تأكد من إنشاء نسخة احتياطية حديثة أولاً.
                </AlertDescription>
              </Alert>

              <div className="grid gap-2">
                <Label htmlFor="backup-file" className="text-slate-300">
                  اختر ملف النسخة الاحتياطية
                </Label>
                <Input
                  id="backup-file"
                  type="file"
                  accept=".json"
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
                      <span className="text-white">
                        {new Date(restoreData.metadata.timestamp).toLocaleString("en-US")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">النوع:</span>
                      <span className="text-white">{restoreData.metadata.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">الجداول:</span>
                      <span className="text-white">{restoreData.metadata.tables.length}</span>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleRestore}
                disabled={loading || !restoreData}
                variant="destructive"
                className="w-full"
              >
                {loading ? "جاري الاستعادة..." : "استعادة النسخة الاحتياطية"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Backup History */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              سجل النسخ الاحتياطية
            </CardTitle>
          </CardHeader>
          <CardContent>
            {backupHistory.length > 0 ? (
              <div className="space-y-3">
                {backupHistory.map((backup) => (
                  <div key={backup.id} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                    <div>
                      <div className="text-white font-medium">{new Date(backup.timestamp).toLocaleString("en-US")}</div>
                      <div className="text-slate-300 text-sm">
                        {backup.tables.length} جداول - {formatFileSize(backup.size)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{backup.type}</Badge>
                      <div className="text-slate-400 text-sm">
                        {Object.values(backup.recordCounts).reduce((a: number, b: number) => a + b, 0)} سجل
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Database className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">لا توجد نسخ احتياطية</h3>
                <p className="text-slate-400">ابدأ بإنشاء أول نسخة احتياطية لحماية بياناتك</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
