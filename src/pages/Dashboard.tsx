import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocalization } from '../hooks/useLocalization'
import { useGlobalFilters } from '../hooks/useGlobalFilters'
import { useDashboardMetrics, useFinancialMetrics } from '../hooks'
import { useMLPrediction, useActiveModels, type MLPrediction } from '../hooks/useMLInsights'
import { useStore } from '../store'
import api from '../api'
import { CHART_COLORS } from '../utils/chartColors'
import MetricCard from '../components/MetricCard'
import MLInsightsBadge from '../components/MLInsightsBadge'
import AreaChart from '../components/charts/AreaChart'
import LineChart from '../components/charts/LineChart'
import PieChart from '../components/charts/PieChart'
import GaugeChart from '../components/charts/GaugeChart'
import {
  UserGroupIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  HeartIcon,
  BanknotesIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import DataSourceSelector from '../components/DataSourceSelector'

interface HealthSummary {
  headcount: number
  attrition_rate: number
  avg_engagement: number
  avg_performance: number
  open_requisitions: number
  attendance_rate: number
  active_alerts: number
}

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-20 mb-2"></div>
          <div className="h-3 bg-gray-100 rounded w-32"></div>
        </div>
        <div className="p-3 rounded-lg bg-gray-100 w-12 h-12"></div>
      </div>
    </div>
  )
}

function SkeletonChart() {
  return (
    <div className="card animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-40 mb-4"></div>
      <div className="h-[280px] bg-gray-100 rounded"></div>
    </div>
  )
}

function SkeletonTable() {
  return (
    <div className="card animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-48 mb-4"></div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded"></div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const loc = useLocalization()
  const { filterObj } = useGlobalFilters()
  const { employees, requisitions } = useStore()

  // Data source state
  const [dataSource, setDataSource] = useState('live-api')

  // Fetch dashboard metrics from /api/metrics/dashboard via React Query hook
  const {
    data: dashboardData,
    isLoading: metricsLoading,
  } = useDashboardMetrics()

  // Fetch financial & quality-of-hire metrics
  const {
    data: financialData,
    isLoading: financialLoading,
  } = useFinancialMetrics()

  // Fetch health summary from /api/command-center/health
  const [healthData, setHealthData] = useState<HealthSummary | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)

  // ML Insights
  const { data: activeModels } = useActiveModels()
  const {
    data: attritionPrediction,
    isLoading: attritionLoading,
    isError: attritionError,
  } = useMLPrediction('attrition') as { data: MLPrediction | undefined, isLoading: boolean, isError: boolean }
  const {
    data: headcountPrediction,
    isLoading: headcountMLLoading,
    isError: headcountMLError,
  } = useMLPrediction('headcount_forecast') as { data: MLPrediction | undefined, isLoading: boolean, isError: boolean }

  const hasActiveModels = (activeModels?.length ?? 0) > 0

  useEffect(() => {
    let cancelled = false

    async function fetchHealth() {
      try {
        setHealthLoading(true)
        const response = await api.get('/command-center/health', { params: filterObj })
        if (!cancelled) {
          setHealthData(response.data?.data ?? response.data)
        }
      } catch (err) {
        // Health endpoint is supplementary; we can proceed without it
        console.error('Failed to fetch health summary:', err)
      } finally {
        if (!cancelled) setHealthLoading(false)
      }
    }

    fetchHealth()
    return () => { cancelled = true }
  }, [filterObj])

  // Compute store-based metrics (used as primary source or fallback)
  const storeMetrics = useMemo(() => {
    const active = employees.filter((e: any) => e.status === 'active')
    const terminated = employees.filter((e: any) => e.status === 'terminated')
    const headcount = active.length
    const turnoverRate = employees.length > 0
      ? Math.round((terminated.length / Math.max(employees.length, 1)) * 1000) / 10
      : 0
    const avgSalary = active.length > 0
      ? Math.round(active.reduce((s: number, e: any) => s + (e.salary ?? 0), 0) / active.length)
      : 0
    const engagementScore = active.length > 0
      ? Math.round(active.reduce((s: number, e: any) => s + (e.engagementScore ?? e.engagement_score ?? 4), 0) / active.length * 10) / 10
      : 0
    const performanceAvg = active.length > 0
      ? Math.round(active.reduce((s: number, e: any) => s + (e.performanceRating ?? e.performance_rating ?? 3.5), 0) / active.length * 10) / 10
      : 0
    const openPositions = requisitions.filter((r: any) => r.status === 'open').length

    return { headcount, turnoverRate, avgSalary, engagementScore, performanceAvg, openPositions }
  }, [employees, requisitions])

  // Derive all metrics from the API response with store fallbacks for sync
  const metrics = useMemo(() => {
    const d = dashboardData?.data

    return {
      totalHeadcount: (d?.headcount?.active ?? d?.headcount?.total) || storeMetrics.headcount || 0,
      headcountChange: d?.headcount?.change_vs_last_month ?? 0,
      newHires: d?.recruitment?.hires_this_quarter ?? 0,
      turnoverRate: d?.turnover?.rate ?? storeMetrics.turnoverRate,
      turnoverChange: d?.turnover?.change_vs_last_year ?? 0,
      openPositions: (d?.recruitment?.open_positions) ?? storeMetrics.openPositions ?? 0,
      timeToHire: d?.recruitment?.avg_time_to_hire ?? 0,
      avgSalary: d?.compensation?.avg_salary ?? storeMetrics.avgSalary,
      salaryChange: d?.compensation?.yoy_change ?? 0,
      engagementScore: d?.engagement?.avg_score ?? storeMetrics.engagementScore,
      engagementChange: d?.engagement?.change_vs_last_survey ?? 0,
      performanceAvg: d?.performance?.avg_rating ?? storeMetrics.performanceAvg,
    }
  }, [dashboardData, storeMetrics])

  // Time series data for charts — generate from store data when API unavailable
  const headcountTimeSeries = useMemo(() => {
    const series = dashboardData?.data?.time_series?.headcount
    if (series && series.length > 0) {
      return series.map((point: { date: string; value: number }) => ({
        date: point.date,
        headcount: point.value,
      }))
    }
    // Generate approximate time series from store employees
    if (employees.length === 0) return []
    const now = new Date()
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now)
      d.setMonth(d.getMonth() - (11 - i))
      const month = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      // Estimate headcount at that time
      const hired = employees.filter(e => {
        const hd = new Date(e.hireDate)
        return hd <= d
      }).length
      return { date: month, headcount: hired }
    })
  }, [dashboardData, employees])

  const turnoverTimeSeries = useMemo(() => {
    const series = dashboardData?.data?.time_series?.turnover
    if (series && series.length > 0) {
      return series.map(
        (point: { date: string; voluntary: number; involuntary: number }) => ({
          date: point.date,
          voluntary: point.voluntary,
          involuntary: point.involuntary,
        })
      )
    }
    // Generate approximate from terminated employees
    if (employees.length === 0) return []
    const now = new Date()
    const terminated = employees.filter(e => e.status === 'terminated' && e.terminationDate)
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now)
      d.setMonth(d.getMonth() - (11 - i))
      const month = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const exits = terminated.filter(e => e.terminationDate?.startsWith(monthStr)).length
      return { date: month, voluntary: exits * 0.7, involuntary: exits * 0.3 }
    })
  }, [dashboardData, employees])

  // Department breakdown — fall back to store computation
  const departmentMetrics = useMemo(() => {
    const byDept = dashboardData?.data?.by_department
    if (byDept && byDept.length > 0) {
      return byDept.map((d: any) => ({
        department: d.department,
        headcount: d.headcount ?? d.count ?? 0,
        openPositions: d.open_positions ?? d.openPositions ?? 0,
        turnoverRate: d.turnover_rate ?? d.turnoverRate ?? 0,
        avgTenure: d.avg_tenure ?? d.avgTenure ?? 0,
        engagementScore: d.engagement_score ?? d.engagementScore ?? 0,
        avgSalary: d.avg_salary ?? d.avgSalary ?? 0,
      }))
    }
    // Compute from store
    const deptMap = new Map<string, { headcount: number; salary: number; engagement: number; tenure: number }>()
    employees.forEach((e: any) => {
      if (!deptMap.has(e.department)) {
        deptMap.set(e.department, { headcount: 0, salary: 0, engagement: 0, tenure: 0 })
      }
      const d = deptMap.get(e.department)!
      if (e.status === 'active') {
        d.headcount++
        d.salary += e.salary ?? 0
        d.engagement += e.engagementScore ?? e.engagement_score ?? 4
        d.tenure += e.tenure ?? 0
      }
    })
    return Array.from(deptMap.entries()).map(([department, d]) => ({
      department,
      headcount: d.headcount,
      openPositions: requisitions.filter((r: any) => r.department === department && r.status === 'open').length,
      turnoverRate: 0,
      avgTenure: d.headcount > 0 ? Math.round(d.tenure / d.headcount * 10) / 10 : 0,
      engagementScore: d.headcount > 0 ? Math.round(d.engagement / d.headcount * 10) / 10 : 0,
      avgSalary: d.headcount > 0 ? Math.round(d.salary / d.headcount) : 0,
    })).sort((a, b) => b.headcount - a.headcount)
  }, [dashboardData, employees, requisitions])

  // Pie chart: department distribution
  const departmentDistribution = useMemo(() => {
    if (departmentMetrics.length > 0) {
      return departmentMetrics.map(d => ({ name: d.department, value: d.headcount }))
    }
    return []
  }, [departmentMetrics])

  // Pie chart: location distribution
  const locationDistribution = useMemo(() => {
    const byLoc = dashboardData?.data?.by_location
    if (byLoc && byLoc.length > 0) {
      return byLoc.map((d: any) => ({
        name: d.location,
        value: d.headcount ?? d.count ?? 0,
      }))
    }
    // Compute from store
    const locMap = new Map<string, number>()
    employees.forEach((e: any) => {
      if (e.status === 'active') {
        locMap.set(e.location, (locMap.get(e.location) ?? 0) + 1)
      }
    })
    return Array.from(locMap.entries()).map(([name, value]) => ({ name, value }))
  }, [dashboardData, employees])

  // Financial & quality-of-hire derived values
  const financialMetrics = useMemo(() => {
    const d = financialData?.data
    if (!d) return null
    return {
      revenuePerEmployee: d.revenue_per_employee ?? 0,
      profitPerEmployee: d.profit_per_employee ?? 0,
      qualityOfHire: d.quality_of_hire ?? 0,
      revenueYoY: d.revenue_per_employee_yoy ?? undefined,
      profitYoY: d.profit_per_employee_yoy ?? undefined,
    }
  }, [financialData])

  const financialTrends = useMemo(() => {
    const trends = financialData?.data?.trends
    if (!trends || trends.length === 0) return []
    return trends.map((t: any) => ({
      month: t.month,
      revenuePerEmployee: t.revenue_per_employee,
      profitPerEmployee: t.profit_per_employee,
      qualityOfHire: t.quality_of_hire,
    }))
  }, [financialData])

  // Gauge values from health endpoint (with fallback to metrics)
  const gaugeValues = useMemo(() => {
    const engagement = healthData?.avg_engagement
      ? healthData.avg_engagement * 20
      : (metrics ? metrics.engagementScore * 20 : 0)
    const retention = healthData?.attrition_rate != null
      ? 100 - healthData.attrition_rate
      : metrics
        ? 100 - metrics.turnoverRate
        : 0
    const performance = healthData?.avg_performance
      ? healthData.avg_performance * 20
      : (metrics ? metrics.performanceAvg * 20 : 0)
    // Diversity score: calculate from gender distribution if available
    const genderRatio = dashboardData?.data?.diversity?.gender_ratio
    let diversity = 0
    if (genderRatio) {
      const values = Object.values(genderRatio) as number[]
      const total = values.reduce((a, b) => a + b, 0)
      if (total > 0) {
        // Shannon diversity index normalized to 0-100
        const proportions = values.map(v => v / total).filter(p => p > 0)
        const entropy = -proportions.reduce((sum, p) => sum + p * Math.log(p), 0)
        const maxEntropy = Math.log(proportions.length || 1)
        diversity = maxEntropy > 0 ? (entropy / maxEntropy) * 100 : 0
      }
    }

    return { engagement, retention, performance, diversity }
  }, [healthData, metrics, dashboardData])

  // Show skeleton only on first load AND no store data to fall back to
  const hasStoreData = employees.length > 0 || requisitions.length > 0
  if (metricsLoading && !dashboardData && !hasStoreData) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={`sk1-${i}`} />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={`sk2-${i}`} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonChart />
          <SkeletonChart />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonChart />
          <SkeletonChart />
          <SkeletonChart />
        </div>
        <SkeletonTable />
      </div>
    )
  }

  return (
    <div className="space-y-5 w-full">
      {/* Header with Data Source */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">Executive Dashboard</h2>
          <p className="text-[11px] text-gray-500 font-medium">Organization overview and key performance indicators</p>
        </div>
        <DataSourceSelector module="Dashboard" selectedSource={dataSource} onSourceChange={setDataSource} compact />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Headcount"
          value={loc.number(metrics?.totalHeadcount ?? 0)}
          change={metrics?.headcountChange ?? 0}
          changeLabel="vs last month"
          trend={
            (metrics?.headcountChange ?? 0) >= 0 ? 'up' : 'down'
          }
          icon={<UserGroupIcon />}
        />
        <MetricCard
          title="New Hires (Quarter)"
          value={metrics?.newHires ?? 0}
          icon={<ArrowTrendingUpIcon />}
        />
        <MetricCard
          title="Turnover Rate"
          value={`${(metrics?.turnoverRate ?? 0).toFixed(1)}%`}
          change={metrics?.turnoverChange ?? 0}
          changeLabel="vs last year"
          trend={
            (metrics?.turnoverChange ?? 0) <= 0 ? 'up' : 'down'
          }
          icon={<HeartIcon />}
        />
        <MetricCard
          title="Open Positions"
          value={metrics?.openPositions ?? 0}
          subtitle={`${Math.round(metrics?.timeToHire ?? 0)} days avg. time to fill`}
          icon={<ChartBarIcon />}
        />
      </div>

      {/* Second Row Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Avg. Salary"
          value={loc.currency(metrics?.avgSalary ?? 0)}
          change={metrics?.salaryChange ?? 0}
          changeLabel="YoY increase"
          trend={
            (metrics?.salaryChange ?? 0) >= 0 ? 'up' : 'down'
          }
          icon={<CurrencyDollarIcon />}
        />
        <MetricCard
          title="Avg. Time to Hire"
          value={`${metrics?.timeToHire ?? 0} days`}
          icon={<ClockIcon />}
        />
        <MetricCard
          title="Engagement Score"
          value={`${(metrics?.engagementScore ?? 0).toFixed(1)}/5`}
          change={metrics?.engagementChange ?? 0}
          changeLabel="vs last survey"
          trend={
            (metrics?.engagementChange ?? 0) >= 0 ? 'up' : 'down'
          }
        />
        <MetricCard
          title="Avg. Performance"
          value={`${(metrics?.performanceAvg ?? 0).toFixed(1)}/5`}
        />
      </div>

      {/* Financial & Quality Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {financialLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <MetricCard
              title="Revenue per Employee"
              value={loc.currency(financialMetrics?.revenuePerEmployee ?? 0)}
              icon={<BanknotesIcon />}
              subtitle="Annual revenue / headcount"
              change={financialMetrics?.revenueYoY != null ? Math.abs(financialMetrics.revenueYoY) : undefined}
              trend={financialMetrics?.revenueYoY != null ? (financialMetrics.revenueYoY >= 0 ? 'up' : 'down') : undefined}
              changeLabel="vs last year"
            />
            <MetricCard
              title="Profit per Employee"
              value={loc.currency(financialMetrics?.profitPerEmployee ?? 0)}
              icon={<CurrencyDollarIcon />}
              subtitle="Net profit / headcount"
              change={financialMetrics?.profitYoY != null ? Math.abs(financialMetrics.profitYoY) : undefined}
              trend={financialMetrics?.profitYoY != null ? (financialMetrics.profitYoY >= 0 ? 'up' : 'down') : undefined}
              changeLabel="vs last year"
            />
            <div className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="metric-label">Quality of Hire</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="metric-value">
                      {(financialMetrics?.qualityOfHire ?? 0).toFixed(1)}
                    </p>
                    <span className="text-sm text-gray-400">/100</span>
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        (financialMetrics?.qualityOfHire ?? 0) > 75
                          ? 'bg-success-500'
                          : (financialMetrics?.qualityOfHire ?? 0) >= 50
                          ? 'bg-warning-500'
                          : 'bg-danger-500'
                      }`}
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1 leading-tight">Composite: perf, retention, productivity, satisfaction</p>
                </div>
                <div className="p-1.5 rounded-md bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400">
                  <SparklesIcon className="w-4 h-4" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ML Insights Section */}
      {hasActiveModels ? (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-header mb-0">ML Insights</h3>
            <Link
              to="/app/ml-models"
              className="text-sm text-accent-600 hover:text-accent-700 font-medium"
            >
              View all models
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Attrition Prediction */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
              {attritionLoading ? (
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-40 mb-3"></div>
                  <div className="h-6 bg-gray-200 rounded w-24 mb-2"></div>
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-3 bg-gray-100 rounded w-full"></div>
                    ))}
                  </div>
                </div>
              ) : attritionError || !attritionPrediction ? (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Attrition Risk</h4>
                  <p className="text-sm text-gray-500">
                    Attrition model is available but predictions could not be loaded.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">Attrition Risk Prediction</h4>
                    <MLInsightsBadge
                      modelName={attritionPrediction.model_name}
                      confidence={attritionPrediction.confidence}
                    />
                  </div>
                  {(() => {
                    const predData = attritionPrediction.predictions
                    // The ML predict endpoint returns { status, prediction: { high_risk_count, medium_risk_count, low_risk_count, results_summary } }
                    const prediction = predData?.prediction || predData
                    const highRiskCount = prediction?.high_risk_count ?? 0
                    const mediumRiskCount = prediction?.medium_risk_count ?? 0
                    const lowRiskCount = prediction?.low_risk_count ?? 0
                    const totalAnalyzed = prediction?.input_count ?? (highRiskCount + mediumRiskCount + lowRiskCount)
                    return (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <ExclamationTriangleIcon className={`w-5 h-5 ${highRiskCount > 0 ? 'text-danger-600' : 'text-warning-600'}`} />
                          <p className="text-lg font-bold text-gray-900 dark:text-white">
                            {highRiskCount} employee{highRiskCount !== 1 ? 's' : ''} at high risk
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">High Risk</span>
                            <span className="font-medium text-danger-600">{highRiskCount}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Medium Risk</span>
                            <span className="font-medium text-warning-600">{mediumRiskCount}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Low Risk</span>
                            <span className="font-medium text-success-600">{lowRiskCount}</span>
                          </div>
                          <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>Total Analyzed</span>
                            <span>{totalAnalyzed}</span>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* Headcount Forecast */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
              {headcountMLLoading ? (
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-40 mb-3"></div>
                  <div className="h-6 bg-gray-200 rounded w-24 mb-2"></div>
                  <div className="h-3 bg-gray-100 rounded w-48"></div>
                </div>
              ) : headcountMLError || !headcountPrediction || (!headcountPrediction.predictions && !headcountPrediction.projected_headcount) ? (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Headcount Forecast</h4>
                  <p className="text-sm text-gray-500">
                    {headcountMLError ? 'Error loading forecast' : 'Forecast model trained. View details in Workforce Planning.'}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">Headcount Forecast</h4>
                    <MLInsightsBadge
                      modelName={headcountPrediction.model_name}
                      confidence={headcountPrediction.confidence}
                    />
                  </div>
                  {(() => {
                    // Try to find the projected value in various possible locations in the response
                    const p = headcountPrediction
                    const projectedValue = p.projected_headcount 
                      ?? p.predictions?.projected_headcount
                      ?? (Array.isArray(p.predictions) ? p.predictions[Math.min(5, p.predictions.length-1)]?.headcount : null)
                      ?? (Array.isArray(p.predictions?.predictions) ? p.predictions.predictions[Math.min(5, p.predictions.predictions.length-1)]?.headcount : null)

                    return (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <ArrowTrendingUpIcon className="w-5 h-5 text-primary-600" />
                          <p className="text-lg font-bold text-gray-900 dark:text-white">
                            {projectedValue != null
                              ? `${Math.round(projectedValue).toLocaleString()} projected`
                              : 'Forecast available'}
                          </p>
                        </div>
                        <p className="text-sm text-gray-500">
                          {projectedValue != null
                            ? 'Projected headcount in 6 months based on ML model'
                            : 'View Workforce Planning for detailed forecast'}
                        </p>
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="flex items-center gap-4 p-2">
            <div className="p-3 rounded-lg bg-accent-50 text-accent-600">
              <SparklesIcon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Get ML-powered Insights</h3>
              <p className="text-sm text-gray-500">
                Train your first ML model to see attrition predictions, headcount forecasts, and more right here on your dashboard.
              </p>
            </div>
            <Link
              to="/app/ml-models"
              className="btn-primary text-sm"
            >
              Train a Model
            </Link>
          </div>
        </div>
      )}

      {/* Financial & Quality Trend Chart */}
      <div className="card">
        <h3 className="card-header">Financial & Quality Trends (6 Months)</h3>
        {financialTrends.length > 0 ? (
          <LineChart
            data={financialTrends}
            xKey="month"
            lines={[
              { key: 'revenuePerEmployee', name: `Revenue / Employee (${loc.settings.currency})`, color: CHART_COLORS[0] },
              { key: 'profitPerEmployee', name: `Profit / Employee (${loc.settings.currency})`, color: CHART_COLORS[1] },
              { key: 'qualityOfHire', name: 'Quality of Hire', color: CHART_COLORS[4] },
            ]}
            height={300}
            yAxisFormatter={(v: number) => loc.currency(v, true)}
          />
        ) : (
          <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">
            No financial trend data available
          </div>
        )}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="card-header">Headcount Trend</h3>
          {headcountTimeSeries.length > 0 ? (
            <AreaChart
              data={headcountTimeSeries}
              xKey="date"
              areas={[
                { key: 'headcount', name: 'Headcount', color: CHART_COLORS[0] },
              ]}
              height={280}
            />
          ) : (
            <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
              No headcount trend data available
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="card-header">Monthly Turnover</h3>
          {turnoverTimeSeries.length > 0 ? (
            <AreaChart
              data={turnoverTimeSeries}
              xKey="date"
              areas={[
                { key: 'voluntary', name: 'Voluntary', color: CHART_COLORS[3] },
                { key: 'involuntary', name: 'Involuntary', color: CHART_COLORS[2] },
              ]}
              stacked
              height={280}
            />
          ) : (
            <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
              No turnover trend data available
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="card-header">Department Distribution</h3>
          {departmentDistribution.length > 0 ? (
            <PieChart data={departmentDistribution} height={280} innerRadius={50} />
          ) : (
            <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
              No department data available
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="card-header">Location Distribution</h3>
          {locationDistribution.length > 0 ? (
            <PieChart data={locationDistribution} height={280} innerRadius={50} />
          ) : (
            <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
              No location data available
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="card-header">Key Health Indicators</h3>
          {healthLoading ? (
            <div className="grid grid-cols-2 gap-4 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 rounded"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <GaugeChart
                value={gaugeValues.engagement}
                label="Engagement"
                size="small"
              />
              <GaugeChart
                value={gaugeValues.retention}
                label="Retention"
                size="small"
              />
              <GaugeChart
                value={gaugeValues.performance}
                label="Performance"
                size="small"
              />
              <GaugeChart
                value={gaugeValues.diversity}
                label="Diversity"
                size="small"
              />
            </div>
          )}
        </div>
      </div>

      {/* Department Performance Table */}
      <div className="card overflow-hidden">
        <h3 className="card-header px-0.5">Department Overview</h3>
        {departmentMetrics.length > 0 ? (
          <div className="overflow-x-auto -mx-3.5 -mb-3.5">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="table-header">Department</th>
                  <th className="table-header text-right">Headcount</th>
                  <th className="table-header text-right">Open Positions</th>
                  <th className="table-header text-right">Turnover Rate</th>
                  <th className="table-header text-right">Avg. Tenure</th>
                  <th className="table-header text-right">Engagement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800/30">
                {departmentMetrics.map((dept: any) => (
                  <tr key={dept.department} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="table-cell font-medium text-gray-900 dark:text-white">{dept.department}</td>
                    <td className="table-cell text-right">{dept.headcount}</td>
                    <td className="table-cell text-right">{dept.openPositions}</td>
                    <td className="table-cell text-right">
                      <span
                        className={
                          dept.turnoverRate > 12
                            ? 'text-danger-600 font-semibold'
                            : dept.turnoverRate > 8
                            ? 'text-warning-600 font-semibold'
                            : 'text-success-600 font-semibold'
                        }
                      >
                        {dept.turnoverRate}%
                      </span>
                    </td>
                    <td className="table-cell text-right">{dept.avgTenure} yrs</td>
                    <td className="table-cell text-right">
                      <span
                        className={
                          dept.engagementScore > 4
                            ? 'text-success-600 font-semibold'
                            : dept.engagementScore > 3.5
                            ? 'text-warning-600 font-semibold'
                            : 'text-danger-600 font-semibold'
                        }
                      >
                        {dept.engagementScore}/5
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-gray-400 text-[11px]">
            No department data available
          </div>
        )}
      </div>
    </div>
  )
}
