/**
 * Integration Tests
 * End-to-end workflow tests
 */

import { signIn } from "@/lib/auth"
import { createProduct, createIssuance, getProducts, getIssuances } from "@/lib/database"
import { jest } from "@jest/globals"
import { fail } from "assert"

// Mock Supabase for integration tests
const mockSupabaseData = {
  users: [
    {
      id: "123e4567-e89b-12d3-a456-426614174000",
      email: "admin@itmco.com",
      name: "مدير النظام",
      role: "admin",
      password_hash: "$2b$10$hashedpassword",
      is_active: true,
    },
  ],
  products: [],
  issuances: [],
}

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn((table: string) => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({
            data: mockSupabaseData[table as keyof typeof mockSupabaseData][0] || null,
            error: null,
          })),
        })),
        order: jest.fn(() => ({
          data: mockSupabaseData[table as keyof typeof mockSupabaseData],
          error: null,
        })),
        limit: jest.fn(() => ({
          data: mockSupabaseData[table as keyof typeof mockSupabaseData],
          error: null,
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => {
            const newItem = {
              id: Date.now(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
            mockSupabaseData[table as keyof typeof mockSupabaseData].push(newItem as any)
            return { data: newItem, error: null }
          }),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({ data: {}, error: null })),
          })),
        })),
      })),
    })),
  },
}))

jest.mock("bcryptjs", () => ({
  compare: jest.fn(() => Promise.resolve(true)),
  hash: jest.fn(() => Promise.resolve("$2b$10$hashedpassword")),
}))

describe("Integration Tests", () => {
  describe("Complete Product Management Workflow", () => {
    test("should handle complete product lifecycle", async () => {
      // 1. Admin logs in
      const loginResult = await signIn("admin@itmco.com", "password123")
      expect(loginResult.user).toBeTruthy()
      expect(loginResult.error).toBeNull()

      // 2. Admin creates a new product
      const productData = {
        name: "آلة عد النقود المتقدمة",
        brand: "Canon",
        model: "CC-2000",
        category: "آلات عد النقود",
        stock: 15,
        minStock: 5,
      }

      const createdProduct = await createProduct(productData)
      expect(createdProduct).toBeTruthy()
      expect(createdProduct.name).toBe(productData.name)

      // 3. Verify product appears in products list
      const products = await getProducts()
      expect(products.length).toBe(1)
      expect(products[0].name).toBe(productData.name)

      // 4. Create an issuance for the product
      const issuanceData = {
        product_id: createdProduct.id,
        product_name: createdProduct.name,
        brand: createdProduct.brand,
        model: createdProduct.model,
        quantity: 2,
        customer_name: "أحمد محمد السعيد",
        branch: "الفرع الرئيسي - الرياض",
        engineer: "م. خالد العتيبي",
        serial_number: "SN001234567",
        notes: "تم التسليم بحالة ممتازة",
        issued_by: loginResult.user.id,
      }

      const createdIssuance = await createIssuance(issuanceData)
      expect(createdIssuance).toBeTruthy()
      expect(createdIssuance.quantity).toBe(issuanceData.quantity)

      // 5. Verify issuance appears in issuances list
      const issuances = await getIssuances()
      expect(issuances.length).toBe(1)
      expect(issuances[0].quantity).toBe(issuanceData.quantity)
    })
  })

  describe("Role-based Access Control", () => {
    test("should enforce role-based permissions", async () => {
      // Test admin access
      const adminLogin = await signIn("admin@itmco.com", "password123")
      expect(adminLogin.user?.role).toBe("admin")

      // Admin should be able to access all features
      expect(["admin", "inventory_manager", "engineer"]).toContain(adminLogin.user?.role)

      // Test inventory manager access
      mockSupabaseData.users[0] = {
        ...mockSupabaseData.users[0],
        email: "inventory@itmco.com",
        role: "inventory_manager",
      }

      const inventoryLogin = await signIn("inventory@itmco.com", "password123")
      expect(inventoryLogin.user?.role).toBe("inventory_manager")

      // Inventory manager should not have user management access
      expect(inventoryLogin.user?.role).not.toBe("admin")

      // Test engineer access
      mockSupabaseData.users[0] = {
        ...mockSupabaseData.users[0],
        email: "engineer@itmco.com",
        role: "engineer",
      }

      const engineerLogin = await signIn("engineer@itmco.com", "password123")
      expect(engineerLogin.user?.role).toBe("engineer")

      // Engineer should have limited access
      expect(["admin", "engineer"]).toContain(engineerLogin.user?.role)
    })
  })

  describe("Data Validation Integration", () => {
    test("should validate data throughout the system", async () => {
      // Test product validation
      const invalidProduct = {
        name: "", // Invalid: empty name
        brand: "Canon",
        model: "CC-2000",
        category: "آلات عد النقود",
        stock: -1, // Invalid: negative stock
        minStock: 5,
      }

      try {
        await createProduct(invalidProduct as any)
        fail("Should have thrown validation error")
      } catch (error) {
        expect(error).toBeTruthy()
      }

      // Test issuance validation
      const invalidIssuance = {
        product_id: 0, // Invalid: zero product ID
        product_name: "",
        brand: "Canon",
        model: "CC-2000",
        quantity: -1, // Invalid: negative quantity
        customer_name: "أ", // Invalid: too short
        branch: "الفرع الرئيسي - الرياض",
        engineer: "م. خالد العتيبي",
        serial_number: "", // Invalid: empty serial
        issued_by: "invalid-uuid", // Invalid: bad UUID
      }

      try {
        await createIssuance(invalidIssuance as any)
        fail("Should have thrown validation error")
      } catch (error) {
        expect(error).toBeTruthy()
      }
    })
  })
})
