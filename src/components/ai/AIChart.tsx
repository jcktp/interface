import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts'
import { formatChartLabel } from '../../utils/chartColors'

function formatXTick(value: unknown): string {
  if (typeof value !== 'string') return String(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = new Date(value)
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
  return value
}

interface ChartConfig {
  type: 'bar' | 'line' | 'pie'
  xKey?: string
  yKeys?: string[]
  nameKey?: string
  valueKey?: string
  title?: string
}

interface AIChartProps {
  config: ChartConfig
  data: Record<string, any>[]
}

const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

export default function AIChart({ config, data }: AIChartProps) {
  if (!data || data.length === 0) return null

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mt-3">
      {config.title && <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">{config.title}</h4>}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {config.type === 'bar' ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey={config.xKey} tick={{ fontSize: 11 }} tickFormatter={formatXTick} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {(config.yKeys || []).map((key, i) => (
                <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]}>
                  {data.length <= 12 && (
                    <LabelList dataKey={key} position="top" fontSize={11} fill="#64748b" formatter={formatChartLabel} />
                  )}
                </Bar>
              ))}
            </BarChart>
          ) : config.type === 'line' ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey={config.xKey} tick={{ fontSize: 11 }} tickFormatter={formatXTick} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {(config.yKeys || []).map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={data.length <= 12}>
                  {data.length <= 12 && (
                    <LabelList dataKey={key} position="top" fontSize={11} fill="#64748b" formatter={formatChartLabel} />
                  )}
                </Line>
              ))}
            </LineChart>
          ) : (
            <PieChart>
              <Pie
                data={data}
                dataKey={config.valueKey || 'value'}
                nameKey={config.nameKey || 'name'}
                cx="50%"
                cy="45%"
                outerRadius={80}
                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
                  if (percent < 0.05) return null
                  const RADIAN = Math.PI / 180
                  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
                  const x = cx + radius * Math.cos(-midAngle * RADIAN)
                  const y = cy + radius * Math.sin(-midAngle * RADIAN)
                  return (
                    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
                      {`${(percent * 100).toFixed(0)}%`}
                    </text>
                  )
                }}
                labelLine={false}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
