# قائمة مراجعة النشر - نظام إدارة المخزون ITMCO

## ✅ قبل النشر

### إعداد قاعدة البيانات
- [ ] إنشاء مشروع Supabase جديد
- [ ] تشغيل سكريبت `init-database-simple.sql`
- [ ] تشغيل سكريبت `seed-database-updated.sql`
- [ ] التحقق من إنشاء جميع الجداول
- [ ] التحقق من إدراج البيانات الأولية

### إعداد المتغيرات
- [ ] نسخ `NEXT_PUBLIC_SUPABASE_URL` من Supabase
- [ ] نسخ `NEXT_PUBLIC_SUPABASE_ANON_KEY` من Supabase
- [ ] اختبار الاتصال محلياً

### اختبار النظام
- [ ] تشغيل `/test` للتحقق من قاعدة البيانات
- [ ] اختبار تسجيل الدخول لجميع الأدوار
- [ ] اختبار إضافة منتج جديد
- [ ] اختبار إصدار منتج
- [ ] اختبار التقارير

## 🚀 خطوات النشر

### الطريقة 1: GitHub + Vercel (مُوصى بها)

1. **رفع الكود إلى GitHub**
   \`\`\`bash
   git init
   git add .
   git commit -m "Initial commit - ITMCO Inventory System"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   \`\`\`

2. **النشر على Vercel**
   - اذهب إلى [vercel.com/new](https://vercel.com/new)
   - اختر "Import Git Repository"
   - اختر repository الخاص بك
   - اضغط "Import"

3. **إعداد متغيرات البيئة**
   - في صفحة النشر، اضغط "Environment Variables"
   - أضف:
     - `NEXT_PUBLIC_SUPABASE_URL` = رابط مشروع Supabase
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = مفتاح Supabase العام
   - اضغط "Deploy"

### الطريقة 2: Vercel CLI

1. **تثبيت Vercel CLI**
   \`\`\`bash
   npm i -g vercel
   \`\`\`

2. **تسجيل الدخول**
   \`\`\`bash
   vercel login
   \`\`\`

3. **النشر**
   \`\`\`bash
   vercel --prod
   \`\`\`

4. **إعداد متغيرات البيئة**
   \`\`\`bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   \`\`\`

## ✅ بعد النشر

### التحقق من النشر
- [ ] زيارة الرابط المُنشر
- [ ] اختبار تحميل الصفحة الرئيسية
- [ ] اختبار `/test` للتحقق من قاعدة البيانات
- [ ] اختبار تسجيل الدخول

### اختبار الوظائف
- [ ] تسجيل الدخول بحساب المدير
- [ ] تسجيل الدخول بحساب مدير المخزون
- [ ] تسجيل الدخول بحساب المهندس
- [ ] اختبار إضافة منتج جديد
- [ ] اختبار إصدار منتج
- [ ] اختبار البحث المتقدم
- [ ] اختبار التقارير

### الأمان والأداء
- [ ] التحقق من تشفير HTTPS
- [ ] اختبار سرعة التحميل
- [ ] التحقق من عمل النظام على الهاتف
- [ ] اختبار النسخ الاحتياطي لقاعدة البيانات

## 🔧 إعدادات إضافية

### Domain مخصص (اختياري)
1. في Vercel Dashboard → Settings → Domains
2. أضف domain الخاص بك
3. اتبع تعليمات DNS

### SSL Certificate
- Vercel يوفر SSL تلقائياً
- تأكد من إعادة التوجيه من HTTP إلى HTTPS

### Monitoring
- فعّل Vercel Analytics
- راقب الأخطاء والأداء
- اعد تقارير دورية

## 📞 معلومات الاتصال

**الدعم الفني:**
- البريد الإلكتروني: support@itmco.com
- الهاتف: +966-XX-XXX-XXXX

**روابط مهمة:**
- Vercel Dashboard: https://vercel.com/dashboard
- Supabase Dashboard: https://app.supabase.com
- GitHub Repository: [رابط المستودع]

## 🚨 في حالة المشاكل

### مشاكل شائعة وحلولها:

1. **خطأ "Environment variables missing"**
   - تأكد من إضافة متغيرات البيئة في Vercel
   - أعد النشر بعد إضافة المتغيرات

2. **خطأ "Database connection failed"**
   - تحقق من صحة رابط Supabase
   - تأكد من تشغيل سكريبتات قاعدة البيانات

3. **خطأ "Login failed"**
   - تحقق من تشغيل سكريبت البيانات الأولية
   - تأكد من صحة كلمات المرور المُشفرة

4. **بطء في التحميل**
   - تحقق من إعدادات Supabase
   - راجع استعلامات قاعدة البيانات
\`\`\`

Let's also create a production environment configuration:
