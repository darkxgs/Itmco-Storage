-- فحص المستخدمين الفعليين الموجودين في قاعدة البيانات
-- للمقارنة مع المعرفات المقدمة في البيانات

-- 1. عرض جميع المستخدمين الموجودين في قاعدة البيانات
SELECT 
    id,
    email,
    name,
    role,
    created_at
FROM users
ORDER BY created_at DESC;

-- 2. فحص المعرفات المحددة من البيانات المقدمة
-- (هذه المعرفات التي تسبب مشكلة Foreign Key)
SELECT 
    '4217434d-14fd-494c-861c-eb732ded6a4f' as provided_id,
    CASE 
        WHEN EXISTS (SELECT 1 FROM users WHERE id = '4217434d-14fd-494c-861c-eb732ded6a4f') 
        THEN 'موجود' 
        ELSE 'غير موجود' 
    END as status
UNION ALL
SELECT 
    '8b2c1a5e-9f3d-4e7a-b6c8-1d2e3f4a5b6c' as provided_id,
    CASE 
        WHEN EXISTS (SELECT 1 FROM users WHERE id = '8b2c1a5e-9f3d-4e7a-b6c8-1d2e3f4a5b6c') 
        THEN 'موجود' 
        ELSE 'غير موجود' 
    END as status
UNION ALL
SELECT 
    '3f8e2d1c-7a4b-4c5d-9e6f-2a1b3c4d5e6f' as provided_id,
    CASE 
        WHEN EXISTS (SELECT 1 FROM users WHERE id = '3f8e2d1c-7a4b-4c5d-9e6f-2a1b3c4d5e6f') 
        THEN 'موجود' 
        ELSE 'غير موجود' 
    END as status
UNION ALL
SELECT 
    '9c5a7b2e-1f4d-4a8c-b3e6-5d7f8a9b1c2d' as provided_id,
    CASE 
        WHEN EXISTS (SELECT 1 FROM users WHERE id = '9c5a7b2e-1f4d-4a8c-b3e6-5d7f8a9b1c2d') 
        THEN 'موجود' 
        ELSE 'غير موجود' 
    END as status;

-- 3. البحث عن المستخدمين بالبريد الإلكتروني
-- للتحقق من وجودهم بمعرفات مختلفة
SELECT 
    id,
    email,
    name,
    role
FROM users 
WHERE email IN (
    'admin@itmco.com',
    'engineer@itmco.com', 
    'inventory@itmco.com',
    'test@itmco.com'
);

-- 4. عدد المستخدمين الإجمالي
SELECT COUNT(*) as total_users FROM users;

-- 5. فحص آخر المستخدمين المضافين
SELECT 
    id,
    email,
    name,
    role,
    created_at
FROM users
ORDER BY created_at DESC
LIMIT 10;