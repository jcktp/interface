import { useState } from 'react'
import {
  CircleStackIcon,
  CloudArrowUpIcon,
  ArrowPathIcon,
  ServerIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

export interface DataSource {
  id: string
  name: string
  type: 'api' | 'csv' | 'integration' | 'database'
  lastSync?: string
  status: 'active' | 'stale' | 'error'
  recordCount?: number
}

interface DataSourceSelectorProps {
  module: string
  selectedSource: string
  onSourceChange: (sourceId: string) => void
  sources?: DataSource[]
  compact?: boolean
}

const DEFAULT_SOURCES: DataSource[] = [
  {
    id: 'live-api',
    name: 'Live API',
    type: 'api',
    status: 'active',
    lastSync: new Date().toISOString(),
  },
]

const typeIcons: Record<string, typeof CircleStackIcon> = {
  api: ServerIcon,
  csv: CloudArrowUpIcon,
  integration: ArrowPathIcon,
  database: CircleStackIcon,
}

const statusColors: Record<string, string> = {
  active: 'bg-success-500',
  stale: 'bg-warning-500',
  error: 'bg-danger-500',
}

export default function DataSourceSelector({
  module,
  selectedSource,
  onSourceChange,
  sources = DEFAULT_SOURCES,
  compact = false,
}: DataSourceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const selected = sources.find((s) => s.id === selectedSource) || sources[0]
  const Icon = typeIcons[selected?.type || 'api'] || ServerIcon

  const formatLastSync = (iso?: string) => {
    if (!iso) return 'Never'
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHrs = Math.floor(diffMin / 60)
    if (diffHrs < 24) return `${diffHrs}h ago`
    const diffDays = Math.floor(diffHrs / 24)
    return `${diffDays}d ago`
  }

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <div className={clsx('w-1.5 h-1.5 rounded-full', statusColors[selected?.status || 'active'])} />
          <Icon className="w-3.5 h-3.5" />
          <span>{selected?.name || 'Select Source'}</span>
          <ChevronDownIcon className={clsx('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-40 py-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Data Source for {module}
              </div>
              {sources.map((source) => {
                const SIcon = typeIcons[source.type] || ServerIcon
                return (
                  <button
                    key={source.id}
                    onClick={() => {
                      onSourceChange(source.id)
                      setIsOpen(false)
                    }}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 transition-colors',
                      selectedSource === source.id && 'bg-primary-50'
                    )}
                  >
                    <div className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', statusColors[source.status])} />
                    <SIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 text-left">
                      <p className="text-sm text-gray-900">{source.name}</p>
                      <p className="text-[10px] text-gray-500">
                        {formatLastSync(source.lastSync)}
                        {source.recordCount ? ` | ${source.recordCount.toLocaleString()} records` : ''}
                      </p>
                    </div>
                    {selectedSource === source.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <CircleStackIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Data Source</label>
        <select
          value={selectedSource}
          onChange={(e) => onSourceChange(e.target.value)}
          className="block w-full mt-0.5 text-sm font-medium text-gray-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer"
        >
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
              {source.recordCount ? ` (${source.recordCount.toLocaleString()} records)` : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <div className={clsx('w-2 h-2 rounded-full', statusColors[selected?.status || 'active'])} />
        <span>{formatLastSync(selected?.lastSync)}</span>
      </div>
    </div>
  )
}
