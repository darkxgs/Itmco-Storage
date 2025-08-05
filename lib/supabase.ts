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
      inventory: {
        Row: {
          id: string
          item_name: string
          item_code: string
          category: string
          quantity: number
          unit: string
          location: string
          supplier: string
          purchase_date: string
          expiry_date: string | null
          cost_per_unit: number
          total_cost: number
          status: "available" | "low_stock" | "out_of_stock"
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          item_name: string
          item_code: string
          category: string
          quantity: number
          unit: string
          location: string
          supplier: string
          purchase_date: string
          expiry_date?: string | null
          cost_per_unit: number
          total_cost: number
          status?: "available" | "low_stock" | "out_of_stock"
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          item_name?: string
          item_code?: string
          category?: string
          quantity?: number
          unit?: string
          location?: string
          supplier?: string
          purchase_date?: string
          expiry_date?: string | null
          cost_per_unit?: number
          total_cost?: number
          status?: "available" | "low_stock" | "out_of_stock"
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string
        }
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string
          user_name: string
          action: string
          module: string
          details: string
          timestamp: string
        }
        Insert: {
          id?: string
          user_id: string
          user_name: string
          action: string
          module: string
          details: string
          timestamp?: string
        }
        Update: {
          id?: string
          user_id?: string
          user_name?: string
          action?: string
          module?: string
          details?: string
          timestamp?: string
        }
      }
    }
  }
}
