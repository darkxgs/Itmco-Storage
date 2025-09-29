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
      branches: {
        Row: {
          id: number
          name: string
          code: string
          address: string | null
          phone: string | null
          manager_name: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name: string
          code: string
          address?: string | null
          phone?: string | null
          manager_name?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          code?: string
          address?: string | null
          phone?: string | null
          manager_name?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: number
          name: string
          code: string | null
          email: string | null
          phone: string | null
          address: string | null
          contact_person: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name: string
          code?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          contact_person?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          code?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          contact_person?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      warehouses: {
        Row: {
          id: number
          warehouse_number: string
          name: string
          location: string | null
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          warehouse_number?: string
          name: string
          location?: string | null
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          warehouse_number?: string
          name?: string
          location?: string | null
          description?: string | null
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
          item_code: string | null
          warehouse_id: number | null
          purchase_price: number | null
          selling_price: number | null
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
          item_code?: string | null
          warehouse_id?: number | null
          purchase_price?: number | null
          selling_price?: number | null
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
          item_code?: string | null
          warehouse_id?: number | null
          purchase_price?: number | null
          selling_price?: number | null
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
          warranty_type: string | null
          invoice_number: string | null
          notes: string | null
          issued_by: string
          customer_id: number | null
          branch_id: number | null
          item_code: string | null
          warehouse_id: number | null
          date: string
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
          warranty_type?: string | null
          invoice_number?: string | null
          notes?: string | null
          issued_by: string
          customer_id?: number | null
          branch_id?: number | null
          item_code?: string | null
          warehouse_id?: number | null
          date: string
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
          warranty_type?: string | null
          invoice_number?: string | null
          notes?: string | null
          issued_by?: string
          customer_id?: number | null
          branch_id?: number | null
          item_code?: string | null
          warehouse_id?: number | null
          date?: string
          created_at?: string
        }
      }
      release_items: {
        Row: {
          id: number
          issuance_id: number
          product_id: number | null
          item_code: string | null
          product_name: string
          brand: string
          model: string
          quantity: number
          unit_price: number | null
          total_price: number | null
          serial_numbers: string[] | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: number
          issuance_id: number
          product_id?: number | null
          item_code?: string | null
          product_name: string
          brand: string
          model: string
          quantity: number
          unit_price?: number | null
          total_price?: number | null
          serial_numbers?: string[] | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          issuance_id?: number
          product_id?: number | null
          item_code?: string | null
          product_name?: string
          brand?: string
          model?: string
          quantity?: number
          unit_price?: number | null
          total_price?: number | null
          serial_numbers?: string[] | null
          notes?: string | null
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
      user_warehouse_permissions: {
        Row: {
          id: number
          user_id: string
          warehouse_id: number
          permission_level: "view" | "edit" | "admin"
          can_view: boolean
          can_add: boolean
          can_edit: boolean
          can_delete: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id: string
          warehouse_id: number
          permission_level?: "view" | "edit" | "admin"
          can_view?: boolean
          can_add?: boolean
          can_edit?: boolean
          can_delete?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          warehouse_id?: number
          permission_level?: "view" | "edit" | "admin"
          can_view?: boolean
          can_add?: boolean
          can_edit?: boolean
          can_delete?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      stock_entries: {
        Row: {
          id: number
          product_id: number
          product_name: string
          item_code: string | null
          quantity_added: number
          previous_stock: number
          new_stock: number
          entry_date: string
          entry_time: string
          entry_datetime: string
          notes: string | null
          entered_by: string
          user_id: string | null
          warehouse_id: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          product_id: number
          product_name: string
          item_code?: string | null
          quantity_added: number
          previous_stock?: number
          new_stock: number
          entry_date?: string
          entry_time?: string
          entry_datetime?: string
          notes?: string | null
          entered_by: string
          user_id?: string | null
          warehouse_id?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          product_id?: number
          product_name?: string
          item_code?: string | null
          quantity_added?: number
          previous_stock?: number
          new_stock?: number
          entry_date?: string
          entry_time?: string
          entry_datetime?: string
          notes?: string | null
          entered_by?: string
          user_id?: string | null
          warehouse_id?: number | null
          created_at?: string
          updated_at?: string
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

export type Branch = Database['public']['Tables']['branches']['Row']
export type BranchInsert = Database['public']['Tables']['branches']['Insert']
export type BranchUpdate = Database['public']['Tables']['branches']['Update']

export type Customer = Database['public']['Tables']['customers']['Row']
export type CustomerInsert = Database['public']['Tables']['customers']['Insert']
export type CustomerUpdate = Database['public']['Tables']['customers']['Update']

export type Warehouse = Database['public']['Tables']['warehouses']['Row']
export type WarehouseInsert = Database['public']['Tables']['warehouses']['Insert']
export type WarehouseUpdate = Database['public']['Tables']['warehouses']['Update']

export type ReleaseItem = Database['public']['Tables']['release_items']['Row']
export type ReleaseItemInsert = Database['public']['Tables']['release_items']['Insert']
export type ReleaseItemUpdate = Database['public']['Tables']['release_items']['Update']

export type User = Database['public']['Tables']['users']['Row']
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row']

export type UserWarehousePermission = Database['public']['Tables']['user_warehouse_permissions']['Row']
export type UserWarehousePermissionInsert = Database['public']['Tables']['user_warehouse_permissions']['Insert']
export type UserWarehousePermissionUpdate = Database['public']['Tables']['user_warehouse_permissions']['Update']

export type StockEntry = Database['public']['Tables']['stock_entries']['Row']
export type StockEntryInsert = Database['public']['Tables']['stock_entries']['Insert']
export type StockEntryUpdate = Database['public']['Tables']['stock_entries']['Update']
