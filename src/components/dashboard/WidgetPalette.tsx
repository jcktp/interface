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

const WIDGET_GROUPS = [
  {
    label: 'Single Value',
    items: [
      { type: 'metric' as WidgetType, label: 'Metric Card', icon: HashtagIcon, description: 'Single KPI with trend' },
      { type: 'gauge' as WidgetType, label: 'Gauge', icon: BeakerIcon, description: 'Progress toward a target' },
    ],
  },
  {
    label: 'Charts',
    items: [
      { type: 'bar' as WidgetType, label: 'Bar Chart', icon: ChartBarIcon, description: 'Compare across categories' },
      { type: 'line' as WidgetType, label: 'Line Chart', icon: PresentationChartLineIcon, description: 'Trends over time' },
      { type: 'area' as WidgetType, label: 'Area Chart', icon: PresentationChartLineIcon, description: 'Volume trends over time' },
      { type: 'pie' as WidgetType, label: 'Pie / Donut', icon: ChartPieIcon, description: 'Proportions of a whole' },
    ],
  },
  {
    label: 'Data',
    items: [
      { type: 'table' as WidgetType, label: 'Table', icon: TableCellsIcon, description: 'Tabular data view' },
      { type: 'sql' as WidgetType, label: 'SQL Query', icon: CodeBracketIcon, description: 'Custom SQL visualisation' },
    ],
  },
]

export default function WidgetPalette({ onAddWidget }: WidgetPaletteProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Add Widget</h3>
      {WIDGET_GROUPS.map(group => (
        <div key={group.label}>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{group.label}</p>
          <div className="space-y-1">
            {group.items.map(widget => {
              const Icon = widget.icon
              return (
                <button
                  key={widget.type}
                  onClick={() => onAddWidget(widget.type)}
                  className="w-full flex items-center gap-3 p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group text-left"
                >
                  <Icon className="w-4 h-4 text-gray-400 group-hover:text-blue-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-700 dark:group-hover:text-blue-300">{widget.label}</p>
                    <p className="text-[10px] text-gray-400 leading-tight">{widget.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
