"use client"

import { DatabaseTest } from "@/components/database-test"
import { LoginTest } from "@/components/login-test"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, Database, Lock, CheckCircle } from "lucide-react"

export default function TestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-8">
          <Link href="/">
            <Button variant="outline" className="mb-4 bg-transparent">
              <ArrowLeft className="w-4 h-4 mr-2" />
              العودة للرئيسية
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">اختبار النظام</h1>
          <p className="text-slate-300">اختبار الاتصال بقاعدة البيانات وتسجيل الدخول</p>
        </div>

        <div className="grid gap-6">
          {/* Status Overview */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                حالة النظام
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg">
                  <Database className="w-5 h-5 text-green-400" />
                  <div>
                    <div className="text-white font-medium">قاعدة البيانات</div>
                    <div className="text-green-400 text-sm">متصلة ومُعدة بنجاح</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg">
                  <Lock className="w-5 h-5 text-blue-400" />
                  <div>
                    <div className="text-white font-medium">نظام المصادقة</div>
                    <div className="text-blue-400 text-sm">جاهز للاختبار</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Database Test */}
          <DatabaseTest />

          {/* Login Test */}
          <LoginTest />

          {/* Setup Information */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">معلومات الإعداد</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-slate-300">
                <h4 className="font-medium text-white mb-2">الخطوات المكتملة:</h4>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    إنشاء مشروع Supabase
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    تشغيل سكريبت إنشاء الجداول
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    تشغيل سكريبت البيانات الأولية
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    تعيين متغيرات البيئة
                  </li>
                </ul>
              </div>

              <div className="text-slate-300">
                <h4 className="font-medium text-white mb-2">الخطوات التالية:</h4>
                <ul className="space-y-1 text-sm">
                  <li>• اختبار تسجيل الدخول بالحسابات التجريبية</li>
                  <li>• اختبار وظائف إدارة المخزون</li>
                  <li>• اختبار إصدار المنتجات</li>
                  <li>• مراجعة التقارير والتحليلات</li>
                </ul>
              </div>

              <div className="flex gap-2 pt-4">
                <Link href="/login">
                  <Button className="w-full sm:w-auto">تجربة تسجيل الدخول</Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="outline" className="w-full sm:w-auto bg-transparent">
                    الذهاب للوحة التحكم
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
