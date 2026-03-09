import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

interface GaugeChartProps {
  value: number
  max?: number
  label: string
  color?: string
  size?: 'small' | 'medium' | 'large'
  showValue?: boolean
  thresholds?: { value: number; color: string }[]
}

const defaultThresholds = [
  { value: 33, color: '#ef4444' },
  { value: 66, color: '#f59e0b' },
  { value: 100, color: '#22c55e' },
]

export default function GaugeChart({
  value,
  max = 100,
  label,
  color,
  size = 'medium',
  showValue = true,
  thresholds = defaultThresholds,
}: GaugeChartProps) {
  const percentage = Math.min((value / max) * 100, 100)

  const getColor = () => {
    if (color) return color
    for (const threshold of thresholds) {
      if (percentage <= threshold.value) return threshold.color
    }
    return thresholds[thresholds.length - 1].color
  }

  const data = [
    { name: 'value', value: percentage },
    { name: 'empty', value: 100 - percentage },
  ]

  const sizeConfig = {
    small: { height: 120, innerRadius: 35, outerRadius: 50, fontSize: 'text-lg' },
    medium: { height: 160, innerRadius: 50, outerRadius: 70, fontSize: 'text-2xl' },
    large: { height: 200, innerRadius: 65, outerRadius: 90, fontSize: 'text-3xl' },
  }

  const config = sizeConfig[size]

  return (
    <div className="relative flex flex-col items-center">
      <ResponsiveContainer width="100%" height={config.height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="70%"
            startAngle={180}
            endAngle={0}
            innerRadius={config.innerRadius}
            outerRadius={config.outerRadius}
            paddingAngle={0}
            dataKey="value"
          >
            <Cell fill={getColor()} />
            <Cell fill="#e5e7eb" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {showValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ top: '20%' }}>
          <span className={`font-bold text-gray-900 ${config.fontSize}`}>
            {typeof value === 'number' ? value.toFixed(1) : value}%
          </span>
        </div>
      )}

      <p className="text-sm font-medium text-gray-600 -mt-4">{label}</p>
    </div>
  )
}
