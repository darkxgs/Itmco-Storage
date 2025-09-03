-- إضافة المستخدمين المفقودين إلى قاعدة البيانات
-- يجب تشغيل هذا الملف لحل مشكلة انتهاك قيود المفتاح الخارجي

-- التحقق من المستخدمين الموجودين أولاً
SELECT 'المستخدمون الموجودون حالياً:' as info;
SELECT id, email, name, role FROM users ORDER BY email;

-- إضافة المستخدمين المفقودين
-- ملاحظة: يجب استبدال كلمات المرور المؤقتة بكلمات مرور حقيقية مشفرة

-- إضافة مدير النظام
INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
VALUES (
    '4217434d-14fd-494c-861c-eb732ded6a4f',
    'itmcoadmin@gmail.com',
    'مدير النظام',
    'admin',
    '$2b$10$YourActualHashedPasswordHere',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- إضافة المهندس
INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
VALUES (
    '0b1becf8-9c44-48ab-82f9-d060a4d7c6fb',
    'engineer@itmco.com',
    'مهندس',
    'engineer',
    '$2b$10$YourActualHashedPasswordHere',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- إضافة مدير المخزون
INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
VALUES (
    '8568a82e-dbbf-402f-9ccb-11fb7afa8bca',
    'inventory@itmco.com',
    'مدير المخزون',
    'inventory_manager',
    '$2b$10$YourActualHashedPasswordHere',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- إضافة المستخدم التجريبي
INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
VALUES (
    'c1956708-a4c7-448d-9fce-e5b66cc05bcd',
    'testtest@gmail.com',
    'TESTtest',
    'inventory_manager',
    '$2b$10$YourActualHashedPasswordHere',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- التحقق من إضافة المستخدمين بنجاح
SELECT 'المستخدمون بعد الإضافة:' as info;
SELECT id, email, name, role, created_at FROM users WHERE id IN (
    '4217434d-14fd-494c-861c-eb732ded6a4f',
    '0b1becf8-9c44-48ab-82f9-d060a4d7c6fb',
    '8568a82e-dbbf-402f-9ccb-11fb7afa8bca',
    'c1956708-a4c7-448d-9fce-e5b66cc05bcd'
) ORDER BY email;

-- عرض عدد المستخدمين الإجمالي
SELECT 'إجمالي المستخدمين:' as info, COUNT(*) as total_users FROM users;