import { useState, useEffect, useCallback, Fragment, useMemo } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { useLocalization } from '../hooks/useLocalization'
import { usePageFilters } from '../hooks/usePageFilters'
import PageFilterBar from '../components/PageFilterBar'
import { useFinancialMetrics } from '../hooks'
import {
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  BanknotesIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import DataSourceSelector from '../components/DataSourceSelector'

interface KPIDashboardItem {
  kpi_id: string
  name: string
  category: string
  unit: string
  description: string
  current_value: number | null
  previous_value: number | null
  variance: number | null
  target_value: number | null
  target_status: string | null
  last_updated: string | null
  is_system: boolean
  trend?: { date: string; value: number }[]
}

interface KPITarget {
  id: string
  kpi_definition_id: string
  target_value: number
  period_start: string
  period_end: string
  status: string
  department: string | null
  notes: string | null
  created_at: string
}

interface LevelTargetEntry {
  id: string
  kpi_id: string
  kpi_name: string
  kpi_category: string
  kpi_unit: string
  target_value: number
  org_unit: string | null
  org_unit_type: string | null
  status: string
}

interface ByLevelData {
  org: LevelTargetEntry[]
  departments: Record<string, LevelTargetEntry[]>
  teams: Record<string, LevelTargetEntry[]>
  employees: Record<string, LevelTargetEntry[]>
}

const DEPARTMENTS = [
  'Engineering',
  'Product',
  'Design',
  'Marketing',
  'Sales',
  'Customer Success',
  'HR',
  'Finance',
  'Operations',
]

const PERIODS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
]

function getPeriodFromDates(start: string, end: string): string {
  if (!start || !end) return 'monthly'
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diffMs = endDate.getTime() - startDate.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays > 300) return 'annual'
  if (diffDays > 60) return 'quarterly'
  return 'monthly'
}

function MiniSparkline({ data, color = '#6366f1' }: { data: { value: number }[]; color?: string }) {
  if (!data || data.length < 2) return null
  const vals = data.map(d => d.value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const W = 60, H = 20
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W
    const y = H - ((v - min) / range) * H
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="flex-shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function getDatesFromPeriod(period: string, refStart?: string): { start: string; end: string } {
  const now = refStart ? new Date(refStart) : new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  if (period === 'annual') {
    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`,
    }
  }
  if (period === 'quarterly') {
    const qStart = Math.floor(month / 3) * 3
    const startDate = new Date(year, qStart, 1)
    const endDate = new Date(year, qStart + 3, 0)
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    }
  }
  // monthly
  const startDate = new Date(year, month, 1)
  const endDate = new Date(year, month + 1, 0)
  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
  }
}

export default function KPIManagement() {
  const { hasPermission } = usePermissions()
  const loc = useLocalization()
  const { department, setDepartment, location, setLocation, timePeriod, setTimePeriod, filterParams, hasFilters, resetFilters } = usePageFilters()
  const [dataSource, setDataSource] = useState('live-api')
  const { data: financialData, isLoading: financialLoading } = useFinancialMetrics(filterParams)
  const [dashboard, setDashboard] = useState<KPIDashboardItem[]>([])
  const [targets, setTargets] = useState<KPITarget[]>([])
  const [byLevelData, setByLevelData] = useState<ByLevelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'targets' | 'by-level'>('overview')
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())
  const [empSearch, setEmpSearch] = useState('')
  const [levelKpiFilter, setLevelKpiFilter] = useState<string>('all')
  const [showCreateTarget, setShowCreateTarget] = useState(false)
  const [showCreateKPI, setShowCreateKPI] = useState(false)
  const [newTarget, setNewTarget] = useState({ kpi_definition_id: '', target_value: '', period_start: '', period_end: '', department: '', notes: '' })
  const [newKPI, setNewKPI] = useState({ name: '', description: '', category: 'custom', unit: 'number', calculation_method: 'manual' })
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [editingTarget, setEditingTarget] = useState<KPITarget | null>(null)
  const [editForm, setEditForm] = useState({ target_value: '', period_start: '', period_end: '', department: '', notes: '' })
  const [searchQuery, setSearchQuery] = useState('')
  // Targets tab filters
  const [targetsSearch, setTargetsSearch] = useState('')
  const [targetsDeptFilter, setTargetsDeptFilter] = useState('')
  const [targetsStatusFilter, setTargetsStatusFilter] = useState('')
  // By-level period filter
  const [levelPeriodFilter, setLevelPeriodFilter] = useState<string>('all')
  // Targets tab pagination
  const [targetsPage, setTargetsPage] = useState(1)
  const TARGETS_PER_PAGE = 20
  // Inline editing state for targets tab
  const [inlineEditId, setInlineEditId] = useState<string | null>(null)
  const [inlineEditValues, setInlineEditValues] = useState({ target_value: '', period: 'monthly' })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [dashRes, targetsRes, byLevelRes] = await Promise.all([
        api.get('/kpis/dashboard', { params: filterParams }).catch(() => ({ data: [] })),
        api.get('/kpis/targets', { params: filterParams }).catch(() => ({ data: [] })),
        api.get('/kpis/targets/by-level', { params: filterParams }).catch(() => ({ data: null })),
      ])
      const dashData = Array.isArray(dashRes.data) ? dashRes.data : dashRes.data?.data || dashRes.data?.items || []
      setDashboard(dashData)
      setTargets(Array.isArray(targetsRes.data) ? targetsRes.data : targetsRes.data?.data || targetsRes.data?.targets || [])
      if (byLevelRes.data?.data) setByLevelData(byLevelRes.data.data)
      // Expand all categories by default
      const cats = [...new Set(dashData.map((k: KPIDashboardItem) => k.category))] as string[]
      setExpandedCategories(new Set(cats))
    } catch {
      toast.error('Failed to load KPI data')
    } finally {
      setLoading(false)
    }
  }, [department, location, timePeriod]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Re-fetch by-level when period filter changes
  const fetchByLevel = useCallback(async (period: string) => {
    const params: Record<string, string> = { ...filterParams }
    if (period !== 'all') {
      const dates = getDatesFromPeriod(period)
      params.start_date = dates.start
      params.end_date = dates.end
    }
    try {
      const res = await api.get('/kpis/targets/by-level', { params }).catch(() => ({ data: null }))
      if (res.data?.data) setByLevelData(res.data.data)
    } catch { /* silent */ }
  }, [department, location, timePeriod]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'by-level') {
      fetchByLevel(levelPeriodFilter)
    }
  }, [levelPeriodFilter, activeTab, fetchByLevel])

  // Filtered dashboard items based on search
  const filteredDashboard = useMemo(() => {
    if (!searchQuery.trim()) return dashboard
    const q = searchQuery.toLowerCase()
    return dashboard.filter(k =>
      k.name.toLowerCase().includes(q) ||
      k.category.toLowerCase().includes(q) ||
      (k.description && k.description.toLowerCase().includes(q))
    )
  }, [dashboard, searchQuery])

  const filteredCategories = useMemo(() => {
    return [...new Set(filteredDashboard.map(k => k.category))]
  }, [filteredDashboard])

  const filteredTargets = useMemo(() => {
    setTargetsPage(1)
    return targets.filter(t => {
      const kpi = dashboard.find(k => k.kpi_id === t.kpi_definition_id)
      const kpiName = kpi?.name?.toLowerCase() || ''
      if (targetsSearch && !kpiName.includes(targetsSearch.toLowerCase()) && !t.notes?.toLowerCase().includes(targetsSearch.toLowerCase())) return false
      if (targetsDeptFilter && t.department !== targetsDeptFilter && !(targetsDeptFilter === '__all__' && !t.department)) return false
      if (targetsStatusFilter && t.status !== targetsStatusFilter) return false
      return true
    })
  }, [targets, dashboard, targetsSearch, targetsDeptFilter, targetsStatusFilter])

  const handleCalculate = async () => {
    const toastId = toast.loading('Calculating KPI values...')
    try {
      await api.post('/kpis/calculate')
      toast.dismiss(toastId)
      toast.success('KPIs calculated successfully')
      await fetchData()
    } catch {
      toast.dismiss(toastId)
      toast.error('Calculation failed')
    }
  }

  const handleApprove = async (targetId: string) => {
    try {
      await api.post(`/kpis/targets/${targetId}/approve`)
      toast.success('Target approved')
      fetchData()
    } catch {
      toast.error('Failed to approve target')
    }
  }

  const handleReject = async (targetId: string) => {
    try {
      await api.post(`/kpis/targets/${targetId}/reject`)
      toast.success('Target rejected')
      fetchData()
    } catch {
      toast.error('Failed to reject target')
    }
  }

  const handleToggleTarget = async (target: KPITarget) => {
    const newStatus = target.status === 'active' ? 'inactive' : 'active'
    try {
      await api.put(`/kpis/targets/${target.id}`, { status: newStatus })
      toast.success(`Target ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
      fetchData()
    } catch {
      toast.error('Failed to update target status')
    }
  }


  const handleSaveEdit = async () => {
    if (!editingTarget) return
    try {
      await api.put(`/kpis/targets/${editingTarget.id}`, {
        target_value: parseFloat(editForm.target_value),
        period_start: editForm.period_start,
        period_end: editForm.period_end,
        department: editForm.department || null,
        notes: editForm.notes || null,
      })
      toast.success('Target updated')
      setEditingTarget(null)
      fetchData()
    } catch {
      toast.error('Failed to update target')
    }
  }

  // Inline edit handlers for targets tab
  const startInlineEdit = (target: KPITarget) => {
    setInlineEditId(target.id)
    setInlineEditValues({
      target_value: String(target.target_value),
      period: getPeriodFromDates(target.period_start, target.period_end),
    })
  }

  const cancelInlineEdit = () => {
    setInlineEditId(null)
    setInlineEditValues({ target_value: '', period: 'monthly' })
  }

  const saveInlineEdit = async (target: KPITarget) => {
    const dates = getDatesFromPeriod(inlineEditValues.period, target.period_start)
    try {
      await api.put(`/kpis/targets/${target.id}`, {
        target_value: parseFloat(inlineEditValues.target_value),
        period_start: dates.start,
        period_end: dates.end,
        department: target.department || null,
        notes: target.notes || null,
      })
      toast.success('Target updated')
      setInlineEditId(null)
      fetchData()
    } catch {
      toast.error('Failed to update target')
    }
  }

  const handleCreateTarget = async () => {
    try {
      await api.post('/kpis/targets', {
        kpi_definition_id: newTarget.kpi_definition_id,
        target_value: parseFloat(newTarget.target_value),
        period_start: newTarget.period_start,
        period_end: newTarget.period_end,
        department: newTarget.department || null,
        notes: newTarget.notes || null,
      })
      toast.success('Target created')
      setShowCreateTarget(false)
      setNewTarget({ kpi_definition_id: '', target_value: '', period_start: '', period_end: '', department: '', notes: '' })
      fetchData()
    } catch {
      toast.error('Failed to create target')
    }
  }

  const handleCreateKPI = async () => {
    try {
      await api.post('/kpis/definitions', newKPI)
      toast.success('KPI created')
      setShowCreateKPI(false)
      setNewKPI({ name: '', description: '', category: 'custom', unit: 'number', calculation_method: 'manual' })
      fetchData()
    } catch {
      toast.error('Failed to create KPI')
    }
  }

  const formatValue = (value: number | null, unit: string) => {
    if (value === null) return '--'
    if (unit === 'percentage') return loc.percentage(value)
    if (unit === 'currency') return loc.currency(value)
    if (unit === 'days') return `${value.toFixed(0)}d`
    if (unit === 'score') return value.toFixed(2)
    return loc.number(value)
  }

  const getVarianceColor = (variance: number | null) => {
    if (variance === null) return 'text-gray-400'
    if (variance > 0) return 'text-green-600'
    if (variance < 0) return 'text-red-600'
    return 'text-gray-500'
  }

  const getTargetStatusBadge = (kpi: KPIDashboardItem) => {
    if (kpi.target_value === null || kpi.current_value === null) {
      return { label: 'No Target', className: 'bg-gray-100 text-gray-500' }
    }
    const pct = (kpi.current_value / kpi.target_value) * 100
    if (pct >= 95) return { label: 'On Track', className: 'bg-green-100 text-green-700' }
    if (pct >= 80) return { label: 'At Risk', className: 'bg-amber-100 text-amber-700' }
    return { label: 'Off Track', className: 'bg-red-100 text-red-700' }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      pending_approval: 'bg-yellow-100 text-yellow-700',
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-500',
      expired: 'bg-gray-100 text-gray-500',
      rejected: 'bg-red-100 text-red-700',
    }
    return styles[status] || 'bg-gray-100 text-gray-700'
  }

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) {
        next.delete(cat)
      } else {
        next.add(cat)
      }
      return next
    })
  }

  const toggleRow = (kpiId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(kpiId)) {
        next.delete(kpiId)
      } else {
        next.add(kpiId)
      }
      return next
    })
  }

  const collapseAll = () => setExpandedCategories(new Set())
  const expandAll = () => setExpandedCategories(new Set(filteredCategories))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KPIs & Targets</h1>
          <p className="text-sm text-gray-500 mt-1">Track organizational performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <DataSourceSelector module="KPIs" selectedSource={dataSource} onSourceChange={setDataSource} compact />
          {hasPermission('kpis:edit') && (
            <button onClick={handleCalculate} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-xs font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              <ArrowPathIcon className="h-3.5 w-3.5" />
              Calculate
            </button>
          )}
          {hasPermission('kpis:create') && (
            <>
              <button onClick={() => setShowCreateKPI(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-xs font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                <PlusIcon className="h-3.5 w-3.5" />
                New KPI
              </button>
              <button onClick={() => setShowCreateTarget(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 transition-colors">
                <PlusIcon className="h-3.5 w-3.5" />
                New Target
              </button>
            </>
          )}
        </div>
      </div>

      <PageFilterBar
        department={department} setDepartment={setDepartment}
        location={location} setLocation={setLocation}
        timePeriod={timePeriod} setTimePeriod={setTimePeriod}
        hasFilters={hasFilters} resetFilters={resetFilters}
      />

      {/* Tabs + Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <button onClick={() => setActiveTab('overview')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'overview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            Overview ({dashboard.length})
          </button>
          <button onClick={() => setActiveTab('by-level')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'by-level' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            By Level
          </button>
          <button onClick={() => setActiveTab('targets')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'targets' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            All Targets ({targets.length})
          </button>
        </div>
        {activeTab === 'overview' && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search KPIs..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg w-52 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <button onClick={expandAll} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Expand all</button>
            <button onClick={collapseAll} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Collapse</button>
          </div>
        )}
        {activeTab === 'by-level' && (
          <div className="flex items-center gap-2">
            <select
              value={levelKpiFilter}
              onChange={e => setLevelKpiFilter(e.target.value)}
              className="text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">All KPIs</option>
              {dashboard.map(k => <option key={k.kpi_id} value={k.kpi_id}>{k.name}</option>)}
            </select>
            <select
              value={levelPeriodFilter}
              onChange={e => setLevelPeriodFilter(e.target.value)}
              className="text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">All Periods</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
        )}
        {activeTab === 'targets' && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={targetsSearch}
              onChange={e => setTargetsSearch(e.target.value)}
              placeholder="Search targets…"
              className="text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-2.5 py-1.5 w-36 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <select
              value={targetsDeptFilter}
              onChange={e => setTargetsDeptFilter(e.target.value)}
              className="text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">All Departments</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select
              value={targetsStatusFilter}
              onChange={e => setTargetsStatusFilter(e.target.value)}
              className="text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="achieved">Achieved</option>
              <option value="missed">Missed</option>
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-1.5">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="animate-pulse bg-gray-100 rounded h-8" />
          ))}
        </div>
      ) : activeTab === 'overview' ? (
        <div className="space-y-4">
          {/* Financial & Quality of Hire KPIs -- compact */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Financial & Quality</h3>
            {financialLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-20" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Revenue / Employee</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                        {loc.currency(financialData?.data?.revenue_per_employee ?? 0)}
                      </p>
                    </div>
                    <BanknotesIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Profit / Employee</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                        {loc.currency(financialData?.data?.profit_per_employee ?? 0)}
                      </p>
                    </div>
                    <CurrencyDollarIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Quality of Hire</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {(financialData?.data?.quality_of_hire ?? 0).toFixed(1)}
                        </p>
                        <span className="text-sm text-gray-400 dark:text-gray-500">/100</span>
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            (financialData?.data?.quality_of_hire ?? 0) > 75
                              ? 'bg-green-500'
                              : (financialData?.data?.quality_of_hire ?? 0) >= 50
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                        />
                      </div>
                    </div>
                    <SparklesIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Compact KPI Table */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase w-7"></th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Metric</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Current</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Target</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Variance</th>
                  <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filteredCategories.map(cat => {
                  const catKpis = filteredDashboard.filter(k => k.category === cat)
                  const isCatExpanded = expandedCategories.has(cat)
                  return (
                    <Fragment key={`cat-${cat}`}>
                      {/* Category header row */}
                      <tr
                        className="bg-gray-50/60 dark:bg-gray-800/60 cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-700/60"
                        onClick={() => toggleCategory(cat)}
                      >
                        <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">
                          {isCatExpanded ? (
                            <ChevronDownIcon className="h-3 w-3" />
                          ) : (
                            <ChevronRightIcon className="h-3 w-3" />
                          )}
                        </td>
                        <td colSpan={5} className="px-3 py-1.5">
                          <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">{cat}</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1.5">({catKpis.length})</span>
                        </td>
                      </tr>
                      {/* KPI rows within category */}
                      {isCatExpanded && catKpis.map(kpi => {
                        const status = getTargetStatusBadge(kpi)
                        const isRowExpanded = expandedRows.has(kpi.kpi_id)
                        return (
                          <Fragment key={kpi.kpi_id}>
                            <tr
                              className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 cursor-pointer transition-colors"
                              onClick={() => toggleRow(kpi.kpi_id)}
                            >
                              <td className="px-3 py-1.5 text-gray-400 dark:text-gray-500">
                                {isRowExpanded ? (
                                  <ChevronDownIcon className="h-2.5 w-2.5" />
                                ) : (
                                  <ChevronRightIcon className="h-2.5 w-2.5" />
                                )}
                              </td>
                              <td className="px-3 py-1.5">
                                <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{kpi.name}</span>
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{formatValue(kpi.current_value, kpi.unit)}</span>
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{kpi.target_value !== null ? formatValue(kpi.target_value, kpi.unit) : '--'}</span>
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                <span className={`text-xs font-medium tabular-nums ${getVarianceColor(kpi.variance)}`}>
                                  {kpi.variance !== null ? `${kpi.variance > 0 ? '+' : ''}${formatValue(kpi.variance, kpi.unit)}` : '--'}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <span className={`inline-flex text-[10px] px-1.5 py-0.5 rounded-full font-medium ${status.className}`}>
                                  {status.label}
                                </span>
                              </td>
                            </tr>
                            {/* Expanded detail row */}
                            {isRowExpanded && (
                              <tr key={`${kpi.kpi_id}-detail`} className="bg-gray-50/40 dark:bg-gray-900/20">
                                <td></td>
                                <td colSpan={5} className="px-3 py-2">
                                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1.5">{kpi.description || 'No description available'}</p>
                                  <div className="grid grid-cols-4 gap-3 text-[10px]">
                                    <div>
                                      <span className="text-gray-400 dark:text-gray-500">Previous</span>
                                      <p className="font-medium text-gray-700 dark:text-gray-300">{formatValue(kpi.previous_value, kpi.unit)}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-400 dark:text-gray-500">Unit</span>
                                      <p className="font-medium text-gray-700 dark:text-gray-300 capitalize">{kpi.unit}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-400 dark:text-gray-500">Updated</span>
                                      <p className="font-medium text-gray-700 dark:text-gray-300">{kpi.last_updated ? new Date(kpi.last_updated).toLocaleDateString() : 'Never'}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-400 dark:text-gray-500">Type</span>
                                      <p className="font-medium text-gray-700 dark:text-gray-300">{kpi.is_system ? 'System' : 'Custom'}</p>
                                    </div>
                                  </div>
                                  {/* Mini progress bar */}
                                  {kpi.target_value !== null && kpi.current_value !== null && (
                                    <div className="mt-2">
                                      <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">
                                        <span>Progress</span>
                                        <span>{Math.min(100, Math.round((kpi.current_value / kpi.target_value) * 100))}%</span>
                                      </div>
                                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                                        <div
                                          className={`h-1 rounded-full ${kpi.current_value >= kpi.target_value ? 'bg-green-500' : kpi.current_value >= kpi.target_value * 0.8 ? 'bg-amber-500' : 'bg-red-500'}`}
                                          style={{ width: `${Math.min(100, (kpi.current_value / kpi.target_value) * 100)}%` }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                  {/* Trend sparkline */}
                                  {kpi.trend && kpi.trend.length > 1 && (
                                    <div className="mt-2 flex items-center gap-2">
                                      <span className="text-[10px] text-gray-400 dark:text-gray-500">12-month trend</span>
                                      <MiniSparkline data={kpi.trend} color={kpi.variance !== null && kpi.variance >= 0 ? '#22c55e' : '#ef4444'} />
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </Fragment>
                  )
                })}
                {filteredDashboard.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-xs text-gray-500">
                    {searchQuery ? 'No KPIs match your search' : 'No KPI data available'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'by-level' ? (
        /* By Level tab — hierarchical target view */
        <div className="space-y-4">
          {/* Org-wide targets */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Organization</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {(byLevelData?.org ?? [])
                .filter(t => levelKpiFilter === 'all' || t.kpi_id === levelKpiFilter)
                .map(t => {
                  const kpi = dashboard.find(k => k.kpi_id === t.kpi_id)
                  const current = kpi?.current_value
                  const pct = current !== null && current !== undefined && t.target_value ? Math.min(100, (current / t.target_value) * 100) : null
                  return (
                    <div key={t.id} className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-2.5">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">{t.kpi_name}</p>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{formatValue(t.target_value, t.kpi_unit)}</span>
                        <span className="text-[10px] text-gray-400">target</span>
                      </div>
                      {current !== null && current !== undefined && (
                        <p className="text-[10px] text-gray-500 mt-0.5">Current: {formatValue(current, t.kpi_unit)}</p>
                      )}
                      {pct !== null && (
                        <div className="mt-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                          <div className={`h-1 rounded-full ${pct >= 95 ? 'bg-green-500' : pct >= 80 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  )
                })}
              {!byLevelData?.org?.length && <p className="text-xs text-gray-400 col-span-5">No org-level targets loaded. Reload the database.</p>}
            </div>
          </div>

          {/* Department targets */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Departments</h3>
              <span className="text-[10px] text-gray-400">{Object.keys(byLevelData?.departments ?? {}).length} departments</span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {Object.entries(byLevelData?.departments ?? {}).map(([dept, deptTargets]) => {
                const filtered = deptTargets.filter(t => levelKpiFilter === 'all' || t.kpi_id === levelKpiFilter)
                if (!filtered.length) return null
                const isExpanded = expandedDepts.has(dept)
                // Find teams for this dept
                const deptTeams = Object.entries(byLevelData?.teams ?? {})
                  .filter(([teamKey]) => teamKey.startsWith(dept + ' / '))
                  .map(([teamKey, teamTargets]) => ({ teamKey, team: teamKey.replace(dept + ' / ', ''), targets: teamTargets }))

                return (
                  <div key={dept}>
                    <button
                      className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      onClick={() => setExpandedDepts(prev => {
                        const next = new Set(prev)
                        if (next.has(dept)) next.delete(dept)
                        else next.add(dept)
                        return next
                      })}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDownIcon className="h-3 w-3 text-gray-400" /> : <ChevronRightIcon className="h-3 w-3 text-gray-400" />}
                        <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{dept}</span>
                        <span className="text-[10px] text-gray-400">{filtered.length} targets · {deptTeams.length} teams</span>
                      </div>
                      <div className="flex gap-2">
                        {filtered.slice(0, 4).map(t => {
                          const kpi = dashboard.find(k => k.kpi_id === t.kpi_id)
                          const current = kpi?.current_value
                          const pct = current !== null && current !== undefined && t.target_value ? Math.min(100, (current / t.target_value) * 100) : null
                          return (
                            <div key={t.id} className="text-right">
                              <p className="text-[9px] text-gray-400 truncate max-w-[60px]">{t.kpi_name}</p>
                              <p className={`text-[10px] font-semibold tabular-nums ${pct !== null ? (pct >= 95 ? 'text-green-600' : pct >= 80 ? 'text-amber-600' : 'text-red-600') : 'text-gray-500'}`}>
                                {formatValue(t.target_value, t.kpi_unit)}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="pl-8 bg-gray-50/50 dark:bg-gray-900/10">
                        {/* KPI targets for this dept */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                          {filtered.map(t => {
                            const kpi = dashboard.find(k => k.kpi_id === t.kpi_id)
                            const current = kpi?.current_value
                            const pct = current !== null && current !== undefined && t.target_value ? Math.min(100, (current / t.target_value) * 100) : null
                            return (
                              <div key={t.id} className="bg-white dark:bg-gray-800 rounded p-2 border border-gray-100 dark:border-gray-700">
                                <p className="text-[9px] font-semibold text-gray-400 uppercase truncate">{t.kpi_name}</p>
                                <p className="text-xs font-bold text-gray-900 dark:text-white tabular-nums">{formatValue(t.target_value, t.kpi_unit)}</p>
                                {pct !== null && (
                                  <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-0.5">
                                    <div className={`h-0.5 rounded-full ${pct >= 95 ? 'bg-green-500' : pct >= 80 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        {/* Teams under this dept */}
                        {deptTeams.length > 0 && (
                          <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            {deptTeams.map(({ teamKey, team, targets: teamTargets }) => {
                              const filteredTeam = teamTargets.filter(t => levelKpiFilter === 'all' || t.kpi_id === levelKpiFilter)
                              if (!filteredTeam.length) return null
                              const isTeamExpanded = expandedTeams.has(teamKey)
                              return (
                                <div key={teamKey}>
                                  <button
                                    className="w-full flex items-center gap-2 px-4 py-1.5 hover:bg-gray-100/60 dark:hover:bg-gray-700/20 text-left"
                                    onClick={() => setExpandedTeams(prev => {
                                      const next = new Set(prev)
                                      if (next.has(teamKey)) next.delete(teamKey)
                                      else next.add(teamKey)
                                      return next
                                    })}
                                  >
                                    {isTeamExpanded ? <ChevronDownIcon className="h-2.5 w-2.5 text-gray-400 flex-shrink-0" /> : <ChevronRightIcon className="h-2.5 w-2.5 text-gray-400 flex-shrink-0" />}
                                    <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">{team}</span>
                                    <span className="text-[10px] text-gray-400">{filteredTeam.length} KPI targets</span>
                                    <div className="ml-auto flex gap-3">
                                      {filteredTeam.slice(0, 3).map(t => (
                                        <span key={t.id} className="text-[10px] text-gray-500 tabular-nums">{t.kpi_name}: <strong>{formatValue(t.target_value, t.kpi_unit)}</strong></span>
                                      ))}
                                    </div>
                                  </button>
                                  {isTeamExpanded && (
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 px-6 py-2 bg-white/60 dark:bg-gray-800/30">
                                      {filteredTeam.map(t => (
                                        <div key={t.id} className="rounded p-1.5 border border-gray-100 dark:border-gray-700">
                                          <p className="text-[9px] text-gray-400 uppercase truncate">{t.kpi_name}</p>
                                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 tabular-nums">{formatValue(t.target_value, t.kpi_unit)}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Employee targets */}
          {byLevelData && Object.keys(byLevelData.employees).length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Individual Targets</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">{Object.keys(byLevelData.employees).length} employees with targets</span>
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Filter by employee ID..."
                      value={empSearch}
                      onChange={e => setEmpSearch(e.target.value)}
                      className="pl-6 pr-2 py-1 text-[10px] border border-gray-300 rounded w-40 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
                {Object.entries(byLevelData.employees)
                  .filter(([empId]) => !empSearch || empId.toLowerCase().includes(empSearch.toLowerCase()))
                  .slice(0, 50)
                  .map(([empId, empTargets]) => {
                    const filtered = empTargets.filter(t => levelKpiFilter === 'all' || t.kpi_id === levelKpiFilter)
                    if (!filtered.length) return null
                    return (
                      <div key={empId} className="flex items-center px-4 py-1.5 gap-4">
                        <span className="text-[10px] text-gray-500 font-mono w-32 truncate flex-shrink-0">{empId.slice(0, 8)}…</span>
                        <div className="flex gap-3 flex-wrap">
                          {filtered.map(t => (
                            <span key={t.id} className="text-[10px] text-gray-600 dark:text-gray-300">
                              {t.kpi_name}: <strong className="tabular-nums">{formatValue(t.target_value, t.kpi_unit)}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Targets tab with inline editing */
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-4 py-2 text-left text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">KPI</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Target Value</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Period</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Department</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-2 text-right text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredTargets.slice((targetsPage - 1) * TARGETS_PER_PAGE, targetsPage * TARGETS_PER_PAGE).map(target => {
                const kpi = dashboard.find(k => k.kpi_id === target.kpi_definition_id)
                const isInlineEditing = inlineEditId === target.id
                const periodLabel = getPeriodFromDates(target.period_start, target.period_end)
                return (
                  <tr key={target.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 group">
                    <td className="px-4 py-2 text-xs font-medium text-gray-900 dark:text-gray-100">{kpi?.name || 'Unknown KPI'}</td>
                    <td className="px-4 py-2">
                      {isInlineEditing ? (
                        <input
                          type="number"
                          value={inlineEditValues.target_value}
                          onChange={e => setInlineEditValues(p => ({ ...p, target_value: e.target.value }))}
                          className="w-24 text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveInlineEdit(target)
                            if (e.key === 'Escape') cancelInlineEdit()
                          }}
                        />
                      ) : (
                        <span className="text-xs text-gray-700 dark:text-gray-300 tabular-nums">{target.target_value}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {isInlineEditing ? (
                        <select
                          value={inlineEditValues.period}
                          onChange={e => setInlineEditValues(p => ({ ...p, period: e.target.value }))}
                          className="text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {PERIODS.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">{periodLabel}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">{target.department || 'All'}</td>
                    <td className="px-4 py-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getStatusBadge(target.status)}`}>
                        {target.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        {isInlineEditing ? (
                          <>
                            <button
                              onClick={() => saveInlineEdit(target)}
                              className="text-green-600 hover:text-green-800 p-0.5"
                              title="Save"
                            >
                              <CheckIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={cancelInlineEdit}
                              className="text-gray-400 hover:text-gray-600 p-0.5"
                              title="Cancel"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Toggle on/off */}
                            <button
                              onClick={() => handleToggleTarget(target)}
                              className={`relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                target.status === 'active' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                              }`}
                              title={target.status === 'active' ? 'Deactivate' : 'Activate'}
                            >
                              <span
                                className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  target.status === 'active' ? 'translate-x-3' : 'translate-x-0'
                                }`}
                              />
                            </button>
                            {/* Edit target */}
                            <button onClick={() => startInlineEdit(target)} className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-0.5" title="Edit target">
                              <PencilSquareIcon className="h-3.5 w-3.5" />
                            </button>
                            {/* Approve/Reject for pending */}
                            {(target.status === 'draft' || target.status === 'pending_approval') && hasPermission('kpis:approve_targets') && (
                              <>
                                <button onClick={() => handleApprove(target.id)} className="text-green-600 hover:text-green-800 p-0.5" title="Approve">
                                  <CheckCircleIcon className="h-4 w-4" />
                                </button>
                                <button onClick={() => handleReject(target.id)} className="text-red-600 hover:text-red-800 p-0.5" title="Reject">
                                  <XCircleIcon className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredTargets.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                  {targets.length === 0 ? 'No targets set yet' : 'No targets match the current filters'}
                </td></tr>
              )}
            </tbody>
          </table>
          {filteredTargets.length > TARGETS_PER_PAGE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {(targetsPage - 1) * TARGETS_PER_PAGE + 1}–{Math.min(targetsPage * TARGETS_PER_PAGE, filteredTargets.length)} of {filteredTargets.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTargetsPage(p => Math.max(1, p - 1))}
                  disabled={targetsPage === 1}
                  className="px-2.5 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                {Array.from({ length: Math.ceil(filteredTargets.length / TARGETS_PER_PAGE) }, (_, i) => i + 1).map(pg => (
                  <button
                    key={pg}
                    onClick={() => setTargetsPage(pg)}
                    className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${pg === targetsPage ? 'bg-slate-900 dark:bg-slate-700 text-white border-slate-900 dark:border-slate-700' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  >
                    {pg}
                  </button>
                ))}
                <button
                  onClick={() => setTargetsPage(p => Math.min(Math.ceil(filteredTargets.length / TARGETS_PER_PAGE), p + 1))}
                  disabled={targetsPage >= Math.ceil(filteredTargets.length / TARGETS_PER_PAGE)}
                  className="px-2.5 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create KPI Definition Modal */}
      {showCreateKPI && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New KPI</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" placeholder="e.g. Employee Retention Rate" value={newKPI.name} onChange={e => setNewKPI(p => ({ ...p, name: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea placeholder="What does this KPI measure?" value={newKPI.description} onChange={e => setNewKPI(p => ({ ...p, description: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={newKPI.category} onChange={e => setNewKPI(p => ({ ...p, category: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2">
                    <option value="custom">Custom</option>
                    <option value="retention">Retention</option>
                    <option value="recruitment">Recruitment</option>
                    <option value="engagement">Engagement</option>
                    <option value="compensation">Compensation</option>
                    <option value="diversity">Diversity</option>
                    <option value="performance">Performance</option>
                    <option value="attendance">Attendance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select value={newKPI.unit} onChange={e => setNewKPI(p => ({ ...p, unit: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2">
                    <option value="number">Number</option>
                    <option value="percentage">Percentage</option>
                    <option value="currency">Currency</option>
                    <option value="days">Days</option>
                    <option value="score">Score</option>
                    <option value="ratio">Ratio</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Calculation Method</label>
                <select value={newKPI.calculation_method} onChange={e => setNewKPI(p => ({ ...p, calculation_method: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2">
                  <option value="manual">Manual</option>
                  <option value="auto_avg">Auto - Average</option>
                  <option value="auto_sum">Auto - Sum</option>
                  <option value="auto_count">Auto - Count</option>
                  <option value="auto_ratio">Auto - Ratio</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowCreateKPI(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleCreateKPI} disabled={!newKPI.name} className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">Create KPI</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Target Modal */}
      {editingTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Target</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">KPI</label>
                <p className="text-sm text-gray-900 font-medium">{dashboard.find(k => k.kpi_id === editingTarget.kpi_definition_id)?.name || 'Unknown KPI'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Value *</label>
                <input type="number" value={editForm.target_value} onChange={e => setEditForm(p => ({ ...p, target_value: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" value={editForm.period_start} onChange={e => setEditForm(p => ({ ...p, period_start: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" value={editForm.period_end} onChange={e => setEditForm(p => ({ ...p, period_end: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select value={editForm.department} onChange={e => setEditForm(p => ({ ...p, department: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2">
                  <option value="">All Departments</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2" rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setEditingTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleSaveEdit} disabled={!editForm.target_value} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Target Modal */}
      {showCreateTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Target</h3>
            <div className="space-y-3">
              <select value={newTarget.kpi_definition_id} onChange={e => setNewTarget(p => ({ ...p, kpi_definition_id: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Select KPI...</option>
                {dashboard.map(k => <option key={k.kpi_id} value={k.kpi_id}>{k.name}</option>)}
              </select>
              <input type="number" placeholder="Target value" value={newTarget.target_value} onChange={e => setNewTarget(p => ({ ...p, target_value: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2" />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" placeholder="Start" value={newTarget.period_start} onChange={e => setNewTarget(p => ({ ...p, period_start: e.target.value }))} className="text-sm border border-gray-300 rounded-lg px-3 py-2" />
                <input type="date" placeholder="End" value={newTarget.period_end} onChange={e => setNewTarget(p => ({ ...p, period_end: e.target.value }))} className="text-sm border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select value={newTarget.department} onChange={e => setNewTarget(p => ({ ...p, department: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2">
                  <option value="">All Departments</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <textarea placeholder="Notes (optional)" value={newTarget.notes} onChange={e => setNewTarget(p => ({ ...p, notes: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2" rows={2} />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowCreateTarget(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleCreateTarget} disabled={!newTarget.kpi_definition_id || !newTarget.target_value} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
