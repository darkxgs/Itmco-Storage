"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Package, Eye, EyeOff, Loader2, AlertTriangle, Mail } from "lucide-react"
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
  const [capsLockOn, setCapsLockOn] = useState(false)
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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden" dir="rtl">
      {/* Decorative background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background:radial-gradient(400px_circle_at_100%_0%,rgba(37,99,235,0.15),transparent_60%),radial-gradient(400px_circle_at_0%_100%,rgba(14,165,233,0.12),transparent_60%)] sm:[background:radial-gradient(600px_circle_at_100%_0%,rgba(37,99,235,0.15),transparent_60%),radial-gradient(600px_circle_at_0%_100%,rgba(14,165,233,0.12),transparent_60%)]"
      />

      <Card className="w-full max-w-sm sm:max-w-md lg:max-w-lg bg-slate-900/60 backdrop-blur border-slate-800 shadow-xl mx-4 sm:mx-0">
        <CardHeader className="text-center spacing-responsive-sm">
          <div className="flex justify-center mb-3 sm:mb-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-600 rounded-xl shadow-lg shadow-blue-900/40 flex items-center justify-center">
              <Package className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-xl sm:text-2xl lg:text-3xl text-white font-bold">تسجيل الدخول</CardTitle>
          <p className="text-sm sm:text-base text-slate-300">نظام إدارة المخزون - ITMCO</p>
        </CardHeader>
        <CardContent className="relative spacing-responsive-sm">
          {isBlocked && (
            <Alert className="mb-4 sm:mb-6 bg-red-900/20 border-red-800">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm sm:text-base text-red-300">
                تم حظر الحساب مؤقتاً بسبب تجاوز الحد الأقصى لمحاولات تسجيل الدخول
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="email" className="text-slate-200 font-medium text-sm sm:text-base">
                البريد الإلكتروني
              </Label>
              <div className="relative">
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
                  className={`bg-slate-800/80 border-slate-700 text-white text-right pl-10 px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-colors ${
                    errors.email ? "border-red-500" : ""
                  }`}
                  placeholder="أدخل بريدك الإلكتروني"
                  disabled={loading || isBlocked}
                  autoComplete="email"
                  autoFocus
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
                <Mail className="w-4 h-4 absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              </div>
              {errors.email && (
                <p id="email-error" className="text-red-400 text-xs sm:text-sm">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="password" className="text-slate-200 font-medium text-sm sm:text-base">
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
                  onKeyUp={(e) => setCapsLockOn((e as any).getModifierState && (e as any).getModifierState('CapsLock'))}
                  className={`bg-slate-800/80 border-slate-700 text-white text-right pl-10 px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-colors ${
                    errors.password ? "border-red-500" : ""
                  }`}
                  style={{
                    fontFamily: showPassword ? 'inherit' : 'system-ui, Arial, sans-serif',
                    letterSpacing: showPassword ? 'normal' : '1px'
                  }}
                  placeholder="أدخل كلمة المرور"
                  disabled={loading || isBlocked}
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading || isBlocked}
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 rounded-sm p-0 m-0 w-4 h-4"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {capsLockOn && (
                <div className="flex items-center gap-2 mt-2 text-yellow-400 text-xs sm:text-sm">
                  <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>مفتاح Caps Lock مفعل</span>
                </div>
              )}
              {errors.password && (
                <p id="password-error" className="text-red-400 text-xs sm:text-sm">
                  {errors.password}
                </p>
              )}
            </div>

            {loginAttempts >= 3 && (
              <Alert className="mb-3 sm:mb-4 bg-yellow-900/20 border-yellow-800">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs sm:text-sm text-yellow-300">
                  تحذير: لديك محاولة واحدة متبقية قبل حظر الحساب
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={loading || isBlocked || !email || !password}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-2.5 sm:py-3 px-4 text-sm sm:text-base rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm sm:text-base">جاري تسجيل الدخول...</span>
                </div>
              ) : (
                "تسجيل الدخول"
              )}
            </Button>
          </form>

          <div className="text-center mt-4 sm:mt-6">
             <Link
               href="/forgot-password"
               className="text-blue-400 hover:text-blue-300 text-xs sm:text-sm transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/40 rounded-sm"
             >
               نسيت كلمة المرور؟
             </Link>
           </div>
         </CardContent>
       </Card>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-lg p-4 sm:p-6 shadow-xl max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 justify-center">
              <div className="w-5 h-5 sm:w-6 sm:h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-white font-medium text-sm sm:text-base">جاري تسجيل الدخول...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}