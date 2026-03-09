import type { WidgetData, WidgetConfig } from '../types'

interface GaugeWidgetProps {
  data: WidgetData
  config: WidgetConfig
}

export default function GaugeWidget({ data, config }: GaugeWidgetProps) {
  const value = typeof data.value === 'number' ? data.value : 0
  const min = data.min ?? 0
  const max = data.max ?? 100
  const label = data.label ?? 'Value'
  const thresholds = data.thresholds || config.thresholds || { low: 30, medium: 60, high: 80 }

  // Calculate percentage for display
  const percentage = ((value - min) / (max - min)) * 100
  const clampedPercentage = Math.max(0, Math.min(100, percentage))

  // Determine color based on thresholds
  const getColor = () => {
    if (percentage < thresholds.low) return '#ef4444' // red
    if (percentage < thresholds.medium) return '#f59e0b' // yellow
    if (percentage < thresholds.high) return '#3b82f6' // blue
    return '#10b981' // green
  }

  // SVG gauge parameters
  const radius = 60
  const strokeWidth = 12

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <svg width="160" height="120" viewBox="0 0 160 120">
        {/* Background arc */}
        <path
          d={describeArc(80, 80, radius, -135, 135)}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={describeArc(80, 80, radius, -135, -135 + (clampedPercentage / 100) * 270)}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Value text */}
        <text
          x="80"
          y="75"
          textAnchor="middle"
          className="text-2xl font-bold"
          fill="#1f2937"
        >
          {value.toFixed(max <= 5 ? 1 : 0)}
        </text>
        {/* Min/Max labels */}
        <text x="25" y="110" textAnchor="middle" fontSize="10" fill="#9ca3af">
          {min}
        </text>
        <text x="135" y="110" textAnchor="middle" fontSize="10" fill="#9ca3af">
          {max}
        </text>
      </svg>
      <div className="text-sm text-gray-500 -mt-2">{label}</div>
    </div>
  )
}

// Helper function to create arc path
function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(x, y, radius, endAngle)
  const end = polarToCartesian(x, y, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'

  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(' ')
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  }
}
