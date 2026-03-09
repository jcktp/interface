import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useStore } from '../store'
import { usePermissions } from '../hooks/usePermissions'
import toast from 'react-hot-toast'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPermission?: string
  requiredPermissions?: string[]
  requiredRole?: Array<'super_admin' | 'admin' | 'hr_manager' | 'analyst' | 'viewer'>
}

export default function ProtectedRoute({
  children,
  requiredPermission,
  requiredPermissions,
  requiredRole,
}: ProtectedRouteProps) {
  const { isAuthenticated } = useStore()
  const { hasPermission, hasAnyPermission, role } = usePermissions()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check role requirement
  if (requiredRole && role && !requiredRole.includes(role)) {
    toast.error('You do not have permission to access this page')
    return <Navigate to="/app/command-center" replace />
  }

  // Check single permission
  if (requiredPermission && !hasPermission(requiredPermission)) {
    toast.error('You do not have permission to access this page')
    return <Navigate to="/app/command-center" replace />
  }

  // Check multiple permissions (any)
  if (requiredPermissions && requiredPermissions.length > 0 && !hasAnyPermission(requiredPermissions)) {
    toast.error('You do not have permission to access this page')
    return <Navigate to="/app/command-center" replace />
  }

  return <>{children}</>
}
