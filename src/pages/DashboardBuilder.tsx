import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import {
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  Cog6ToothIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import api from '../api'
import {
  DashboardGrid,
  WidgetPalette,
  WidgetConfig,
  type Widget,
  type WidgetType,
  type DashboardLayout,
} from '../components/dashboard'

interface Dashboard {
  id: string
  name: string
  description?: string
  is_default: boolean
  is_public: boolean
  layout: DashboardLayout[]
  widgets: Widget[]
  theme: string
  refresh_interval?: number
}

const DEFAULT_WIDGET_SIZE: Record<WidgetType, { w: number; h: number; minW: number; minH: number }> = {
  metric: { w: 3, h: 2, minW: 2, minH: 2 },
  bar: { w: 6, h: 3, minW: 3, minH: 2 },
  line: { w: 6, h: 3, minW: 3, minH: 2 },
  area: { w: 6, h: 3, minW: 3, minH: 2 },
  pie: { w: 4, h: 3, minW: 3, minH: 3 },
  table: { w: 6, h: 4, minW: 4, minH: 3 },
  gauge: { w: 3, h: 2, minW: 2, minH: 2 },
  sql: { w: 6, h: 4, minW: 4, minH: 3 },
}

const DEFAULT_WIDGET_TITLES: Record<WidgetType, string> = {
  metric: 'New Metric',
  bar: 'Bar Chart',
  line: 'Line Chart',
  area: 'Area Chart',
  pie: 'Pie Chart',
  table: 'Data Table',
  gauge: 'Gauge',
  sql: 'SQL Query Widget',
}

export default function DashboardBuilder() {
  const { dashboardId } = useParams<{ dashboardId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [isEditing, setIsEditing] = useState(false)
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null)
  const [dashboardName, setDashboardName] = useState('')
  const [localLayout, setLocalLayout] = useState<DashboardLayout[]>([])
  const [localWidgets, setLocalWidgets] = useState<Widget[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [departmentFilter, setDepartmentFilter] = useState<string>('')

  // Fetch dashboard
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard', dashboardId],
    queryFn: async () => {
      if (!dashboardId || dashboardId === 'new') return null
      const response = await api.get(`/dashboards/${dashboardId}`)
      return response.data.dashboard as Dashboard
    },
    enabled: !!dashboardId && dashboardId !== 'new',
  })

  // Initialize local state from fetched data
  useEffect(() => {
    if (dashboardData) {
      setDashboardName(dashboardData.name)
      setLocalLayout(dashboardData.layout || [])
      setLocalWidgets(dashboardData.widgets || [])
    } else if (dashboardId === 'new') {
      setDashboardName('New Dashboard')
      setLocalLayout([])
      setLocalWidgets([])
      setIsEditing(true)
    }
  }, [dashboardData, dashboardId])

  // Create dashboard mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; layout: DashboardLayout[]; widgets: Widget[] }) => {
      const response = await api.post('/dashboards', data)
      return response.data
    },
    onSuccess: (data) => {
      toast.success('Dashboard created')
      navigate(`/app/dashboard-builder/${data.dashboard_id}`)
      queryClient.invalidateQueries({ queryKey: ['dashboards'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create dashboard')
    },
  })

  // Update dashboard mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { name: string; layout: DashboardLayout[]; widgets: Widget[] }) => {
      const response = await api.put(`/dashboards/${dashboardId}`, data)
      return response.data
    },
    onSuccess: () => {
      toast.success('Dashboard saved')
      setHasChanges(false)
      queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to save dashboard')
    },
  })

  // Delete dashboard mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete(`/dashboards/${dashboardId}`)
      return response.data
    },
    onSuccess: () => {
      toast.success('Dashboard deleted')
      navigate('/app/dashboard')
      queryClient.invalidateQueries({ queryKey: ['dashboards'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete dashboard')
    },
  })

  const handleAddWidget = (type: WidgetType) => {
    const newWidget: Widget = {
      id: `widget-${Date.now()}`,
      type,
      title: DEFAULT_WIDGET_TITLES[type],
      config: getDefaultConfig(type),
    }

    const newLayout: DashboardLayout = {
      i: newWidget.id,
      x: 0,
      y: Infinity, // Will be placed at the bottom
      ...DEFAULT_WIDGET_SIZE[type],
    }

    setLocalWidgets([...localWidgets, newWidget])
    setLocalLayout([...localLayout, newLayout])
    setHasChanges(true)
    setEditingWidget(newWidget)
  }

  const handleDeleteWidget = (widgetId: string) => {
    setLocalWidgets(localWidgets.filter((w) => w.id !== widgetId))
    setLocalLayout(localLayout.filter((l) => l.i !== widgetId))
    setHasChanges(true)
  }

  const handleEditWidget = (widgetId: string) => {
    const widget = localWidgets.find((w) => w.id === widgetId)
    if (widget) {
      setEditingWidget(widget)
    }
  }

  const handleSaveWidget = (updatedWidget: Widget) => {
    setLocalWidgets(localWidgets.map((w) => (w.id === updatedWidget.id ? updatedWidget : w)))
    setHasChanges(true)
    setEditingWidget(null)
  }

  const handleLayoutChange = (newLayout: DashboardLayout[]) => {
    setLocalLayout(newLayout)
    setHasChanges(true)
  }

  const handleSave = () => {
    const data = {
      name: dashboardName,
      layout: localLayout,
      widgets: localWidgets,
    }

    if (dashboardId === 'new') {
      createMutation.mutate(data)
    } else {
      updateMutation.mutate(data)
    }
  }

  const handleCancel = () => {
    if (dashboardData) {
      setDashboardName(dashboardData.name)
      setLocalLayout(dashboardData.layout || [])
      setLocalWidgets(dashboardData.widgets || [])
    }
    setHasChanges(false)
    setIsEditing(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {isEditing ? (
            <input
              type="text"
              value={dashboardName}
              onChange={(e) => {
                setDashboardName(e.target.value)
                setHasChanges(true)
              }}
              className="text-2xl font-bold text-gray-900 bg-transparent border-b-2 border-primary-500 focus:outline-none"
            />
          ) : (
            <h1 className="text-2xl font-bold text-gray-900">{dashboardName}</h1>
          )}
          {hasChanges && (
            <span className="text-xs text-warning-600 bg-warning-100 px-2 py-1 rounded">
              Unsaved changes
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <XMarkIcon className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="btn-primary inline-flex items-center gap-2"
              >
                <CheckIcon className="w-4 h-4" />
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <PencilIcon className="w-4 h-4" />
                Edit
              </button>
              {dashboardId !== 'new' && (
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this dashboard?')) {
                      deleteMutation.mutate()
                    }
                  }}
                  className="btn-secondary text-danger-600 hover:text-danger-700 inline-flex items-center gap-2"
                >
                  <TrashIcon className="w-4 h-4" />
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Department Filter */}
      {!isEditing && localWidgets.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Filter by Department:</label>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="input py-1.5 px-3 text-sm w-48"
          >
            <option value="">All Departments</option>
            {['Engineering', 'Sales', 'Marketing', 'Product', 'HR', 'Finance', 'Operations', 'Design', 'Customer Success', 'Legal'].map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      )}

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Widget Palette (shown when editing) */}
        {isEditing && (
          <div className="w-64 flex-shrink-0">
            <WidgetPalette onAddWidget={handleAddWidget} />
          </div>
        )}

        {/* Dashboard Grid */}
        <div className="flex-1 min-h-[600px] bg-gray-50 rounded-lg p-4">
          {localWidgets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Cog6ToothIcon className="w-12 h-12 mb-4 text-gray-300" />
              <p className="text-lg font-medium">No widgets yet</p>
              <p className="text-sm">
                {isEditing
                  ? 'Click a widget type on the left to add it to your dashboard'
                  : 'Click Edit to start adding widgets'}
              </p>
            </div>
          ) : (
            <DashboardGrid
              widgets={localWidgets}
              layout={localLayout}
              isEditing={isEditing}
              onLayoutChange={handleLayoutChange}
              onEditWidget={handleEditWidget}
              onDeleteWidget={handleDeleteWidget}
              departmentFilter={departmentFilter}
            />
          )}
        </div>
      </div>

      {/* Widget Config Modal */}
      <WidgetConfig
        widget={editingWidget}
        isOpen={!!editingWidget}
        onClose={() => setEditingWidget(null)}
        onSave={handleSaveWidget}
      />
    </div>
  )
}

function getDefaultConfig(type: WidgetType): Record<string, any> {
  switch (type) {
    case 'metric':
      return { metric: 'headcount' }
    case 'bar':
    case 'line':
    case 'area':
      return { data_source: 'headcount_by_department', showLegend: true, showGrid: true }
    case 'pie':
      return { data_source: 'headcount_by_department', showLegend: true }
    case 'table':
      return { data_source: 'employees', limit: 10 }
    case 'gauge':
      return { metric: 'engagement' }
    case 'sql':
      return { data_source: 'sql_query', sql_query: 'SELECT * FROM employees LIMIT 10' }
    default:
      return {}
  }
}
