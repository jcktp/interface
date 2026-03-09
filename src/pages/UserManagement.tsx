import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import { createUserWithPassword, updateUserPermissions } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import {
  ShieldCheckIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  UserPlusIcon,
  KeyIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline'

interface ManagedUser {
  id: string
  email: string
  name: string
  role: string
  department?: string
  is_active: boolean
  last_login?: string
  created_at: string
  permissions?: string[]
  custom_permissions?: string[] | null
}

const ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'hr_manager', label: 'HR Manager' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'viewer', label: 'Viewer' },
]

// Permission definitions grouped by section
const PERMISSION_GROUPS = {
  'Page Access': [
    { key: 'command_center:view', label: 'Command Center' },
    { key: 'analytics:view', label: 'Dashboard' },
    { key: 'dashboards:view', label: 'My Dashboards' },
    { key: 'planning:view', label: 'Workforce Planning' },
    { key: 'candidates:view', label: 'Recruitment' },
    { key: 'retention:view', label: 'Retention' },
    { key: 'diversity:view', label: 'D&I' },
    { key: 'deep_dive:view', label: 'Deep Dive' },
    { key: 'kpis:view', label: 'KPIs' },
    { key: 'attendance:view', label: 'Attendance' },
    { key: 'compensation:view', label: 'Compensation' },
    { key: 'scenarios:view', label: 'Scenario Planning' },
    { key: 'reports:view', label: 'Reports' },
    { key: 'ai_qa:use', label: 'AI Assistant' },
    { key: 'ml:view', label: 'ML Models' },
    { key: 'queries:execute', label: 'SQL Editor' },
    { key: 'uploads:view', label: 'Data Management' },
    { key: 'integrations:view', label: 'Integrations' },
    { key: 'api_docs:view', label: 'API Docs' },
    { key: 'users:manage_roles', label: 'User Management' },
    { key: 'settings:view', label: 'Settings' },
  ],
  'Data Permissions': [
    { key: 'employees:view', label: 'Employees (view)' },
    { key: 'employees:edit', label: 'Employees (edit)' },
    { key: 'employees:export', label: 'Employees (export)' },
    { key: 'candidates:edit', label: 'Candidates (edit)' },
    { key: 'salary:view', label: 'Salary data (view)' },
    { key: 'salary:edit', label: 'Salary data (edit)' },
    { key: 'analytics:export', label: 'Analytics (view)' },
  ],
  'Actions': [
    { key: 'uploads:create', label: 'Upload data' },
    { key: 'imports:create', label: 'Import' },
    { key: 'ml:train', label: 'Run ML models' },
    { key: 'kpis:approve_targets', label: 'Approve KPI targets' },
    { key: 'users:create', label: 'Manage users' },
    { key: 'roles:manage', label: 'Manage roles' },
  ],
}

export default function UserManagement() {
  const { hasPermission } = usePermissions()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [showPermissions, setShowPermissions] = useState(false)
  const [permissionsUserId, setPermissionsUserId] = useState<string | null>(null)
  const [permissionsUserRole, setPermissionsUserRole] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set())
  const [savingPermissions, setSavingPermissions] = useState(false)
  const [inviteData, setInviteData] = useState({ email: '', name: '', role: 'viewer' })
  const [createData, setCreateData] = useState({ email: '', name: '', role: 'viewer', department: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)
  const [creatingUser, setCreatingUser] = useState(false)
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [showAudit, setShowAudit] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [roleFilter, statusFilter])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (roleFilter) params.role = roleFilter
      if (statusFilter) params.status = statusFilter
      const res = await api.get('/admin/users', { params })
      const data = res.data
      setUsers(Array.isArray(data) ? data : data.users || [])
      setTotal(data.total || (Array.isArray(data) ? data.length : 0))
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole })
      toast.success('Role updated')
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update role')
    }
  }

  const handleDeactivate = async (userId: string) => {
    try {
      await api.put(`/admin/users/${userId}/deactivate`)
      toast.success('User deactivated')
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to deactivate')
    }
  }

  const handleActivate = async (userId: string) => {
    try {
      await api.put(`/admin/users/${userId}/activate`)
      toast.success('User activated')
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to activate')
    }
  }

  const handleInvite = async () => {
    try {
      await api.post('/admin/users/invite', inviteData)
      toast.success('Invitation sent')
      setShowInvite(false)
      setInviteData({ email: '', name: '', role: 'viewer' })
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to invite user')
    }
  }

  const handleCreateUser = async () => {
    setCreatingUser(true)
    try {
      const payload: any = {
        email: createData.email,
        name: createData.name,
        role: createData.role,
      }
      if (createData.department) payload.department = createData.department
      if (createData.password) payload.password = createData.password
      const res = await createUserWithPassword(payload)
      const password = res.data?.password || res.data?.generated_password
      setGeneratedPassword(password)
      toast.success('User created successfully')
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create user')
    } finally {
      setCreatingUser(false)
    }
  }

  const handleCopyPassword = async () => {
    if (generatedPassword) {
      await navigator.clipboard.writeText(generatedPassword)
      toast.success('Password copied to clipboard')
    }
  }

  const handleCloseCreateUser = () => {
    setShowCreateUser(false)
    setCreateData({ email: '', name: '', role: 'viewer', department: '', password: '' })
    setShowPassword(false)
    setGeneratedPassword(null)
  }

  const handleOpenPermissions = (user: ManagedUser) => {
    setPermissionsUserId(user.id)
    setPermissionsUserRole(user.role)
    // Use custom_permissions if they've been set, otherwise fall back to effective role permissions
    const initialPerms = user.custom_permissions ?? user.permissions ?? []
    setSelectedPermissions(new Set(initialPerms))
    setShowPermissions(true)
  }

  const togglePermission = (key: string) => {
    setSelectedPermissions(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const toggleGroupAll = (groupPermissions: { key: string }[]) => {
    setSelectedPermissions(prev => {
      const next = new Set(prev)
      const allChecked = groupPermissions.every(p => next.has(p.key))
      if (allChecked) {
        groupPermissions.forEach(p => next.delete(p.key))
      } else {
        groupPermissions.forEach(p => next.add(p.key))
      }
      return next
    })
  }

  const handleSavePermissions = async () => {
    if (!permissionsUserId) return
    setSavingPermissions(true)
    try {
      await updateUserPermissions(permissionsUserId, Array.from(selectedPermissions))
      toast.success('Permissions updated')
      setShowPermissions(false)
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update permissions')
    } finally {
      setSavingPermissions(false)
    }
  }

  const handleViewAudit = async (userId: string) => {
    try {
      const res = await api.get(`/admin/users/${userId}/audit-log`)
      setAuditLog(Array.isArray(res.data) ? res.data : res.data?.entries || [])
      setShowAudit(true)
    } catch {
      toast.error('Failed to load audit log')
    }
  }

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      super_admin: 'bg-purple-100 text-purple-700',
      admin: 'bg-indigo-100 text-indigo-700',
      hr_manager: 'bg-blue-100 text-blue-700',
      analyst: 'bg-green-100 text-green-700',
      viewer: 'bg-gray-100 text-gray-700',
    }
    return styles[role] || 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">{total} users in your organization</p>
        </div>
        <div className="flex items-center gap-2">
          {hasPermission('users:create') && (
            <>
              <button onClick={() => setShowInvite(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                <EnvelopeIcon className="h-4 w-4" />
                Invite User
              </button>
              <button onClick={() => setShowCreateUser(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                <UserPlusIcon className="h-4 w-4" />
                Create User
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
        />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="animate-pulse bg-gray-100 rounded h-12" />
            ))}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.filter(user => {
                if (!searchQuery) return true
                const q = searchQuery.toLowerCase()
                return user.name?.toLowerCase().includes(q) || user.email?.toLowerCase().includes(q)
              }).map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {hasPermission('users:manage_roles') ? (
                      <select
                        value={user.role}
                        onChange={e => handleRoleChange(user.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${getRoleBadge(user.role)}`}
                      >
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getRoleBadge(user.role)}`}>
                        {user.role.replace(/_/g, ' ')}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{user.department || '--'}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      {hasPermission('users:manage_roles') && (
                        <button onClick={() => handleOpenPermissions(user)} title="Edit Permissions" className="text-gray-400 hover:text-indigo-600">
                          <KeyIcon className="h-4 w-4" />
                        </button>
                      )}
                      {hasPermission('users:delete') && (
                        user.is_active ? (
                          <button onClick={() => handleDeactivate(user.id)} title="Deactivate" className="text-gray-400 hover:text-red-600">
                            <NoSymbolIcon className="h-4 w-4" />
                          </button>
                        ) : (
                          <button onClick={() => handleActivate(user.id)} title="Activate" className="text-gray-400 hover:text-green-600">
                            <CheckCircleIcon className="h-4 w-4" />
                          </button>
                        )
                      )}
                      <button onClick={() => handleViewAudit(user.id)} title="View audit log" className="text-gray-400 hover:text-indigo-600">
                        <ShieldCheckIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">No users found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Invite User</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <input type="email" value={inviteData.email} onChange={e => setInviteData(p => ({ ...p, email: e.target.value }))} className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="user@company.com" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Name</label>
                <input type="text" value={inviteData.name} onChange={e => setInviteData(p => ({ ...p, name: e.target.value }))} className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Full Name" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Role</label>
                <select value={inviteData.role} onChange={e => setInviteData(p => ({ ...p, role: e.target.value }))} className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowInvite(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleInvite} disabled={!inviteData.email || !inviteData.name} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                <EnvelopeIcon className="h-4 w-4" />
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create User</h3>
            {generatedPassword ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-800 mb-1">User created successfully!</p>
                  <p className="text-xs text-green-600">Save this password now. It will not be shown again.</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-mono text-green-400 break-all">{generatedPassword}</code>
                    <button onClick={handleCopyPassword} className="ml-3 flex-shrink-0 text-gray-400 hover:text-white transition-colors" title="Copy password">
                      <ClipboardDocumentIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={handleCloseCreateUser} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Email *</label>
                    <input type="email" value={createData.email} onChange={e => setCreateData(p => ({ ...p, email: e.target.value }))} className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="user@company.com" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Name *</label>
                    <input type="text" value={createData.name} onChange={e => setCreateData(p => ({ ...p, name: e.target.value }))} className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Full Name" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Role *</label>
                    <select value={createData.role} onChange={e => setCreateData(p => ({ ...p, role: e.target.value }))} className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Department <span className="text-gray-400">(optional)</span></label>
                    <input type="text" value={createData.department} onChange={e => setCreateData(p => ({ ...p, department: e.target.value }))} className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Engineering" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Password <span className="text-gray-400">(leave empty to auto-generate)</span></label>
                    <div className="relative mt-1">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={createData.password}
                        onChange={e => setCreateData(p => ({ ...p, password: e.target.value }))}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Auto-generated if empty"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-medium"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={handleCloseCreateUser} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                  <button onClick={handleCreateUser} disabled={!createData.email || !createData.name || creatingUser} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    <UserPlusIcon className="h-4 w-4" />
                    {creatingUser ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {showPermissions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Edit Permissions</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Current role: <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${getRoleBadge(permissionsUserRole)}`}>{permissionsUserRole.replace(/_/g, ' ')}</span>
                </p>
              </div>
              <button onClick={() => setShowPermissions(false)} className="text-gray-400 hover:text-gray-600 text-sm">Close</button>
            </div>

            <div className="space-y-6">
              {Object.entries(PERMISSION_GROUPS).map(([groupName, permissions]) => {
                const allChecked = permissions.every(p => selectedPermissions.has(p.key))
                const someChecked = permissions.some(p => selectedPermissions.has(p.key))
                return (
                  <div key={groupName}>
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={el => { if (el) el.indeterminate = someChecked && !allChecked }}
                        onChange={() => toggleGroupAll(permissions)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{groupName}</h4>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 ml-6">
                      {permissions.map(perm => (
                        <label key={perm.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                          <input
                            type="checkbox"
                            checked={selectedPermissions.has(perm.key)}
                            onChange={() => togglePermission(perm.key)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          {perm.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-400">{selectedPermissions.size} permissions selected</p>
              <div className="flex gap-3">
                <button onClick={() => setShowPermissions(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                <button onClick={handleSavePermissions} disabled={savingPermissions} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {savingPermissions ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {showAudit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Audit Log</h3>
              <button onClick={() => setShowAudit(false)} className="text-gray-400 hover:text-gray-600 text-sm">Close</button>
            </div>
            {auditLog.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No audit entries</p>
            ) : (
              <div className="space-y-3">
                {auditLog.map((entry, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{entry.action?.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-gray-400">{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                    {entry.details && (
                      <div className="text-xs text-gray-500 mt-1">
                        {Object.entries(entry.details).map(([k, v]) => (
                          <span key={k} className="mr-3">{k}: {String(v)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
