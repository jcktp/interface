import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useGlobalFilters } from '../hooks/useGlobalFilters'
import { useLocalization } from '../hooks/useLocalization'
import {
  BanknotesIcon,
  ArrowPathIcon,
  PlusIcon,
  DocumentArrowDownIcon,
  SparklesIcon,
  ArrowTrendingUpIcon,
  TrashIcon,
  PlayIcon,
  StopIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import api from '../api'
import { bulkSalaryIncrease } from '../api'
import {
  CompensationGrid,
  BudgetOverviewCards,
  BudgetVsActualChart,
  SalaryDistributionChart,
  CompensationChangeModal,
  MeritCycleWizard,
} from '../components/compensation'
import { PlanningPeriodSelector, type PlanningPeriod } from '../components/planning'
import type { CompensationPlan } from '../components/compensation/CompensationGrid'

interface BudgetSummary {
  period_id: string
  total_current_salary: number
  total_planned_budget: number
  total_actual_spend: number | null
  total_equity_budget: number
  equity_pool_total: number
  equity_pool_remaining: number
  budget_variance: number | null
  budget_variance_pct: number | null
  plans_count: number
  by_department: {
    department: string
    currency: string
    current_salary: number
    planned_budget: number
    actual_spend: number | null
    equity_budget: number
    variance: number | null
  }[]
}

interface SalaryDistribution {
  group: string
  count: number
  min_salary: number | null
  max_salary: number | null
  avg_salary: number | null
  total_salary: number | null
}

const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'Customer Success', 'HR', 'Finance', 'Operations']
const LOCATIONS = ['New York', 'San Francisco', 'London', 'Berlin', 'Tokyo', 'Singapore', 'Sydney', 'Toronto', 'Remote']
const TEAMS = ['Frontend', 'Backend', 'DevOps', 'Data Science', 'Mobile', 'QA', 'Security', 'Platform']
const CHANGE_TYPES = [
  { value: 'merit', label: 'Merit' },
  { value: 'market_adjustment', label: 'Market Adjustment' },
  { value: 'equity_adjustment', label: 'Equity Adjustment' },
]

export default function CompensationPlanning() {
  const queryClient = useQueryClient()
  const { filterObj } = useGlobalFilters()
  const loc = useLocalization()
  const [selectedPeriod, setSelectedPeriod] = useState<PlanningPeriod | null>(null)
  const [showActuals, setShowActuals] = useState(true)
  const [showChangeModal, setShowChangeModal] = useState(false)
  const [showMeritWizard, setShowMeritWizard] = useState(false)
  const [showBulkIncrease, setShowBulkIncrease] = useState(false)
  const [showCreatePeriod, setShowCreatePeriod] = useState(false)
  const [newPeriod, setNewPeriod] = useState({ name: '', start_date: '', end_date: '', description: '' })
  const [distributionMetric, setDistributionMetric] = useState<'avg_salary' | 'total_salary' | 'count'>('avg_salary')

  // Bulk increase state
  const [bulkScope, setBulkScope] = useState<'company' | 'department' | 'location' | 'team'>('company')
  const [bulkScopeValue, setBulkScopeValue] = useState('')
  const [bulkPercentage, setBulkPercentage] = useState('')
  const [bulkChangeType, setBulkChangeType] = useState('merit')
  const [bulkEffectiveDate, setBulkEffectiveDate] = useState('')
  const [bulkPreview, setBulkPreview] = useState<{
    employees_affected: number
    current_total: number
    new_total: number
    cost_increase: number
  } | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Fetch planning periods
  const { data: periodsData } = useQuery({
    queryKey: ['planning-periods'],
    queryFn: async () => {
      const response = await api.get('/planning/periods')
      const periods = response.data.periods as PlanningPeriod[]
      
      // Auto-clear selected period if it's gone (re-seed case)
      if (selectedPeriod && !periods.some(p => p.id === selectedPeriod.id)) {
        setSelectedPeriod(null)
      }
      
      return periods
    },
  })

  // Auto-select active period on first load
  useEffect(() => {
    if (periodsData && periodsData.length > 0 && !selectedPeriod) {
      const active = periodsData.find((p: PlanningPeriod) => p.status === 'active') ?? periodsData[0]
      setSelectedPeriod(active)
    }
  }, [periodsData, selectedPeriod])

  // Fetch compensation plans for selected period
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['compensation-plans', selectedPeriod?.id, filterObj],
    queryFn: async () => {
      if (!selectedPeriod) return null
      const response = await api.get('/compensation/plans', {
        params: { period_id: selectedPeriod.id, ...filterObj },
      })
      return response.data.plans as CompensationPlan[]
    },
    enabled: !!selectedPeriod,
  })

  // Fetch budget summary
  const { data: summaryData } = useQuery({
    queryKey: ['compensation-summary', selectedPeriod?.id, filterObj],
    queryFn: async () => {
      if (!selectedPeriod) return null
      const response = await api.get('/compensation/budget-summary', {
        params: { period_id: selectedPeriod.id, ...filterObj },
      })
      return response.data.data as BudgetSummary
    },
    enabled: !!selectedPeriod,
  })

  // Fetch salary distribution
  const { data: distributionData } = useQuery({
    queryKey: ['salary-distribution', filterObj],
    queryFn: async () => {
      const response = await api.get('/compensation/salary-distribution', {
        params: { group_by: 'department', ...filterObj },
      })
      return response.data.data as SalaryDistribution[]
    },
  })

  // Fetch employees for change modal
  const { data: employeesData } = useQuery({
    queryKey: ['employees-basic', filterObj],
    queryFn: async () => {
      const response = await api.get('/employees', { params: { limit: 1000, ...filterObj } })
      return (response.data.employees || []).map((e: any) => ({
        id: e.id,
        name: `${e.first_name} ${e.last_name}`,
        department: e.department,
        salary: e.salary,
      }))
    },
  })

  // Initialize plans mutation
  const initializeMutation = useMutation({
    mutationFn: async (periodId: string) => {
      const response = await api.post('/compensation/plans/initialize', null, {
        params: { period_id: periodId },
      })
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['compensation-plans', selectedPeriod?.id] })
      queryClient.invalidateQueries({ queryKey: ['compensation-summary', selectedPeriod?.id] })
      toast.success(`Initialized ${data.plans_created} compensation plans`)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to initialize plans')
    },
  })

  // Update plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: async ({ planId, updates }: { planId: string; updates: Partial<CompensationPlan> }) => {
      const response = await api.put(`/compensation/plans/${planId}`, updates)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compensation-plans', selectedPeriod?.id] })
      queryClient.invalidateQueries({ queryKey: ['compensation-summary', selectedPeriod?.id] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update plan')
    },
  })

  // Sync actuals mutation
  const syncActualsMutation = useMutation({
    mutationFn: async (periodId: string) => {
      const response = await api.post('/compensation/sync-actuals', null, {
        params: { period_id: periodId },
      })
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['compensation-plans', selectedPeriod?.id] })
      queryClient.invalidateQueries({ queryKey: ['compensation-summary', selectedPeriod?.id] })
      toast.success(`Synced ${data.plans_updated} plans with actual data`)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to sync actuals')
    },
  })

  // Create planning period mutation
  const createPeriodMutation = useMutation({
    mutationFn: async (data: { name: string; start_date: string; end_date: string; description?: string }) => {
      const response = await api.post('/planning/periods', {
        name: data.name,
        start_date: data.start_date,
        end_date: data.end_date,
        period_type: 'quarter',
        description: data.description || null,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-periods'] })
      toast.success('Planning period created')
      setShowCreatePeriod(false)
      setNewPeriod({ name: '', start_date: '', end_date: '', description: '' })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create period')
    },
  })

  // Activate planning period mutation
  const activatePeriodMutation = useMutation({
    mutationFn: async (periodId: string) => {
      const response = await api.post(`/planning/periods/${periodId}/activate`)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['planning-periods'] })
      toast.success(data.message || 'Period activated')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to activate period')
    },
  })

  // Deactivate (close) planning period mutation
  const deactivatePeriodMutation = useMutation({
    mutationFn: async (periodId: string) => {
      const response = await api.post(`/planning/periods/${periodId}/deactivate`)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['planning-periods'] })
      toast.success(data.message || 'Period closed')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to close period')
    },
  })

  // Delete planning period mutation
  const deletePeriodMutation = useMutation({
    mutationFn: async (periodId: string) => {
      const response = await api.delete(`/planning/periods/${periodId}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-periods'] })
      if (selectedPeriod) {
        setSelectedPeriod(null)
      }
      toast.success('Period deleted')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete period')
    },
  })

  // Propose compensation change mutation
  const proposeChangeMutation = useMutation({
    mutationFn: async (data: CompensationChangeData | CompensationChangeData[]) => {
      if (Array.isArray(data)) {
        const promises = data.map(item => api.post('/compensation/changes', item))
        const results = await Promise.all(promises)
        return { count: results.length, bulk: true }
      }
      const response = await api.post('/compensation/changes', data)
      return response.data
    },
    onSuccess: (data) => {
      if (data.bulk) {
        toast.success(`Successfully proposed ${data.count} compensation changes`)
      } else {
        toast.success(`Compensation change proposed (+${data.change_pct?.toFixed(1)}%)`)
      }
      setShowChangeModal(false)
      queryClient.invalidateQueries({ queryKey: ['compensation-plans'] })
      queryClient.invalidateQueries({ queryKey: ['compensation-summary'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to propose change')
    },
  })

interface CompensationChangeData {
  employee_id: string
  change_type: string
  new_salary: number
  effective_date: string
  reason?: string
  plan_id?: string
}

  // Bulk increase mutation
  const bulkIncreaseMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await bulkSalaryIncrease(data)
      return response.data
    },
    onSuccess: (data) => {
      toast.success(`Bulk increase applied to ${data.employees_affected || 'all eligible'} employees`)
      setShowBulkIncrease(false)
      resetBulkForm()
      queryClient.invalidateQueries({ queryKey: ['compensation-plans'] })
      queryClient.invalidateQueries({ queryKey: ['compensation-summary'] })
      queryClient.invalidateQueries({ queryKey: ['salary-distribution'] })
      queryClient.invalidateQueries({ queryKey: ['employees-basic'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to apply bulk increase')
    },
  })

  const periods = periodsData || []
  const plans = plansData || []
  const employees = employeesData || []
  const departments = [...new Set(plans.map((p) => p.department))].filter(Boolean)

  const handlePlanUpdate = (planId: string, updates: Partial<CompensationPlan>) => {
    updatePlanMutation.mutate({ planId, updates })
  }

  const handleMeritCycleComplete = async (settings: any) => {
    for (const plan of plans) {
      const deptAllocation = settings.department_allocations.find(
        (d: any) => d.department === plan.department
      )
      if (deptAllocation) {
        await updatePlanMutation.mutateAsync({
          planId: plan.id,
          updates: {
            merit_increase_pct: deptAllocation.merit_pct,
            promotion_budget: (plan.current_total_salary * deptAllocation.promotion_pct) / 100,
            market_adjustment_budget: (plan.current_total_salary * deptAllocation.market_pct) / 100,
            equity_budget: deptAllocation.equity_budget,
          },
        })
      }
    }
    toast.success('Merit cycle settings applied to all departments')
  }

  const resetBulkForm = () => {
    setBulkScope('company')
    setBulkScopeValue('')
    setBulkPercentage('')
    setBulkChangeType('merit')
    setBulkEffectiveDate('')
    setBulkPreview(null)
  }

  const handleBulkPreview = async () => {
    const pct = parseFloat(bulkPercentage)
    if (isNaN(pct) || pct <= 0 || pct > 50) {
      toast.error('Percentage must be between 0.1 and 50')
      return
    }
    setLoadingPreview(true)
    try {
      const params: Record<string, unknown> = {
        increase_pct: pct,
        change_type: bulkChangeType,
        scope: bulkScope,
        preview: true,
      }
      if (bulkScope !== 'company' && bulkScopeValue) {
        params.scope_value = bulkScopeValue
      }
      if (bulkEffectiveDate) {
        params.effective_date = bulkEffectiveDate
      }
      const res = await bulkSalaryIncrease(params)
      setBulkPreview(res.data?.preview || res.data?.data?.preview || res.data)
    } catch (err: any) {
      // Generate a client-side estimate if the preview endpoint isn't available
      const employeeList = employees || []
      let filtered = employeeList
      if (bulkScope === 'department' && bulkScopeValue) {
        filtered = employeeList.filter((e: any) => e.department === bulkScopeValue)
      }
      const currentTotal = filtered.reduce((sum: number, e: any) => sum + (e.salary || 0), 0)
      const costIncrease = currentTotal * (pct / 100)
      setBulkPreview({
        employees_affected: filtered.length,
        current_total: currentTotal,
        new_total: currentTotal + costIncrease,
        cost_increase: costIncrease,
      })
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleBulkApply = () => {
    const pct = parseFloat(bulkPercentage)
    if (isNaN(pct) || pct <= 0 || pct > 50) {
      toast.error('Percentage must be between 0.1 and 50')
      return
    }
    const payload: Record<string, unknown> = {
      increase_pct: pct,
      change_type: bulkChangeType,
      scope: bulkScope,
    }
    if (bulkScope !== 'company' && bulkScopeValue) {
      payload.scope_value = bulkScopeValue
    }
    if (bulkEffectiveDate) {
      payload.effective_date = bulkEffectiveDate
    }
    bulkIncreaseMutation.mutate(payload)
  }

  const getScopeOptions = () => {
    if (bulkScope === 'department') return DEPARTMENTS
    if (bulkScope === 'location') return LOCATIONS
    if (bulkScope === 'team') return TEAMS
    return []
  }

  const formatCurrency = (val: number) => loc.currency(val)

  const isEditable = selectedPeriod?.status === 'draft' || selectedPeriod?.status === 'active'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compensation Planning</h1>
          <p className="mt-1 text-sm text-gray-500">
            Plan salary budgets, merit cycles, and track compensation spend
          </p>
        </div>
        <button
          onClick={() => setShowBulkIncrease(true)}
          className="btn-primary inline-flex items-center gap-2"
        >
          <ArrowTrendingUpIcon className="h-5 w-5" />
          Bulk Increase
        </button>
      </div>

      {/* Period Selector & Actions */}
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <PlanningPeriodSelector
            periods={periods}
            selectedPeriod={selectedPeriod}
            onSelect={setSelectedPeriod}
            onCreateNew={() => setShowCreatePeriod(true)}
          />

          {selectedPeriod && (
            <div className="flex items-center gap-3">
              {selectedPeriod.status === 'draft' && plans.length === 0 && (
                <button
                  onClick={() => initializeMutation.mutate(selectedPeriod.id)}
                  disabled={initializeMutation.isPending}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  <PlusIcon className="h-5 w-5" />
                  Initialize from Payroll
                </button>
              )}

              {plans.length > 0 && (
                <button
                  onClick={() => setShowMeritWizard(true)}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  <SparklesIcon className="h-5 w-5" />
                  Merit Cycle Wizard
                </button>
              )}

              {selectedPeriod.status === 'active' && (
                <button
                  onClick={() => syncActualsMutation.mutate(selectedPeriod.id)}
                  disabled={syncActualsMutation.isPending}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  <ArrowPathIcon
                    className={`h-5 w-5 ${syncActualsMutation.isPending ? 'animate-spin' : ''}`}
                  />
                  Sync Actuals
                </button>
              )}

              <button
                onClick={() => setShowChangeModal(true)}
                className="btn-primary inline-flex items-center gap-2"
              >
                <PlusIcon className="h-5 w-5" />
                Propose Change
              </button>

              <button className="btn-secondary inline-flex items-center gap-2">
                <DocumentArrowDownIcon className="h-5 w-5" />
                Export
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Planning Periods Table */}
      {periods.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">All Planning Periods</h3>
            <span className="text-xs text-gray-500">{periods.length} period{periods.length !== 1 ? 's' : ''}</span>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {periods.map((period) => (
                <tr
                  key={period.id}
                  className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                    selectedPeriod?.id === period.id ? 'bg-primary-50' : ''
                  }`}
                  onClick={() => setSelectedPeriod(period)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{period.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(period.start_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(period.end_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${
                      period.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : period.status === 'closed'
                        ? 'bg-gray-200 text-gray-500'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {period.status.charAt(0).toUpperCase() + period.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      {period.status === 'draft' && (
                        <>
                          <button
                            onClick={() => activatePeriodMutation.mutate(period.id)}
                            disabled={activatePeriodMutation.isPending}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                            title="Activate period"
                          >
                            <PlayIcon className="h-3.5 w-3.5" />
                            Activate
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Delete this draft period? This cannot be undone.')) {
                                deletePeriodMutation.mutate(period.id)
                              }
                            }}
                            disabled={deletePeriodMutation.isPending}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                            title="Delete period"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </>
                      )}
                      {period.status === 'active' && (
                        <button
                          onClick={() => {
                            if (confirm('Close this active period? This will mark it as closed.')) {
                              deactivatePeriodMutation.mutate(period.id)
                            }
                          }}
                          disabled={deactivatePeriodMutation.isPending}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
                          title="Close period"
                        >
                          <StopIcon className="h-3.5 w-3.5" />
                          Close
                        </button>
                      )}
                      {period.status === 'closed' && (
                        <span className="text-xs text-gray-400">No actions</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Content */}
      {!selectedPeriod ? (
        <div className="card text-center py-12">
          <BanknotesIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Select a Planning Period</h3>
          <p className="mt-2 text-gray-500">
            Choose a planning period to view and manage compensation budgets
          </p>
        </div>
      ) : plansLoading ? (
        <div className="card text-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading compensation plans...</p>
        </div>
      ) : (
        <>
          {/* Budget Overview Cards */}
          <BudgetOverviewCards summary={summaryData || null} />

          {/* Toggle View */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Department Budgets</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showActuals}
                onChange={(e) => setShowActuals(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Show Actuals & Variance
            </label>
          </div>

          {/* Compensation Grid */}
          <div className="card overflow-hidden">
            {plans.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No compensation plans yet</p>
                <button
                  onClick={() => initializeMutation.mutate(selectedPeriod.id)}
                  disabled={initializeMutation.isPending}
                  className="btn-primary"
                >
                  Initialize from Current Payroll
                </button>
              </div>
            ) : (
              <CompensationGrid
                plans={plans}
                isEditable={isEditable}
                onPlanUpdate={handlePlanUpdate}
                showActuals={showActuals}
              />
            )}
          </div>

          {/* Charts */}
          {plans.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {showActuals && (
                <div className="card">
                  <h3 className="card-header">Budget vs Actual by Department</h3>
                  <BudgetVsActualChart plans={plans} />
                </div>
              )}

              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Salary Distribution</h3>
                  <select
                    value={distributionMetric}
                    onChange={(e) =>
                      setDistributionMetric(e.target.value as 'avg_salary' | 'total_salary' | 'count')
                    }
                    className="input py-1 px-2 text-sm"
                  >
                    <option value="avg_salary">Avg Salary</option>
                    <option value="total_salary">Total Salary</option>
                    <option value="count">Headcount</option>
                  </select>
                </div>
                <SalaryDistributionChart
                  data={distributionData || []}
                  metric={distributionMetric}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Compensation Change Modal */}
      <CompensationChangeModal
        isOpen={showChangeModal}
        onClose={() => setShowChangeModal(false)}
        onSubmit={(data) => proposeChangeMutation.mutate(data)}
        employees={employees}
        planId={plans[0]?.id}
      />

      {/* Merit Cycle Wizard */}
      <MeritCycleWizard
        isOpen={showMeritWizard}
        onClose={() => setShowMeritWizard(false)}
        onComplete={handleMeritCycleComplete}
        departments={departments}
      />

      {/* Create Period Modal */}
      {showCreatePeriod && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Planning Period</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Q2 2026 Planning"
                  value={newPeriod.name}
                  onChange={(e) => setNewPeriod((p) => ({ ...p, name: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={newPeriod.start_date}
                    onChange={(e) => setNewPeriod((p) => ({ ...p, start_date: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    value={newPeriod.end_date}
                    onChange={(e) => setNewPeriod((p) => ({ ...p, end_date: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  placeholder="Optional description for this planning period"
                  value={newPeriod.description}
                  onChange={(e) => setNewPeriod((p) => ({ ...p, description: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowCreatePeriod(false)
                  setNewPeriod({ name: '', start_date: '', end_date: '', description: '' })
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => createPeriodMutation.mutate(newPeriod)}
                disabled={!newPeriod.name || !newPeriod.start_date || !newPeriod.end_date || createPeriodMutation.isPending}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {createPeriodMutation.isPending ? 'Creating...' : 'Create Period'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Increase Modal */}
      {showBulkIncrease && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Bulk Salary Increase</h3>
                <p className="text-sm text-gray-500 mt-0.5">Apply a percentage increase across employees</p>
              </div>
              <button onClick={() => { setShowBulkIncrease(false); resetBulkForm() }} className="text-gray-400 hover:text-gray-600 text-sm">Close</button>
            </div>

            <div className="space-y-4">
              {/* Scope Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Scope</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'company', label: 'Company Wide' },
                    { value: 'department', label: 'By Department' },
                    { value: 'location', label: 'By Location' },
                    { value: 'team', label: 'By Team' },
                  ] as const).map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-sm transition-colors ${
                        bulkScope === opt.value
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="bulkScope"
                        value={opt.value}
                        checked={bulkScope === opt.value}
                        onChange={() => { setBulkScope(opt.value); setBulkScopeValue(''); setBulkPreview(null) }}
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Dynamic scope value */}
              {bulkScope !== 'company' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {bulkScope === 'department' ? 'Department' : bulkScope === 'location' ? 'Location' : 'Team'}
                  </label>
                  <select
                    value={bulkScopeValue}
                    onChange={e => { setBulkScopeValue(e.target.value); setBulkPreview(null) }}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select...</option>
                    {getScopeOptions().map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Increase Percentage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Increase Percentage</label>
                <div className="relative">
                  <input
                    type="number"
                    value={bulkPercentage}
                    onChange={e => { setBulkPercentage(e.target.value); setBulkPreview(null) }}
                    min="0.1"
                    max="50"
                    step="0.1"
                    placeholder="e.g. 5.0"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                </div>
              </div>

              {/* Change Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Change Type</label>
                <select
                  value={bulkChangeType}
                  onChange={e => setBulkChangeType(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CHANGE_TYPES.map(ct => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>
              </div>

              {/* Effective Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
                <input
                  type="date"
                  value={bulkEffectiveDate}
                  onChange={e => setBulkEffectiveDate(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Preview Button */}
              <button
                onClick={handleBulkPreview}
                disabled={!bulkPercentage || loadingPreview || (bulkScope !== 'company' && !bulkScopeValue)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                {loadingPreview ? 'Calculating...' : 'Preview Impact'}
              </button>

              {/* Preview Section */}
              {bulkPreview && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700">Impact Preview</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Employees affected</span>
                      <p className="font-semibold text-gray-900">{bulkPreview.employees_affected.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Current total</span>
                      <p className="font-semibold text-gray-900">{formatCurrency(bulkPreview.current_total)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">New total</span>
                      <p className="font-semibold text-green-700">{formatCurrency(bulkPreview.new_total)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Cost increase</span>
                      <p className="font-semibold text-amber-700">+{formatCurrency(bulkPreview.cost_increase)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <button onClick={() => { setShowBulkIncrease(false); resetBulkForm() }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={handleBulkApply}
                disabled={
                  !bulkPercentage ||
                  !bulkEffectiveDate ||
                  bulkIncreaseMutation.isPending ||
                  (bulkScope !== 'company' && !bulkScopeValue)
                }
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {bulkIncreaseMutation.isPending ? 'Applying...' : 'Apply Increase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
