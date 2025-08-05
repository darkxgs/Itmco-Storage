import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleString("ar-SA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function generateItemCode(category: string, sequence: number): string {
  const categoryCode = category.substring(0, 3).toUpperCase()
  const sequenceStr = sequence.toString().padStart(4, "0")
  return `${categoryCode}-${sequenceStr}`
}

export function calculateStatus(quantity: number, minStock = 10): "available" | "low_stock" | "out_of_stock" {
  if (quantity === 0) return "out_of_stock"
  if (quantity <= minStock) return "low_stock"
  return "available"
}

export interface User {
  id: string
  name: string
  email: string
  role: "admin" | "inventory_manager" | "engineer"
}

export function loadUserFromStorage(): User | null {
  try {
    const userData = localStorage.getItem("user")
    if (!userData) return null

    const parsedUser = JSON.parse(userData)
    
    // التحقق من وجود جميع الحقول المطلوبة
    if (
      parsedUser &&
      typeof parsedUser.id === "string" &&
      typeof parsedUser.name === "string" &&
      typeof parsedUser.email === "string" &&
      typeof parsedUser.role === "string" &&
      ["admin", "inventory_manager", "engineer"].includes(parsedUser.role)
    ) {
      return parsedUser as User
    }

    // إذا كانت البيانات غير صحيحة، احذفها
    localStorage.removeItem("user")
    return null
  } catch (error) {
    console.error("Error loading user from storage:", error)
    localStorage.removeItem("user")
    return null
  }
}

export function saveUserToStorage(user: User): void {
  try {
    localStorage.setItem("user", JSON.stringify(user))
  } catch (error) {
    console.error("Error saving user to storage:", error)
  }
}

export function clearUserFromStorage(): void {
  localStorage.removeItem("user")
}
