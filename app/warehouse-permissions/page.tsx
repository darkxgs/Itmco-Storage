'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  getUserWarehousePermissions, 
  grantWarehousePermission, 
  revokeWarehousePermission,
  getCurrentUserId,
  isWarehouseAdmin
} from '@/lib/warehouse-permissions'
import type { UserWarehousePermission, User, Warehouse } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Trash2, Plus, Shield, Users, Warehouse as WarehouseIcon, UserCheck } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { useAuth } from '@/hooks/use-auth'
import { ErrorBoundary } from '@/components/error-boundary'

interface UserWithPermissions extends User {
  permissions: UserWarehousePermission[]
}

export default function WarehousePermissionsPage() {
  const [users, setUsers] = useState<UserWithPermissions[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([])
  const [newPermissions, setNewPermissions] = useState({
    permission_level: 'view' as 'view' | 'edit' | 'admin',
    can_view: true,
    can_add: false,
    can_edit: false,
    can_delete: false
  })

  useEffect(() => {
    checkAdminStatus()
    loadData()
  }, [])

  const checkAdminStatus = async () => {
    try {
      const userId = await getCurrentUserId()
      if (userId) {
        const adminStatus = await isWarehouseAdmin(userId)
        setIsAdmin(adminStatus)
        if (!adminStatus) {
          toast.error('ليس لديك صلاحية للوصول إلى هذه الصفحة')
        }
      }
    } catch (error) {
      console.error('Error checking admin status:', error)
      toast.error('خطأ في التحقق من الصلاحيات')
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('name')
      
      if (usersError) throw usersError

      // Load warehouses - admin users see all warehouses
      const { data: warehousesData, error: warehousesError } = await supabase
        .from('warehouses')
        .select('*')
        .order('name')
      
      if (warehousesError) throw warehousesError

      // Load permissions for each user
      const usersWithPermissions = await Promise.all(
        (usersData || []).map(async (user) => {
          const permissions = await getUserWarehousePermissions(user.id)
          return { ...user, permissions }
        })
      )

      setUsers(usersWithPermissions)
      setWarehouses(warehousesData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('خطأ في تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  const handleGrantPermission = async () => {
    if (!selectedUser || selectedWarehouses.length === 0) {
      toast.error('يرجى اختيار المستخدم والمخازن')
      return
    }

    try {
      // Grant permissions for all selected warehouses
      await Promise.all(
        selectedWarehouses.map(warehouseId => 
          grantWarehousePermission(
            selectedUser,
            parseInt(warehouseId),
            newPermissions
          )
        )
      )
      
      toast.success(`تم منح الصلاحيات بنجاح لـ ${selectedWarehouses.length} مخزن`)
      setSelectedUser('')
      setSelectedWarehouses([])
      setNewPermissions({
        permission_level: 'view',
        can_view: true,
        can_add: false,
        can_edit: false,
        can_delete: false
      })
      loadData()
    } catch (error) {
      console.error('Error granting permission:', error)
      toast.error('خطأ في منح الصلاحية')
    }
  }

  const handleRevokePermission = async (userId: string, warehouseId: number) => {
    try {
      await revokeWarehousePermission(userId, warehouseId)
      toast.success('تم إلغاء الصلاحية بنجاح')
      loadData()
    } catch (error) {
      console.error('Error revoking permission:', error)
      toast.error('خطأ في إلغاء الصلاحية')
    }
  }

  const getPermissionLevelBadge = (level: string) => {
    const variants = {
      view: 'secondary',
      edit: 'default',
      admin: 'destructive'
    } as const
    
    const labels = {
      view: 'عرض',
      edit: 'تعديل',
      admin: 'مدير'
    }
    
    return (
      <Badge variant={variants[level as keyof typeof variants] || 'secondary'}>
        {labels[level as keyof typeof labels] || level}
      </Badge>
    )
  }

  const getWarehouseName = (warehouseId: number) => {
    const warehouse = warehouses.find(w => w.id === warehouseId)
    return warehouse?.name || `مخزن ${warehouseId}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل صلاحيات المخازن...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <ErrorBoundary>
        <div className="flex min-h-screen bg-slate-900 items-center justify-center">
          <Card className="w-full max-w-md bg-slate-800 border-slate-700">
            <CardHeader className="text-center">
              <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <CardTitle className="text-red-400">غير مصرح</CardTitle>
              <CardDescription className="text-slate-300">
                ليس لديك صلاحية للوصول إلى صفحة إدارة صلاحيات المخازن
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen bg-slate-900" dir="rtl">
        <Sidebar />
        <div className="flex-1 p-6">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="h-8 w-8 text-blue-400" />
              <h1 className="text-3xl font-bold text-white">إدارة صلاحيات المخازن</h1>
            </div>
            <p className="text-slate-300">إدارة صلاحيات المستخدمين للوصول إلى المخازن المختلفة</p>
          </div>

          <Tabs defaultValue="permissions" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 bg-slate-800 border-slate-700">
              <TabsTrigger value="permissions" className="flex items-center gap-2 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-300">
                <Users className="h-4 w-4" />
                الصلاحيات الحالية
              </TabsTrigger>
              <TabsTrigger value="grant" className="flex items-center gap-2 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-300">
                <Plus className="h-4 w-4" />
                منح صلاحية جديدة
              </TabsTrigger>
            </TabsList>

            <TabsContent value="permissions" className="space-y-4">
              <div className="grid gap-4">
                {users.map((user) => (
                  <Card key={user.id} className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-white">
                            <Users className="h-5 w-5" />
                            {user.name || user.email}
                          </CardTitle>
                          <CardDescription className="text-slate-300">{user.email}</CardDescription>
                        </div>
                        <Badge variant="outline" className="border-slate-600 text-slate-300">
                          {user.permissions.length} مخزن
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {user.permissions.length === 0 ? (
                        <p className="text-slate-400 text-center py-4">
                          لا توجد صلاحيات مخازن لهذا المستخدم
                        </p>
                      ) : (
                        <div className="grid gap-3">
                          {user.permissions.map((permission) => (
                            <div
                              key={`${permission.user_id}-${permission.warehouse_id}`}
                              className="flex items-center justify-between p-3 border border-slate-600 rounded-lg bg-slate-700"
                            >
                              <div className="flex items-center gap-3">
                                <WarehouseIcon className="h-4 w-4 text-slate-400" />
                                <div>
                                  <p className="font-medium text-white">
                                    {getWarehouseName(permission.warehouse_id)}
                                  </p>
                                  <div className="flex gap-2 mt-1">
                                    {getPermissionLevelBadge(permission.permission_level)}
                                    {permission.can_view && <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">عرض</Badge>}
                                    {permission.can_add && <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">إضافة</Badge>}
                                    {permission.can_edit && <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">تعديل</Badge>}
                                    {permission.can_delete && <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">حذف</Badge>}
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRevokePermission(user.id, permission.warehouse_id)}
                                className="text-red-400 hover:text-red-300 border-slate-600 hover:border-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="grant" className="space-y-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Plus className="h-5 w-5" />
                منح صلاحية مخزن جديدة
              </CardTitle>
              <CardDescription className="text-slate-300">
                اختر المستخدم والمخزن وحدد نوع الصلاحيات المطلوبة
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">المستخدم</label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue placeholder="اختر المستخدم" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                       {users.map((user) => (
                         <SelectItem key={user.id} value={user.id} className="text-white hover:bg-slate-600">
                           {user.name || user.email}
                         </SelectItem>
                       ))}
                     </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">المخازن ({selectedWarehouses.length} محدد)</label>
                  <div className="max-h-48 overflow-y-auto border border-slate-600 rounded-md bg-slate-700 p-3">
                    <div className="space-y-2">
                      {warehouses.map((warehouse) => (
                        <div key={warehouse.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`warehouse-${warehouse.id}`}
                            checked={selectedWarehouses.includes(warehouse.id.toString())}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedWarehouses(prev => [...prev, warehouse.id.toString()])
                              } else {
                                setSelectedWarehouses(prev => prev.filter(id => id !== warehouse.id.toString()))
                              }
                            }}
                            className="border-slate-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                          <label htmlFor={`warehouse-${warehouse.id}`} className="text-sm text-white cursor-pointer">
                            {warehouse.name}
                          </label>
                        </div>
                      ))}
                    </div>
                    {warehouses.length === 0 && (
                      <p className="text-slate-400 text-sm text-center py-2">لا توجد مخازن متاحة</p>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedWarehouses(warehouses.map(w => w.id.toString()))}
                      className="text-xs bg-slate-600 border-slate-500 text-white hover:bg-slate-500"
                    >
                      تحديد الكل
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedWarehouses([])}
                      className="text-xs bg-slate-600 border-slate-500 text-white hover:bg-slate-500"
                    >
                      إلغاء التحديد
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">مستوى الصلاحية</label>
                <Select 
                  value={newPermissions.permission_level} 
                  onValueChange={(value: 'view' | 'edit' | 'admin') => 
                    setNewPermissions(prev => ({ ...prev, permission_level: value }))
                  }
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                     <SelectItem value="view" className="text-white hover:bg-slate-600">عرض فقط</SelectItem>
                     <SelectItem value="edit" className="text-white hover:bg-slate-600">تعديل</SelectItem>
                     <SelectItem value="admin" className="text-white hover:bg-slate-600">مدير</SelectItem>
                   </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-white">الصلاحيات التفصيلية</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="can_view"
                      checked={newPermissions.can_view}
                      onCheckedChange={(checked) => 
                        setNewPermissions(prev => ({ ...prev, can_view: !!checked }))
                      }
                      className="border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <label htmlFor="can_view" className="text-sm text-white">عرض البيانات</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="can_add"
                      checked={newPermissions.can_add}
                      onCheckedChange={(checked) => 
                        setNewPermissions(prev => ({ ...prev, can_add: !!checked }))
                      }
                      className="border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <label htmlFor="can_add" className="text-sm text-white">إضافة عناصر</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="can_edit"
                      checked={newPermissions.can_edit}
                      onCheckedChange={(checked) => 
                        setNewPermissions(prev => ({ ...prev, can_edit: !!checked }))
                      }
                      className="border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <label htmlFor="can_edit" className="text-sm text-white">تعديل البيانات</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="can_delete"
                      checked={newPermissions.can_delete}
                      onCheckedChange={(checked) => 
                        setNewPermissions(prev => ({ ...prev, can_delete: !!checked }))
                      }
                      className="border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <label htmlFor="can_delete" className="text-sm text-white">حذف البيانات</label>
                  </div>
                </div>
              </div>

                <Button 
                  onClick={handleGrantPermission}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={!selectedUser || selectedWarehouses.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  منح الصلاحية
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </ErrorBoundary>
  )
}