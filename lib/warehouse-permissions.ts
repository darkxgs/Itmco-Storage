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

type WarehouseAction = 'view' | 'add' | 'edit' | 'delete'

const ACTION_COLUMN: Record<WarehouseAction, 'can_view' | 'can_add' | 'can_edit' | 'can_delete'> = {
  view: 'can_view',
  add: 'can_add',
  edit: 'can_edit',
  delete: 'can_delete',
}

/**
 * Check if user has permission to access a specific warehouse. System admins may do
 * everything; permission_level 'admin' grants every action on that one warehouse.
 */
export async function hasWarehousePermission(
  userId: string,
  warehouseId: number,
  action: WarehouseAction = 'view'
): Promise<boolean> {
  if (await isWarehouseAdmin(userId)) {
    return true
  }

  const { data, error } = await supabase
    .from('user_warehouse_permissions')
    .select('*')
    .eq('user_id', userId)
    .eq('warehouse_id', warehouseId)
    .maybeSingle()

  if (error || !data) {
    return false
  }

  return data.permission_level === 'admin' || !!data[ACTION_COLUMN[action]]
}

/**
 * Get list of warehouse IDs that user has access to
 */
export async function getUserAccessibleWarehouses(
  userId: string,
  action: WarehouseAction = 'view'
): Promise<number[]> {
  if (await isWarehouseAdmin(userId)) {
    // System admins have access to all warehouses
    const { data: allWarehouses, error: warehouseError } = await supabase
      .from('warehouses')
      .select('id')

    if (warehouseError) {
      console.error('Error fetching all warehouses for admin:', warehouseError)
      throw warehouseError
    }

    return allWarehouses?.map(warehouse => warehouse.id) || []
  }

  // Warehouses where the user has this action, or is admin of that warehouse
  const { data, error } = await supabase
    .from('user_warehouse_permissions')
    .select('warehouse_id')
    .eq('user_id', userId)
    .or(`permission_level.eq.admin,${ACTION_COLUMN[action]}.eq.true`)

  if (error) {
    console.error('Error fetching accessible warehouses:', error)
    throw error
  }

  return data?.map(item => item.warehouse_id) || []
}

/**
 * Whether the user is a system admin (users.role = 'admin'), who manages warehouse
 * permissions and can act on every warehouse. A permission_level of 'admin' on one
 * warehouse only covers that warehouse (see hasWarehousePermission).
 */
export async function isWarehouseAdmin(userId: string): Promise<boolean> {
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (userError) {
    console.error('Error checking user role:', userError)
    return false
  }

  return userData?.role === 'admin'
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
  // The verified Supabase Auth session, not the editable localStorage profile
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user.id ?? null
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

  const hasPermission = await hasWarehousePermission(userId, warehouseId, action)
  
  if (!hasPermission) {
    throw new Error(`Access denied: You don't have ${action} permission for this warehouse`)
  }

  return true
}

/**
 * Filter query results to only include warehouses user has access to
 */
export async function filterByUserWarehouses<T extends { warehouse_id: number | null }>(
  items: T[],
  action: WarehouseAction = 'view'
): Promise<T[]> {
  const userId = await getCurrentUserId()

  if (!userId) {
    return []
  }

  if (await isWarehouseAdmin(userId)) {
    return items
  }

  // Items without a warehouse aren't restricted to anyone (they used to vanish for everybody)
  const accessibleWarehouses = new Set(await getUserAccessibleWarehouses(userId, action))
  return items.filter(item => item.warehouse_id == null || accessibleWarehouses.has(item.warehouse_id))
}

/**
 * Get full warehouse objects that user has access to
 */
export async function getUserAccessibleWarehousesWithData(
  userId: string,
  action: 'view' | 'add' | 'edit' | 'delete' = 'view'
) {
  // Check if user is admin first
  const adminStatus = await isWarehouseAdmin(userId)
  
  if (adminStatus) {
    // Admin users have access to all warehouses
    const { data: allWarehouses, error: warehouseError } = await supabase
      .from('warehouses')
      .select('*')
      .order('name')
    
    if (warehouseError) {
      console.error('Error fetching all warehouses for admin:', warehouseError)
      throw warehouseError
    }
    
    return allWarehouses || []
  }

  // For non-admin users, get accessible warehouse IDs first
  const accessibleWarehouseIds = await getUserAccessibleWarehouses(userId, action)
  
  if (accessibleWarehouseIds.length === 0) {
    return []
  }

  // Fetch full warehouse data
  const { data, error } = await supabase
    .from('warehouses')
    .select('*')
    .in('id', accessibleWarehouseIds)
    .order('name')
  
  if (error) {
    console.error('Error fetching accessible warehouses:', error)
    throw error
  }

  return data || []
}