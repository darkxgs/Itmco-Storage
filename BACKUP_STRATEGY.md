# استراتيجية النسخ الاحتياطي - نظام إدارة المخزون ITMCO

## 🛡️ استراتيجية النسخ الاحتياطي الشاملة

### 1. النسخ الاحتياطي على مستوى التطبيق

#### النسخ اليدوي
- **الموقع**: `/backup` في النظام
- **التكرار**: حسب الحاجة
- **الصيغة**: JSON
- **المحتوى**: جميع الجداول والبيانات

#### النسخ التلقائي
- **التكرار**: يومي (منتصف الليل)
- **الاحتفاظ**: آخر 30 نسخة
- **التنبيهات**: عند فشل النسخ

### 2. النسخ الاحتياطي في Supabase

#### Point-in-Time Recovery (PITR)
\`\`\`sql
-- تفعيل PITR في Supabase
-- يتم تلقائياً في الخطط المدفوعة
-- يسمح بالاستعادة لأي نقطة زمنية خلال آخر 7 أيام
\`\`\`

#### النسخ اليومي التلقائي
- **التوقيت**: 2:00 صباحاً بتوقيت السعودية
- **الاحتفاظ**: 7 أيام للخطة المجانية، 30 يوم للمدفوعة
- **الموقع**: Supabase Dashboard → Settings → Database

### 3. النسخ الاحتياطي السحابي

#### Google Drive Integration
\`\`\`javascript
// مثال على رفع النسخة لـ Google Drive
async function uploadToGoogleDrive(backupData) {
  const formData = new FormData();
  const blob = new Blob([JSON.stringify(backupData)], { type: 'application/json' });
  formData.append('file', blob, `itmco-backup-${new Date().toISOString()}.json`);
  
  // رفع للـ Google Drive API
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    body: formData
  });
}
\`\`\`

## 📋 جدول النسخ الاحتياطي

| النوع | التكرار | الاحتفاظ | الموقع | المسؤول |
|-------|---------|---------|--------|----------|
| تطبيق يدوي | حسب الحاجة | محلي | النظام | المدير |
| تطبيق تلقائي | يومي | 30 يوم | محلي | النظام |
| Supabase تلقائي | يومي | 7-30 يوم | Supabase | تلقائي |
| سحابي | أسبوعي | 90 يوم | Google Drive | مجدول |

## 🔧 إعداد النسخ التلقائي

### 1. في Supabase Dashboard

1. **اذهب إلى Settings → Database**
2. **فعّل Automatic Backups**
3. **اختر التوقيت المناسب**
4. **حدد مدة الاحتفاظ**

### 2. في النظام

\`\`\`typescript
// إعداد النسخ التلقائي
const scheduleAutoBackup = () => {
  // كل يوم في منتصف الليل
  setInterval(async () => {
    try {
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'auto', tables: ['users', 'products', 'issuances', 'activity_logs'] })
      });
      
      const backupData = await response.json();
      
      // حفظ محلي
      localStorage.setItem(`auto_backup_${Date.now()}`, JSON.stringify(backupData));
      
      // رفع سحابي (اختياري)
      await uploadToCloud(backupData);
      
    } catch (error) {
      console.error('Auto backup failed:', error);
      // إرسال تنبيه للمدير
      sendBackupAlert(error);
    }
  }, 24 * 60 * 60 * 1000); // كل 24 ساعة
};
\`\`\`

### 3. Vercel Cron Jobs

\`\`\`typescript
// api/cron/backup.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // التحقق من صحة الطلب
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // إنشاء نسخة احتياطية
    const backupData = await createBackup();
    
    // رفع للتخزين السحابي
    await uploadToStorage(backupData);
    
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
\`\`\`

## 🚨 خطة الطوارئ

### في حالة فقدان البيانات

1. **التقييم الفوري**
   - تحديد نطاق الفقدان
   - تحديد آخر نسخة احتياطية صالحة
   - إيقاف النظام مؤقتاً

2. **الاستعادة**
   \`\`\`bash
   # استعادة من Supabase PITR
   # في Supabase Dashboard → Settings → Database → Point in Time Recovery
   
   # أو استعادة من النسخة المحلية
   # استخدام /backup في النظام
   \`\`\`

3. **التحقق**
   - اختبار تسجيل الدخول
   - التحقق من اكتمال البيانات
   - اختبار الوظائف الأساسية

4. **الإبلاغ**
   - توثيق الحادثة
   - تحديث إجراءات النسخ
   - تدريب الفريق

## 📊 مراقبة النسخ الاحتياطي

### مؤشرات الأداء الرئيسية (KPIs)

- **معدل نجاح النسخ**: > 99%
- **وقت إنشاء النسخة**: < 5 دقائق
- **حجم النسخة**: مراقبة النمو
- **وقت الاستعادة**: < 30 دقيقة

### التنبيهات

\`\`\`typescript
// نظام التنبيهات
const sendBackupAlert = async (error: Error) => {
  const alertData = {
    type: 'backup_failure',
    timestamp: new Date().toISOString(),
    error: error.message,
    system: 'ITMCO Inventory'
  };
  
  // إرسال بريد إلكتروني
  await sendEmail({
    to: 'admin@itmco.com',
    subject: 'تنبيه: فشل النسخ الاحتياطي',
    body: `فشل في إنشاء النسخة الاحتياطية: ${error.message}`
  });
  
  // إرسال SMS (اختياري)
  await sendSMS({
    to: '+966XXXXXXXXX',
    message: 'تنبيه: فشل النسخ الاحتياطي لنظام ITMCO'
  });
};
\`\`\`

## 🔐 أمان النسخ الاحتياطي

### التشفير
- **أثناء النقل**: HTTPS/TLS
- **أثناء التخزين**: AES-256
- **كلمات المرور**: مُشفرة بـ bcrypt

### التحكم في الوصول
- **النسخ**: مديري النظام فقط
- **الاستعادة**: مديري النظام + موافقة إضافية
- **التحميل**: سجل مراجعة كامل

### الامتثال
- **GDPR**: حذف البيانات الشخصية عند الطلب
- **SOX**: الاحتفاظ بسجلات المراجعة
- **ISO 27001**: إجراءات أمان البيانات

## 📞 جهات الاتصال في الطوارئ

| الدور | الاسم | الهاتف | البريد الإلكتروني |
|-------|------|--------|-------------------|
| مدير النظام | [الاسم] | +966XXXXXXXXX | admin@itmco.com |
| مدير قاعدة البيانات | [الاسم] | +966XXXXXXXXX | dba@itmco.com |
| الدعم الفني | [الاسم] | +966XXXXXXXXX | support@itmco.com |

## 📝 سجل التحديثات

| التاريخ | النسخة | التغييرات | المسؤول |
|---------|--------|-----------|----------|
| 2024-01-20 | 1.0 | إنشاء الاستراتيجية الأولى | فريق التطوير |
| | | | |
\`\`\`

Now let's add the backup route to the sidebar:
