# دليل ترحيل قاعدة البيانات - إضافة عمود الوصف

## المشكلة
كان النظام يحاول استخدام عمود `description` في جدول `products` ولكن هذا العمود غير موجود في قاعدة البيانات.

## الحل

### 1. للمشاريع الجديدة
استخدم السكريبت المحدث `scripts/init-database-simple.sql` الذي يتضمن عمود `description`.

### 2. للمشاريع الموجودة
شغل السكريبت التالي في Supabase SQL Editor:

```sql
-- إضافة عمود الوصف إلى جدول المنتجات
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
```

### 3. التحقق من التحديث
```sql
-- التحقق من بنية الجدول
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'products' 
ORDER BY ordinal_position;
```

## التغييرات المطبقة

### 1. تحديث السكريبت الأساسي
- ✅ إضافة عمود `description TEXT` إلى جدول `products`

### 2. تحديث أنواع البيانات في TypeScript
- ✅ إضافة أنواع `Product`, `ProductInsert`, `ProductUpdate`
- ✅ تحديث أنواع `Issuance` و `IssuanceInsert`
- ✅ مطابقة الأنواع مع بنية قاعدة البيانات الفعلية

### 3. تحديث دوال قاعدة البيانات
- ✅ تحديث `createProduct` لدعم عمود `description`
- ✅ تحديث `updateProduct` لدعم عمود `description`
- ✅ تحسين معالجة الأخطاء والتحقق من الأنواع

## خطوات التطبيق

### الخطوة 1: تحديث قاعدة البيانات
```bash
# في Supabase SQL Editor، شغل:
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
```

### الخطوة 2: إعادة تشغيل التطبيق
```bash
npm run dev
```

### الخطوة 3: اختبار الوظيفة
1. اذهب إلى صفحة إدارة المخزون
2. جرب إضافة منتج جديد مع وصف
3. تأكد من عدم ظهور أخطاء

## التحقق من نجاح التحديث

### في Supabase Dashboard:
1. اذهب إلى Table Editor
2. اختر جدول `products`
3. تأكد من وجود عمود `description` من نوع `text`

### في التطبيق:
1. جرب إضافة منتج جديد
2. أضف وصف في حقل الوصف
3. تأكد من حفظ البيانات بنجاح

## ملاحظات مهمة

- ✅ العمود `description` اختياري (nullable)
- ✅ المنتجات الموجودة ستحتوي على `null` في عمود الوصف
- ✅ يمكن تحديث المنتجات الموجودة لإضافة وصف لاحقاً
- ✅ النظام يعمل بشكل طبيعي مع أو بدون وصف

## استكشاف الأخطاء

### خطأ "column does not exist"
```sql
-- تأكد من إضافة العمود
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
```

### خطأ في الأنواع TypeScript
```bash
# أعد تشغيل خادم التطوير
npm run dev
```

### خطأ في Supabase Types
```bash
# تأكد من تحديث ملف lib/supabase.ts
# أو أعد إنشاء الأنواع من Supabase CLI
```

---

**تاريخ التحديث**: 8 أغسطس 2025  
**الحالة**: ✅ مكتمل ومُختبر