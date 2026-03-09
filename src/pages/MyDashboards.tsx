import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  PlusIcon,
  PencilSquareIcon,
  DocumentDuplicateIcon,
  ShareIcon,
  TrashIcon,
  Squares2X2Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import api from '../api'

interface Dashboard {
  id: string
  name: string
  description?: string
  is_default: boolean
  is_public: boolean
  widget_count: number
  created_at: string
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(months / 12)
  return `${years}y ago`
}

export default function MyDashboards() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showDuplicatePrompt, setShowDuplicatePrompt] = useState(false)

  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null)

  // Create modal state
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createIsDefault, setCreateIsDefault] = useState(false)

  // Share modal state
  const [shareUserEmail, setShareUserEmail] = useState('')
  const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('view')

  // Duplicate prompt state
  const [duplicateName, setDuplicateName] = useState('')

  // Fetch dashboards
  const { data: dashboards, isLoading } = useQuery({
    queryKey: ['dashboards'],
    queryFn: async () => {
      const response = await api.get('/dashboards')
      return response.data.dashboards as Dashboard[]
    },
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; is_default: boolean }) => {
      const response = await api.post('/dashboards', data)
      return response.data
    },
    onSuccess: () => {
      toast.success('Dashboard created')
      queryClient.invalidateQueries({ queryKey: ['dashboards'] })
      closeCreateModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create dashboard')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/dashboards/${id}`)
      return response.data
    },
    onSuccess: () => {
      toast.success('Dashboard deleted')
      queryClient.invalidateQueries({ queryKey: ['dashboards'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete dashboard')
    },
  })

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await api.post(`/dashboards/${id}/duplicate`, { name })
      return response.data
    },
    onSuccess: () => {
      toast.success('Dashboard duplicated')
      queryClient.invalidateQueries({ queryKey: ['dashboards'] })
      closeDuplicatePrompt()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to duplicate dashboard')
    },
  })

  // Share mutation
  const shareMutation = useMutation({
    mutationFn: async ({ id, user_email, permission }: { id: string; user_email: string; permission: string }) => {
      const response = await api.post(`/dashboards/${id}/share`, { user_email, permission })
      return response.data
    },
    onSuccess: () => {
      toast.success('Dashboard shared')
      closeShareModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to share dashboard')
    },
  })

  // Modal helpers
  const openCreateModal = () => {
    setCreateName('')
    setCreateDescription('')
    setCreateIsDefault(false)
    setShowCreateModal(true)
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
    setCreateName('')
    setCreateDescription('')
    setCreateIsDefault(false)
  }

  const openShareModal = (dashboardId: string) => {
    setSelectedDashboardId(dashboardId)
    setShareUserEmail('')
    setSharePermission('view')
    setShowShareModal(true)
  }

  const closeShareModal = () => {
    setShowShareModal(false)
    setSelectedDashboardId(null)
    setShareUserEmail('')
    setSharePermission('view')
  }

  const openDuplicatePrompt = (dashboard: Dashboard) => {
    setSelectedDashboardId(dashboard.id)
    setDuplicateName(`${dashboard.name} (Copy)`)
    setShowDuplicatePrompt(true)
  }

  const closeDuplicatePrompt = () => {
    setShowDuplicatePrompt(false)
    setSelectedDashboardId(null)
    setDuplicateName('')
  }

  const handleCreate = () => {
    if (!createName.trim()) {
      toast.error('Dashboard name is required')
      return
    }
    createMutation.mutate({
      name: createName.trim(),
      description: createDescription.trim(),
      is_default: createIsDefault,
    })
  }

  const handleShare = () => {
    if (!shareUserEmail.trim()) {
      toast.error('User email is required')
      return
    }
    if (!selectedDashboardId) return
    shareMutation.mutate({
      id: selectedDashboardId,
      user_email: shareUserEmail.trim(),
      permission: sharePermission,
    })
  }

  const handleDuplicate = () => {
    if (!duplicateName.trim()) {
      toast.error('Dashboard name is required')
      return
    }
    if (!selectedDashboardId) return
    duplicateMutation.mutate({
      id: selectedDashboardId,
      name: duplicateName.trim(),
    })
  }

  const handleDelete = (dashboard: Dashboard) => {
    if (confirm(`Are you sure you want to delete "${dashboard.name}"?`)) {
      deleteMutation.mutate(dashboard.id)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const hasDashboards = dashboards && dashboards.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Dashboards</h1>
        <button onClick={openCreateModal} className="btn-primary inline-flex items-center gap-2">
          <PlusIcon className="w-4 h-4" />
          Create Dashboard
        </button>
      </div>

      {/* Empty State */}
      {!hasDashboards && (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <Squares2X2Icon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No dashboards yet</h2>
          <p className="text-gray-500 mb-6">
            Create your first dashboard to start visualizing your HR data.
          </p>
          <button onClick={openCreateModal} className="btn-primary inline-flex items-center gap-2">
            <PlusIcon className="w-4 h-4" />
            Create Dashboard
          </button>
        </div>
      )}

      {/* Dashboard Table */}
      {hasDashboards && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Widgets</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dashboards.map((dashboard) => (
                <tr
                  key={dashboard.id}
                  onClick={() => navigate(`/app/dashboard-builder/${dashboard.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-semibold text-gray-900">{dashboard.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-500">
                      {dashboard.description
                        ? dashboard.description.length > 60
                          ? `${dashboard.description.slice(0, 60)}...`
                          : dashboard.description
                        : '\u2014'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700">{dashboard.widget_count}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {dashboard.is_default && (
                        <span className="text-xs font-medium bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                          Default
                        </span>
                      )}
                      {dashboard.is_public && (
                        <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          Public
                        </span>
                      )}
                      {!dashboard.is_default && !dashboard.is_public && (
                        <span className="text-xs text-gray-400">{'\u2014'}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-500">{timeAgo(dashboard.created_at)}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/app/dashboard-builder/${dashboard.id}`) }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                        title="Edit"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openDuplicatePrompt(dashboard) }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                        title="Duplicate"
                      >
                        <DocumentDuplicateIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openShareModal(dashboard.id) }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                        title="Share"
                      >
                        <ShareIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(dashboard) }}
                        className="p-1.5 text-gray-400 hover:text-danger-600 rounded-md hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={closeCreateModal} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Create Dashboard</h2>
              <button onClick={closeCreateModal} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="input w-full"
                  placeholder="e.g. Executive Overview"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  className="input w-full"
                  placeholder="Optional description"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="create-default"
                  checked={createIsDefault}
                  onChange={(e) => setCreateIsDefault(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="create-default" className="text-sm text-gray-700">
                  Set as default dashboard
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={closeCreateModal} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="btn-primary"
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={closeShareModal} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Share Dashboard</h2>
              <button onClick={closeShareModal} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User Email</label>
                <input
                  type="email"
                  value={shareUserEmail}
                  onChange={(e) => setShareUserEmail(e.target.value)}
                  className="input w-full"
                  placeholder="colleague@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Permission</label>
                <select
                  value={sharePermission}
                  onChange={(e) => setSharePermission(e.target.value as 'view' | 'edit')}
                  className="input w-full"
                >
                  <option value="view">View only</option>
                  <option value="edit">Can edit</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={closeShareModal} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleShare}
                disabled={shareMutation.isPending}
                className="btn-primary"
              >
                {shareMutation.isPending ? 'Sharing...' : 'Share'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Prompt Modal */}
      {showDuplicatePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={closeDuplicatePrompt} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Duplicate Dashboard</h2>
              <button onClick={closeDuplicatePrompt} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Dashboard Name</label>
              <input
                type="text"
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                className="input w-full"
                placeholder="Dashboard name"
              />
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={closeDuplicatePrompt} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleDuplicate}
                disabled={duplicateMutation.isPending}
                className="btn-primary"
              >
                {duplicateMutation.isPending ? 'Duplicating...' : 'Duplicate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
