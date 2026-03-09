import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts'

function formatXTick(value: unknown): string {
  if (typeof value !== 'string') return String(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = new Date(value)
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
  return value
}

interface ForecastChartProps {
  data: Record<string, unknown>[]
  xKey: string
  actualKey: string
  forecastKey: string
  confidenceUpperKey?: string
  confidenceLowerKey?: string
  height?: number
  actualColor?: string
  forecastColor?: string
  confidenceColor?: string
  showGrid?: boolean
}

export default function ForecastChart({
  data,
  xKey,
  actualKey,
  forecastKey,
  confidenceUpperKey,
  confidenceLowerKey,
  height = 350,
  actualColor = '#0ea5e9',
  forecastColor = '#8b5cf6',
  confidenceColor = '#8b5cf6',
  showGrid = true,
}: ForecastChartProps) {
  // Find where forecast starts (first point where actual is null/undefined)
  const forecastStartIndex = data.findIndex((d) => d[actualKey] === null || d[actualKey] === undefined)
  const forecastStartDate = forecastStartIndex > 0 ? data[forecastStartIndex]?.[xKey] : null

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
          tickFormatter={(value) => value.toLocaleString()}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
          formatter={(value: number, name: string) => [
            value?.toLocaleString() ?? '-',
            name === actualKey ? 'Actual' : name === forecastKey ? 'Forecast' : name,
          ]}
        />
        <Legend />

        {/* Confidence interval area */}
        {confidenceUpperKey && confidenceLowerKey && (
          <Area
            type="monotone"
            dataKey={confidenceUpperKey}
            stroke="none"
            fill={confidenceColor}
            fillOpacity={0.1}
            name="Upper Bound"
          />
        )}

        {/* Forecast start line */}
        {forecastStartDate && (
          <ReferenceLine
            x={forecastStartDate as string}
            stroke="#9ca3af"
            strokeDasharray="5 5"
            label={{ value: 'Forecast →', position: 'top', fontSize: 11, fill: '#6b7280' }}
          />
        )}

        {/* Actual line */}
        <Line
          type="monotone"
          dataKey={actualKey}
          name="Actual"
          stroke={actualColor}
          strokeWidth={2}
          dot={{ fill: actualColor, strokeWidth: 2, r: 3 }}
          connectNulls={false}
        />

        {/* Forecast line */}
        <Line
          type="monotone"
          dataKey={forecastKey}
          name="Forecast"
          stroke={forecastColor}
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ fill: forecastColor, strokeWidth: 2, r: 3 }}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
