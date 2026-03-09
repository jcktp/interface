import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts'

interface MiniTrendChartProps {
  data: { month: string; value: number }[]
  title: string
  color?: string
  valueFormatter?: (v: number) => string
}

export default function MiniTrendChart({ data, title, color = '#4f46e5', valueFormatter }: MiniTrendChartProps) {
  const roundedFormatter = (v: number) => {
    const rounded = Number.isInteger(v) ? v : parseFloat(v.toFixed(2))
    return rounded.toLocaleString()
  }
  const format = valueFormatter ? (v: number) => {
    const rounded = Number.isInteger(v) ? v : parseFloat(v.toFixed(2))
    return valueFormatter(rounded)
  } : roundedFormatter

  // Calculate latest value and change
  const latest = data.length > 0 ? data[data.length - 1].value : 0
  const previous = data.length > 1 ? data[data.length - 2].value : latest
  const change = latest - previous
  const changePct = previous > 0 ? Math.round((change / previous) * 100) : 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-medium text-gray-600">{title}</h4>
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-bold text-gray-900">{format(latest)}</span>
          {change !== 0 && (
            <span className={`text-xs font-medium ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change > 0 ? '+' : ''}{changePct}%
            </span>
          )}
        </div>
      </div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 15, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis hide />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload?.length) {
                  return (
                    <div className="bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded shadow">
                      <div className="font-medium">{label}</div>
                      <div>{format(payload[0].value as number)}</div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            >
              {data.length <= 12 && (
                <LabelList
                  dataKey="value"
                  position="top"
                  style={{ fontSize: 10, fill: '#6b7280' }}
                  offset={6}
                  formatter={(v: number) => format(v)}
                />
              )}
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
