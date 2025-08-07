import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          email: string
          password_hash: string
          role: "admin" | "inventory_manager" | "engineer"
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          password_hash: string
          role: "admin" | "inventory_manager" | "engineer"
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          password_hash?: string
          role?: "admin" | "inventory_manager" | "engineer"
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: number
          name: string
          brand: string
          model: string
          category: string
          stock: number
          min_stock: number
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name: string
          brand: string
          model: string
          category: string
          stock?: number
          min_stock?: number
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          brand?: string
          model?: string
          category?: string
          stock?: number
          min_stock?: number
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      issuances: {
        Row: {
          id: number
          product_id: number
          product_name: string
          brand: string
          model: string
          quantity: number
          customer_name: string
          branch: string
          engineer: string
          serial_number: string
          notes: string | null
          issued_by: string
          created_at: string
        }
        Insert: {
          id?: number
          product_id: number
          product_name: string
          brand: string
          model: string
          quantity: number
          customer_name: string
          branch: string
          engineer: string
          serial_number: string
          notes?: string | null
          issued_by: string
          created_at?: string
        }
        Update: {
          id?: number
          product_id?: number
          product_name?: string
          brand?: string
          model?: string
          quantity?: number
          customer_name?: string
          branch?: string
          engineer?: string
          serial_number?: string
          notes?: string | null
          issued_by?: string
          created_at?: string
        }
      }
      activity_logs: {
        Row: {
          id: number
          user_id: string
          user_name: string
          action: string
          module: string
          details: string
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          user_name: string
          action: string
          module: string
          details: string
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          user_name?: string
          action?: string
          module?: string
          details?: string
          created_at?: string
        }
      }
    }
  }
}

// Type aliases for easier use
export type Product = Database['public']['Tables']['products']['Row']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type ProductUpdate = Database['public']['Tables']['products']['Update']

export type Issuance = Database['public']['Tables']['issuances']['Row']
export type IssuanceInsert = Database['public']['Tables']['issuances']['Insert']
export type IssuanceUpdate = Database['public']['Tables']['issuances']['Update']

export type User = Database['public']['Tables']['users']['Row']
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row']
