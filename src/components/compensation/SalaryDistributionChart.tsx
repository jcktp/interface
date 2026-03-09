import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'
import { PIE_COLORS, formatChartLabel } from '../../utils/chartColors'
import { useLocalization } from '../../hooks/useLocalization'

interface SalaryDistributionData {
  group: string
  count: number
  min_salary: number | null
  max_salary: number | null
  avg_salary: number | null
  total_salary: number | null
}

interface SalaryDistributionChartProps {
  data: SalaryDistributionData[]
  metric?: 'avg_salary' | 'total_salary' | 'count'
}

const COLORS = PIE_COLORS

export default function SalaryDistributionChart({
  data,
  metric = 'avg_salary',
}: SalaryDistributionChartProps) {
  const loc = useLocalization()
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No salary data available</p>
      </div>
    )
  }

  const chartData = data.map((item, index) => ({
    ...item,
    fill: COLORS[index % COLORS.length],
    value: item[metric] || 0,
  }))

  const getTooltipLabel = (metricName: string) => {
    switch (metricName) {
      case 'avg_salary':
        return 'Avg Salary'
      case 'total_salary':
        return 'Total Salary'
      case 'count':
        return 'Headcount'
      default:
        return metricName
    }
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 20, right: 30, left: 80, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal />
        <XAxis
          type="number"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
          tickFormatter={(value) =>
            metric === 'count' ? value.toString() : loc.currency(value, true)
          }
        />
        <YAxis
          type="category"
          dataKey="group"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
          width={70}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
          formatter={(value: number) => [
            metric === 'count' ? value : loc.currency(value, true),
            getTooltipLabel(metric),
          ]}
          labelFormatter={(label) => label}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
          {chartData.length <= 12 && (
            <LabelList dataKey="value" position="right" fontSize={11} fill="#64748b" formatter={formatChartLabel} />
          )}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
