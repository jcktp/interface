import { useState, useMemo } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import {
  UserGroupIcon,
  ArrowPathIcon,
  PlusIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CalculatorIcon,
  CurrencyDollarIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import api from '../api'
import { useStore } from '../store'
import {
  PlanningGrid,
  PlanningPeriodSelector,
  ActualVsPlanChart,
  type PlanningPeriod,
  type WorkforcePlan,
} from '../components/planning'

interface NewPeriodForm {
  name: string
  start_date: string
  end_date: string
  period_type: string
  description: string
}

export default function WorkforcePlanningInteractive() {
  const queryClient = useQueryClient()
  const { 
    planningPeriods: periods, 
    activePeriodId, 
    setActivePeriodId, 
    workforcePlans: plans,
    recruiterGoals,
    employees,
    requisitions
  } = useStore()
  
  const [showNewPeriodModal, setShowNewPeriodModal] = useState(false)
  const [showActuals, setShowActuals] = useState(true)
  const [newPeriodForm, setNewPeriodForm] = useState<NewPeriodForm>({
    name: '',
    start_date: '',
    end_date: '',
    period_type: 'quarter',
    description: '',
  })

  // ML Predictions (simulated integration from ML Insights)
  const { data: attritionPrediction } = useQuery({
    queryKey: ['ml-attrition-forecast'],
    queryFn: async () => {
      try {
        const res = await api.post('/ml/attrition/predict')
        return res.data
      } catch {
        return null
      }
    },
  })

  const selectedPeriod = useMemo(() => 
    periods.find(p => p.id === activePeriodId) || null, 
  [periods, activePeriodId])

  const setSelectedPeriod = (period: PlanningPeriod | null) => {
    setActivePeriodId(period?.id || null)
  }

  // Mutations
  const createPeriodMutation = useMutation({
    mutationFn: async (data: NewPeriodForm) => {
      const response = await api.post('/planning/periods', data)
      return { responseData: response.data, formData: data }
    },
    onSuccess: ({ responseData, formData }) => {
      queryClient.invalidateQueries({ queryKey: ['planning-periods'] })
      toast.success('Planning period created')
      setShowNewPeriodModal(false)
      if (responseData.period) {
        setSelectedPeriod({
          id: responseData.period.id,
          name: responseData.period.name || formData.name,
          start_date: formData.start_date,
          end_date: formData.end_date,
          status: responseData.period.status || 'draft',
          period_type: formData.period_type,
          description: formData.description,
        })
      }
    }
  })

  const initializeMutation = useMutation({
    mutationFn: async (periodId: string) => {
      const response = await api.post(`/planning/periods/${periodId}/initialize`)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workforce-plans', selectedPeriod?.id] })
      toast.success(`Created ${data.plans_created} department plans`)
    }
  })

  const updatePlanMutation = useMutation({
    mutationFn: async ({ planId, updates }: { planId: string; updates: Partial<WorkforcePlan> }) => {
      const response = await api.put(`/planning/plans/${planId}`, updates)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workforce-plans', selectedPeriod?.id] })
    }
  })

  const syncActualsMutation = useMutation({
    mutationFn: async (periodId: string) => {
      const response = await api.post('/planning/sync-actuals', null, {
        params: { period_id: periodId },
      })
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workforce-plans', selectedPeriod?.id] })
      toast.success(`Synced ${data.plans_updated} plans with actual data`)
    }
  })

  const activateMutation = useMutation({
    mutationFn: async (periodId: string) => {
      const response = await api.post(`/planning/periods/${periodId}/activate`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-periods'] })
      toast.success('Planning period activated')
    }
  })

  // Calculate Summary & Forecast Metrics
  const activeEmployees = employees.filter(e => e.status === 'active')
  const currentHeadcount = activeEmployees.length
  
  const totalPlannedHires = plans.reduce((acc, p) => acc + (p.plannedHires || 0), 0)
  const totalPlannedAttrition = plans.reduce((acc, p) => acc + (p.plannedAttrition || 0), 0)
  const totalPlannedHeadcount = plans.reduce((acc, p) => acc + (p.plannedEndingHeadcount || 0), 0)
  const totalCompensationBudget = plans.reduce((acc, p) => acc + (p.totalCompensationBudget || 0), 0)
  
  // Predictive Baseline (ML driven where possible)
  const mlHighRiskCount = attritionPrediction?.prediction?.high_risk_count ?? Math.round(currentHeadcount * 0.05) // Fallback to 5% if ML fails
  const expectedAttrition = Math.max(totalPlannedAttrition, mlHighRiskCount)
  const currentOpenReqs = requisitions.filter(r => r.status === 'open').length
  const baselineDemand = currentOpenReqs + expectedAttrition

  // Capacity Analysis
  const activeRecruiters = (recruiterGoals as any[]).filter(r => r.is_active !== false)
  const teamMonthlyCapacity = activeRecruiters.reduce((sum, r) => {
    const cap = r.monthly_capacity || 4
    const util = r.utilization_pct || 85
    const overhead = r.overhead_pct || 15
    return sum + (cap * (util / 100) * (1 - overhead / 100))
  }, 0)

  // Assume period is 3 months (quarter) for rough capacity calc
  const periodCapacity = Math.round(teamMonthlyCapacity * 3) 
  const capacityGap = totalPlannedHires - periodCapacity

  const handlePlanUpdate = (planId: string, updates: Partial<WorkforcePlan>) => {
    updatePlanMutation.mutate({ planId, updates })
  }

  const isEditable = selectedPeriod?.status === 'draft' || selectedPeriod?.status === 'active'

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Workforce Planning & Forecasting</h1>
          <p className="text-sm text-gray-500 mt-1">End-to-end scenario planning: from baseline demand to execution capacity and financial impact.</p>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <PlanningPeriodSelector
            periods={periods}
            selectedPeriod={selectedPeriod}
            onSelect={setSelectedPeriod}
            onCreateNew={() => setShowNewPeriodModal(true)}
          />

          {selectedPeriod && (
            <div className="flex items-center gap-3">
              {selectedPeriod.status === 'draft' && plans.length === 0 && (
                <button onClick={() => initializeMutation.mutate(selectedPeriod.id)} disabled={initializeMutation.isPending} className="btn-secondary">
                  <PlusIcon className="h-4 w-4 mr-1.5" /> Initialize Baseline
                </button>
              )}
              {selectedPeriod.status === 'draft' && plans.length > 0 && (
                <button onClick={() => activateMutation.mutate(selectedPeriod.id)} disabled={activateMutation.isPending} className="btn-primary">
                  <CheckCircleIcon className="h-4 w-4 mr-1.5" /> Activate Plan
                </button>
              )}
              {selectedPeriod.status === 'active' && (
                <button onClick={() => syncActualsMutation.mutate(selectedPeriod.id)} disabled={syncActualsMutation.isPending} className="btn-secondary">
                  <ArrowPathIcon className={`h-4 w-4 mr-1.5 ${syncActualsMutation.isPending ? 'animate-spin' : ''}`} /> Sync Actuals
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {!selectedPeriod ? (
        <div className="card text-center py-16">
          <UserGroupIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Start a New Plan</h3>
          <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">Select an existing period or create a new one to begin forecasting headcount, assessing recruiter capacity, and analyzing costs.</p>
          <button onClick={() => setShowNewPeriodModal(true)} className="mt-6 btn-primary">
            <PlusIcon className="h-4 w-4 mr-1.5" /> Create Planning Period
          </button>
        </div>
      ) : plans.length === 0 ? (
        <div className="card text-center py-16 border-dashed border-2 border-primary-200 bg-primary-50/10">
          <CalculatorIcon className="h-12 w-12 text-primary-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Initialize {selectedPeriod.name} Baseline</h3>
          <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">We'll automatically generate department-level plans based on your current headcount and open requisitions.</p>
          <button onClick={() => initializeMutation.mutate(selectedPeriod.id)} disabled={initializeMutation.isPending} className="mt-6 btn-primary">
            {initializeMutation.isPending ? 'Generating...' : 'Generate Baseline Plans'}
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* STEP 1: Baseline & Demand */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-bold">1</span>
              <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight">Demand Forecast</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="card bg-gray-50/50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-700/50">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Current Headcount</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{currentHeadcount.toLocaleString()}</p>
                <p className="text-[10px] text-gray-400 mt-1">Starting baseline</p>
              </div>
              <div className="card bg-gray-50/50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-700/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 text-accent-500">
                  <SparklesIcon className="w-4 h-4" />
                </div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">ML Predicted Attrition</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{expectedAttrition}</p>
                <p className="text-[10px] text-gray-400 mt-1">{mlHighRiskCount} high risk identified</p>
              </div>
              <div className="card bg-gray-50/50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-700/50">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Open Requisitions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{currentOpenReqs}</p>
                <p className="text-[10px] text-gray-400 mt-1">Currently approved to fill</p>
              </div>
              <div className="card border-primary-200 dark:border-primary-800/50 bg-primary-50/30 dark:bg-primary-900/10">
                <p className="text-[11px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-1">Total Plan Hires</p>
                <p className="text-2xl font-bold text-primary-700 dark:text-primary-300">{totalPlannedHires}</p>
                <p className="text-[10px] text-primary-500 mt-1">Baseline demand: {baselineDemand}</p>
              </div>
            </div>
          </section>

          {/* STEP 2: Capacity Analysis */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-bold">2</span>
              <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight">Execution Capacity</h2>
            </div>
            <div className="card">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Can your team deliver this plan?</h4>
                  <p className="text-xs text-gray-500 leading-relaxed mb-4">
                    Based on your active recruitment team ({activeRecruiters.length} recruiters) and their historical velocity, we estimate a period capacity of <strong className="text-gray-900 dark:text-white">{periodCapacity} hires</strong>.
                  </p>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Capacity: {periodCapacity}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Plan: {totalPlannedHires}</span>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-1/2">
                  <div className="relative h-10 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex items-center">
                    <div className="absolute left-0 top-0 bottom-0 bg-gray-300 dark:bg-gray-600 transition-all duration-500" style={{ width: `${Math.min(100, (periodCapacity / Math.max(periodCapacity, totalPlannedHires)) * 100)}%` }} />
                    <div className={`absolute left-0 top-0 bottom-0 transition-all duration-500 opacity-60 ${capacityGap > 0 ? 'bg-danger-500' : 'bg-success-500'}`} style={{ width: `${Math.min(100, (totalPlannedHires / Math.max(periodCapacity, totalPlannedHires)) * 100)}%` }} />
                    
                    <div className="absolute inset-0 flex items-center justify-center mix-blend-difference">
                      <span className="text-white font-bold text-xs uppercase tracking-wider">
                        {capacityGap > 0 
                          ? `Shortfall of ${capacityGap} hires` 
                          : `Surplus of ${Math.abs(capacityGap)} capacity`}
                      </span>
                    </div>
                  </div>
                  {capacityGap > 0 && (
                    <div className="mt-3 flex items-start gap-2 text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-900/10 p-2.5 rounded-md border border-danger-100 dark:border-danger-900/30">
                      <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-tight font-medium">You need approximately <strong className="font-bold">{Math.ceil(capacityGap / (teamMonthlyCapacity / (activeRecruiters.length || 1) || 4) / 3)} more recruiters</strong> to hit this target safely without burnout.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* STEP 3: Department Allocation */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-bold">3</span>
                <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight">Department Allocation</h2>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showActuals}
                  onChange={(e) => setShowActuals(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Show Sync Actuals
              </label>
            </div>
            
            <div className="card p-0 overflow-hidden border border-gray-200 dark:border-gray-700">
              <PlanningGrid
                plans={plans}
                isEditable={isEditable}
                onPlanUpdate={handlePlanUpdate}
                showActuals={showActuals}
              />
            </div>
          </section>

          {/* STEP 4: Financial & Final Outcome */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 text-xs font-bold">4</span>
              <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight">Predicted Outcome</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card bg-success-50/30 dark:bg-success-900/10 border-success-200 dark:border-success-800/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-success-100 dark:bg-success-900/30 rounded-lg text-success-600 dark:text-success-400">
                    <UserGroupIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-success-700 dark:text-success-500 uppercase tracking-wider">Projected Ending Headcount</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalPlannedHeadcount.toLocaleString()}</p>
                  </div>
                </div>
                <div className="h-px bg-success-200 dark:bg-success-800/50 my-3" />
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                  <span className="text-gray-500">Start: {currentHeadcount}</span>
                  <span className="text-success-600">+{totalPlannedHires} Hires</span>
                  <span className="text-danger-600">-{totalPlannedAttrition} Attr.</span>
                </div>
              </div>

              <div className="card bg-blue-50/30 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                    <CurrencyDollarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-blue-700 dark:text-blue-500 uppercase tracking-wider">Projected Comp Budget</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      ${(totalCompensationBudget / 1000000).toFixed(1)}M
                    </p>
                  </div>
                </div>
                <div className="h-px bg-blue-200 dark:bg-blue-800/50 my-3" />
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Based on current department averages</p>
              </div>
            </div>
            
            {showActuals && (
              <div className="card mt-4">
                <h3 className="card-header">Plan Distribution vs Actuals</h3>
                <ActualVsPlanChart plans={plans} />
              </div>
            )}
          </section>
        </div>
      )}

      {/* New Period Modal */}
      {showNewPeriodModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-700">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700/50">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Create Planning Scenario</h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                createPeriodMutation.mutate(newPeriodForm)
              }}
              className="p-5 space-y-4"
            >
              <div>
                <label className="label">Scenario Name</label>
                <input
                  type="text"
                  value={newPeriodForm.name}
                  onChange={(e) => setNewPeriodForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="input"
                  placeholder="e.g., Aggressive Growth 2026"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Start Date</label>
                  <input
                    type="date"
                    value={newPeriodForm.start_date}
                    onChange={(e) => setNewPeriodForm((prev) => ({ ...prev, start_date: e.target.value }))}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input
                    type="date"
                    value={newPeriodForm.end_date}
                    onChange={(e) => setNewPeriodForm((prev) => ({ ...prev, end_date: e.target.value }))}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Period Type</label>
                <select
                  value={newPeriodForm.period_type}
                  onChange={(e) => setNewPeriodForm((prev) => ({ ...prev, period_type: e.target.value }))}
                  className="input"
                >
                  <option value="month">Month</option>
                  <option value="quarter">Quarter</option>
                  <option value="half_year">Half Year</option>
                  <option value="year">Year</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700/50 mt-6">
                <button type="button" onClick={() => setShowNewPeriodModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={createPeriodMutation.isPending} className="btn-primary">
                  {createPeriodMutation.isPending ? 'Creating...' : 'Create Scenario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
