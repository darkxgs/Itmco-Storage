-- إصلاح دور المستخدم وصلاحيات المخزن
-- قم بتشغيل هذا في Supabase SQL Editor

-- ========================================
-- الخطوة 1: التحقق من المستخدمين الحاليين
-- ========================================

-- عرض جميع المستخدمين وأدوارهم
SELECT 
  id,
  name,
  email,
  role,
  is_active,
  created_at
FROM users
ORDER BY created_at DESC;

-- ========================================
-- الخطوة 2: تحديث دور المستخدم إلى inventory_manager
-- ========================================

-- استبدل 'user@email.com' ببريد المستخدم الفعلي
UPDATE users 
SET role = 'inventory_manager'
WHERE email = 'user@email.com' -- ضع البريد الإلكتروني هنا
  AND role != 'admin'; -- لا تغير دور الـ admin

-- ========================================
-- الخطوة 3: التحقق من المخازن المتاحة
-- ========================================

-- عرض جميع المخازن
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
-- الخطوة 4: إضافة صلاحيات المخزن للمستخدم
-- ========================================

-- احصل على معرف المستخدم أولاً
-- استبدل 'user@email.com' ببريد المستخدم
DO $$
DECLARE
  v_user_id TEXT;
  v_warehouse_id INTEGER;
BEGIN
  -- الحصول على معرف المستخدم
  SELECT id INTO v_user_id
  FROM users
  WHERE email = 'user@email.com'; -- ضع البريد الإلكتروني هنا
  
  -- الحصول على معرف المخزن (أول مخزن نشط)
  SELECT id INTO v_warehouse_id
  FROM warehouses
  WHERE is_active = true
  LIMIT 1;
  
  -- إضافة الصلاحيات إذا لم تكن موجودة
  IF v_user_id IS NOT NULL AND v_warehouse_id IS NOT NULL THEN
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
      'admin', -- أو 'edit' أو 'view' حسب الحاجة
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
    
    RAISE NOTICE 'تم إضافة/تحديث صلاحيات المستخدم للمخزن';
  ELSE
    RAISE NOTICE 'لم يتم العثور على المستخدم أو المخزن';
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
  w.warehouse_number,
  w.name as warehouse_name,
  uwp.permission_level,
  uwp.can_view,
  uwp.can_add,
  uwp.can_edit,
  uwp.can_delete
FROM user_warehouse_permissions uwp
JOIN users u ON uwp.user_id = u.id
JOIN warehouses w ON uwp.warehouse_id = w.id
WHERE u.email = 'user@email.com' -- ضع البريد الإلكتروني هنا
ORDER BY w.warehouse_number;

-- ========================================
-- الخطوة 6: إضافة صلاحيات لمخازن متعددة (اختياري)
-- ========================================

-- إذا كنت تريد إضافة المستخدم لعدة مخازن
DO $$
DECLARE
  v_user_id TEXT;
  v_warehouse RECORD;
BEGIN
  -- الحصول على معرف المستخدم
  SELECT id INTO v_user_id
  FROM users
  WHERE email = 'user@email.com'; -- ضع البريد الإلكتروني هنا
  
  -- إضافة المستخدم لجميع المخازن النشطة
  FOR v_warehouse IN 
    SELECT id FROM warehouses WHERE is_active = true
  LOOP
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
      v_warehouse.id,
      'edit', -- يمكن التعديل ولكن لا يمكن الحذف
      true,
      true,
      true,
      false -- لا يمكن حذف المخازن
    )
    ON CONFLICT (user_id, warehouse_id) DO NOTHING;
  END LOOP;
  
  RAISE NOTICE 'تم إضافة المستخدم لجميع المخازن النشطة';
END $$;

-- ========================================
-- الخطوة 7: حذف صلاحيات (إذا لزم الأمر)
-- ========================================

-- حذف صلاحيات مستخدم من مخزن معين
-- DELETE FROM user_warehouse_permissions
-- WHERE user_id = 'معرف_المستخدم'
--   AND warehouse_id = معرف_المخزن;

-- ========================================
-- الخطوة 8: إنشاء مستخدم جديد (اختياري)
-- ========================================

-- إنشاء مستخدم جديد كمدير مخزن
-- ملاحظة: يجب تشفير كلمة المرور باستخدام bcrypt
-- INSERT INTO users (
--   name,
--   email,
--   password_hash,
--   role,
--   is_active
-- )
-- VALUES (
--   'اسم المستخدم',
--   'email@example.com',
--   'كلمة_المرور_المشفرة', -- استخدم bcrypt
--   'inventory_manager',
--   true
-- );

-- ========================================
-- استعلامات مفيدة للتحقق
-- ========================================

-- 1. عرض جميع المستخدمين وصلاحياتهم
SELECT 
  u.name,
  u.email,
  u.role,
  COUNT(uwp.id) as warehouses_count,
  STRING_AGG(w.name, ', ') as warehouses
FROM users u
LEFT JOIN user_warehouse_permissions uwp ON u.id = uwp.user_id
LEFT JOIN warehouses w ON uwp.warehouse_id = w.id
GROUP BY u.id, u.name, u.email, u.role
ORDER BY u.role, u.name;

-- 2. عرض المخازن بدون مديرين
SELECT 
  w.warehouse_number,
  w.name,
  w.location,
  COUNT(uwp.id) as managers_count
FROM warehouses w
LEFT JOIN user_warehouse_permissions uwp ON w.id = uwp.warehouse_id
WHERE w.is_active = true
GROUP BY w.id, w.warehouse_number, w.name, w.location
HAVING COUNT(uwp.id) = 0
ORDER BY w.warehouse_number;

-- 3. عرض المستخدمين بدون صلاحيات مخازن
SELECT 
  u.name,
  u.email,
  u.role
FROM users u
LEFT JOIN user_warehouse_permissions uwp ON u.id = uwp.user_id
WHERE u.role = 'inventory_manager'
  AND u.is_active = true
  AND uwp.id IS NULL
ORDER BY u.name;

-- ========================================
-- ملاحظات مهمة
-- ========================================

-- 1. استبدل 'user@email.com' بالبريد الإلكتروني الفعلي للمستخدم
-- 2. تأكد من أن المستخدم لديه دور 'inventory_manager' وليس 'engineer'
-- 3. تأكد من إضافة صلاحيات المخزن للمستخدم
-- 4. permission_level يمكن أن يكون: 'admin', 'edit', 'view'
-- 5. can_delete يجب أن يكون false لغير الـ admin

SELECT 'تم الانتهاء من السكريبت!' as status;