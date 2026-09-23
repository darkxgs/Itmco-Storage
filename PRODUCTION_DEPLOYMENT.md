# دليل النشر في الإنتاج - Production Deployment Guide

## 🚀 **إعداد النشر في الإنتاج**

### 1. **إعداد قاعدة البيانات**

#### الخطوة 1: إنشاء قاعدة البيانات
```sql
-- شغل هذه السكريبتات بالترتيب في Supabase SQL Editor:

-- 1. إنشاء الجداول الأساسية
-- شغل: scripts/init-database-simple.sql

-- 2. إضافة جداول الأمان والنسخ الاحتياطي
-- شغل: scripts/add-security-table.sql

-- 3. إضافة البيانات الأولية
-- شغل: scripts/seed-database-production.sql
```

#### الخطوة 2: التحقق من الإعداد
```sql
-- تحقق من وجود جميع الجداول
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- يجب أن ترى:
-- - users
-- - products  
-- - issuances
-- - activity_logs
-- - security_logs
-- - backup_config
-- - backup_history
```

### 2. **متغيرات البيئة**

#### في Vercel:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
CRON_SECRET=your_secure_random_string_for_cron_jobs
```

#### إنشاء CRON_SECRET آمن:
```bash
# استخدم أداة لإنشاء مفتاح عشوائي آمن
openssl rand -base64 32
```

### 3. **إعداد النسخ الاحتياطي التلقائي**

#### في Vercel Cron Jobs:
1. اذهب إلى مشروعك في Vercel
2. اذهب إلى Settings → Functions
3. أضف Cron Job جديد:
   ```
   Path: /api/cron/backup?secret=YOUR_CRON_SECRET
   Schedule: 0 2 * * * (كل يوم في الساعة 2 صباحاً)
   ```

#### أو استخدم خدمة خارجية:
```bash
# مثال باستخدام cron-job.org أو similar service
curl "https://your-app.vercel.app/api/cron/backup?secret=YOUR_CRON_SECRET"
```

### 4. **إعدادات الأمان**

#### تفعيل HTTPS فقط:
- تأكد من أن التطبيق يعمل على HTTPS فقط
- Vercel يوفر HTTPS تلقائياً

#### إعدادات الأمان في next.config.mjs:
```javascript
const nextConfig = {
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ]
  },
}
```

### 5. **مراقبة النظام**

#### تحقق من سجلات الأمان:
```sql
-- عرض آخر الأحداث الأمنية
SELECT * FROM security_logs 
ORDER BY timestamp DESC 
LIMIT 50;

-- عرض المحاولات المشبوهة
SELECT * FROM security_logs 
WHERE severity IN ('HIGH', 'CRITICAL')
ORDER BY timestamp DESC;
```

#### تحقق من النسخ الاحتياطية:
```sql
-- عرض تاريخ النسخ الاحتياطية
SELECT * FROM backup_history 
ORDER BY timestamp DESC 
LIMIT 10;

-- تحقق من إعدادات النسخ الاحتياطي
SELECT * FROM backup_config;
```

### 6. **اختبار النظام**

#### اختبار الوظائف الأساسية:
1. **تسجيل الدخول**: جرب جميع أنواع المستخدمين
2. **إدارة المخزون**: إضافة/تعديل/حذف المنتجات
3. **الإصدارات**: إنشاء/تعديل/حذف الإصدارات
4. **النسخ الاحتياطي**: إنشاء نسخة احتياطية يدوية
5. **التقارير**: عرض جميع التقارير والإحصائيات

#### اختبار الأمان:
```bash
# اختبار حد المعدل (Rate Limiting)
for i in {1..150}; do curl -X POST https://your-app.vercel.app/api/backup; done

# يجب أن ترى رسالة "Rate limit exceeded" بعد 100 طلب
```

### 7. **الصيانة الدورية**

#### أسبوعياً:
- تحقق من سجلات الأمان
- مراجعة النسخ الاحتياطية
- تحقق من أداء النظام

#### شهرياً:
- تنظيف سجلات الأمان القديمة
- مراجعة المستخدمين النشطين
- تحديث كلمات المرور إذا لزم الأمر

#### سنوياً:
- مراجعة شاملة للأمان
- تحديث التبعيات (Dependencies)
- اختبار استعادة النسخ الاحتياطية

## 🔒 **قائمة التحقق من الأمان**

### ✅ **قبل النشر**
- [ ] تم تشغيل جميع سكريبتات قاعدة البيانات
- [ ] تم تعيين متغيرات البيئة بشكل صحيح
- [ ] تم إنشاء CRON_SECRET آمن
- [ ] تم اختبار جميع الوظائف الأساسية
- [ ] تم تفعيل النسخ الاحتياطي التلقائي

### ✅ **بعد النشر**
- [ ] تم اختبار تسجيل الدخول لجميع الأدوار
- [ ] تم اختبار النسخ الاحتياطي اليدوي
- [ ] تم التحقق من عمل النسخ الاحتياطي التلقائي
- [ ] تم مراجعة سجلات الأمان
- [ ] تم اختبار حد المعدل (Rate Limiting)

## 🚨 **في حالة الطوارئ**

### استعادة النسخة الاحتياطية:
1. اذهب إلى `/backup` في التطبيق
2. اختر ملف النسخة الاحتياطية
3. اضغط "استعادة النسخة الاحتياطية"
4. انتظر حتى اكتمال العملية

### إعادة تعيين كلمة مرور المدير:
من لوحة Supabase: Authentication → Users → اختر المستخدم → Send password recovery / Reset password.
لا تضع كلمات مرور أو hashes معروفة في أي ملف داخل المستودع.

### تنظيف سجلات الأمان:
```sql
-- حذف السجلات الأقدم من 90 يوم
DELETE FROM security_logs 
WHERE timestamp < NOW() - INTERVAL '90 days';
```

## 📞 **الدعم الفني**

في حالة وجود مشاكل:
1. تحقق من سجلات Vercel
2. راجع سجلات الأمان في قاعدة البيانات
3. تأكد من عمل النسخ الاحتياطي التلقائي
4. اتصل بفريق الدعم الفني

---

**تاريخ الإنشاء**: 8 أغسطس 2025  
**الإصدار**: 2.0 Production Ready  
**الحالة**: ✅ جاهز للإنتاج