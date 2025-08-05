/**
 * Database Tests
 * Tests for all database operations
 */

import { getProducts, getDashboardStats } from "@/lib/database"
import { validateData, productSchema, issuanceSchema } from "@/lib/validation"
import jest from "jest" // Import jest to declare the variable

// Mock Supabase
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      order: jest.fn(() => ({
        data: [],
        error: null,
      })),
      eq: jest.fn(() => ({
        single: jest.fn(() => ({
          data: null,
          error: null,
        })),
      })),
      gte: jest.fn(() => ({
        data: [],
        error: null,
      })),
      limit: jest.fn(() => ({
        data: [],
        error: null,
      })),
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => ({
          data: {},
          error: null,
        })),
      })),
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: {},
            error: null,
          })),
        })),
      })),
    })),
    delete: jest.fn(() => ({
      eq: jest.fn(() => ({
        error: null,
      })),
    })),
  })),
}

jest.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}))

describe("Database Operations", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Product Operations", () => {
    test("should validate product data correctly", () => {
      const productData = {
        name: "آلة عد النقود",
        brand: "Canon",
        model: "CC-2000",
        category: "آلات عد النقود",
        stock: 10,
        minStock: 5,
      }

      const result = validateData(productSchema, productData)
      expect(result.success).toBe(true)
    })

    test("should reject invalid product data", () => {
      const productData = {
        name: "",
        brand: "Canon",
        model: "CC-2000",
        category: "آلات عد النقود",
        stock: -1,
        minStock: 5,
      }

      const result = validateData(productSchema, productData)
      expect(result.success).toBe(false)
      expect(result.errors).toContain("اسم المنتج يجب أن يكون أكثر من حرفين")
      expect(result.errors).toContain("الكمية لا يمكن أن تكون سالبة")
    })

    test("should get products from database", async () => {
      const mockProducts = [
        {
          id: 1,
          name: "آلة عد النقود",
          brand: "Canon",
          model: "CC-2000",
          category: "آلات عد النقود",
          stock: 10,
          min_stock: 5,
        },
      ]

      mockSupabase.from().select().order.mockReturnValue({
        data: mockProducts,
        error: null,
      })

      const result = await getProducts()
      expect(result).toEqual(mockProducts)
      expect(mockSupabase.from).toHaveBeenCalledWith("products")
    })
  })

  describe("Issuance Operations", () => {
    test("should validate issuance data correctly", () => {
      const issuanceData = {
        product_id: 1,
        product_name: "آلة عد النقود",
        brand: "Canon",
        model: "CC-2000",
        quantity: 2,
        customer_name: "أحمد محمد",
        branch: "الفرع الرئيسي - الرياض",
        engineer: "م. خالد العتيبي",
        serial_number: "SN001234567",
        notes: "تم التسليم بحالة ممتازة",
        issued_by: "123e4567-e89b-12d3-a456-426614174000",
      }

      const result = validateData(issuanceSchema, issuanceData)
      expect(result.success).toBe(true)
    })

    test("should reject invalid issuance data", () => {
      const issuanceData = {
        product_id: 0,
        product_name: "",
        brand: "Canon",
        model: "CC-2000",
        quantity: -1,
        customer_name: "أ",
        branch: "الفرع الرئيسي - الرياض",
        engineer: "م. خالد العتيبي",
        serial_number: "",
        issued_by: "invalid-uuid",
      }

      const result = validateData(issuanceSchema, issuanceData)
      expect(result.success).toBe(false)
      expect(result.errors).toContain("يجب اختيار منتج صالح")
      expect(result.errors).toContain("اسم المنتج مطلوب")
      expect(result.errors).toContain("الكمية يجب أن تكون أكبر من صفر")
      expect(result.errors).toContain("اسم العميل يجب أن يكون أكثر من حرفين")
      expect(result.errors).toContain("الرقم التسلسلي مطلوب")
      expect(result.errors).toContain("معرف المستخدم غير صالح")
    })
  })

  describe("Dashboard Stats", () => {
    test("should calculate dashboard statistics correctly", async () => {
      // Mock products count
      mockSupabase.from().select.mockReturnValueOnce({
        count: 50,
      })

      // Mock products data for stock calculation
      mockSupabase.from().select.mockReturnValueOnce({
        data: [
          { stock: 10, min_stock: 5 },
          { stock: 3, min_stock: 5 }, // Low stock
          { stock: 0, min_stock: 2 }, // Out of stock
        ],
      })

      // Mock today's issuances
      mockSupabase.from().select().gte.mockReturnValue({
        count: 5,
      })

      const stats = await getDashboardStats()

      expect(stats.totalProducts).toBe(50)
      expect(stats.totalStock).toBe(13)
      expect(stats.todayIssuances).toBe(5)
      expect(stats.lowStockCount).toBe(2) // Products with stock <= min_stock
    })
  })
})
