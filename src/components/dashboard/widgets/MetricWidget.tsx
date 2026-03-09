import type { WidgetData, WidgetConfig } from '../types'

interface MetricWidgetProps {
  data: WidgetData
  config: WidgetConfig
}

export default function MetricWidget({ data }: MetricWidgetProps) {
  const value = data.value ?? 0
  const label = data.label ?? 'Metric'
  const prefix = data.prefix ?? ''
  const suffix = data.suffix ?? ''

  const formatValue = (val: number | string) => {
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(1)}M`
      } else if (val >= 1000) {
        return `${(val / 1000).toFixed(1)}K`
      }
      return val.toLocaleString()
    }
    return val
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="text-2xl font-bold text-gray-900">
        {prefix}
        {formatValue(value)}
        {suffix}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}
