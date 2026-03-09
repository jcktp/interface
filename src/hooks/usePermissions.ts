import { useStore } from '../store'

export function usePermissions() {
  const user = useStore((s) => s.user)

  const isAdminRole = user?.role === 'admin' || user?.role === 'super_admin'

  const hasPermission = (permission: string): boolean => {
    if (!user) return false
    // admin and super_admin have all permissions
    if (isAdminRole) return true
    return user.permissions?.includes(permission) ?? false
  }

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!user) return false
    if (isAdminRole) return true
    return permissions.some((p) => user.permissions?.includes(p) ?? false)
  }

  const hasAllPermissions = (permissions: string[]): boolean => {
    if (!user) return false
    if (isAdminRole) return true
    return permissions.every((p) => user.permissions?.includes(p) ?? false)
  }

  const isAdmin = isAdminRole
  const isSuperAdmin = user?.role === 'super_admin'

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin,
    isSuperAdmin,
    role: user?.role,
    permissions: user?.permissions ?? [],
  }
}
