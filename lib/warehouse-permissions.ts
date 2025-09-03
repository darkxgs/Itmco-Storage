import { supabase } from './supabase'
import type { UserWarehousePermission } from './supabase'

/**
 * Get current user's warehouse permissions
 */
export async function getUserWarehousePermissions(userId: string): Promise<UserWarehousePermission[]> {
  const { data, error } = await supabase
    .from('user_warehouse_permissions')
    .select(`
      *,
      warehouses:warehouse_id (
        id,
        name,
        location
      )
    `)
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching user warehouse permissions:', error)
    throw error
  }

  return data || []
}

/**
 * Check if user has permission to access a specific warehouse
 */
export async function hasWarehousePermission(
  userId: string,
  warehouseId: number,
  action: 'view' | 'add' | 'edit' | 'delete' = 'view'
): Promise<boolean> {
  // Check if user is admin first
  const adminStatus = await isWarehouseAdmin(userId)
  
  if (adminStatus) {
    // Admin users have all permissions for all warehouses
    return true
  }

  // For non-admin users, check specific permissions
  const { data, error } = await supabase
    .from('user_warehouse_permissions')
    .select('*')
    .eq('user_id', userId)
    .eq('warehouse_id', warehouseId)
    .single()

  if (error || !data) {
    return false
  }

  // Check specific permission based on action
  switch (action) {
    case 'view':
      return data.can_view
    case 'add':
      return data.can_add
    case 'edit':
      return data.can_edit
    case 'delete':
      return data.can_delete
    default:
      return false
  }
}

/**
 * Get list of warehouse IDs that user has access to
 */
export async function getUserAccessibleWarehouses(
  userId: string,
  action: 'view' | 'add' | 'edit' | 'delete' = 'view'
): Promise<number[]> {
  // Check if user is admin first
  const adminStatus = await isWarehouseAdmin(userId)
  
  if (adminStatus) {
    // Admin users have access to all warehouses
    const { data: allWarehouses, error: warehouseError } = await supabase
      .from('warehouses')
      .select('id')
    
    if (warehouseError) {
      console.error('Error fetching all warehouses for admin:', warehouseError)
      throw warehouseError
    }
    
    return allWarehouses?.map(warehouse => warehouse.id) || []
  }

  // For non-admin users, check specific permissions
  let query = supabase
    .from('user_warehouse_permissions')
    .select('warehouse_id')
    .eq('user_id', userId)

  // Filter by specific permission
  switch (action) {
    case 'view':
      query = query.eq('can_view', true)
      break
    case 'add':
      query = query.eq('can_add', true)
      break
    case 'edit':
      query = query.eq('can_edit', true)
      break
    case 'delete':
      query = query.eq('can_delete', true)
      break
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching accessible warehouses:', error)
    throw error
  }

  return data?.map(item => item.warehouse_id) || []
}

/**
 * Check if user has admin permission on any warehouse
 */
export async function isWarehouseAdmin(userId: string): Promise<boolean> {
  // First check if user is admin in users table
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (userError) {
    console.error('Error checking user role:', userError)
    return false
  }

  // If user is admin, they have access to warehouse permissions
  if (userData?.role === 'admin') {
    return true
  }

  // Otherwise check warehouse-specific admin permissions
  const { data, error } = await supabase
    .from('user_warehouse_permissions')
    .select('permission_level')
    .eq('user_id', userId)
    .eq('permission_level', 'admin')
    .limit(1)

  if (error) {
    console.error('Error checking admin permission:', error)
    return false
  }

  return (data?.length || 0) > 0
}

/**
 * Grant warehouse permission to user
 */
export async function grantWarehousePermission(
  userId: string,
  warehouseId: number,
  permissions: {
    permission_level?: 'view' | 'edit' | 'admin'
    can_view?: boolean
    can_add?: boolean
    can_edit?: boolean
    can_delete?: boolean
  }
) {
  const { data, error } = await supabase
    .from('user_warehouse_permissions')
    .upsert({
      user_id: userId,
      warehouse_id: warehouseId,
      permission_level: permissions.permission_level || 'view',
      can_view: permissions.can_view ?? true,
      can_add: permissions.can_add ?? false,
      can_edit: permissions.can_edit ?? false,
      can_delete: permissions.can_delete ?? false
    })
    .select()

  if (error) {
    console.error('Error granting warehouse permission:', error)
    throw error
  }

  return data
}

/**
 * Revoke warehouse permission from user
 */
export async function revokeWarehousePermission(
  userId: string,
  warehouseId: number
) {
  const { error } = await supabase
    .from('user_warehouse_permissions')
    .delete()
    .eq('user_id', userId)
    .eq('warehouse_id', warehouseId)

  if (error) {
    console.error('Error revoking warehouse permission:', error)
    throw error
  }
}

/**
 * Get current user ID from Supabase auth
 */
export async function getCurrentUserId(): Promise<string | null> {
  // Use localStorage-based authentication instead of Supabase Auth
  try {
    const userData = localStorage.getItem('user')
    if (!userData) return null
    
    const parsedUser = JSON.parse(userData)
    return parsedUser?.id || null
  } catch (error) {
    console.error('Error getting current user ID:', error)
    return null
  }
}

/**
 * Middleware function to check warehouse permission before database operations
 */
export async function checkWarehousePermission(
  warehouseId: number,
  action: 'view' | 'add' | 'edit' | 'delete' = 'view'
): Promise<boolean> {
  const userId = await getCurrentUserId()
  
  if (!userId) {
    throw new Error('User not authenticated')
  }

  // Check if user is admin first
  const adminStatus = await isWarehouseAdmin(userId)
  
  if (adminStatus) {
    // Admin users have all permissions
    return true
  }

  // For non-admin users, check specific permissions
  const hasPermission = await hasWarehousePermission(userId, warehouseId, action)
  
  if (!hasPermission) {
    throw new Error(`Access denied: You don't have ${action} permission for this warehouse`)
  }

  return true
}

/**
 * Filter query results to only include warehouses user has access to
 */
export async function filterByUserWarehouses<T extends { warehouse_id: number }>(
  items: T[],
  action: 'view' | 'add' | 'edit' | 'delete' = 'view'
): Promise<T[]> {
  const userId = await getCurrentUserId()
  
  if (!userId) {
    return []
  }

  const accessibleWarehouses = await getUserAccessibleWarehouses(userId, action)
  
  return items.filter(item => accessibleWarehouses.includes(item.warehouse_id))
}