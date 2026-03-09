import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import toast from 'react-hot-toast'
import api from '../api'
import { CHART_COLORS, formatChartLabel } from '../utils/chartColors'
import { useLocalization } from '../hooks/useLocalization'
import clsx from 'clsx'
import {
  FunnelIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

const METRICS = [
  { value: 'engagement', label: 'Engagement Score' },
  { value: 'performance', label: 'Performance Rating' },
  { value: 'salary', label: 'Salary' },
  { value: 'attrition', label: 'Attrition Rate' },
  { value: 'headcount', label: 'Headcount' },
  { value: 'tenure', label: 'Tenure' },
  { value: 'age', label: 'Age' },
]

export default function DeepDive() {
  const loc = useLocalization()
  const [searchParams] = useSearchParams()
  const [metric, setMetric] = useState(searchParams.get('metric') || 'engagement')
  const [department, setDepartment] = useState(searchParams.get('department') || '')
  const [location, setLocation] = useState(searchParams.get('location') || '')
  const [comparisonMode, setComparisonMode] = useState(false)
  
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const alertId = searchParams.get('alert_id')

  // Fetch options from the database
  const [departments, setDepartments] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [metaLoading, setMetaLoading] = useState(true)

  useEffect(() => {
    async function fetchMetadata() {
      setMetaLoading(true)
      try {
        const [deptRes, locRes] = await Promise.all([
          api.get('/employees/departments'),
          api.get('/employees/locations')
        ])
        setDepartments(deptRes.data?.departments ?? [])
        setLocations(locRes.data?.locations ?? [])
      } catch (err) {
        console.error('Failed to fetch metadata:', err)
      } finally {
        setMetaLoading(false)
      }
    }
    fetchMetadata()
  }, [])

  const runAnalysis = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { metric }
      if (alertId) params.alert_id = alertId
      if (department) params.department = department
      if (location) params.location = location
      
      const res = await api.get('/deep-dive/analyze', { params })
      setAnalysis(res.data)
      if (res.data.metric && res.data.metric !== metric) {
        setMetric(res.data.metric)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.message || 'Failed to load analysis')
    } finally {
      setLoading(false)
    }
  }, [metric, department, location, alertId])

  useEffect(() => {
    runAnalysis()
  }, [runAnalysis])

  if (metaLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 bg-gray-200 animate-pulse rounded-xl w-1/3" />
        <div className="h-16 bg-gray-100 animate-pulse rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-72" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deep Dive Analysis</h1>
          <p className="text-sm text-gray-500 mt-1">
            {analysis?.alert_context
              ? `Investigating: ${analysis.alert_context.title}`
              : 'Drill down into organizational metrics'}
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors">
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Metric:</span>
          <select value={metric} onChange={e => setMetric(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400">
            {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Department:</span>
          <select value={department} onChange={e => setDepartment(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400 min-w-[150px]">
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Location:</span>
          <select value={location} onChange={e => setLocation(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400 min-w-[150px]">
            <option value="">All Locations</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="flex-1"></div>

        <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Comparison Mode:</span>
          <button 
            onClick={() => setComparisonMode(!comparisonMode)}
            className={clsx(
              "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2",
              comparisonMode ? "bg-slate-900" : "bg-gray-200"
            )}
          >
            <span className={clsx(
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
              comparisonMode ? "translate-x-5" : "translate-x-0"
            )} />
          </button>
        </div>
      </div>

      {analysis?.alert_context && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              analysis.alert_context.severity === 'critical' ? 'bg-red-100 text-red-700' :
              analysis.alert_context.severity === 'high' ? 'bg-orange-100 text-orange-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>{analysis.alert_context.severity}</span>
            <h3 className="text-sm font-semibold text-amber-800">{analysis.alert_context.title}</h3>
          </div>
          <p className="text-sm text-amber-700 mt-1">{analysis.alert_context.description}</p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-72" />
          ))}
        </div>
      ) : analysis ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
          {/* Statistical Distribution Profile */}
          {analysis.distribution_stats && Object.keys(analysis.distribution_stats).length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 lg:col-span-2 shadow-sm border-l-4 border-l-slate-900">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Statistical Distribution Profile</h3>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {[
                  { label: 'Min', value: analysis.distribution_stats.min },
                  { label: 'P25', value: analysis.distribution_stats.p25 },
                  { label: 'Median', value: analysis.distribution_stats.median, highlight: true },
                  { label: 'P75', value: analysis.distribution_stats.p75 },
                  { label: 'Max', value: analysis.distribution_stats.max },
                  { label: 'Std Dev', value: analysis.distribution_stats.std_dev, sub: true },
                ].map((stat) => (
                  <div key={stat.label} className={clsx(
                    "p-3 rounded-lg text-center",
                    stat.highlight ? "bg-slate-900 border border-slate-800" : "bg-gray-50 dark:bg-gray-700/50"
                  )}>
                    <p className={clsx("text-[10px] uppercase font-bold tracking-wider", stat.highlight ? "text-slate-300" : "text-gray-500 dark:text-gray-400")}>{stat.label}</p>
                    <p className={clsx(
                      "text-xl font-black mt-1",
                      stat.highlight ? "text-white" : "text-gray-900 dark:text-white"
                    )}>{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cross-Tabulation: Metric by Tenure Segment */}
          {analysis.cross_tabulation?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Segment Analysis: By Tenure Bucket</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.cross_tabulation} layout="vertical" margin={{ left: 20, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="segment" type="category" tick={{ fontSize: 11 }} width={60} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} barSize={30}>
                      <LabelList dataKey="value" position="right" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {analysis.by_department?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">By Department</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.by_department} margin={{ top: 25, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="avg_value" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} name="Average">
                      {analysis.by_department.length <= 12 && (
                        <LabelList dataKey="avg_value" position="top" fontSize={11} fill="#64748b" formatter={formatChartLabel} />
                      )}
                    </Bar>
                    <Bar dataKey="count" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} name="Count">
                      {analysis.by_department.length <= 12 && (
                        <LabelList dataKey="count" position="top" fontSize={11} fill="#64748b" formatter={formatChartLabel} />
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {analysis.by_location?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">By Location</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.by_location} margin={{ top: 25, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="avg_value" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} name="Average">
                      {analysis.by_location.length <= 12 && (
                        <LabelList dataKey="avg_value" position="top" fontSize={11} fill="#64748b" formatter={formatChartLabel} />
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {analysis.trend?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">12-Month Trend</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analysis.trend} margin={{ top: 25, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke={CHART_COLORS[1]} strokeWidth={2} dot={{ r: 3 }}>
                      {analysis.trend.length <= 12 && (
                        <LabelList dataKey="value" position="top" fontSize={11} fill="#64748b" formatter={formatChartLabel} />
                      )}
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {analysis.contributing_factors?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Contributing Factors</h3>
              <div className="space-y-4">
                {analysis.contributing_factors.map((factor: any, i: number) => (
                  <div key={i}>
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{factor.factor}</h4>
                    {Array.isArray(factor.data) ? (
                      <div className="space-y-1">
                        {factor.data.map((item: any, j: number) => (
                          <div key={j} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{item.label}</span>
                            <span className="font-medium text-gray-900">{item.count} employees</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {Object.entries(factor.data).map(([key, val]: [string, any]) => (
                          <div key={key}>
                            <span className="text-gray-500">{key.replace(/_/g, ' ')}: </span>
                            <span className="font-medium">{typeof val === 'number' ? loc.number(val) : val}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.summary && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Summary Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(analysis.summary).map(([key, val]: [string, any]) => (
                  <div key={key} className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">
                      {typeof val === 'number' ? loc.number(val, { maximumFractionDigits: 2 }) : val}
                    </p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">{key.replace(/_/g, ' ')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.correlations?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Metric Correlations</h3>
              <div className="space-y-3">
                {analysis.correlations.map((corr: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{corr.metric}</div>
                      <div className="text-xs text-gray-500">{corr.strength} {corr.direction} Correlation</div>
                    </div>
                    <div className={clsx(
                      "text-sm font-bold",
                      corr.r > 0 ? "text-success-600" : "text-danger-600"
                    )}>
                      {corr.r > 0 ? '+' : ''}{corr.r}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.heatmap?.data?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Distribution Heatmap (%)</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-[11px]">
                  <thead>
                    <tr>
                      <th className="text-left pb-2 text-gray-400 font-medium">Department</th>
                      {analysis.heatmap.x_labels.map((label: string) => (
                        <th key={label} className="text-center pb-2 text-gray-400 font-medium px-1">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {analysis.heatmap.data.map((row: any, i: number) => (
                      <tr key={i}>
                        <td className="py-2 pr-2 font-medium text-gray-700">{row.name}</td>
                        {analysis.heatmap.x_labels.map((label: string) => {
                          const val = row[label]
                          return (
                            <td key={label} className="py-2 px-1 text-center">
                              <div 
                                className="py-1.5 rounded font-bold"
                                style={{
                                  backgroundColor: `rgba(79, 70, 229, ${Math.min(0.9, val / 50 + 0.05)})`,
                                  color: val > 25 ? 'white' : '#4f46e5'
                                }}
                              >
                                {val}%
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
