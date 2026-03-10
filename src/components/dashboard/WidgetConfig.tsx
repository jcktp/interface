import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { XMarkIcon } from '@heroicons/react/24/outline'
import api from '../../api'
import type { Widget, WidgetConfig as IWidgetConfig, WidgetType } from './types'

interface MetricDefinition {
  id: string
  name: string
  category: string
  is_system: boolean
  is_active: boolean
}

interface WidgetConfigProps {
  widget: Widget | null
  isOpen: boolean
  onClose: () => void
  onSave: (widget: Widget) => void
}

const TIME_PERIOD_OPTIONS = [
  { value: '', label: 'Default (all time)' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'last_12_months', label: 'Last 12 Months' },
]

const COMPARISON_OPTIONS = [
  { value: '', label: 'No comparison' },
  { value: 'wow', label: 'Week over Week (WoW)' },
  { value: 'mom', label: 'Month over Month (MoM)' },
  { value: 'qoq', label: 'Quarter over Quarter (QoQ)' },
  { value: 'yoy', label: 'Year over Year (YoY)' },
  { value: 'vs_target', label: 'vs. Target' },
  { value: 'vs_benchmark', label: 'vs. Industry Benchmark' },
]

const METRIC_CATEGORIES = [
  {
    label: 'Workforce',
    options: [
      { value: 'headcount', label: 'Total Headcount' },
      { value: 'active_employees', label: 'Active Employees' },
      { value: 'new_hires', label: 'New Hires (Last 30 Days)' },
      { value: 'new_hires_quarter', label: 'New Hires (This Quarter)' },
      { value: 'new_hires_year', label: 'New Hires (This Year)' },
      { value: 'avg_tenure', label: 'Average Tenure (Years)' },
      { value: 'avg_age', label: 'Average Age' },
      { value: 'full_time_count', label: 'Full-Time Employees' },
      { value: 'part_time_count', label: 'Part-Time Employees' },
      { value: 'contractor_count', label: 'Contractors' },
      { value: 'remote_percentage', label: 'Remote Work %' },
    ],
  },
  {
    label: 'Retention & Attrition',
    options: [
      { value: 'turnover_rate', label: 'Turnover Rate' },
      { value: 'voluntary_turnover', label: 'Voluntary Turnover Rate' },
      { value: 'involuntary_turnover', label: 'Involuntary Turnover Rate' },
      { value: 'retention_rate', label: 'Retention Rate' },
      { value: 'first_year_turnover', label: 'First-Year Turnover Rate' },
      { value: 'terminations_last_30', label: 'Terminations (Last 30 Days)' },
      { value: 'terminations_quarter', label: 'Terminations (This Quarter)' },
      { value: 'avg_tenure_terminated', label: 'Avg Tenure of Departed' },
    ],
  },
  {
    label: 'Recruitment',
    options: [
      { value: 'open_positions', label: 'Open Positions' },
      { value: 'active_candidates', label: 'Active Candidates' },
      { value: 'total_candidates', label: 'Total Candidates' },
      { value: 'offer_acceptance_rate', label: 'Offer Acceptance Rate' },
      { value: 'hired_count', label: 'Total Hired' },
      { value: 'pipeline_conversion', label: 'Pipeline Conversion Rate' },
      { value: 'avg_time_to_fill', label: 'Avg Time to Fill (Days)' },
      { value: 'cost_per_hire', label: 'Cost per Hire' },
    ],
  },
  {
    label: 'Compensation',
    options: [
      { value: 'avg_salary', label: 'Average Salary' },
      { value: 'median_salary', label: 'Median Salary' },
      { value: 'total_payroll', label: 'Total Payroll' },
      { value: 'avg_salary_increase', label: 'Avg Salary Increase %' },
      { value: 'compa_ratio', label: 'Compa-Ratio' },
      { value: 'revenue_per_employee', label: 'Revenue per Employee' },
      { value: 'profit_per_employee', label: 'Profit per Employee' },
    ],
  },
  {
    label: 'Engagement & Performance',
    options: [
      { value: 'engagement', label: 'Engagement Score' },
      { value: 'performance', label: 'Performance Rating' },
      { value: 'high_performers_pct', label: 'High Performers %' },
      { value: 'low_performers_pct', label: 'Low Performers %' },
      { value: 'flight_risk_count', label: 'Flight Risk Count' },
      { value: 'flight_risk_pct', label: 'Flight Risk %' },
    ],
  },
  {
    label: 'Diversity',
    options: [
      { value: 'gender_diversity_ratio', label: 'Gender Diversity Ratio' },
      { value: 'ethnic_diversity_index', label: 'Ethnic Diversity Index' },
      { value: 'women_in_leadership', label: 'Women in Leadership %' },
      { value: 'pay_equity_gap', label: 'Pay Equity Gap' },
    ],
  },
  {
    label: 'Attendance',
    options: [
      { value: 'attendance_rate', label: 'Attendance Rate' },
      { value: 'absence_rate', label: 'Absence Rate' },
      { value: 'avg_sick_days', label: 'Avg Sick Days' },
    ],
  },
]

const DATA_SOURCE_CATEGORIES = [
  {
    label: 'Headcount',
    options: [
      { value: 'headcount_by_department', label: 'Headcount by Department' },
      { value: 'headcount_by_location', label: 'Headcount by Location' },
      { value: 'headcount_by_level', label: 'Headcount by Job Level' },
      { value: 'headcount_by_type', label: 'Headcount by Employment Type' },
      { value: 'headcount_trend', label: 'Headcount Trend (Monthly)' },
      { value: 'headcount_by_age_group', label: 'Headcount by Age Group' },
      { value: 'headcount_by_tenure_band', label: 'Headcount by Tenure Band' },
      { value: 'new_hires_trend', label: 'New Hires Trend (Monthly)' },
      { value: 'remote_vs_onsite', label: 'Remote vs On-site Split' },
    ],
  },
  {
    label: 'Compensation',
    options: [
      { value: 'salary_by_department', label: 'Avg Salary by Department' },
      { value: 'salary_by_level', label: 'Avg Salary by Job Level' },
      { value: 'salary_by_location', label: 'Avg Salary by Location' },
      { value: 'salary_distribution', label: 'Salary Distribution (Bands)' },
      { value: 'payroll_trend', label: 'Total Payroll Trend (Monthly)' },
      { value: 'compa_ratio_by_department', label: 'Compa-Ratio by Department' },
    ],
  },
  {
    label: 'Recruitment',
    options: [
      { value: 'candidates_by_status', label: 'Candidates by Status' },
      { value: 'candidates_by_source', label: 'Candidates by Source' },
      { value: 'requisitions_by_department', label: 'Open Reqs by Department' },
      { value: 'requisitions_by_status', label: 'Requisitions by Status' },
      { value: 'hires_by_month', label: 'Hires by Month' },
      { value: 'source_effectiveness', label: 'Source Effectiveness (%)' },
      { value: 'time_to_fill_by_department', label: 'Time to Fill by Department' },
      { value: 'offer_acceptance_trend', label: 'Offer Acceptance Trend' },
      { value: 'pipeline_funnel', label: 'Hiring Pipeline Funnel' },
    ],
  },
  {
    label: 'Retention & Attrition',
    options: [
      { value: 'turnover_by_department', label: 'Turnover by Department' },
      { value: 'turnover_by_tenure', label: 'Turnover by Tenure Band' },
      { value: 'turnover_trend', label: 'Turnover Trend (Monthly)' },
      { value: 'termination_reasons', label: 'Termination Reasons' },
      { value: 'flight_risk_by_department', label: 'Flight Risk by Department' },
      { value: 'voluntary_vs_involuntary', label: 'Voluntary vs Involuntary Attrition' },
      { value: 'retention_rate_trend', label: 'Retention Rate Trend' },
    ],
  },
  {
    label: 'Diversity & Inclusion',
    options: [
      { value: 'gender_distribution', label: 'Gender Distribution' },
      { value: 'ethnicity_distribution', label: 'Ethnic Group Distribution' },
      { value: 'gender_by_department', label: 'Gender by Department' },
      { value: 'gender_by_level', label: 'Gender by Job Level' },
      { value: 'women_in_leadership_trend', label: 'Women in Leadership Trend' },
      { value: 'pay_gap_by_department', label: 'Pay Gap by Department' },
    ],
  },
  {
    label: 'Performance & Engagement',
    options: [
      { value: 'performance_distribution', label: 'Performance Rating Distribution' },
      { value: 'performance_by_department', label: 'Avg Performance by Department' },
      { value: 'engagement_by_department', label: 'Avg Engagement by Department' },
      { value: 'performance_trend', label: 'Performance Trend (Monthly)' },
      { value: 'engagement_trend', label: 'Engagement Trend (Monthly)' },
      { value: 'high_low_performers_by_dept', label: 'High vs Low Performers by Dept' },
    ],
  },
  {
    label: 'Attendance',
    options: [
      { value: 'attendance_by_department', label: 'Attendance Rate by Department' },
      { value: 'attendance_trend', label: 'Attendance Trend (Monthly)' },
      { value: 'absence_reasons', label: 'Absence Reasons Distribution' },
      { value: 'sick_days_by_department', label: 'Avg Sick Days by Department' },
    ],
  },
  {
    label: 'Custom',
    options: [
      { value: 'sql_query', label: 'Custom SQL Query' },
    ],
  },
]

const TABLE_DATA_CATEGORIES = [
  {
    label: 'People',
    options: [
      { value: 'employees', label: 'Employees' },
      { value: 'new_hires', label: 'Recent Hires' },
      { value: 'terminations', label: 'Recent Terminations' },
      { value: 'flight_risks', label: 'Flight Risk Employees' },
      { value: 'top_performers', label: 'Top Performers' },
      { value: 'upcoming_anniversaries', label: 'Upcoming Anniversaries' },
    ],
  },
  {
    label: 'Recruitment',
    options: [
      { value: 'open_requisitions', label: 'Open Requisitions' },
      { value: 'candidates_pipeline', label: 'Candidates in Pipeline' },
      { value: 'recent_offers', label: 'Recent Offers' },
    ],
  },
  {
    label: 'Custom',
    options: [
      { value: 'sql_query', label: 'Custom SQL Query' },
    ],
  },
]

const GAUGE_CATEGORIES = [
  {
    label: 'Engagement & Performance',
    options: [
      { value: 'engagement', label: 'Engagement Score' },
      { value: 'performance', label: 'Performance Rating' },
      { value: 'eNPS', label: 'Employee Net Promoter Score' },
    ],
  },
  {
    label: 'Workforce Health',
    options: [
      { value: 'retention_rate', label: 'Retention Rate' },
      { value: 'attendance_rate', label: 'Attendance Rate' },
      { value: 'goal_attainment', label: 'Goal Attainment %' },
      { value: 'diversity_index', label: 'Diversity Index' },
      { value: 'offer_acceptance_rate', label: 'Offer Acceptance Rate' },
    ],
  },
]

const WIDGET_TYPE_OPTIONS: { value: WidgetType; label: string }[] = [
  { value: 'metric', label: 'Metric Card' },
  { value: 'bar', label: 'Bar Chart' },
  { value: 'line', label: 'Line Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'table', label: 'Table' },
  { value: 'gauge', label: 'Gauge' },
  { value: 'sql', label: 'SQL Query' },
]

function getDefaultConfigForType(type: WidgetType): IWidgetConfig {
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

export default function WidgetConfig({ widget, isOpen, onClose, onSave }: WidgetConfigProps) {
  const [title, setTitle] = useState('')
  const [widgetType, setWidgetType] = useState<WidgetType>('metric')
  const [config, setConfig] = useState<IWidgetConfig>({})
  const [limitInput, setLimitInput] = useState<string>('10')
  const [queryPreview, setQueryPreview] = useState<{ columns: string[]; rows: Record<string, any>[] } | null>(null)
  const [queryLoading, setQueryLoading] = useState(false)
  const [queryError, setQueryError] = useState<string | null>(null)

  // Load custom metric definitions
  const { data: customMetrics } = useQuery<MetricDefinition[]>({
    queryKey: ['metricDefinitions'],
    queryFn: async () => {
      const res = await api.get('/metrics/definitions')
      const d = res.data
      return (d.data || d.definitions || (Array.isArray(d) ? d : [])) as MetricDefinition[]
    },
    staleTime: 60000,
  })

  // Re-initialize form state whenever the modal opens or the widget changes
  useEffect(() => {
    if (isOpen && widget) {
      setTitle(widget.title)
      setWidgetType(widget.type)
      setConfig({ ...widget.config })
      setLimitInput(String(widget.config.limit || 10))
      setQueryPreview(null)
      setQueryError(null)
    }
  }, [isOpen, widget])

  const handleTypeChange = (newType: WidgetType) => {
    setWidgetType(newType)
    // Reset config to defaults for the new type, preserving department filter if present
    const currentDepartment = config.department
    const newConfig = getDefaultConfigForType(newType)
    if (currentDepartment) {
      newConfig.department = currentDepartment
    }
    setConfig(newConfig)
    if (newConfig.limit !== undefined) {
      setLimitInput(String(newConfig.limit))
    }
  }

  const handleSave = () => {
    if (widget) {
      onSave({
        ...widget,
        type: widgetType,
        title,
        config,
      })
    }
    onClose()
  }

  const handleRunQuery = async () => {
    if (!config.sql_query) return
    setQueryLoading(true)
    setQueryError(null)
    setQueryPreview(null)
    try {
      const response = await api.post('/queries/execute', { sql: config.sql_query })
      setQueryPreview(response.data)
    } catch (err: any) {
      setQueryError(err.response?.data?.detail || err.message || 'Query execution failed')
    } finally {
      setQueryLoading(false)
    }
  }

  const renderSQLFields = () => (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700">Saved Query Name</label>
        <input
          type="text"
          value={config.saved_query_id || ''}
          onChange={(e) => setConfig({ ...config, saved_query_id: e.target.value })}
          className="input mt-1"
          placeholder="Optional: name to save this query as"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">SQL Query</label>
        <textarea
          value={config.sql_query || ''}
          onChange={(e) => setConfig({ ...config, sql_query: e.target.value })}
          className="input mt-1 font-mono text-sm"
          rows={8}
          placeholder="SELECT * FROM employees LIMIT 10"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleRunQuery}
          disabled={queryLoading || !config.sql_query}
          className="btn-secondary inline-flex items-center gap-2 text-sm"
        >
          {queryLoading ? (
            <div className="animate-spin h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full" />
          ) : null}
          Run Query
        </button>
        {queryLoading && <span className="text-sm text-gray-500">Executing...</span>}
      </div>
      <p className="text-xs text-gray-500">Query will run against your data warehouse</p>
      {queryError && (
        <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded p-3">
          {queryError}
        </div>
      )}
      {queryPreview && (
        <div className="overflow-auto max-h-48 border border-gray-200 rounded text-xs">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {queryPreview.columns.map((col) => (
                  <th key={col} className="px-2 py-1 text-left font-medium text-gray-500 uppercase">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {queryPreview.rows.slice(0, 5).map((row, i) => (
                <tr key={i}>
                  {queryPreview.columns.map((col) => (
                    <td key={col} className="px-2 py-1 text-gray-700 whitespace-nowrap">
                      {row[col] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )

  if (!isOpen || !widget) return null

  const renderConfigFields = () => {
    switch (widgetType) {
      case 'metric': {
        const userCustomMetrics = (customMetrics || []).filter((m) => !m.is_system && m.is_active)
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700">Metric</label>
            <select
              value={config.metric || 'headcount'}
              onChange={(e) => setConfig({ ...config, metric: e.target.value })}
              className="input mt-1"
            >
              {METRIC_CATEGORIES.map((cat) => (
                <optgroup key={cat.label} label={cat.label}>
                  {cat.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </optgroup>
              ))}
              {userCustomMetrics.length > 0 && (
                <optgroup label="Custom Metrics">
                  {userCustomMetrics.map((m) => (
                    <option key={`custom:${m.id}`} value={`custom:${m.id}`}>{m.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        )
      }

      case 'bar':
      case 'line':
      case 'area':
      case 'pie':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Data Source</label>
              <select
                value={config.data_source || 'headcount_by_department'}
                onChange={(e) => setConfig({ ...config, data_source: e.target.value })}
                className="input mt-1"
              >
                {DATA_SOURCE_CATEGORIES.map((cat) => (
                  <optgroup key={cat.label} label={cat.label}>
                    {cat.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            {config.data_source === 'sql_query' && renderSQLFields()}
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.showLegend !== false}
                  onChange={(e) => setConfig({ ...config, showLegend: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600"
                />
                <span className="text-sm text-gray-700">Show Legend</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.showGrid !== false}
                  onChange={(e) => setConfig({ ...config, showGrid: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600"
                />
                <span className="text-sm text-gray-700">Show Grid</span>
              </label>
            </div>
          </>
        )

      case 'table':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Data Source</label>
              <select
                value={config.data_source || 'employees'}
                onChange={(e) => setConfig({ ...config, data_source: e.target.value })}
                className="input mt-1"
              >
                {TABLE_DATA_CATEGORIES.map((cat) => (
                  <optgroup key={cat.label} label={cat.label}>
                    {cat.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            {config.data_source === 'sql_query' && renderSQLFields()}
            <div>
              <label className="block text-sm font-medium text-gray-700">Row Limit</label>
              <input
                type="number"
                value={limitInput}
                onChange={(e) => {
                  setLimitInput(e.target.value)
                  setConfig({ ...config, limit: parseInt(e.target.value) || 10 })
                }}
                className="input mt-1"
                min={1}
                max={100}
              />
            </div>
          </>
        )

      case 'gauge':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700">Metric</label>
            <select
              value={config.metric || 'engagement'}
              onChange={(e) => setConfig({ ...config, metric: e.target.value })}
              className="input mt-1"
            >
              {GAUGE_CATEGORIES.map((cat) => (
                <optgroup key={cat.label} label={cat.label}>
                  {cat.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )

      case 'sql':
        return renderSQLFields()

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] flex flex-col pointer-events-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Configure Widget</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input mt-1"
              placeholder="Widget title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Widget Type</label>
            <select
              value={widgetType}
              onChange={(e) => handleTypeChange(e.target.value as WidgetType)}
              className="input mt-1"
            >
              {WIDGET_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {renderConfigFields()}

          {/* ── Filters ── */}
          <div className="pt-3 border-t border-gray-100">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Filters & Comparison</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Time Period</label>
                <select
                  value={config.time_period || ''}
                  onChange={(e) => setConfig({ ...config, time_period: e.target.value || undefined })}
                  className="input mt-1"
                >
                  {TIME_PERIOD_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Comparison</label>
                <select
                  value={config.comparison || ''}
                  onChange={(e) => setConfig({ ...config, comparison: e.target.value || undefined })}
                  className="input mt-1"
                >
                  {COMPARISON_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {config.comparison && config.comparison !== 'vs_target' && config.comparison !== 'vs_benchmark' && (
                  <p className="text-xs text-gray-500 mt-1">
                    {config.comparison === 'wow' && 'Shows current week vs previous week'}
                    {config.comparison === 'mom' && 'Shows current month vs previous month'}
                    {config.comparison === 'qoq' && 'Shows current quarter vs previous quarter'}
                    {config.comparison === 'yoy' && 'Shows current period vs same period last year'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Department Filter</label>
                <input
                  type="text"
                  value={config.department || ''}
                  onChange={(e) => setConfig({ ...config, department: e.target.value || undefined })}
                  className="input mt-1"
                  placeholder="e.g. Engineering (leave blank for all)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Location Filter</label>
                <input
                  type="text"
                  value={config.location || ''}
                  onChange={(e) => setConfig({ ...config, location: e.target.value || undefined })}
                  className="input mt-1"
                  placeholder="e.g. New York (leave blank for all)"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
