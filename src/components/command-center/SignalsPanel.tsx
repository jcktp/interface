import { useState } from 'react'
import clsx from 'clsx'
import { FunnelIcon } from '@heroicons/react/24/outline'
import AlertCard, { AlertCategory } from './AlertCard'

interface Alert {
  id: string
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  category?: AlertCategory
  trend?: string
  affected_department?: string
  affected_count?: number
  created_at: string
  _computed?: boolean
  reasons?: string[]
  impact_cost?: number
  recommended_action?: string
  velocity?: 'worsening' | 'stable' | 'improving'
  performance_tier?: 'top' | 'solid' | 'low'
}

interface SignalsPanelProps {
  alerts: Alert[]
  onAcknowledge?: (id: string) => void
  onInvestigate?: (id: string) => void
  isLoading?: boolean
}

const TABS: { value: AlertCategory | 'all'; label: string }[] = [
  { value: 'all',          label: 'All' },
  { value: 'attrition',    label: 'Attrition' },
  { value: 'performance',  label: 'Performance' },
  { value: 'capacity',     label: 'Capacity' },
  { value: 'compensation', label: 'Compensation' },
  { value: 'compliance',   label: 'Compliance' },
]

export default function SignalsPanel({ alerts, onAcknowledge, onInvestigate, isLoading }: SignalsPanelProps) {
  const [activeTab, setActiveTab] = useState<AlertCategory | 'all'>('all')

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="h-5 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg h-24" />)}
        </div>
      </div>
    )
  }

  const critical = alerts.filter(a => a.severity === 'critical').length
  const high     = alerts.filter(a => a.severity === 'high').length

  const filtered = activeTab === 'all'
    ? alerts
    : alerts.filter(a => a.category === activeTab)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Risk Signals</h3>
          <div className="flex items-center gap-1.5">
            {critical > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-bold">
                {critical} critical
              </span>
            )}
            {high > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 font-bold">
                {high} high
              </span>
            )}
            {critical === 0 && high === 0 && alerts.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                {alerts.length} active
              </span>
            )}
          </div>
        </div>
        <FunnelIcon className="w-4 h-4 text-gray-300 dark:text-gray-600" />
      </div>

      {/* Category tabs — only show if there are alerts */}
      {alerts.length > 0 && (
        <div className="flex gap-1 mb-4 flex-wrap">
          {TABS.map(tab => {
            const count = tab.value === 'all'
              ? alerts.length
              : alerts.filter(a => a.category === tab.value).length
            if (count === 0 && tab.value !== 'all') return null
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={clsx(
                  'text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors',
                  activeTab === tab.value
                    ? 'bg-slate-900 dark:bg-slate-700 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                {tab.label}
                {count > 0 && <span className="ml-1 opacity-60">{count}</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">All clear</p>
          <p className="text-xs text-gray-400 mt-1">
            No {activeTab !== 'all' ? activeTab + ' ' : ''}signals detected
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
          {filtered.map(alert => (
            <AlertCard
              key={alert.id}
              id={alert.id}
              title={alert.title}
              description={alert.description}
              severity={alert.severity}
              category={alert.category}
              trend={alert.trend}
              affectedDepartment={alert.affected_department}
              affectedCount={alert.affected_count}
              createdAt={alert.created_at}
              reasons={alert.reasons}
              impactCost={alert.impact_cost}
              recommendedAction={alert.recommended_action}
              velocity={alert.velocity}
              performanceTier={alert.performance_tier}
              onAcknowledge={alert._computed ? undefined : onAcknowledge}
              onInvestigate={alert._computed ? undefined : onInvestigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
