import { z } from "zod"

/* ------------------------------------------------------------------
 * Product validation schema
 * ----------------------------------------------------------------*/
export const productSchema = z.object({
  name: z.string().min(1, "اسم المنتج مطلوب").max(255, "اسم المنتج طويل جداً"),
  brand: z.string().min(1, "العلامة التجارية مطلوبة").max(100, "العلامة التجارية طويلة جداً"),
  model: z.string().min(1, "الموديل مطلوب").max(100, "الموديل طويل جداً"),
  category: z.string().min(1, "الفئة مطلوبة"),
  stock: z.number().min(0, "الكمية لا يمكن أن تكون سالبة"),
  minStock: z.number().min(0, "الحد الأدنى لا يمكن أن يكون سالباً"),
  description: z.string().optional(),
})

/* ------------------------------------------------------------------
 * User validation schema
 * ----------------------------------------------------------------*/
export const userSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب").max(100, "الاسم طويل جداً"),
  email: z.string().email("البريد الإلكتروني غير صحيح"),
  role: z.enum(["admin", "inventory_manager", "engineer"], {
    errorMap: () => ({ message: "الدور غير صحيح" }),
  }),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل").optional(),
  is_active: z.boolean(),
})

/* ------------------------------------------------------------------
 * Issuance validation schema
 * ----------------------------------------------------------------*/
export const issuanceSchema = z.object({
  product_id: z.number().min(1, "المنتج مطلوب"),
  quantity: z.number().min(1, "الكمية يجب أن تكون أكبر من صفر"),
  customer_name: z.string().min(1, "اسم العميل مطلوب").max(255, "اسم العميل طويل جداً"),
  branch: z.string().min(1, "الفرع مطلوب"),
  engineer: z.string().min(1, "المهندس مطلوب").max(100, "اسم المهندس طويل جداً"),
  serial_number: z.string().optional(),
  notes: z.string().optional(),
})

/* ------------------------------------------------------------------
 * Settings validation schema
 * ----------------------------------------------------------------*/
export const settingsSchema = z.object({
  systemName: z.string().min(1, "اسم النظام مطلوب"),
  companyName: z.string().min(1, "اسم الشركة مطلوب"),
  companyEmail: z.string().email("البريد الإلكتروني غير صحيح"),
  companyPhone: z.string().min(1, "رقم الهاتف مطلوب"),
  companyAddress: z.string().min(1, "العنوان مطلوب"),
  lowStockThreshold: z.number().min(1, "حد التنبيه يجب أن يكون أكبر من صفر"),
  sessionTimeout: z
    .number()
    .min(5, "مهلة الجلسة يجب أن تكون 5 دقائق على الأقل")
    .max(480, "مهلة الجلسة لا يمكن أن تتجاوز 8 ساعات"),
  passwordExpiry: z
    .number()
    .min(30, "انتهاء كلمة المرور يجب أن يكون 30 يوم على الأقل")
    .max(365, "انتهاء كلمة المرور لا يمكن أن يتجاوز سنة"),
  maxLoginAttempts: z
    .number()
    .min(3, "محاولات تسجيل الدخول يجب أن تكون 3 على الأقل")
    .max(10, "محاولات تسجيل الدخول لا يمكن أن تتجاوز 10"),
  backupRetention: z
    .number()
    .min(7, "مدة الاحتفاظ يجب أن تكون 7 أيام على الأقل")
    .max(365, "مدة الاحتفاظ لا يمكن أن تتجاوز سنة"),
})

/* ------------------------------------------------------------------
 * Generic validation helper
 * ----------------------------------------------------------------*/
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: boolean; data?: T; errors?: string[] } {
  // Handle null/undefined data
  if (data === null || data === undefined) {
    return { success: false, errors: ["البيانات مطلوبة"] }
  }

  try {
    const validatedData = schema.parse(data)
    return { success: true, data: validatedData }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => err.message)
      return { success: false, errors }
    }
    return { success: false, errors: ["خطأ في التحقق من البيانات"] }
  }
}

/* ------------------------------------------------------------------
 * Simple field-level helpers for forms
 * ----------------------------------------------------------------*/
export function validateRequired(value: string, fieldName: string): string | null {
  if (!value || value.trim() === "") {
    return `${fieldName} مطلوب`
  }
  return null
}

export function validateEmail(email: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return "البريد الإلكتروني غير صحيح"
  }
  return null
}

export function validateNumber(value: string, fieldName: string, min?: number, max?: number): string | null {
  const num = Number.parseFloat(value)
  if (isNaN(num)) {
    return `${fieldName} يجب أن يكون رقماً`
  }
  if (min !== undefined && num < min) {
    return `${fieldName} يجب أن يكون ${min} على الأقل`
  }
  if (max !== undefined && num > max) {
    return `${fieldName} لا يمكن أن يتجاوز ${max}`
  }
  return null
}

export function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
    return "كلمة المرور يجب أن تكون 8 أحرف على الأقل"
  }
  if (!/(?=.*[a-z])/.test(password)) {
    return "كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل"
  }
  if (!/(?=.*[A-Z])/.test(password)) {
    return "كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل"
  }
  if (!/(?=.*\d)/.test(password)) {
    return "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل"
  }
  return null
}
