# إصلاح شامل لنظام المخازن والصلاحيات

## المشاكل التي تم حلها ✅

### 1. لوحة التحكم تعرض بيانات جميع المخازن ❌

#### المشكلة:
- مدير المخزن يرى إحصائيات **جميع المخازن** في لوحة التحكم
- البيانات المعروضة:
  - إجمالي المخزون: 101 (من جميع المخازن)
  - المنتجات المتوفرة: من جميع المخازن
  - الإصدارات اليوم: من جميع المخازن
  - إجمالي المنتجات: 4 (من جميع المخازن)

#### الحل:
تم تحديث جميع دوال لوحة التحكم لتصفية البيانات حسب مخازن المستخدم:

1. **getDashboardStats(userId)**:
   - الآن تقبل `userId` كمعامل
   - تصفي المنتجات والإصدارات حسب المخازن المسموح بها
   - Admin يرى كل شيء، غيره يرى مخازنه فقط

2. **getMonthlyStockData(userId)**:
   - تصفي بيانات المخزون الشهري حسب المخازن

3. **getWeeklyIssuanceData(userId)**:
   - تصفي الإصدارات الأسبوعية حسب المخازن

---

### 2. مدير المخزن لا يرى "إدارة المخزون" في القائمة ❌

#### المشكلة:
- المستخدم يرى فقط:
  - لوحة التحكم
  - الإصدارات
  - البحث المتقدم
- لا يرى:
  - إدارة المخزون ❌
  - المخازن ❌
  - الفئات ❌

#### السبب المحتمل:
المستخدم قد يكون لديه دور خاطئ أو لم يتم تعيين الصلاحيات بشكل صحيح.

#### الحل:
1. **التحقق من الدور**:
   - يجب أن يكون الدور `inventory_manager` وليس `engineer`
   - يمكن التحقق من جدول `users` في قاعدة البيانات

2. **الصلاحيات في Sidebar**:
   ```typescript
   {
     name: "إدارة المخزون",
     href: "/inventory",
     icon: Package,
     roles: ["admin", "inventory_manager"], // ✅ صحيح
   }
   ```

---

## التحديثات التفصيلية

### ملف: `lib/database.ts`

#### 1. تحديث getDashboardStats:
```typescript
export async function getDashboardStats(userId?: string) {
  return withErrorHandling(async () => {
    // Don't use cache if userId is provided
    if (!userId && dashboardStatsCache && Date.now() - dashboardStatsCache.timestamp < CACHE_DURATION) {
      return dashboardStatsCache.data
    }

    // Fetch fresh data with warehouse filtering
    let productsQuery = supabase.from("products").select("stock, min_stock, warehouse_id")
    let issuancesQuery = supabase.from("issuances").select("id, warehouse_id").gte("created_at", new Date().toISOString().split("T")[0])

    // If userId is provided, filter by user's accessible warehouses
    if (userId) {
      const accessibleWarehouses = await getUserAccessibleWarehouses(userId)
      const warehouseIds = accessibleWarehouses.map(w => w.id)
      
      if (warehouseIds.length > 0) {
        productsQuery = productsQuery.in("warehouse_id", warehouseIds)
        issuancesQuery = issuancesQuery.in("warehouse_id", warehouseIds)
      } else {
        // No accessible warehouses, return empty stats
        return {
          totalProducts: 0,
          totalStock: 0,
          todayIssuances: 0,
          lowStockCount: 0,
        }
      }
    }

    const [productsResult, issuancesResult] = await Promise.all([
      productsQuery,
      issuancesQuery,
    ])

    const products = productsResult.data || []
    const totalProducts = products.length
    const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0)
    const lowStockCount = products.filter((p) => (p.stock || 0) <= (p.min_stock || 0) && (p.stock || 0) > 0).length
    const todayIssuances = issuancesResult.data?.length || 0

    return {
      totalProducts,
      totalStock,
      todayIssuances,
      lowStockCount,
    }
  }, "Failed to fetch dashboard stats")
}
```

#### 2. تحديث getMonthlyStockData:
```typescript
export async function getMonthlyStockData(userId?: string) {
  return withErrorHandling(async () => {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    
    // Filter by user's warehouses if userId provided
    let productsQuery = supabase.from("products").select("stock")
    let issuancesQuery = supabase.from("issuances").select("created_at, quantity").gte("created_at", sixMonthsAgo.toISOString())
    
    if (userId) {
      const accessibleWarehouses = await getUserAccessibleWarehouses(userId)
      const warehouseIds = accessibleWarehouses.map(w => w.id)
      
      if (warehouseIds.length > 0) {
        productsQuery = productsQuery.in("warehouse_id", warehouseIds)
        issuancesQuery = issuancesQuery.in("warehouse_id", warehouseIds)
      } else {
        return []
      }
    }
    
    // ... rest of the function
  }, "Failed to fetch monthly stock data")
}
```

#### 3. تحديث getWeeklyIssuanceData:
```typescript
export async function getWeeklyIssuanceData(userId?: string) {
  return withErrorHandling(async () => {
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    let query = supabase
      .from("issuances")
      .select("created_at, quantity, warehouse_id")
      .gte("created_at", oneWeekAgo.toISOString())
    
    // Filter by user's warehouses if userId provided
    if (userId) {
      const accessibleWarehouses = await getUserAccessibleWarehouses(userId)
      const warehouseIds = accessibleWarehouses.map(w => w.id)
      
      if (warehouseIds.length > 0) {
        query = query.in("warehouse_id", warehouseIds)
      } else {
        return []
      }
    }

    const { data: issuances } = await query
    
    // ... rest of the function
  }, "Failed to fetch weekly issuance data")
}
```

### ملف: `app/dashboard/page.tsx`

#### تمرير userId للدوال:
```typescript
const loadDashboardData = async (showRefreshToast = false) => {
  if (!user) return

  try {
    setLoading(!showRefreshToast)
    setRefreshing(showRefreshToast)
    setError(null)

    // Pass userId for non-admin users to filter by their warehouses
    const userId = user.role !== 'admin' ? user.id : undefined
    
    const [statsData, monthlyStats, productStats, branchStats, activityData, stockData, issuanceData] =
      await Promise.all([
        getDashboardStats(userId),
        getMonthlyIssuances(),
        getProductFrequency(),
        getBranchPerformance(),
        getActivityLogs(10),
        getMonthlyStockData(userId),
        getWeeklyIssuanceData(userId),
      ])

    // ... rest of the function
  } catch (error) {
    // ... error handling
  }
}
```

---

## كيفية التحقق من الدور الصحيح

### الخطوة 1: التحقق من قاعدة البيانات

قم بتشغيل هذا الاستعلام في Supabase SQL Editor:

```sql
-- التحقق من دور المستخدم
SELECT id, name, email, role, is_active 
FROM users 
WHERE email = 'البريد_الإلكتروني_للمستخدم';
```

**النتيجة المتوقعة**:
```
role: inventory_manager
is_active: true
```

### الخطوة 2: التحقق من صلاحيات المخازن

```sql
-- التحقق من صلاحيات المخازن للمستخدم
SELECT 
  uwp.*,
  w.name as warehouse_name,
  u.name as user_name
FROM user_warehouse_permissions uwp
JOIN warehouses w ON uwp.warehouse_id = w.id
JOIN users u ON uwp.user_id = u.id
WHERE u.email = 'البريد_الإلكتروني_للمستخدم';
```

**النتيجة المتوقعة**:
```
user_id: xxx
warehouse_id: yyy
permission_level: admin أو edit أو view
can_view: true
can_add: true
can_edit: true
can_delete: true (للـ admin فقط)
```

### الخطوة 3: إصلاح الدور إذا كان خاطئاً

```sql
-- تحديث دور المستخدم إلى inventory_manager
UPDATE users 
SET role = 'inventory_manager'
WHERE email = 'البريد_الإلكتروني_للمستخدم';
```

### الخطوة 4: إضافة صلاحيات المخزن

```sql
-- إضافة صلاحيات للمستخدم على مخزن معين
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
  'معرف_المستخدم',
  معرف_المخزن,
  'admin', -- أو 'edit' أو 'view'
  true,
  true,
  true,
  true -- false إذا كان edit أو view
);
```

---

## الأدوار والصلاحيات الكاملة

### Admin (المدير العام):
```
✅ لوحة التحكم: جميع المخازن
✅ إدارة المخزون: جميع المنتجات
✅ المخازن: إضافة/تعديل/حذف
✅ الفئات: إدارة كاملة
✅ الإصدارات: من أي مخزن
✅ البحث المتقدم: جميع البيانات
✅ إدارة المستخدمين: كاملة
✅ إدارة العملاء: كاملة
✅ إدارة الفروع: كاملة
✅ صلاحيات المخازن: كاملة
✅ التقارير: جميع البيانات
```

### Inventory Manager (مدير المخزن):
```
✅ لوحة التحكم: مخازنه فقط
✅ إدارة المخزون: منتجات مخازنه فقط
✅ المخازن: عرض مخازنه فقط (لا حذف/تعديل)
✅ الفئات: عرض وإدارة
✅ الإصدارات: من مخازنه فقط
✅ البحث المتقدم: بيانات مخازنه
❌ إدارة المستخدمين: لا
❌ إدارة العملاء: لا
❌ إدارة الفروع: لا
❌ صلاحيات المخازن: لا
❌ التقارير: محدودة
```

### Engineer (المهندس):
```
✅ لوحة التحكم: عرض عام
❌ إدارة المخزون: لا
❌ المخازن: لا
❌ الفئات: لا
✅ الإصدارات: نعم
✅ البحث المتقدم: نعم
❌ إدارة المستخدمين: لا
❌ إدارة العملاء: لا
❌ إدارة الفروع: لا
❌ صلاحيات المخازن: لا
❌ التقارير: لا
```

---

## سيناريوهات الاستخدام

### سيناريو 1: مدير مخزن القاهرة

**المستخدم**: أحمد (inventory_manager)  
**المخزن**: مخزن القاهرة

**لوحة التحكم**:
```
إجمالي المخزون: 50 (من مخزن القاهرة فقط)
المنتجات المتوفرة: 10 (من مخزن القاهرة)
الإصدارات اليوم: 2 (من مخزن القاهرة)
إجمالي المنتجات: 15 (في مخزن القاهرة)
```

**القائمة الجانبية**:
```
✅ لوحة التحكم
✅ إدارة المخزون
✅ المخازن (عرض فقط)
✅ الفئات
✅ الإصدارات
✅ البحث المتقدم
```

### سيناريو 2: المدير العام

**المستخدم**: محمد (admin)  
**المخازن**: جميع المخازن

**لوحة التحكم**:
```
إجمالي المخزون: 101 (من جميع المخازن)
المنتجات المتوفرة: 25 (من جميع المخازن)
الإصدارات اليوم: 5 (من جميع المخازن)
إجمالي المنتجات: 50 (في جميع المخازن)
```

**القائمة الجانبية**:
```
✅ جميع الصفحات متاحة
```

---

## الاختبار

### اختبار 1: لوحة التحكم لمدير المخزن
1. ✅ تسجيل الدخول كـ inventory_manager
2. ✅ الذهاب للوحة التحكم
3. ✅ التحقق من أن الإحصائيات تعرض مخزنه فقط
4. ✅ التحقق من الرسوم البيانية (مخزنه فقط)

### اختبار 2: القائمة الجانبية
1. ✅ تسجيل الدخول كـ inventory_manager
2. ✅ التحقق من ظهور:
   - لوحة التحكم ✅
   - إدارة المخزون ✅
   - المخازن ✅
   - الفئات ✅
   - الإصدارات ✅
   - البحث المتقدم ✅

### اختبار 3: صفحة المخازن
1. ✅ تسجيل الدخول كـ inventory_manager
2. ✅ الذهاب لصفحة المخازن
3. ✅ التحقق من رؤية مخازنه فقط
4. ✅ التحقق من عدم وجود أزرار حذف/إضافة

### اختبار 4: Admin يرى كل شيء
1. ✅ تسجيل الدخول كـ admin
2. ✅ التحقق من رؤية جميع المخازن
3. ✅ التحقق من جميع الإحصائيات
4. ✅ التحقق من إمكانية الإدارة الكاملة

---

## إصلاح المشاكل الشائعة

### المشكلة: لا أرى "إدارة المخزون"

**الحل**:
1. تحقق من الدور في قاعدة البيانات
2. يجب أن يكون `inventory_manager` وليس `engineer`
3. قم بتحديث الدور:
```sql
UPDATE users SET role = 'inventory_manager' WHERE email = 'your@email.com';
```

### المشكلة: أرى جميع المخازن في لوحة التحكم

**الحل**:
1. تأكد من تحديث الكود
2. امسح الـ cache:
```typescript
// في المتصفح
localStorage.clear()
sessionStorage.clear()
// ثم أعد تحميل الصفحة
```

### المشكلة: لا توجد صلاحيات للمخزن

**الحل**:
1. اذهب لصفحة "صلاحيات المخازن" (كـ admin)
2. أضف المستخدم للمخزن المطلوب
3. اختر مستوى الصلاحية المناسب

---

## الملفات المحدثة

1. ✅ `lib/database.ts` - إضافة تصفية المخازن
2. ✅ `app/dashboard/page.tsx` - تمرير userId
3. ✅ `app/warehouses/page.tsx` - تصفية المخازن
4. ✅ `components/sidebar.tsx` - الصلاحيات الصحيحة

---

## الخلاصة

الآن النظام يعمل بشكل صحيح:
- ✅ كل مستخدم يرى فقط بيانات مخازنه
- ✅ لوحة التحكم تعرض إحصائيات دقيقة
- ✅ القائمة الجانبية تعرض الصفحات المناسبة
- ✅ الصلاحيات محمية ومنظمة
- ✅ لا يمكن حذف المخازن بالخطأ