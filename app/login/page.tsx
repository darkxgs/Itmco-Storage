"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Package, Eye, EyeOff, Loader2, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { loginUser } from "@/lib/auth"
import { validateEmail, validateRequired } from "@/lib/validation"
import { loadUserFromStorage, saveUserToStorage } from "@/lib/utils"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [loginAttempts, setLoginAttempts] = useState(0)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    // Check if user is already logged in
    const user = loadUserFromStorage()
    if (user) {
      router.push("/dashboard")
    }
  }, [router])

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}

    const emailError = validateRequired(email, "البريد الإلكتروني") || validateEmail(email)
    if (emailError) newErrors.email = emailError

    const passwordError = validateRequired(password, "كلمة المرور")
    if (passwordError) newErrors.password = passwordError

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      toast({
        title: "خطأ في البيانات",
        description: "يرجى تصحيح الأخطاء والمحاولة مرة أخرى",
        variant: "destructive",
      })
      return
    }

    if (loginAttempts >= 5) {
      toast({
        title: "تم حظر الحساب مؤقتاً",
        description: "تم تجاوز الحد الأقصى لمحاولات تسجيل الدخول. يرجى المحاولة لاحقاً",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const result = await loginUser(email, password)

      if (result.success && result.user) {
        saveUserToStorage(result.user)

        toast({
          title: "تم تسجيل الدخول بنجاح",
          description: `مرحباً ${result.user.name}`,
        })

        router.push("/dashboard")
      } else {
        throw new Error(result.message || "فشل في تسجيل الدخول")
      }
    } catch (error: any) {
      setLoginAttempts((prev) => prev + 1)

      toast({
        title: "فشل في تسجيل الدخول",
        description: error.message || "حدث خطأ أثناء تسجيل الدخول",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const isBlocked = loginAttempts >= 5

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center">
              <Package className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl text-white">تسجيل الدخول</CardTitle>
          <p className="text-slate-300">نظام إدارة المخزون - ITMCO</p>
        </CardHeader>
        <CardContent>
          {isBlocked && (
            <Alert className="mb-6 bg-red-900/20 border-red-800">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-red-300">
                تم حظر الحساب مؤقتاً بسبب تجاوز الحد الأقصى لمحاولات تسجيل الدخول
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">
                البريد الإلكتروني
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (errors.email) {
                    setErrors((prev) => ({ ...prev, email: "" }))
                  }
                }}
                className={`bg-slate-700 border-slate-600 text-white text-right ${
                  errors.email ? "border-red-500" : ""
                }`}
                placeholder="أدخل البريد الإلكتروني"
                disabled={loading || isBlocked}
                autoComplete="email"
              />
              {errors.email && <p className="text-red-400 text-sm">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">
                كلمة المرور
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errors.password) {
                      setErrors((prev) => ({ ...prev, password: "" }))
                    }
                  }}
                  className={`bg-slate-700 border-slate-600 text-white text-right pr-10 ${
                    errors.password ? "border-red-500" : ""
                  }`}
                  placeholder="أدخل كلمة المرور"
                  disabled={loading || isBlocked}
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading || isBlocked}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {errors.password && <p className="text-red-400 text-sm">{errors.password}</p>}
            </div>

            {loginAttempts > 0 && loginAttempts < 5 && (
              <Alert className="bg-yellow-900/20 border-yellow-800">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-yellow-300">
                  محاولة {loginAttempts} من 5. تبقى {5 - loginAttempts} محاولات
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={loading || isBlocked}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  جاري تسجيل الدخول...
                </>
              ) : (
                "تسجيل الدخول"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              نسيت كلمة المرور؟ <button className="text-blue-400 hover:text-blue-300 underline">اتصل بالمدير</button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
