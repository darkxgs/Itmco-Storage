"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn } from "@/lib/auth"
import { CheckCircle, XCircle, Loader2, User } from "lucide-react"

const testAccounts = [
  {
    email: "itmcoadmin@gmail.com",
    password: "itmcoadmin@12",
    role: "مدير النظام",
    name: "Admin Test",
  },
  {
    email: "inventory@itmco.com",
    password: "inventory@itmco",
    role: "مدير المخزون",
    name: "Inventory Test",
  },
  {
    email: "engineer@itmco.com",
    password: "engineer@itmco",
    role: "مهندس",
    name: "Engineer Test",
  },
]

export function LoginTest() {
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [manualTest, setManualTest] = useState({ email: "", password: "" })
  const [manualResult, setManualResult] = useState<any>(null)

  const runAutoTests = async () => {
    setTesting(true)
    const testResults = []

    for (const account of testAccounts) {
      try {
        const { user, error } = await signIn(account.email, account.password)

        testResults.push({
          name: account.name,
          email: account.email,
          role: account.role,
          status: error ? "error" : "success",
          message: error || "تم تسجيل الدخول بنجاح",
          user: user,
        })
      } catch (error) {
        testResults.push({
          name: account.name,
          email: account.email,
          role: account.role,
          status: "error",
          message: error.message || "خطأ غير متوقع",
        })
      }
    }

    setResults(testResults)
    setTesting(false)
  }

  const testManualLogin = async () => {
    if (!manualTest.email || !manualTest.password) {
      setManualResult({
        status: "error",
        message: "يرجى إدخال البريد الإلكتروني وكلمة المرور",
      })
      return
    }

    try {
      const { user, error } = await signIn(manualTest.email, manualTest.password)

      setManualResult({
        status: error ? "error" : "success",
        message: error || "تم تسجيل الدخول بنجاح",
        user: user,
      })
    } catch (error) {
      setManualResult({
        status: "error",
        message: error.message || "خطأ غير متوقع",
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Automatic Tests */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">اختبار تسجيل الدخول التلقائي</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={runAutoTests} disabled={testing} className="w-full">
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                جاري الاختبار...
              </>
            ) : (
              "اختبار جميع الحسابات"
            )}
          </Button>

          {results.length > 0 && (
            <div className="space-y-3">
              {results.map((result, index) => (
                <div key={index} className="p-4 bg-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="text-white font-medium">{result.name}</span>
                      <span className="text-slate-400 text-sm">({result.role})</span>
                    </div>
                    {result.status === "success" ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  <div className="text-sm text-slate-300 mb-1">{result.email}</div>
                  <div className={`text-sm ${result.status === "success" ? "text-green-400" : "text-red-400"}`}>
                    {result.message}
                  </div>
                  {result.user && (
                    <div className="mt-2 p-2 bg-slate-600 rounded text-xs">
                      <div className="text-slate-300">معلومات المستخدم:</div>
                      <div className="text-white">الاسم: {result.user.name}</div>
                      <div className="text-white">الدور: {result.user.role}</div>
                      <div className="text-white">المعرف: {result.user.id}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Test */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">اختبار تسجيل الدخول اليدوي</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="test-email" className="text-slate-300">
                البريد الإلكتروني
              </Label>
              <Input
                id="test-email"
                type="email"
                value={manualTest.email}
                onChange={(e) => setManualTest({ ...manualTest, email: e.target.value })}
                placeholder="أدخل البريد الإلكتروني"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="test-password" className="text-slate-300">
                كلمة المرور
              </Label>
              <Input
                id="test-password"
                type="password"
                value={manualTest.password}
                onChange={(e) => setManualTest({ ...manualTest, password: e.target.value })}
                placeholder="أدخل كلمة المرور"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <Button onClick={testManualLogin} className="w-full">
              اختبار تسجيل الدخول
            </Button>
          </div>

          {manualResult && (
            <div className="p-4 bg-slate-700 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {manualResult.status === "success" ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
                <span
                  className={`font-medium ${manualResult.status === "success" ? "text-green-400" : "text-red-400"}`}
                >
                  {manualResult.status === "success" ? "نجح تسجيل الدخول" : "فشل تسجيل الدخول"}
                </span>
              </div>
              <div className={`text-sm ${manualResult.status === "success" ? "text-green-400" : "text-red-400"}`}>
                {manualResult.message}
              </div>
              {manualResult.user && (
                <div className="mt-2 p-2 bg-slate-600 rounded text-xs">
                  <div className="text-slate-300">معلومات المستخدم:</div>
                  <div className="text-white">الاسم: {manualResult.user.name}</div>
                  <div className="text-white">الدور: {manualResult.user.role}</div>
                  <div className="text-white">المعرف: {manualResult.user.id}</div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Accounts Reference */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">الحسابات التجريبية</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {testAccounts.map((account, index) => (
              <div key={index} className="p-3 bg-slate-700 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-white font-medium">{account.role}</div>
                    <div className="text-slate-300 text-sm">{account.email}</div>
                  </div>
                  <div className="text-slate-400 text-sm font-mono">{account.password}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
