"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Settings, Bell, Shield, Database, Globe, Save, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { validateData, settingsSchema } from "@/lib/validation"

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const [settings, setSettings] = useState({
    // System Settings
    systemName: "نظام إدارة المخزون - ITMCO",
    systemVersion: "1.0.0",
    maintenanceMode: false,

    // Notification Settings
    emailNotifications: true,
    stockAlerts: true,
    lowStockThreshold: 5,
    dailyReports: false,
    alertEmails: "",

    // Security Settings
    sessionTimeout: 30,
    passwordExpiry: 90,
    maxLoginAttempts: 5,
    requireTwoFactor: false,

    // Backup Settings
    autoBackup: true,
    backupFrequency: "daily",
    backupRetention: 30,
    backupLocation: "local",

    // Display Settings
    theme: "dark",
    language: "ar",
    dateFormat: "dd/mm/yyyy",
    currency: "EGP",
    itemsPerPage: 10,

    // Business Settings
    companyName: "ITMCO",
    companyEmail: "info@itmco.com",
    companyPhone: "+20-XX-XXX-XXXX",
    companyAddress: "مصر",
    taxNumber: "",
    commercialRegister: "",
  })

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [activeTab, setActiveTab] = useState("system")
  const { toast } = useToast()

  useEffect(() => {
    if (user && user.role !== "admin") {
      window.location.href = "/dashboard"
      return
    }

    // Load settings from localStorage
    const savedSettings = localStorage.getItem("system_settings")
    if (savedSettings) {
      setSettings((prev) => ({ ...prev, ...JSON.parse(savedSettings) }))
    }
  }, [user])

  const handleSettingChange = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
    setErrors([]) // Clear errors when user makes changes
  }

  const handleSaveSettings = async () => {
    setLoading(true)
    setErrors([])

    try {
      // Validate settings
      const validation = validateData(settingsSchema, settings)
      if (!validation.success) {
        setErrors(validation.errors || [])
        return
      }

      // Save to localStorage (in production, save to database)
      localStorage.setItem("system_settings", JSON.stringify(settings))
      setHasChanges(false)

      toast({
        title: "تم حفظ الإعدادات",
        description: "تم حفظ جميع الإعدادات بنجاح",
      })
    } catch (error) {
      toast({
        title: "خطأ في الحفظ",
        description: "فشل في حفظ الإعدادات",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleResetSettings = () => {
    if (confirm("هل أنت متأكد من إعادة تعيين جميع الإعدادات؟")) {
      localStorage.removeItem("system_settings")
      window.location.reload()
    }
  }

  const handleTestNotification = () => {
    toast({
      title: "اختبار التنبيهات",
      description: "تم إرسال تنبيه تجريبي بنجاح",
    })
  }

  if (!user) {
    return <div>جاري التحميل...</div>
  }

  return (
    <div className="flex min-h-screen bg-slate-900">
      <Sidebar />
      <div className="flex-1 p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">إعدادات النظام</h1>
          <p className="text-slate-300">إدارة إعدادات النظام والتفضيلات</p>
        </div>

        {/* Error Alert */}
        {errors.length > 0 && (
          <Alert className="mb-6 bg-red-900/20 border-red-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-red-300">
              <div className="font-medium mb-2">يرجى تصحيح الأخطاء التالية:</div>
              <ul className="list-disc list-inside space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Changes Alert */}
        {hasChanges && (
          <Alert className="mb-6 bg-yellow-900/20 border-yellow-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-yellow-300">
              لديك تغييرات غير محفوظة. تأكد من حفظ الإعدادات قبل المغادرة.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-slate-800">
            <TabsTrigger value="system" className="data-[state=active]:bg-slate-700">
              <Settings className="w-4 h-4 mr-2" />
              النظام
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-slate-700">
              <Bell className="w-4 h-4 mr-2" />
              التنبيهات
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-slate-700">
              <Shield className="w-4 h-4 mr-2" />
              الأمان
            </TabsTrigger>
            <TabsTrigger value="backup" className="data-[state=active]:bg-slate-700">
              <Database className="w-4 h-4 mr-2" />
              النسخ الاحتياطي
            </TabsTrigger>
            <TabsTrigger value="company" className="data-[state=active]:bg-slate-700">
              <Globe className="w-4 h-4 mr-2" />
              الشركة
            </TabsTrigger>
          </TabsList>

          <TabsContent value="system" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">إعدادات النظام العامة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">اسم النظام *</Label>
                    <Input
                      value={settings.systemName}
                      onChange={(e) => handleSettingChange("systemName", e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">إصدار النظام</Label>
                    <Input
                      value={settings.systemVersion}
                      disabled
                      className="bg-slate-700 border-slate-600 text-white opacity-50"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">اللغة</Label>
                    <Select value={settings.language} onValueChange={(value) => handleSettingChange("language", value)}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="ar">العربية</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">تنسيق التاريخ</Label>
                    <Select
                      value={settings.dateFormat}
                      onValueChange={(value) => handleSettingChange("dateFormat", value)}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="dd/mm/yyyy">DD/MM/YYYY</SelectItem>
                        <SelectItem value="mm/dd/yyyy">MM/DD/YYYY</SelectItem>
                        <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">العملة</Label>
                    <Select value={settings.currency} onValueChange={(value) => handleSettingChange("currency", value)}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                        <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                        <SelectItem value="EUR">يورو (EUR)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                  <div>
                    <Label className="text-white font-medium">وضع الصيانة</Label>
                    <p className="text-sm text-slate-400">تعطيل النظام مؤقتاً للصيانة</p>
                  </div>
                  <Switch
                    checked={settings.maintenanceMode}
                    onCheckedChange={(checked) => handleSettingChange("maintenanceMode", checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  إعدادات التنبيهات
                  <Button onClick={handleTestNotification} variant="outline" size="sm" className="bg-transparent">
                    اختبار التنبيهات
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                  <div>
                    <Label className="text-white font-medium">تنبيهات البريد الإلكتروني</Label>
                    <p className="text-sm text-slate-400">إرسال تنبيهات عبر البريد الإلكتروني</p>
                  </div>
                  <Switch
                    checked={settings.emailNotifications}
                    onCheckedChange={(checked) => handleSettingChange("emailNotifications", checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                  <div>
                    <Label className="text-white font-medium">تنبيهات المخزون</Label>
                    <p className="text-sm text-slate-400">تنبيهات عند انخفاض المخزون</p>
                  </div>
                  <Switch
                    checked={settings.stockAlerts}
                    onCheckedChange={(checked) => handleSettingChange("stockAlerts", checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">حد التنبيه للمخزون المنخفض *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={settings.lowStockThreshold}
                    onChange={(e) => handleSettingChange("lowStockThreshold", Number.parseInt(e.target.value) || 5)}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <p className="text-xs text-slate-400">سيتم إرسال تنبيه عندما يصل المخزون إلى هذا العدد أو أقل</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">عناوين البريد الإلكتروني للتنبيهات</Label>
                  <Textarea
                    value={settings.alertEmails}
                    onChange={(e) => handleSettingChange("alertEmails", e.target.value)}
                    placeholder="admin@company.com, manager@company.com"
                    className="bg-slate-700 border-slate-600 text-white"
                    rows={3}
                  />
                  <p className="text-xs text-slate-400">افصل بين العناوين بفاصلة</p>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                  <div>
                    <Label className="text-white font-medium">التقارير اليومية</Label>
                    <p className="text-sm text-slate-400">إرسال تقرير يومي تلقائي</p>
                  </div>
                  <Switch
                    checked={settings.dailyReports}
                    onCheckedChange={(checked) => handleSettingChange("dailyReports", checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">إعدادات الأمان</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">مهلة انتهاء الجلسة (دقيقة) *</Label>
                    <Input
                      type="number"
                      min="5"
                      max="480"
                      value={settings.sessionTimeout}
                      onChange={(e) => handleSettingChange("sessionTimeout", Number.parseInt(e.target.value) || 30)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">انتهاء صلاحية كلمة المرور (يوم) *</Label>
                    <Input
                      type="number"
                      min="30"
                      max="365"
                      value={settings.passwordExpiry}
                      onChange={(e) => handleSettingChange("passwordExpiry", Number.parseInt(e.target.value) || 90)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">الحد الأقصى لمحاولات تسجيل الدخول *</Label>
                  <Input
                    type="number"
                    min="3"
                    max="10"
                    value={settings.maxLoginAttempts}
                    onChange={(e) => handleSettingChange("maxLoginAttempts", Number.parseInt(e.target.value) || 5)}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                  <div>
                    <Label className="text-white font-medium">المصادقة الثنائية</Label>
                    <p className="text-sm text-slate-400">تطلب رمز إضافي عند تسجيل الدخول</p>
                  </div>
                  <Switch
                    checked={settings.requireTwoFactor}
                    onCheckedChange={(checked) => handleSettingChange("requireTwoFactor", checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backup" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">إعدادات النسخ الاحتياطي</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                  <div>
                    <Label className="text-white font-medium">النسخ الاحتياطي التلقائي</Label>
                    <p className="text-sm text-slate-400">إنشاء نسخ احتياطية تلقائية</p>
                  </div>
                  <Switch
                    checked={settings.autoBackup}
                    onCheckedChange={(checked) => handleSettingChange("autoBackup", checked)}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">تكرار النسخ الاحتياطي</Label>
                    <Select
                      value={settings.backupFrequency}
                      onValueChange={(value) => handleSettingChange("backupFrequency", value)}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="hourly">كل ساعة</SelectItem>
                        <SelectItem value="daily">يومي</SelectItem>
                        <SelectItem value="weekly">أسبوعي</SelectItem>
                        <SelectItem value="monthly">شهري</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">مدة الاحتفاظ (يوم) *</Label>
                    <Input
                      type="number"
                      min="7"
                      max="365"
                      value={settings.backupRetention}
                      onChange={(e) => handleSettingChange("backupRetention", Number.parseInt(e.target.value) || 30)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">موقع النسخ الاحتياطي</Label>
                  <Select
                    value={settings.backupLocation}
                    onValueChange={(value) => handleSettingChange("backupLocation", value)}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="local">محلي</SelectItem>
                      <SelectItem value="cloud">سحابي</SelectItem>
                      <SelectItem value="both">كلاهما</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">معلومات الشركة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">اسم الشركة *</Label>
                    <Input
                      value={settings.companyName}
                      onChange={(e) => handleSettingChange("companyName", e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">البريد الإلكتروني *</Label>
                    <Input
                      type="email"
                      value={settings.companyEmail}
                      onChange={(e) => handleSettingChange("companyEmail", e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">رقم الهاتف *</Label>
                    <Input
                      value={settings.companyPhone}
                      onChange={(e) => handleSettingChange("companyPhone", e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">الرقم الضريبي</Label>
                    <Input
                      value={settings.taxNumber}
                      onChange={(e) => handleSettingChange("taxNumber", e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">رقم السجل التجاري</Label>
                  <Input
                    value={settings.commercialRegister}
                    onChange={(e) => handleSettingChange("commercialRegister", e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">العنوان *</Label>
                  <Textarea
                    value={settings.companyAddress}
                    onChange={(e) => handleSettingChange("companyAddress", e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <Button onClick={handleSaveSettings} disabled={loading || !hasChanges} className="flex-1">
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    حفظ الإعدادات
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleResetSettings} className="bg-transparent">
                إعادة تعيين
              </Button>
            </div>
            {hasChanges && (
              <p className="text-xs text-slate-400 mt-2 flex items-center">
                <CheckCircle className="w-3 h-3 mr-1" />
                لديك تغييرات غير محفوظة
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
