import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useGlobalFilters } from '../hooks/useGlobalFilters'
import clsx from 'clsx'
import api from '../api'
import { useStore } from '../store'
import { usePermissions } from '../hooks/usePermissions'
import HealthMetricCard from '../components/command-center/HealthMetricCard'
import AIInsightsPanel from '../components/AIInsightsPanel'
import SignalsPanel from '../components/command-center/SignalsPanel'
import MiniTrendChart from '../components/command-center/MiniTrendChart'
import { CHART_COLORS } from '../utils/chartColors'
import {
  UsersIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  HeartIcon,
  BriefcaseIcon,
  StarIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  BoltIcon,
  PresentationChartLineIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

export default function Pulse() {
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const { workforcePlans: plans, recruiterGoals, employees, requisitions } = useStore()
  const { filterObj, effectiveDateRange } = useGlobalFilters()

  const [healthData, setHealthData] = useState<any>(null)
  const [trends, setTrends] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [filterObj])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Derive months from date range for trends
      const months = _dateRangeToMonths(effectiveDateRange)
      const [healthRes, trendsRes, alertsRes] = await Promise.all([
        api.get('/command-center/health', { params: filterObj }).catch(() => ({ data: null })),
        api.get('/command-center/trends', { params: { months, ...filterObj } }).catch(() => ({ data: [] })),
        api.get('/command-center/alerts').catch(() => ({ data: [] })),
      ])
      setHealthData(healthRes.data)
      setTrends(Array.isArray(trendsRes.data) ? trendsRes.data : trendsRes.data?.trends || [])
      setAlerts(Array.isArray(alertsRes.data) ? alertsRes.data : alertsRes.data?.alerts || [])
    } catch (err) {
      console.error('Failed to fetch pulse data:', err)
    } finally {
      setLoading(false)
    }
  }

  function _dateRangeToMonths(range: { start: string | null; end: string | null }): number {
    if (!range.start || !range.end) return 6
    const start = new Date(range.start)
    const end = new Date(range.end)
    const months = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)))
    return Math.min(months, 24)
  }

  const handleAcknowledge = async (alertId: string) => {
    try {
      await api.post(`/command-center/alerts/${alertId}/acknowledge`)
      setAlerts(prev => prev.filter(a => a.id !== alertId))
      toast.success('Signal acknowledged')
    } catch {
      toast.error('Operation failed')
    }
  }

  // Compute rich signals from employee/requisition data when API has none
  const computedAlerts = useMemo(() => {
    if (employees.length === 0) return []
    const now = new Date().toISOString()
    const active = employees.filter(e => e.status === 'active')
    const signals: any[] = []

    // 1. Flight risk clusters by department
    const highRisk = active.filter(e => e.flightRisk === 'high')
    const byDeptRisk: Record<string, typeof highRisk> = {}
    highRisk.forEach(e => { byDeptRisk[e.department] = [...(byDeptRisk[e.department] || []), e] })
    Object.entries(byDeptRisk).forEach(([dept, emps]) => {
      if (emps.length < 2) return
      const topPerfCount = emps.filter(e => (e.performanceRating || 0) >= 4).length
      const avgTenure = emps.reduce((s, e) => s + (e.tenure || 0), 0) / emps.length
      const avgSal = emps.reduce((s, e) => s + (e.salary || 0), 0) / Math.max(emps.filter(e => (e.salary || 0) > 0).length, 1)
      signals.push({
        id: `computed-attrition-${dept}`,
        title: `Flight Risk Cluster: ${dept}`,
        description: `${emps.length} employees in ${dept} show elevated attrition signals${topPerfCount > 0 ? `, including ${topPerfCount} top performer${topPerfCount > 1 ? 's' : ''}` : ''}.`,
        severity: emps.length >= 5 ? 'critical' : emps.length >= 3 ? 'high' : 'medium',
        category: 'attrition',
        affected_department: dept,
        affected_count: emps.length,
        reasons: [
          `${emps.length} employees flagged as high flight risk`,
          topPerfCount > 0 ? `${topPerfCount} have performance rating ≥ 4.0 — elevated replacement cost` : `Avg tenure in dept: ${avgTenure.toFixed(1)} years`,
          `Avg compensation: $${Math.round(avgSal / 1000)}K — review vs. market`,
        ],
        impact_cost: emps.length * Math.max(avgSal * 1.5, 75000),
        recommended_action: topPerfCount > 0
          ? 'Schedule retention conversations with top performers within 2 weeks. Run compensation equity review.'
          : `Conduct engagement pulse survey for ${dept}. Identify management or workload concerns.`,
        velocity: 'worsening',
        performance_tier: topPerfCount > emps.length / 2 ? 'top' : 'solid',
        created_at: now,
        _computed: true,
      })
    })

    // 2. Capacity gaps: open reqs significantly beyond plan
    const openReqsByDept: Record<string, number> = {}
    requisitions.filter(r => r.status === 'open').forEach(r => {
      openReqsByDept[r.department] = (openReqsByDept[r.department] || 0) + 1
    })
    Object.entries(openReqsByDept).forEach(([dept, count]) => {
      if (count < 4) return
      const planned = plans.find(p => p.department === dept)?.plannedHires || 0
      if (count <= planned * 1.25) return
      signals.push({
        id: `computed-capacity-${dept}`,
        title: `Capacity Gap: ${dept}`,
        description: `${count} open requisitions in ${dept} — ${Math.max(0, count - planned)} beyond current hiring plan.`,
        severity: count >= 8 ? 'high' : 'medium',
        category: 'capacity',
        affected_department: dept,
        affected_count: count,
        reasons: [
          `${count} open positions vs. ${planned} planned hires`,
          `Gap may delay project delivery or overload current team`,
          `Consider contractor augmentation for immediate needs`,
        ],
        impact_cost: Math.max(0, count - planned) * 18000,
        recommended_action: `Review requisition priority and recruiter capacity for ${dept}. Evaluate contractor sourcing for the ${Math.max(0, count - planned)} gap positions.`,
        velocity: 'stable',
        created_at: now,
        _computed: true,
      })
    })

    // 3. Compensation risk: solid performers earning <80% of dept average
    const deptEmps: Record<string, typeof active> = {}
    active.forEach(e => { deptEmps[e.department] = [...(deptEmps[e.department] || []), e] })
    Object.entries(deptEmps).forEach(([dept, emps]) => {
      const withSal = emps.filter(e => (e.salary || 0) > 0)
      if (withSal.length < 4) return
      const avg = withSal.reduce((s, e) => s + e.salary, 0) / withSal.length
      const underpaid = withSal.filter(e => e.salary < avg * 0.8 && (e.performanceRating || 0) >= 3.5)
      if (underpaid.length < 2) return
      signals.push({
        id: `computed-comp-${dept}`,
        title: `Compensation Risk: ${dept}`,
        description: `${underpaid.length} solid/high performers in ${dept} earn 20%+ below department average — a leading flight risk indicator.`,
        severity: underpaid.length >= 4 ? 'high' : 'medium',
        category: 'compensation',
        affected_department: dept,
        affected_count: underpaid.length,
        reasons: [
          `${underpaid.length} employees earning <80% of dept avg ($${Math.round(avg / 1000)}K)`,
          `All have performance rating ≥ 3.5 — retentionable talent`,
          `Pay gaps are a top-5 driver of voluntary turnover`,
        ],
        impact_cost: underpaid.length * (avg * 0.2),
        recommended_action: `Run compensation equity review for ${dept}. Prioritize salary adjustments for employees with ratings ≥ 3.5.`,
        velocity: 'stable',
        performance_tier: 'solid',
        created_at: now,
        _computed: true,
      })
    })

    return signals.sort((a, b) => {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
      return (order[a.severity] ?? 3) - (order[b.severity] ?? 3)
    })
  }, [employees, requisitions, plans])

  // Merge: prefer API alerts, supplement with computed when API is empty
  const mergedAlerts = useMemo(() => alerts.length > 0 ? alerts : computedAlerts, [alerts, computedAlerts])

  // Real-time Store Derived Metrics
  const storeHC = employees.filter(e => e.status === 'active').length
  const currentHC = healthData?.headcount || storeHC || 0
  const openReqs = requisitions.filter(r => r.status === 'open').length
  
  const totalPlannedHires = plans.reduce((s, p) => s + (p.plannedHires || 0), 0)
  const totalActualHires = plans.reduce((s, p) => s + (p.actualHires || 0), 0)
  const hireAttainment = totalPlannedHires > 0 ? Math.round((totalActualHires / totalPlannedHires) * 100) : 0

  const totalRecruiterGoal = recruiterGoals.reduce((s, r) => s + ((r.q1_goal || 0) + (r.q2_goal || 0) + (r.q3_goal || 0) + (r.q4_goal || 0)), 0)
  const capacityStatus = totalRecruiterGoal > 0 && totalRecruiterGoal < totalPlannedHires ? 'critical' : 'healthy'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HeartIcon className="w-7 h-7 text-primary-600" />
            Pulse
          </h1>
          <p className="text-sm text-gray-500 mt-1">Real-time organizational health, execution risks, and predictive signals.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchData}
            className="btn-secondary py-2"
          >
            <ArrowPathIcon className={clsx("w-4 h-4 mr-1.5", loading && "animate-spin")} />
            Refresh
          </button>
          {hasPermission('alerts:run_detection') && (
            <button onClick={() => fetchData()} className="btn-primary py-2">
              <BoltIcon className="w-4 h-4 mr-1.5" />
              Scan for Risks
            </button>
          )}
        </div>
      </div>

      <AIInsightsPanel
        pageContext="Pulse — Org Health"
        prompt="Analyse the current organisational health signals, active alerts, and predictive risk indicators. Which departments or metrics are most at risk? What patterns do you see across the alerts? Provide prioritised recommendations for immediate action and proactive risk mitigation."
      />

      {/* SECTION 1: CORE HEALTH (THE NOW) */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheckIcon className="w-5 h-5 text-primary-500" />
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Real-time Health</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <HealthMetricCard title="Active Headcount" value={healthData?.headcount || currentHC || 0} icon={UsersIcon} color="blue" />
          <HealthMetricCard title="Attrition Rate" value={`${healthData?.attrition_rate ?? 0}%`} icon={ArrowTrendingDownIcon} color="red" />
          <HealthMetricCard title="Avg Engagement" value={healthData?.avg_engagement ?? 0} unit="/ 5" icon={HeartIcon} color="green" />
          <HealthMetricCard title="Open Positions" value={healthData?.open_requisitions ?? openReqs ?? 0} icon={BriefcaseIcon} color="yellow" />
          <HealthMetricCard title="Performance" value={healthData?.avg_performance ?? 0} unit="/ 5" icon={StarIcon} color="purple" />
          <HealthMetricCard title="Attendance" value={`${healthData?.attendance_rate ?? 0}%`} icon={BuildingOfficeIcon} color="indigo" />
        </div>
      </section>

      {/* SECTION 2: EXECUTION & SIGNALS (THE ACTION) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <BoltIcon className="w-5 h-5 text-accent-500" />
            <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Risk & Anomaly Signals</h2>
          </div>
          <SignalsPanel
            alerts={mergedAlerts}
            onAcknowledge={hasPermission('alerts:manage') ? handleAcknowledge : undefined}
            onInvestigate={(id) => navigate(`/app/deep-dive?alert_id=${id}`)}
            isLoading={loading}
          />
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ArrowTrendingUpIcon className="w-5 h-5 text-primary-500" />
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Velocity Trends</h2>
            </div>
            <div className="space-y-3">
              <MiniTrendChart
                data={trends.map(t => ({ month: t.month, value: t.headcount || 0 }))}
                title="Growth Velocity"
                color={CHART_COLORS[0]}
              />
              <MiniTrendChart
                data={trends.map(t => ({ month: t.month, value: t.attrition_rate || 0 }))}
                title="Attrition Flux"
                color={CHART_COLORS[3]}
                valueFormatter={(v) => `${v}%`}
              />
            </div>
          </div>

          <div className="card border-primary-100 bg-primary-50/10">
            <h4 className="text-[10px] font-bold text-primary-600 uppercase tracking-wider mb-3">Execution Summary</h4>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1 text-[11px]">
                  <span className="text-gray-500 font-medium">Plan Attainment</span>
                  <span className="text-gray-900 font-bold">{hireAttainment}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-primary-600 h-full transition-all duration-1000" style={{ width: `${Math.min(100, hireAttainment)}%` }} />
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className={clsx(
                  "p-1.5 rounded-md",
                  capacityStatus === 'critical' ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                )}>
                  {capacityStatus === 'critical' ? <ExclamationTriangleIcon className="w-4 h-4" /> : <ShieldCheckIcon className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900 dark:text-white">
                    {capacityStatus === 'critical' ? 'Capacity Gap' : 'Capacity Healthy'}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">
                    {capacityStatus === 'critical' 
                      ? 'Team goals are below the active hiring plan.' 
                      : 'Recruitment capacity is aligned with growth targets.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: FORECAST & IMPACT (THE FUTURE) */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <PresentationChartLineIcon className="w-5 h-5 text-success-500" />
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Predictive Outlook</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                <UserGroupIcon className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight">Projected Growth</h4>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              +{totalPlannedHires - totalActualHires} <span className="text-sm font-normal text-gray-400">Pending</span>
            </p>
            <p className="text-[10px] text-gray-500 mt-1 uppercase font-medium">To reach period end target of {currentHC + (totalPlannedHires - totalActualHires)}</p>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400">
                <ArrowTrendingDownIcon className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight">Expected Flux</h4>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {Math.round(currentHC * (healthData?.attrition_rate / 100 || 0.08))} <span className="text-sm font-normal text-gray-400">Departures</span>
            </p>
            <p className="text-[10px] text-gray-500 mt-1 uppercase font-medium">Based on current annualized rate of {healthData?.attrition_rate || 8}%</p>
          </div>

          <div className="card overflow-hidden relative">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg text-primary-600 dark:text-primary-400">
                  <PresentationChartLineIcon className="w-5 h-5" />
                </div>
                <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Simulated Impact</h4>
              </div>
              <p className="text-base font-medium leading-snug text-gray-800 dark:text-gray-100">
                Current <span className="text-primary-600 dark:text-primary-400 font-semibold">capacity gap</span> could delay project starts in <span className="font-semibold text-gray-900 dark:text-white">Engineering</span> by 4 weeks.
              </p>
              <button
                onClick={() => navigate('/app/workforce-planning')}
                className="mt-4 text-[10px] font-bold uppercase tracking-widest text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1"
              >
                Optimize Plan &rarr;
              </button>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-5 transform rotate-12">
              <HeartIcon className="w-32 h-32 text-primary-500" />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
