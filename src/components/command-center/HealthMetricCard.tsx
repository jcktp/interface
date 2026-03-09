import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from '@heroicons/react/24/solid'

interface HealthMetricCardProps {
  title: string
  value: string | number
  unit?: string
  change?: number
  changeLabel?: string
  icon: React.ElementType
  color: 'green' | 'red' | 'blue' | 'yellow' | 'purple' | 'indigo'
  sparklineData?: number[]
}

const iconColorMap: Record<string, string> = {
  green: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
  red: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
  blue: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400',
  purple: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400',
  indigo: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400',
}

export default function HealthMetricCard({ title, value, unit, change, changeLabel, icon: Icon, color, sparklineData }: HealthMetricCardProps) {
  const isPositive = change !== undefined && change > 0
  const isNegative = change !== undefined && change < 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3.5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <div className="mt-1 flex items-baseline gap-1">
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {unit && <span className="text-xs text-gray-500 dark:text-gray-400">{unit}</span>}
          </div>
          {change !== undefined && (
            <div className={`mt-1.5 flex items-center gap-1 text-sm ${isPositive ? 'text-green-600 dark:text-green-400' : isNegative ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {isPositive ? <ArrowUpIcon className="h-3.5 w-3.5" /> : isNegative ? <ArrowDownIcon className="h-3.5 w-3.5" /> : <MinusIcon className="h-3.5 w-3.5" />}
              <span>{Math.abs(change).toFixed(1)}%</span>
              {changeLabel && <span className="text-gray-400 dark:text-gray-500 ml-1">{changeLabel}</span>}
            </div>
          )}
        </div>
        <div className={`p-2 rounded-lg ${iconColorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {sparklineData && sparklineData.length > 1 && (
        <div className="mt-2 h-7">
          <MiniSparkline data={sparklineData} color={color} />
        </div>
      )}
    </div>
  )
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const width = 100
  const height = 32
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * height,
  }))
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const strokeColor = color === 'green' ? '#16a34a' : color === 'red' ? '#dc2626' : color === 'blue' ? '#2563eb' : color === 'yellow' ? '#ca8a04' : color === 'purple' ? '#9333ea' : '#4f46e5'

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
