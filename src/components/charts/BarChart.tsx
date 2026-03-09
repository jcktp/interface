import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  LabelList,
} from 'recharts'
import { formatChartLabel } from '../../utils/chartColors'

function formatXTick(value: unknown): string {
  if (typeof value !== 'string') return String(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = new Date(value)
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
  return value
}

interface BarChartProps {
  data: Record<string, unknown>[]
  xKey: string
  bars: {
    key: string
    name: string
    color: string
  }[]
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  layout?: 'horizontal' | 'vertical'
  stacked?: boolean
  colorByValue?: boolean
  colors?: string[]
}

const defaultColors = [
  '#0ea5e9',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
]

export default function BarChart({
  data,
  xKey,
  bars,
  height = 300,
  showGrid = true,
  showLegend = false,
  layout = 'horizontal',
  stacked = false,
  colorByValue = false,
  colors = defaultColors,
}: BarChartProps) {
  const isVertical = layout === 'vertical'

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        layout={layout}
        margin={{ top: 40, right: 30, left: isVertical ? 80 : 0, bottom: 0 }}
      >
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
        {isVertical ? (
          <>
            <XAxis
              type="number"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              type="category"
              dataKey={xKey}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              width={80}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              tickFormatter={formatXTick}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value.toLocaleString()}
            />
          </>
        )}
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
        />
        {showLegend && <Legend />}
        {bars.map((bar) => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            name={bar.name}
            fill={bar.color}
            radius={[4, 4, 0, 0]}
            stackId={stacked ? 'stack' : undefined}
          >
            {colorByValue &&
              data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            {!stacked && data.length <= 12 && (
              <LabelList
                dataKey={bar.key}
                position={isVertical ? 'right' : 'top'}
                style={{ fontSize: 11, fill: '#64748b' }}
                formatter={formatChartLabel}
              />
            )}
          </Bar>
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}
