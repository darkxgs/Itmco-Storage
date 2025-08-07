# نظام إدارة المخزون ITMCO

نظام شامل لإدارة المخزون مع تقارير تحليلية متقدمة، مصمم خصيصاً لشركة ITMCO.

## المميزات الرئيسية

- 🔐 **نظام مصادقة آمن** مع صلاحيات متعددة المستويات
- 📦 **إدارة المخزون** الشاملة مع تتبع المنتجات
- 📊 **تقارير تحليلية** مع رسوم بيانية تفاعلية
- 🚀 **إصدار المنتجات** مع تتبع العملاء والفروع
- 👥 **إدارة المستخدمين** للمديرين
- 🔍 **البحث المتقدم** مع فلاتر متعددة
- 📈 **لوحة تحكم** مع إحصائيات فورية
- 🌐 **واجهة عربية** مع دعم RTL

## التقنيات المستخدمة

- **Frontend**: Next.js 14, React, TypeScript
- **UI**: Tailwind CSS, shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth + bcrypt
- **Charts**: Recharts
- **Deployment**: Vercel

## الحسابات التجريبية

- **مدير النظام**: `itmcoadmin@gmail.com` / `itmcoadmin@12`
- **مدير المخزون**: `inventory@itmco.com` / `inventory@itmco`
- **مهندس**: `engineer@itmco.com` / `engineer@itmco`

## التثبيت والإعداد

### 1. استنساخ المشروع
\`\`\`bash
git clone <repository-url>
cd itmco-inventory
npm install
\`\`\`

### 2. إعداد قاعدة البيانات

#### للمشاريع الجديدة:
1. أنشئ مشروع جديد في [Supabase](https://supabase.com)
2. شغل السكريبت `scripts/init-database-simple.sql` في SQL Editor
3. شغل السكريبت `scripts/seed-database-updated.sql` لإضافة البيانات الأولية

#### للمشاريع الموجودة (ترحيل):
إذا كان لديك مشروع موجود، شغل السكريبت التالي لإضافة عمود الوصف:
\`\`\`sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
\`\`\`

### 3. متغيرات البيئة
أنشئ ملف `.env.local`:
\`\`\`
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
\`\`\`

### 4. تشغيل المشروع محلياً
\`\`\`bash
npm run dev
\`\`\`

### 5. التحقق من التثبيت
- اذهب إلى `/test` لاختبار الاتصال بقاعدة البيانات
- جرب إضافة منتج جديد في صفحة إدارة المخزون

## النشر على Vercel

### الطريقة الأولى: من خلال GitHub
1. ارفع الكود إلى GitHub repository
2. اذهب إلى [Vercel Dashboard](https://vercel.com/dashboard)
3. اضغط "New Project"
4. اختر repository من GitHub
5. أضف متغيرات البيئة في إعدادات المشروع
6. اضغط "Deploy"

### الطريقة الثانية: Vercel CLI
\`\`\`bash
npm i -g vercel
vercel login
vercel --prod
\`\`\`

## متغيرات البيئة المطلوبة في Vercel

في إعدادات المشروع → Environment Variables:

| المتغير | القيمة |
|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | رابط مشروع Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | مفتاح Supabase العام |

## هيكل المشروع

\`\`\`
├── app/                    # صفحات Next.js
│   ├── dashboard/         # لوحة التحكم
│   ├── inventory/         # إدارة المخزون
│   ├── issuance/          # إصدار المنتجات
│   ├── reports/           # التقارير
│   ├── search/            # البحث المتقدم
│   ├── users/             # إدارة المستخدمين
│   ├── login/             # تسجيل الدخول
│   └── test/              # اختبار النظام
├── components/            # مكونات React
│   ├── ui/               # مكونات UI الأساسية
│   └── sidebar.tsx       # الشريط الجانبي
├── lib/                  # المكتبات والأدوات
│   ├── supabase.ts       # إعداد Supabase
│   ├── auth.ts           # نظام المصادقة
│   └── database.ts       # عمليات قاعدة البيانات
└── scripts/              # سكريبتات قاعدة البيانات
    ├── init-database-simple.sql
    └── seed-database-updated.sql
\`\`\`

## الأدوار والصلاحيات

### مدير النظام (Admin)
- الوصول لجميع الوظائف
- إدارة المستخدمين
- عرض جميع التقارير
- إدارة المخزون الكاملة

### مدير المخزون (Inventory Manager)
- إدارة المنتجات
- عرض التقارير
- البحث المتقدم
- لوحة التحكم

### مهندس (Engineer)
- إصدار المنتجات
- عرض المخزون
- البحث المتقدم
- لوحة التحكم

## استكشاف الأخطاء الشائعة

### خطأ "Could not find the 'description' column"
هذا يعني أن عمود الوصف غير موجود في قاعدة البيانات. الحل:
\`\`\`sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
\`\`\`

### خطأ "Missing environment variables"
تأكد من إضافة متغيرات البيئة في `.env.local` أو في إعدادات Vercel.

### خطأ "relation does not exist"
تأكد من تشغيل سكريبت إنشاء الجداول `scripts/init-database-simple.sql`.

### خطأ في تسجيل الدخول
تأكد من تشغيل سكريبت البيانات الأولية `scripts/seed-database-updated.sql`.

## الدعم والصيانة

للحصول على الدعم أو الإبلاغ عن مشاكل، يرجى التواصل مع فريق التطوير.

## الترخيص

هذا المشروع مطور خصيصاً لشركة ITMCO.
\`\`\`

Now let's create a production deployment checklist:
