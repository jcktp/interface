import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
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

interface LineChartProps {
  data: Record<string, unknown>[]
  xKey: string
  lines: {
    key: string
    name: string
    color: string
    dashed?: boolean
    strokeWidth?: number
  }[]
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  showDots?: boolean
  referenceLine?: {
    y: number
    label: string
    color?: string
  }
  yAxisFormatter?: (value: number) => string
}

export default function LineChart({
  data,
  xKey,
  lines,
  height = 300,
  showGrid = true,
  showLegend = true,
  showDots = true,
  referenceLine,
  yAxisFormatter,
}: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={{ top: 30, right: 20, left: 0, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
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
          tickFormatter={yAxisFormatter || ((value) => value.toLocaleString())}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
        />
        {showLegend && <Legend />}
        {referenceLine && (
          <ReferenceLine
            y={referenceLine.y}
            label={referenceLine.label}
            stroke={referenceLine.color || '#ef4444'}
            strokeDasharray="5 5"
          />
        )}
        {lines.map((line) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.name}
            stroke={line.color}
            strokeWidth={line.strokeWidth ?? 2}
            strokeDasharray={line.dashed ? '5 5' : undefined}
            dot={showDots ? { fill: line.color, strokeWidth: 2 } : false}
            activeDot={{ r: 6 }}
          >
            {data.length <= 8 && lines.length <= 2 && (
              <LabelList
                dataKey={line.key}
                position="top"
                style={{ fontSize: 11, fill: '#64748b' }}
                offset={8}
                formatter={formatChartLabel}
              />
            )}
          </Line>
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  )
}
