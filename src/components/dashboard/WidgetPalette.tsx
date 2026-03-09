import {
  HashtagIcon,
  ChartBarIcon,
  TableCellsIcon,
  PresentationChartLineIcon,
  ChartPieIcon,
  BeakerIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline'
import type { WidgetType } from './types'

interface WidgetPaletteProps {
  onAddWidget: (type: WidgetType) => void
}

const WIDGET_TYPES: { type: WidgetType; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { type: 'metric', label: 'Metric', icon: HashtagIcon, description: 'Single value with optional comparison' },
  { type: 'bar', label: 'Bar Chart', icon: ChartBarIcon, description: 'Compare values across categories' },
  { type: 'line', label: 'Line Chart', icon: PresentationChartLineIcon, description: 'Show trends over time' },
  { type: 'pie', label: 'Pie Chart', icon: ChartPieIcon, description: 'Show proportions of a whole' },
  { type: 'table', label: 'Table', icon: TableCellsIcon, description: 'Display tabular data' },
  { type: 'gauge', label: 'Gauge', icon: BeakerIcon, description: 'Show progress toward a goal' },
  { type: 'sql', label: 'SQL Query', icon: CodeBracketIcon, description: 'Run custom SQL queries' },
]

export default function WidgetPalette({ onAddWidget }: WidgetPaletteProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Add Widget</h3>
      <div className="grid grid-cols-2 gap-2">
        {WIDGET_TYPES.map((widget) => {
          const Icon = widget.icon
          return (
            <button
              key={widget.type}
              onClick={() => onAddWidget(widget.type)}
              className="flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors group"
            >
              <Icon className="w-6 h-6 text-gray-400 group-hover:text-primary-600 mb-1" />
              <span className="text-xs font-medium text-gray-700 group-hover:text-primary-700">
                {widget.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
