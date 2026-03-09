import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../api'
import { useGlobalFilters } from '../hooks/useGlobalFilters'
import MetricCard from '../components/MetricCard'
import MLInsightsBadge from '../components/MLInsightsBadge'
import BarChart from '../components/charts/BarChart'
import PieChart from '../components/charts/PieChart'
import DataTable from '../components/DataTable'
import GaugeChart from '../components/charts/GaugeChart'
import { CHART_COLORS } from '../utils/chartColors'
import { useLocalization } from '../hooks/useLocalization'
import { useMLPrediction } from '../hooks/useMLInsights'
import { ColumnDef } from '@tanstack/react-table'
import {
  HeartIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  UserMinusIcon,
  LightBulbIcon,
  SparklesIcon,
  ChartBarIcon,
  TableCellsIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import DataSourceSelector from '../components/DataSourceSelector'

interface FlightRiskEmployee {
  id: string
  name: string
  department: string
  jobTitle: string
  tenure: number
  performanceRating: number
  engagementScore: number
  salary: number
  riskLevel: string
  lastPromotion: string | null
}

interface RetentionData {
  retentionRate: number
  turnoverRate: number
  voluntaryTurnover: number
  involuntaryTurnover: number
  avgTenure: number
  flightRiskEmployees: FlightRiskEmployee[]
  riskDistribution: Record<string, number>
  turnoverByDepartment: { department: string; rate: number; count: number }[]
  exitReasons: { name: string; value: number }[]
  totalActive: number
  totalTerminated: number
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

export default function Retention() {
  const loc = useLocalization()
  const [dataSource, setDataSource] = useState('live-api')
  const { filterObj } = useGlobalFilters()

  const { data, isLoading } = useQuery({
    queryKey: ['retention-metrics', filterObj],
    queryFn: async () => {
      const res = await api.get('/metrics/retention', { params: filterObj })
      return res.data
    },
  })

  // Reasons for leaving data
  const { data: reasonsRes } = useQuery({
    queryKey: ['reasons-for-leaving', filterObj],
    queryFn: async () => {
      const res = await api.get('/retention/reasons-for-leaving', { params: filterObj })
      return res.data
    },
  })

  // ML-powered attrition prediction
  const {
    data: attritionPrediction,
    isLoading: mlLoading,
    isError: mlError,
  } = useMLPrediction('attrition')

  const retention: RetentionData | null = data?.data ?? null

  const retentionRate = retention?.retentionRate ?? 0
  const turnoverRate = retention?.turnoverRate ?? 0
  const voluntaryTurnover = retention?.voluntaryTurnover ?? 0
  const involuntaryTurnover = retention?.involuntaryTurnover ?? 0
  const flightRiskEmployees = retention?.flightRiskEmployees ?? []
  const riskDistribution = retention?.riskDistribution ?? {}
  const turnoverByDepartment = retention?.turnoverByDepartment ?? []
  const exitReasons = retention?.exitReasons ?? []
  const totalTerminated = retention?.totalTerminated ?? 0

  const highRisk = riskDistribution['high'] ?? 0
  const mediumRisk = riskDistribution['medium'] ?? 0
  const lowRisk = riskDistribution['low'] ?? 0
  const totalRisk = highRisk + mediumRisk + lowRisk

  const topDept = turnoverByDepartment.length > 0 ? turnoverByDepartment[0] : null

  const flightRiskColumns: ColumnDef<FlightRiskEmployee>[] = [
    {
      accessorKey: 'id',
      header: 'ID',
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.id}</span>,
    },
    {
      accessorKey: 'name',
      header: 'Name',
    },
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'jobTitle', header: 'Role' },
    {
      accessorKey: 'tenure',
      header: 'Tenure',
      cell: ({ row }) => `${row.original.tenure} yrs`,
    },
    {
      accessorKey: 'performanceRating',
      header: 'Performance',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.performanceRating}/5</span>
      ),
    },
    {
      accessorKey: 'engagementScore',
      header: 'Engagement',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full',
                row.original.engagementScore >= 70 ? 'bg-success-500' : row.original.engagementScore >= 40 ? 'bg-warning-500' : 'bg-danger-500'
              )}
              style={{ width: `${row.original.engagementScore}%` }}
            />
          </div>
          <span className={clsx(
            'text-sm font-medium',
            row.original.engagementScore >= 70 ? 'text-success-600' : row.original.engagementScore >= 40 ? 'text-warning-600' : 'text-danger-600'
          )}>
            {row.original.engagementScore}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'salary',
      header: 'Salary',
      cell: ({ row }) => loc.currency(row.original.salary),
    },
  ]

  const [activeTab, setActiveTab] = useState<'overview' | 'exit-analysis' | 'flight-risk'>('overview')

  const MLPredictionCard = useMemo(() => {
    if (mlLoading) return (
      <div className="card animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-48 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0,1,2].map(i => <div key={i} className="h-24 bg-gray-100 rounded" />)}
        </div>
      </div>
    )
    if (!mlError && attritionPrediction) {
      const raw = attritionPrediction.predictions
      const predObj = raw?.prediction ?? raw
      const summary = predObj?.results_summary ?? predObj
      const allPredictions: any[] = Array.isArray(summary?.predictions) ? summary.predictions : []
      const hrisk = allPredictions.filter((p: any) => p.risk_level === 'high' || p.probability > 0.7)
      const mrisk = allPredictions.filter((p: any) => p.risk_level === 'medium' || (p.probability > 0.4 && p.probability <= 0.7))
      const highRiskCount = predObj?.high_risk_count ?? hrisk.length
      const totalEmployees = predObj?.input_count ?? summary?.total_employees ?? allPredictions.length
      const avgRiskScore = summary?.average_risk_score
      const predictedRate: number | null = summary?.predicted_attrition_rate
        ?? (totalEmployees > 0 && highRiskCount > 0 ? (highRiskCount / totalEmployees) * 100
          : avgRiskScore != null ? avgRiskScore * 100
          : allPredictions.length > 0 ? (hrisk.length / allPredictions.length) * 100 : null)
      const riskFactors = summary?.top_risk_factors ?? summary?.risk_factors ?? predObj?.top_risk_factors ?? []
      return (
        <div className="card border-accent-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-header mb-0">Attrition Prediction</h3>
            <MLInsightsBadge modelName={attritionPrediction.model_name} confidence={attritionPrediction.confidence} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-accent-50 dark:bg-accent-900/20 rounded-lg border border-accent-100 dark:border-accent-800/50">
              <p className="text-xs font-medium text-accent-700 dark:text-accent-300 mb-0.5">Predicted Attrition Rate</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{predictedRate != null ? `${predictedRate.toFixed(1)}%` : '--'}</p>
              <p className="text-xs text-accent-600 dark:text-accent-400 mt-0.5">Based on ML model analysis</p>
            </div>
            <div className="p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg border border-danger-100 dark:border-danger-800/50">
              <p className="text-xs font-medium text-danger-700 dark:text-danger-300 mb-0.5">High-Risk Employees</p>
              <p className="text-xl font-bold text-danger-600 dark:text-danger-400">{hrisk.length}</p>
              <p className="text-xs text-danger-600 dark:text-danger-400 mt-1">{mrisk.length > 0 && `+${mrisk.length} medium risk`}</p>
            </div>
            <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-100 dark:border-warning-800/50">
              <p className="text-sm font-medium text-warning-700 dark:text-warning-300 mb-1">Top Risk Factors</p>
              {Array.isArray(riskFactors) && riskFactors.length > 0 ? (
                <ul className="space-y-1.5 mt-2">
                  {riskFactors.slice(0, 5).map((factor: any, idx: number) => (
                    <li key={idx} className="text-sm text-warning-800 dark:text-warning-200 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-warning-500 rounded-full flex-shrink-0" />
                      {typeof factor === 'string' ? factor : factor.name || factor.factor || `Factor ${idx + 1}`}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-warning-600 dark:text-warning-400 mt-2">Risk factors available after model evaluation</p>}
            </div>
          </div>
        </div>
      )
    }
    if (!attritionPrediction && !mlLoading && !mlError) return (
      <div className="card">
        <div className="flex items-center gap-4 p-2">
          <div className="p-3 rounded-lg bg-accent-50 text-accent-600"><SparklesIcon className="w-6 h-6" /></div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">ML-Powered Attrition Predictions</h3>
            <p className="text-sm text-gray-500">Train an attrition model to see predicted turnover rates, high-risk employees, and key risk factors.</p>
          </div>
          <Link to="/app/ml-models" className="btn-primary text-sm">Train a Model</Link>
        </div>
      </div>
    )
    return null
  }, [mlLoading, mlError, attritionPrediction])

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: ChartBarIcon },
    { id: 'exit-analysis' as const, label: 'Exit Analysis', icon: TableCellsIcon },
    { id: 'flight-risk' as const, label: 'Flight Risk', icon: ShieldExclamationIcon },
  ]

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonChart />
          <SkeletonChart />
          <SkeletonChart />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonChart />
          <SkeletonChart />
        </div>
        <SkeletonTable />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Retention & Turnover</h2>
          <p className="text-sm text-gray-500">Analyze employee retention patterns and flight risk</p>
        </div>
        <DataSourceSelector module="Retention" selectedSource={dataSource} onSourceChange={setDataSource} compact />
      </div>

      {/* Key Metrics — always visible */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Retention Rate" value={`${retentionRate.toFixed(1)}%`} trend="up" icon={<HeartIcon className="w-6 h-6" />} />
        <MetricCard title="Total Turnover" value={`${turnoverRate.toFixed(1)}%`} subtitle={`Vol: ${voluntaryTurnover}% | Invol: ${involuntaryTurnover}%`} trend="up" icon={<ArrowTrendingDownIcon className="w-6 h-6" />} />
        <MetricCard title="High Flight Risk" value={highRisk} subtitle="Employees needing attention" icon={<ExclamationTriangleIcon className="w-6 h-6" />} />
        <MetricCard title="Terminated" value={totalTerminated} subtitle={`${(retention?.totalActive ?? 0) + totalTerminated} total employees`} icon={<UserMinusIcon className="w-6 h-6" />} />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-gray-700">
        <nav className="flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-700 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {MLPredictionCard}

          {/* Key Insights */}
          <div className="card">
            <h3 className="card-header">Key Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {highRisk > 0 && (
                <div className="flex items-start gap-3 p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg border border-danger-100 dark:border-danger-800/50">
                  <ExclamationTriangleIcon className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-danger-900 dark:text-danger-100">High Flight Risk Alert</p>
                    <p className="text-xs text-danger-700 dark:text-danger-300">{highRisk} employees flagged as high flight risk.</p>
                  </div>
                </div>
              )}
              {topDept && (
                <div className="flex items-start gap-3 p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-100 dark:border-warning-800/50">
                  <LightBulbIcon className="w-5 h-5 text-warning-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-warning-900 dark:text-warning-100">{topDept.department} Needs Attention</p>
                    <p className="text-xs text-warning-700 dark:text-warning-300">{topDept.rate}% turnover — highest across departments.</p>
                  </div>
                </div>
              )}
              <div className={clsx('flex items-start gap-3 p-3 rounded-lg border', retentionRate > 85
                ? 'bg-success-50 dark:bg-success-900/20 border-success-100 dark:border-success-800/50'
                : 'bg-danger-50 dark:bg-danger-900/20 border-danger-100 dark:border-danger-800/50'
              )}>
                <HeartIcon className={clsx('w-5 h-5 flex-shrink-0 mt-0.5', retentionRate > 85 ? 'text-success-500' : 'text-danger-500')} />
                <div>
                  <p className={clsx('text-sm font-medium', retentionRate > 85 ? 'text-success-900 dark:text-success-100' : 'text-danger-900 dark:text-danger-100')}>
                    {retentionRate > 85 ? 'Retention Healthy' : 'Retention Below Target'}
                  </p>
                  <p className={clsx('text-xs', retentionRate > 85 ? 'text-success-700 dark:text-success-300' : 'text-danger-700 dark:text-danger-300')}>
                    {retentionRate.toFixed(1)}% vs 85% benchmark.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="card">
            <h3 className="card-header">Retention Recommendations</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-100 dark:border-primary-800/50">
                <h4 className="font-medium text-primary-900 dark:text-primary-100 mb-2">Compensation Review</h4>
                <p className="text-sm text-primary-700 dark:text-primary-300">Benchmark salaries against market rates, particularly for departments with the highest turnover.</p>
              </div>
              <div className="p-4 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-100 dark:border-success-800/50">
                <h4 className="font-medium text-success-900 dark:text-success-100 mb-2">Career Development</h4>
                <p className="text-sm text-success-700 dark:text-success-300">Implement clear career ladders. Employees with defined growth paths show 35% lower attrition.</p>
              </div>
              <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-100 dark:border-warning-800/50">
                <h4 className="font-medium text-warning-900 dark:text-warning-100 mb-2">Onboarding Enhancement</h4>
                <p className="text-sm text-warning-700 dark:text-warning-300">Extend onboarding programs and assign mentors. 90-day structured onboarding improves retention by 50%.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exit Analysis Tab */}
      {activeTab === 'exit-analysis' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="card-header">Turnover by Department</h3>
              {turnoverByDepartment.length > 0 ? (
                <BarChart data={turnoverByDepartment} xKey="department" bars={[{ key: 'rate', name: 'Turnover Rate %', color: CHART_COLORS[3] }]} height={280} />
              ) : (
                <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">No department turnover data available</div>
              )}
            </div>
            <div className="card">
              <h3 className="card-header">Exit Reasons</h3>
              {exitReasons.length > 0 ? (
                <PieChart data={exitReasons} height={280} innerRadius={50} />
              ) : (
                <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">No exit reason data available</div>
              )}
            </div>
          </div>

          {reasonsRes?.data && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="card-header">Reasons for Leaving (Detail)</h3>
                {(reasonsRes.data.overall?.length ?? 0) > 0 ? (
                  <>
                    <BarChart
                      data={reasonsRes.data.overall.slice(0, 10).map((r: any) => ({ name: r.reason, value: r.count }))}
                      xKey="name"
                      bars={[{ key: 'value', name: 'Count', color: CHART_COLORS[1] }]}
                      height={280}
                    />
                    <p className="text-xs text-gray-500 mt-2 text-center">{reasonsRes.data.total_departures ?? 0} total departures</p>
                  </>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">No data available</div>
                )}
              </div>
              <div className="card">
                <h3 className="card-header">Top Reason by Department</h3>
                {Object.keys(reasonsRes.data.by_department ?? {}).length > 0 ? (
                  <div className="overflow-auto max-h-[350px]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">Department</th>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">Top Reason</th>
                          <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">Count</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {Object.entries(reasonsRes.data.by_department).map(([dept, reasons]: [string, any]) => {
                          const top = reasons?.[0]
                          return top ? (
                            <tr key={dept} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                              <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white">{dept}</td>
                              <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{top.reason}</td>
                              <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-400">{top.count}</td>
                            </tr>
                          ) : null
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">No departmental data available</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Flight Risk Tab */}
      {activeTab === 'flight-risk' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Risk distribution */}
            <div className="card">
              <h3 className="card-header">Risk Distribution</h3>
              {totalRisk > 0 ? (
                <GaugeChart value={(lowRisk / totalRisk) * 100} label="Low Risk" color={CHART_COLORS[0]} size="small" />
              ) : (
                <div className="h-[120px] flex items-center justify-center text-gray-400 text-sm">No risk data available</div>
              )}
              <div className="grid grid-cols-3 gap-3 text-center mt-4">
                <div className="p-2.5 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-100 dark:border-success-800/50">
                  <p className="text-xl font-bold text-success-600 dark:text-success-400">{lowRisk}</p>
                  <p className="text-xs text-success-700 dark:text-success-300">Low Risk</p>
                </div>
                <div className="p-2.5 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-100 dark:border-warning-800/50">
                  <p className="text-xl font-bold text-warning-600 dark:text-warning-400">{mediumRisk}</p>
                  <p className="text-xs text-warning-700 dark:text-warning-300">Medium Risk</p>
                </div>
                <div className="p-2.5 bg-danger-50 dark:bg-danger-900/20 rounded-lg border border-danger-100 dark:border-danger-800/50">
                  <p className="text-xl font-bold text-danger-600 dark:text-danger-400">{highRisk}</p>
                  <p className="text-xs text-danger-700 dark:text-danger-300">High Risk</p>
                </div>
              </div>
            </div>

            {/* Risk by department bar */}
            <div className="card lg:col-span-2">
              <h3 className="card-header">Risk Score by Department</h3>
              {turnoverByDepartment.length > 0 ? (
                <BarChart
                  data={turnoverByDepartment.slice(0, 10)}
                  xKey="department"
                  bars={[{ key: 'rate', name: 'Turnover %', color: CHART_COLORS[3] }]}
                  height={220}
                />
              ) : (
                <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No data available</div>
              )}
            </div>
          </div>

          {/* Flight Risk Table */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="card-header mb-0">High Flight Risk Employees</h3>
                <p className="text-sm text-gray-500 mt-1">Employees flagged based on engagement, tenure, and performance signals</p>
              </div>
            </div>
            {flightRiskEmployees.length > 0 ? (
              <DataTable data={flightRiskEmployees} columns={flightRiskColumns} pageSize={10} />
            ) : (
              <div className="py-12 text-center text-gray-400 text-sm">No high flight risk employees found</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
