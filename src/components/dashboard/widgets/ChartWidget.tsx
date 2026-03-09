import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts'
import { formatChartLabel } from '../../../utils/chartColors'
import type { WidgetData, WidgetConfig, WidgetType } from '../types'

interface ChartWidgetProps {
  type: WidgetType
  data: WidgetData
  config: WidgetConfig
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1',
]

export default function ChartWidget({ type, data, config }: ChartWidgetProps) {
  const labels = data.labels || []
  const datasets = data.datasets || []

  if (labels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No data to display
      </div>
    )
  }

  // Transform data for recharts
  const chartData = labels.map((label, index) => {
    const point: Record<string, any> = { name: label }
    datasets.forEach((dataset) => {
      point[dataset.label] = dataset.data[index]
    })
    return point
  })

  const showLegend = config.showLegend !== false
  const showGrid = config.showGrid !== false

  if (type === 'pie') {
    const pieData = labels.map((label, index) => ({
      name: label,
      value: datasets[0]?.data[index] || 0,
    }))

    const renderInsideLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
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
    }

    return (
      <div style={{ overflow: 'hidden', width: '100%', height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy={showLegend ? '45%' : '50%'}
              outerRadius="70%"
              label={renderInsideLabel}
              labelLine={false}
            >
              {pieData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            {showLegend && <Legend wrapperStyle={{ fontSize: '11px' }} />}
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
          <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} />
          <Tooltip />
          {showLegend && <Legend />}
          {datasets.map((dataset, index) => (
            <Line
              key={dataset.label}
              type="monotone"
              dataKey={dataset.label}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
              dot={chartData.length <= 12}
            >
              {chartData.length <= 12 && (
                <LabelList dataKey={dataset.label} position="top" fontSize={11} fill="#64748b" formatter={formatChartLabel} />
              )}
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'area') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
          <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} />
          <Tooltip />
          {showLegend && <Legend />}
          {datasets.map((dataset, index) => (
            <Area
              key={dataset.label}
              type="monotone"
              dataKey={dataset.label}
              stroke={COLORS[index % COLORS.length]}
              fill={COLORS[index % COLORS.length]}
              fillOpacity={0.3}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  // Default: bar chart
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} />
        <Tooltip />
        {showLegend && <Legend />}
        {datasets.map((dataset, index) => (
          <Bar
            key={dataset.label}
            dataKey={dataset.label}
            fill={COLORS[index % COLORS.length]}
            radius={[4, 4, 0, 0]}
          >
            {chartData.length <= 12 && (
              <LabelList dataKey={dataset.label} position="top" fontSize={11} fill="#64748b" formatter={formatChartLabel} />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
