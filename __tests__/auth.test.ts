/**
 * Authentication Tests
 * Tests for login, password hashing, and user management
 */

import { hashPassword } from "@/lib/auth"
import { validateData, loginSchema, userSchema } from "@/lib/validation"
import jest from "jest"

// Mock Supabase
jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      insert: jest.fn(),
    })),
  },
}))

// Mock bcrypt
jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}))

describe("Authentication System", () => {
  describe("Login Validation", () => {
    test("should validate correct login data", () => {
      const loginData = {
        email: "test@itmco.com",
        password: "password123",
      }

      const result = validateData(loginSchema, loginData)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(loginData)
    })

    test("should reject invalid email", () => {
      const loginData = {
        email: "invalid-email",
        password: "password123",
      }

      const result = validateData(loginSchema, loginData)
      expect(result.success).toBe(false)
      expect(result.errors).toContain("البريد الإلكتروني غير صالح")
    })

    test("should reject empty password", () => {
      const loginData = {
        email: "test@itmco.com",
        password: "",
      }

      const result = validateData(loginSchema, loginData)
      expect(result.success).toBe(false)
      expect(result.errors).toContain("كلمة المرور مطلوبة")
    })
  })

  describe("User Validation", () => {
    test("should validate correct user data", () => {
      const userData = {
        name: "أحمد محمد",
        email: "ahmed@itmco.com",
        role: "admin" as const,
        is_active: true,
      }

      const result = validateData(userSchema, userData)
      expect(result.success).toBe(true)
    })

    test("should reject short name", () => {
      const userData = {
        name: "أ",
        email: "ahmed@itmco.com",
        role: "admin" as const,
        is_active: true,
      }

      const result = validateData(userSchema, userData)
      expect(result.success).toBe(false)
      expect(result.errors).toContain("الاسم يجب أن يكون أكثر من حرفين")
    })

    test("should reject invalid role", () => {
      const userData = {
        name: "أحمد محمد",
        email: "ahmed@itmco.com",
        role: "invalid_role",
        is_active: true,
      }

      const result = validateData(userSchema, userData)
      expect(result.success).toBe(false)
      expect(result.errors).toContain("يجب اختيار دور صالح")
    })
  })

  describe("Password Hashing", () => {
    test("should hash password correctly", async () => {
      const bcrypt = require("bcryptjs")
      bcrypt.hash.mockResolvedValue("hashed_password")

      const result = await hashPassword("password123")
      expect(result).toBe("hashed_password")
      expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10)
    })
  })
})
