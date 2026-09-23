import { supabase } from "./supabase"

// User text is stored exactly as typed. Supabase sends every value as a bound parameter
// (no SQL string building) and React escapes everything it renders, so there is nothing
// to strip here. The previous regex "sanitizer" rejected ordinary text such as "A4/B",
// "O'Neil" or "Select Model", and HTML-escaped what it let through ("/" became "&#x2F;").
// These helpers now only trim strings and bound their length.

const MAX_INPUT_LENGTH = 10000

export class SecurityError extends Error {
  constructor(
    message: string,
    public type: "INPUT_TOO_LONG" | "INVALID_INPUT",
    public details?: any,
  ) {
    super(message)
    this.name = "SecurityError"
  }
}

export function validateInput(input: any): any {
  if (typeof input !== "string") return input

  if (input.length > MAX_INPUT_LENGTH) {
    throw new SecurityError(`Input too long. Maximum ${MAX_INPUT_LENGTH} characters allowed.`, "INPUT_TOO_LONG", {
      length: input.length,
    })
  }
  return input.trim()
}

export function validateObject(obj: any): any {
  if (Array.isArray(obj)) return obj.map(validateObject)
  if (obj && typeof obj === "object" && !(obj instanceof Date)) {
    return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, validateObject(value)]))
  }
  return validateInput(obj)
}

// Whitelist of tables the data layer writes through this helper
const ALLOWED_TABLES = ["users", "products", "issuances", "activity_logs", "customers", "branches", "warehouses"]

export function createSecureQuery(tableName: string, _operation?: "select" | "insert" | "update" | "delete") {
  if (!ALLOWED_TABLES.includes(tableName)) {
    throw new SecurityError(`Table '${tableName}' is not allowed`, "INVALID_INPUT", { tableName })
  }
  return supabase.from(tableName)
}
