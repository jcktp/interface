import clsx from 'clsx'
import {
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
} from '@heroicons/react/24/outline'

export type AlertCategory = 'attrition' | 'performance' | 'capacity' | 'compensation' | 'compliance'

export interface AlertCardProps {
  id: string
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  category?: AlertCategory
  trend?: string
  affectedDepartment?: string
  affectedCount?: number
  createdAt: string
  reasons?: string[]
  impactCost?: number
  recommendedAction?: string
  velocity?: 'worsening' | 'stable' | 'improving'
  performanceTier?: 'top' | 'solid' | 'low'
  onAcknowledge?: (id: string) => void
  onInvestigate?: (id: string) => void
}

const severityConfig = {
  critical: {
    icon: ExclamationCircleIcon,
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800/50',
    text: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
  },
  high: {
    icon: ExclamationTriangleIcon,
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-200 dark:border-orange-800/50',
    text: 'text-orange-700 dark:text-orange-300',
    badge: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
    dot: 'bg-orange-500',
  },
  medium: {
    icon: InformationCircleIcon,
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800/50',
    text: 'text-yellow-700 dark:text-yellow-300',
    badge: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
    dot: 'bg-yellow-500',
  },
  low: {
    icon: CheckCircleIcon,
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800/50',
    text: 'text-blue-700 dark:text-blue-300',
    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
}

const categoryLabels: Record<AlertCategory, string> = {
  attrition:    'Attrition Risk',
  performance:  'Performance',
  capacity:     'Capacity',
  compensation: 'Compensation',
  compliance:   'Compliance',
}

const velocityMap = {
  worsening: { Icon: ArrowTrendingUpIcon,   label: 'Worsening', color: 'text-red-500 dark:text-red-400' },
  stable:    { Icon: MinusIcon,             label: 'Stable',    color: 'text-gray-400' },
  improving: { Icon: ArrowTrendingDownIcon, label: 'Improving', color: 'text-green-500 dark:text-green-400' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function AlertCard({
  id, title, description, severity, category, trend,
  affectedDepartment, affectedCount, createdAt,
  reasons, impactCost, recommendedAction, velocity, performanceTier,
  onAcknowledge, onInvestigate,
}: AlertCardProps) {
  const cfg = severityConfig[severity] ?? severityConfig.medium
  const Icon = cfg.icon
  const vel = velocity ? velocityMap[velocity] : null

  return (
    <div className={clsx('border rounded-lg p-4 space-y-3', cfg.bg, cfg.border)}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <Icon className={clsx('h-5 w-5 mt-0.5 flex-shrink-0', cfg.text)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={clsx('text-sm font-semibold', cfg.text)}>{title}</h4>
            <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide', cfg.badge)}>{severity}</span>
            {category && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/70 dark:bg-gray-800/70 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 font-medium">
                {categoryLabels[category]}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-snug">{description}</p>
        </div>
      </div>

      {/* Why flagged */}
      {reasons && reasons.length > 0 && (
        <div className="ml-8 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Why flagged</p>
          <ul className="space-y-1">
            {reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
                <span className={clsx('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', cfg.dot)} />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Impact row */}
      {(impactCost !== undefined || velocity || performanceTier) && (
        <div className="ml-8 flex items-center gap-4 flex-wrap">
          {impactCost !== undefined && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Est. cost if unaddressed:{' '}
              <span className="font-bold text-gray-800 dark:text-gray-100">
                ${impactCost >= 1000000 ? `${(impactCost / 1000000).toFixed(1)}M` : impactCost >= 1000 ? `${Math.round(impactCost / 1000)}K` : impactCost}
              </span>
            </p>
          )}
          {performanceTier && (
            <span className={clsx(
              'text-[10px] px-2 py-0.5 rounded-full font-bold',
              performanceTier === 'top' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : performanceTier === 'low' ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
            )}>
              {performanceTier === 'top' ? 'Top Performer' : performanceTier === 'solid' ? 'Solid Performer' : 'Low Performer'}
            </span>
          )}
          {vel && (
            <div className={clsx('flex items-center gap-1 text-xs font-medium', vel.color)}>
              <vel.Icon className="w-3.5 h-3.5" />
              {vel.label}
            </div>
          )}
        </div>
      )}

      {/* Recommended action */}
      {recommendedAction && (
        <div className="ml-8 p-2.5 bg-white/60 dark:bg-gray-800/60 rounded border border-gray-200 dark:border-gray-600">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Recommended Action</p>
          <p className="text-xs text-gray-700 dark:text-gray-200">{recommendedAction}</p>
        </div>
      )}

      {/* Footer */}
      <div className="ml-8 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          {affectedDepartment && <span>{affectedDepartment}</span>}
          {affectedCount !== undefined && <span>{affectedCount} affected</span>}
          {trend && <span>{trend}</span>}
          <span>{timeAgo(createdAt)}</span>
        </div>
        <div className="flex gap-2">
          {onInvestigate && (
            <button
              onClick={() => onInvestigate(id)}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 bg-white dark:bg-gray-800 px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700 hover:border-indigo-300 transition-colors"
            >
              Investigate
            </button>
          )}
          {onAcknowledge && (
            <button
              onClick={() => onAcknowledge(id)}
              className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 bg-white dark:bg-gray-800 px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700 hover:border-gray-300 transition-colors"
            >
              Acknowledge
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
