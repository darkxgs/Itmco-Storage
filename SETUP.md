# إعداد نظام إدارة المخزون ITMCO

## 1. إنشاء مشروع Supabase

1. اذهب إلى [supabase.com](https://supabase.com)
2. أنشئ حساب جديد أو سجل الدخول
3. أنشئ مشروع جديد
4. انتظر حتى يكتمل إعداد المشروع

## 2. الحصول على بيانات الاتصال

1. اذهب إلى Settings > API في مشروع Supabase
2. انسخ القيم التالية:
   - Project URL
   - anon public key

## 3. تعيين متغيرات البيئة

### في Vercel:
1. اذهب إلى إعدادات المشروع
2. اذهب إلى Environment Variables
3. أضف المتغيرات التالية:
   \`\`\`
   NEXT_PUBLIC_SUPABASE_URL=your_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   \`\`\`

### للتطوير المحلي:
أنشئ ملف `.env.local` في جذر المشروع:
\`\`\`
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
\`\`\`

## 4. إعداد قاعدة البيانات

1. اذهب إلى SQL Editor في Supabase
2. شغل السكريبت `scripts/init-database-simple.sql`
3. شغل السكريبت `scripts/seed-database-updated.sql`

## 5. اختبار النظام

1. اذهب إلى `/test` لاختبار الاتصال بقاعدة البيانات
2. جرب تسجيل الدخول بالحسابات التجريبية:
   - مدير: itmcoadmin@gmail.com / itmcoadmin@12
   - مخزون: inventory@itmco.com / inventory@itmco
   - مهندس: engineer@itmco.com / engineer@itmco

## استكشاف الأخطاء

### خطأ "Missing environment variables"
- تأكد من تعيين متغيرات البيئة بشكل صحيح
- تأكد من إعادة تشغيل الخادم بعد إضافة متغيرات البيئة

### خطأ "relation does not exist"
- تأكد من تشغيل سكريبت إنشاء الجداول
- تحقق من أن الجداول تم إنشاؤها في Supabase

### خطأ في تسجيل الدخول
- تأكد من تشغيل سكريبت البيانات الأولية
- تحقق من أن المستخدمين تم إنشاؤهم في جدول users
