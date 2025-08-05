# إصلاح الصفحات المتبقية

## الصفحات التي تحتاج إصلاح:

1. **app/users/page.tsx** - ✅ تم الإصلاح جزئياً
2. **app/reports/page.tsx** - ✅ تم الإصلاح جزئياً  
3. **app/search/page.tsx** - ❌ يحتاج إصلاح
4. **app/settings/page.tsx** - ❌ يحتاج إصلاح
5. **app/issuance/page.tsx** - ❌ يحتاج إصلاح
6. **app/backup/page.tsx** - ❌ يحتاج إصلاح
7. **app/page.tsx** - ❌ يحتاج إصلاح

## التغييرات المطلوبة لكل صفحة:

### 1. تحديث الاستيرادات:
```typescript
// إزالة
import { useRouter } from "next/navigation"

// إضافة
import { useAuth } from "@/hooks/use-auth"
```

### 2. تحديث المتغيرات:
```typescript
// إزالة
const [user, setUser] = useState<any>(null)
const router = useRouter()

// إضافة
const { user, loading: authLoading } = useAuth()
```

### 3. إزالة useEffect للمصادقة:
```typescript
// إزالة هذا الكود
useEffect(() => {
  const userData = localStorage.getItem("user")
  if (!userData) {
    router.push("/login")
    return
  }
  const parsedUser = JSON.parse(userData)
  // ... باقي الكود
}, [router])
```

### 4. تحديث التحقق من الصلاحيات:
```typescript
// إضافة
useEffect(() => {
  if (user && !["admin", "inventory_manager"].includes(user.role)) {
    toast({
      title: "غير مصرح لك",
      description: "ليس لديك صلاحية للوصول إلى هذه الصفحة",
      variant: "destructive",
    })
    window.location.href = "/dashboard"
  }
}, [user, toast])
```

### 5. تحديث شرط التحميل:
```typescript
// تغيير
if (!user) {
  return <LoadingComponent />
}

// إلى
if (authLoading || !user) {
  return <LoadingComponent />
}
```