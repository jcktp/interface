import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api'
import { usePageFilters } from '../hooks/usePageFilters'
import PageFilterBar from '../components/PageFilterBar'
import MetricCard from '../components/MetricCard'
import BarChart from '../components/charts/BarChart'
import PieChart from '../components/charts/PieChart'
import { CHART_COLORS } from '../utils/chartColors'
import {
  SparklesIcon,
  UserGroupIcon,
  ScaleIcon,
  ArrowTrendingUpIcon,
  MagnifyingGlassIcon,
  BuildingOfficeIcon,
  UsersIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import DataSourceSelector from '../components/DataSourceSelector'
import AIInsightsPanel from '../components/AIInsightsPanel'
import clsx from 'clsx'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

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

interface BreakdownRow {
  name: string
  headcount: number
  women_pct: number
  women_count: number
  minority_pct: number
  minority_count: number
  pay_gap: number
}

function BreakdownTable({ rows, loading }: { rows: BreakdownRow[]; loading: boolean }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() =>
    rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase())),
    [rows, search]
  )

  return (
    <div className="space-y-3">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">No results found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-700">
                <th className="text-left py-2 pr-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400 whitespace-nowrap">Name</th>
                <th className="text-right py-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">HC</th>
                <th className="text-right py-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 whitespace-nowrap">Women %</th>
                <th className="text-right py-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 whitespace-nowrap">Minority %</th>
                <th className="text-right py-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 whitespace-nowrap">Pay Gap</th>
                <th className="py-2 pl-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 w-32">Women bar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i} className="border-b border-slate-50 dark:border-gray-800 hover:bg-slate-50/60 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-200 max-w-[200px] truncate">{row.name}</td>
                  <td className="py-2.5 px-3 text-right text-gray-600 dark:text-gray-400 tabular-nums">{row.headcount}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    <span className={clsx(
                      'font-medium',
                      row.women_pct >= 40 ? 'text-green-600 dark:text-green-400' :
                      row.women_pct >= 30 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    )}>{row.women_pct}%</span>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    <span className={clsx(
                      'font-medium',
                      row.minority_pct >= 30 ? 'text-green-600 dark:text-green-400' :
                      row.minority_pct >= 20 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    )}>{row.minority_pct}%</span>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    <span className={clsx(
                      'font-medium',
                      row.pay_gap <= 2 ? 'text-green-600 dark:text-green-400' :
                      row.pay_gap <= 5 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    )}>{row.pay_gap > 0 ? `+${row.pay_gap}%` : `${row.pay_gap}%`}</span>
                  </td>
                  <td className="py-2.5 pl-3">
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                      <div
                        className={clsx(
                          'h-1.5 rounded-full transition-all',
                          row.women_pct >= 40 ? 'bg-green-500' :
                          row.women_pct >= 30 ? 'bg-yellow-500' : 'bg-red-400'
                        )}
                        style={{ width: `${Math.min(row.women_pct, 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function Diversity() {
  const [dataSource, setDataSource] = useState('live-api')
  const [activeTab, setActiveTab] = useState<'overview' | 'breakdown' | 'trends'>('overview')
  const [breakdownView, setBreakdownView] = useState<'departments' | 'teams' | 'managers'>('departments')
  const { department, setDepartment, location, setLocation, timePeriod, setTimePeriod, filterParams, hasFilters, resetFilters } = usePageFilters()

  const { data: metricsRes, isLoading } = useQuery({
    queryKey: ['diversity-metrics', filterParams],
    queryFn: async () => {
      const res = await api.get('/metrics/diversity', { params: filterParams })
      return res.data
    },
  })

  const { data: breakdownRes, isLoading: breakdownLoading } = useQuery({
    queryKey: ['diversity-breakdown', filterParams],
    queryFn: async () => {
      const res = await api.get('/metrics/diversity/breakdown', {
        params: { departments: filterParams.departments, locations: filterParams.locations }
      })
      return res.data
    },
    enabled: activeTab === 'breakdown',
  })

  const { data: trendsRes, isLoading: trendsLoading } = useQuery({
    queryKey: ['diversity-trends', filterParams],
    queryFn: async () => {
      const months = (() => {
        if (!filterParams.start_date || !filterParams.end_date) return 12
        const diff = new Date(filterParams.end_date).getTime() - new Date(filterParams.start_date).getTime()
        return Math.min(24, Math.max(3, Math.round(diff / (1000 * 60 * 60 * 24 * 30))))
      })()
      const res = await api.get('/metrics/diversity/trends', {
        params: { months, departments: filterParams.departments, locations: filterParams.locations }
      })
      return res.data
    },
    enabled: activeTab === 'trends',
  })

  const metrics = metricsRes?.data || {
    womenPct: '0',
    underrepPct: '0',
    overallPayGap: 0,
    totalEmployees: 0,
    genderDistribution: [],
    ethnicityDistribution: [],
    ageDistribution: [],
    payGapByLevel: [],
    diversityByDept: [],
  }

  const breakdown = breakdownRes?.data || { departments: [], teams: [], managers: [] }
  const trends: any[] = trendsRes?.data || []

  const tabs = [
    { id: 'overview', label: 'Overview', icon: ChartBarIcon },
    { id: 'breakdown', label: 'Breakdown', icon: BuildingOfficeIcon },
    { id: 'trends', label: 'Trends', icon: ArrowTrendingUpIcon },
  ] as const

  const breakdownTabs = [
    { id: 'departments', label: 'Departments', icon: BuildingOfficeIcon },
    { id: 'teams', label: 'Teams', icon: UsersIcon },
    { id: 'managers', label: 'Managers', icon: UserGroupIcon },
  ] as const

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Diversity & Inclusion</h2>
          <p className="text-sm text-gray-500">Workforce diversity metrics and pay equity analysis</p>
        </div>
        <DataSourceSelector module="Diversity" selectedSource={dataSource} onSourceChange={setDataSource} compact />
      </div>

      <PageFilterBar
        department={department} setDepartment={setDepartment}
        location={location} setLocation={setLocation}
        timePeriod={timePeriod} setTimePeriod={setTimePeriod}
        hasFilters={hasFilters} resetFilters={resetFilters}
      />

      <AIInsightsPanel
        pageContext="Diversity & Inclusion"
        prompt="Analyse the diversity and inclusion metrics including gender representation, ethnic diversity, women in leadership percentages, and pay equity gaps. Identify where the organisation is leading and where critical gaps exist. Provide 3-5 specific, data-driven recommendations to improve D&I outcomes."
      />

      {/* Key Metrics — always visible */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Women in Workforce" value={`${metrics.womenPct}%`} trend="up" icon={<UserGroupIcon className="w-6 h-6" />} />
          <MetricCard title="Underrepresented Groups" value={`${metrics.underrepPct}%`} trend="up" icon={<SparklesIcon className="w-6 h-6" />} />
          <MetricCard title="Gender Pay Gap" value={`${metrics.overallPayGap}%`} subtitle="Men vs Women" icon={<ScaleIcon className="w-6 h-6" />} />
          <MetricCard title="Total Active" value={metrics.totalEmployees} icon={<ArrowTrendingUpIcon className="w-6 h-6" />} />
        </div>
      )}

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
          {/* DEI Insights */}
          <div className="card">
            <h3 className="card-header">DEI Insights & Recommendations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-100 dark:border-primary-800/50">
                <h4 className="font-medium text-primary-900 dark:text-primary-100 mb-2">Gender Representation</h4>
                <p className="text-sm text-primary-700 dark:text-primary-300">
                  Women make up {metrics.womenPct}% of the workforce.
                  {parseFloat(metrics.womenPct) < 40
                    ? ' Consider targeted hiring programs to improve gender balance.'
                    : ' Gender representation is progressing well.'}
                </p>
              </div>
              <div className="p-4 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-100 dark:border-success-800/50">
                <h4 className="font-medium text-success-900 dark:text-success-100 mb-2">Ethnic Diversity</h4>
                <p className="text-sm text-success-700 dark:text-success-300">
                  Underrepresented groups comprise {metrics.underrepPct}% of employees.
                  {parseFloat(metrics.underrepPct) < 30
                    ? ' Expand sourcing channels and partner with diverse organizations.'
                    : ' Diversity initiatives are showing results.'}
                </p>
              </div>
              <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-100 dark:border-warning-800/50">
                <h4 className="font-medium text-warning-900 dark:text-warning-100 mb-2">Pay Equity</h4>
                <p className="text-sm text-warning-700 dark:text-warning-300">
                  {metrics.overallPayGap > 0
                    ? `Overall gender pay gap is ${metrics.overallPayGap}%. Conduct compensation reviews for roles with the largest gaps.`
                    : 'Pay equity is well-balanced across genders.'}
                </p>
              </div>
            </div>
          </div>

          {/* Distribution Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card">
              <h3 className="card-header">Gender Distribution</h3>
              {metrics.genderDistribution.length > 0 ? (
                <PieChart data={metrics.genderDistribution} height={280} innerRadius={50} />
              ) : (
                <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">No data available</div>
              )}
            </div>
            <div className="card">
              <h3 className="card-header">Ethnicity Distribution</h3>
              {metrics.ethnicityDistribution.length > 0 ? (
                <PieChart data={metrics.ethnicityDistribution} height={280} innerRadius={50} />
              ) : (
                <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">No data available</div>
              )}
            </div>
            <div className="card">
              <h3 className="card-header">Age Distribution</h3>
              {metrics.ageDistribution.some((d: any) => d.value > 0) ? (
                <PieChart data={metrics.ageDistribution.filter((d: any) => d.value > 0)} height={280} innerRadius={50} />
              ) : (
                <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">No data available</div>
              )}
            </div>
          </div>

          {/* Pay Gap & Dept Bar Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="card-header">Gender Pay Gap by Level</h3>
              <p className="text-sm text-gray-500 mb-4">Percentage difference in compensation (men vs women)</p>
              {metrics.payGapByLevel.length > 0 ? (
                <BarChart
                  data={metrics.payGapByLevel}
                  xKey="level"
                  bars={[{ key: 'gap', name: 'Pay Gap %', color: CHART_COLORS[3] }]}
                  height={280}
                />
              ) : (
                <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">Insufficient salary data</div>
              )}
            </div>
            <div className="card">
              <h3 className="card-header">Women % by Department</h3>
              {metrics.diversityByDept.length > 0 ? (
                <BarChart
                  data={metrics.diversityByDept}
                  xKey="department"
                  bars={[{ key: 'women', name: 'Women %', color: CHART_COLORS[1] }]}
                  height={280}
                />
              ) : (
                <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">No data available</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Breakdown Tab */}
      {activeTab === 'breakdown' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Diversity by Org Level</h3>
            <div className="flex gap-1 bg-slate-100 dark:bg-gray-800 rounded-lg p-1">
              {breakdownTabs.map(bt => (
                <button
                  key={bt.id}
                  onClick={() => setBreakdownView(bt.id)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    breakdownView === bt.id
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  )}
                >
                  <bt.icon className="w-3.5 h-3.5" />
                  {bt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
            {breakdownView === 'departments' && `${breakdown.departments.length} departments`}
            {breakdownView === 'teams' && `${breakdown.teams.length} teams`}
            {breakdownView === 'managers' && `${breakdown.managers.length} managers`}
          </div>

          <BreakdownTable
            rows={
              breakdownView === 'departments' ? breakdown.departments :
              breakdownView === 'teams' ? breakdown.teams :
              breakdown.managers
            }
            loading={breakdownLoading}
          />
        </div>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          {trendsLoading ? (
            <SkeletonChart />
          ) : trends.length === 0 ? (
            <div className="card h-64 flex items-center justify-center text-gray-400 text-sm">No trend data available</div>
          ) : (
            <>
              {/* Women % trend */}
              <div className="card">
                <h3 className="card-header">Women % Over Time</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} width={40} />
                    <Tooltip formatter={(v: number) => [`${v}%`]} />
                    <Legend />
                    <Line type="monotone" dataKey="women_pct" name="Women %" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="minority_pct" name="Minority %" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Pay Gap trend */}
              <div className="card">
                <h3 className="card-header">Gender Pay Gap Over Time</h3>
                <p className="text-sm text-gray-500 mb-4">% difference in average salary (men vs women)</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} width={40} />
                    <Tooltip formatter={(v: number) => [`${v}%`]} />
                    <Line type="monotone" dataKey="pay_gap" name="Pay Gap %" stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Headcount trend */}
              <div className="card">
                <h3 className="card-header">Headcount Over Time</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={50} />
                    <Tooltip />
                    <Line type="monotone" dataKey="headcount" name="Headcount" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
