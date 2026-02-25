-- سكريبت شامل لإنشاء مدير مخزن مع الصلاحيات
-- قم بتشغيل هذا في Supabase SQL Editor

-- ========================================
-- الخطوة 1: عرض المخازن المتاحة
-- ========================================

SELECT 
  id,
  warehouse_number,
  name,
  location,
  is_active
FROM warehouses
WHERE is_active = true
ORDER BY warehouse_number;

-- ========================================
-- الخطوة 2: إنشاء مستخدم جديد
-- ========================================

-- ملاحظة: يجب تشفير كلمة المرور باستخدام bcrypt
-- يمكنك استخدام موقع مثل: https://bcrypt-generator.com/
-- أو إنشاء المستخدم من واجهة "إدارة المستخدمين"

-- مثال: إنشاء مستخدم جديد
DO $$
DECLARE
  v_user_id TEXT;
  v_user_email TEXT := 'manager@company.com'; -- ضع البريد الإلكتروني هنا
  v_user_name TEXT := 'مدير المخزن'; -- ضع الاسم هنا
  v_user_password TEXT := '$2a$10$YourHashedPasswordHere'; -- ضع كلمة المرور المشفرة هنا
BEGIN
  -- التحقق من عدم وجود المستخدم
  SELECT id INTO v_user_id
  FROM users
  WHERE email = v_user_email;
  
  IF v_user_id IS NULL THEN
    -- إنشاء المستخدم
    INSERT INTO users (
      name,
      email,
      password_hash,
      role,
      is_active
    )
    VALUES (
      v_user_name,
      v_user_email,
      v_user_password,
      'inventory_manager',
      true
    )
    RETURNING id INTO v_user_id;
    
    RAISE NOTICE 'تم إنشاء المستخدم بنجاح: %', v_user_email;
    RAISE NOTICE 'معرف المستخدم: %', v_user_id;
  ELSE
    RAISE NOTICE 'المستخدم موجود بالفعل: %', v_user_email;
  END IF;
END $$;

-- ========================================
-- الخطوة 3: منح صلاحيات المخزن
-- ========================================

-- منح صلاحيات لمخزن واحد
DO $$
DECLARE
  v_user_id TEXT;
  v_warehouse_id INTEGER;
  v_user_email TEXT := 'manager@company.com'; -- ضع البريد الإلكتروني هنا
  v_warehouse_name TEXT := 'مخزن القاهرة'; -- ضع اسم المخزن هنا
BEGIN
  -- الحصول على معرف المستخدم
  SELECT id INTO v_user_id
  FROM users
  WHERE email = v_user_email;
  
  -- الحصول على معرف المخزن
  SELECT id INTO v_warehouse_id
  FROM warehouses
  WHERE name = v_warehouse_name
    AND is_active = true;
  
  IF v_user_id IS NOT NULL AND v_warehouse_id IS NOT NULL THEN
    -- منح الصلاحيات
    INSERT INTO user_warehouse_permissions (
      user_id,
      warehouse_id,
      permission_level,
      can_view,
      can_add,
      can_edit,
      can_delete
    )
    VALUES (
      v_user_id,
      v_warehouse_id,
      'admin', -- يمكن تغييره إلى 'edit' أو 'view'
      true,
      true,
      true,
      true -- false إذا كان 'edit' أو 'view'
    )
    ON CONFLICT (user_id, warehouse_id) 
    DO UPDATE SET
      permission_level = 'admin',
      can_view = true,
      can_add = true,
      can_edit = true,
      can_delete = true,
      updated_at = NOW();
    
    RAISE NOTICE 'تم منح صلاحيات المخزن: % للمستخدم: %', v_warehouse_name, v_user_email;
  ELSE
    IF v_user_id IS NULL THEN
      RAISE NOTICE 'لم يتم العثور على المستخدم: %', v_user_email;
    END IF;
    IF v_warehouse_id IS NULL THEN
      RAISE NOTICE 'لم يتم العثور على المخزن: %', v_warehouse_name;
    END IF;
  END IF;
END $$;

-- ========================================
-- الخطوة 4: منح صلاحيات لعدة مخازن (اختياري)
-- ========================================

-- منح صلاحيات لعدة مخازن محددة
DO $$
DECLARE
  v_user_id TEXT;
  v_user_email TEXT := 'manager@company.com'; -- ضع البريد الإلكتروني هنا
  v_warehouse_names TEXT[] := ARRAY['مخزن القاهرة', 'مخزن الإسكندرية']; -- أسماء المخازن
  v_warehouse_name TEXT;
  v_warehouse_id INTEGER;
BEGIN
  -- الحصول على معرف المستخدم
  SELECT id INTO v_user_id
  FROM users
  WHERE email = v_user_email;
  
  IF v_user_id IS NOT NULL THEN
    -- منح صلاحيات لكل مخزن
    FOREACH v_warehouse_name IN ARRAY v_warehouse_names
    LOOP
      SELECT id INTO v_warehouse_id
      FROM warehouses
      WHERE name = v_warehouse_name
        AND is_active = true;
      
      IF v_warehouse_id IS NOT NULL THEN
        INSERT INTO user_warehouse_permissions (
          user_id,
          warehouse_id,
          permission_level,
          can_view,
          can_add,
          can_edit,
          can_delete
        )
        VALUES (
          v_user_id,
          v_warehouse_id,
          'edit', -- صلاحيات تعديل
          true,
          true,
          true,
          false -- لا يمكن الحذف
        )
        ON CONFLICT (user_id, warehouse_id) DO NOTHING;
        
        RAISE NOTICE 'تم منح صلاحيات المخزن: %', v_warehouse_name;
      ELSE
        RAISE NOTICE 'لم يتم العثور على المخزن: %', v_warehouse_name;
      END IF;
    END LOOP;
  ELSE
    RAISE NOTICE 'لم يتم العثور على المستخدم: %', v_user_email;
  END IF;
END $$;

-- ========================================
-- الخطوة 5: التحقق من الصلاحيات
-- ========================================

-- عرض صلاحيات المستخدم
SELECT 
  u.name as user_name,
  u.email,
  u.role,
  u.is_active,
  w.warehouse_number,
  w.name as warehouse_name,
  uwp.permission_level,
  uwp.can_view,
  uwp.can_add,
  uwp.can_edit,
  uwp.can_delete,
  uwp.created_at
FROM user_warehouse_permissions uwp
JOIN users u ON uwp.user_id = u.id
JOIN warehouses w ON uwp.warehouse_id = w.id
WHERE u.email = 'manager@company.com' -- ضع البريد الإلكتروني هنا
ORDER BY w.warehouse_number;

-- ========================================
-- الخطوة 6: تحديث صلاحيات موجودة (اختياري)
-- ========================================

-- تحديث مستوى الصلاحية
UPDATE user_warehouse_permissions
SET 
  permission_level = 'admin',
  can_view = true,
  can_add = true,
  can_edit = true,
  can_delete = true,
  updated_at = NOW()
WHERE user_id = (SELECT id FROM users WHERE email = 'manager@company.com')
  AND warehouse_id = (SELECT id FROM warehouses WHERE name = 'مخزن القاهرة');

-- ========================================
-- الخطوة 7: حذف صلاحيات (اختياري)
-- ========================================

-- حذف صلاحية مخزن معين
DELETE FROM user_warehouse_permissions
WHERE user_id = (SELECT id FROM users WHERE email = 'manager@company.com')
  AND warehouse_id = (SELECT id FROM warehouses WHERE name = 'مخزن القاهرة');

-- ========================================
-- استعلامات مفيدة
-- ========================================

-- 1. عرض جميع المستخدمين وصلاحياتهم
SELECT 
  u.name,
  u.email,
  u.role,
  u.is_active,
  COUNT(uwp.id) as warehouses_count,
  STRING_AGG(w.name, ', ' ORDER BY w.name) as warehouses
FROM users u
LEFT JOIN user_warehouse_permissions uwp ON u.id = uwp.user_id
LEFT JOIN warehouses w ON uwp.warehouse_id = w.id
WHERE u.role = 'inventory_manager'
GROUP BY u.id, u.name, u.email, u.role, u.is_active
ORDER BY u.name;

-- 2. عرض المخازن وعدد المديرين لكل مخزن
SELECT 
  w.warehouse_number,
  w.name,
  w.location,
  w.is_active,
  COUNT(uwp.id) as managers_count,
  STRING_AGG(u.name, ', ' ORDER BY u.name) as managers
FROM warehouses w
LEFT JOIN user_warehouse_permissions uwp ON w.id = uwp.warehouse_id
LEFT JOIN users u ON uwp.user_id = u.id
WHERE w.is_active = true
GROUP BY w.id, w.warehouse_number, w.name, w.location, w.is_active
ORDER BY w.warehouse_number;

-- 3. عرض المستخدمين بدون صلاحيات
SELECT 
  u.name,
  u.email,
  u.role,
  u.is_active,
  u.created_at
FROM users u
LEFT JOIN user_warehouse_permissions uwp ON u.id = uwp.user_id
WHERE u.role = 'inventory_manager'
  AND u.is_active = true
  AND uwp.id IS NULL
ORDER BY u.created_at DESC;

-- 4. عرض تفاصيل صلاحيات مستخدم معين
SELECT 
  u.name as "اسم المستخدم",
  u.email as "البريد الإلكتروني",
  u.role as "الدور",
  w.name as "المخزن",
  uwp.permission_level as "مستوى الصلاحية",
  CASE 
    WHEN uwp.can_view THEN '✓' ELSE '✗' 
  END as "عرض",
  CASE 
    WHEN uwp.can_add THEN '✓' ELSE '✗' 
  END as "إضافة",
  CASE 
    WHEN uwp.can_edit THEN '✓' ELSE '✗' 
  END as "تعديل",
  CASE 
    WHEN uwp.can_delete THEN '✓' ELSE '✗' 
  END as "حذف"
FROM user_warehouse_permissions uwp
JOIN users u ON uwp.user_id = u.id
JOIN warehouses w ON uwp.warehouse_id = w.id
WHERE u.email = 'manager@company.com' -- ضع البريد الإلكتروني هنا
ORDER BY w.name;

-- ========================================
-- قالب سريع لإنشاء مستخدم كامل
-- ========================================

-- استبدل القيم التالية:
-- - YOUR_EMAIL: البريد الإلكتروني
-- - YOUR_NAME: الاسم
-- - YOUR_HASHED_PASSWORD: كلمة المرور المشفرة
-- - YOUR_WAREHOUSE: اسم المخزن

DO $$
DECLARE
  v_user_id TEXT;
  v_warehouse_id INTEGER;
BEGIN
  -- إنشاء المستخدم
  INSERT INTO users (name, email, password_hash, role, is_active)
  VALUES ('YOUR_NAME', 'YOUR_EMAIL', 'YOUR_HASHED_PASSWORD', 'inventory_manager', true)
  ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active
  RETURNING id INTO v_user_id;
  
  -- منح صلاحيات المخزن
  SELECT id INTO v_warehouse_id FROM warehouses WHERE name = 'YOUR_WAREHOUSE' AND is_active = true;
  
  IF v_warehouse_id IS NOT NULL THEN
    INSERT INTO user_warehouse_permissions (
      user_id, warehouse_id, permission_level,
      can_view, can_add, can_edit, can_delete
    )
    VALUES (v_user_id, v_warehouse_id, 'admin', true, true, true, true)
    ON CONFLICT (user_id, warehouse_id) DO UPDATE SET
      permission_level = 'admin',
      can_view = true,
      can_add = true,
      can_edit = true,
      can_delete = true;
    
    RAISE NOTICE 'تم إنشاء المستخدم ومنح الصلاحيات بنجاح!';
  ELSE
    RAISE NOTICE 'تم إنشاء المستخدم ولكن لم يتم العثور على المخزن';
  END IF;
END $$;

-- ========================================
-- ملاحظات مهمة
-- ========================================

/*
1. استبدل القيم التالية قبل التشغيل:
   - manager@company.com: البريد الإلكتروني الفعلي
   - مدير المخزن: الاسم الفعلي
   - مخزن القاهرة: اسم المخزن الفعلي
   - $2a$10$...: كلمة المرور المشفرة

2. لتشفير كلمة المرور:
   - استخدم موقع: https://bcrypt-generator.com/
   - أو أنشئ المستخدم من واجهة "إدارة المستخدمين"

3. مستويات الصلاحية:
   - view: عرض فقط
   - edit: عرض + إضافة + تعديل
   - admin: جميع الصلاحيات

4. الصلاحيات التفصيلية:
   - can_view: رؤية البيانات
   - can_add: إضافة منتجات
   - can_edit: تعديل منتجات
   - can_delete: حذف منتجات

5. للتحقق من نجاح العملية:
   - قم بتشغيل استعلام التحقق في الخطوة 5
   - سجل الدخول بالحساب الجديد
   - تحقق من القائمة الجانبية ولوحة التحكم
*/

SELECT 'تم الانتهاء من السكريبت!' as status;