import React from 'react'
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid'
import clsx from 'clsx'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  change?: number
  changeLabel?: string
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  format?: 'number' | 'currency' | 'percentage' | 'days'
  size?: 'small' | 'medium' | 'large'
  /** Inverts the color meaning (e.g. turnover going up is bad) */
  invertTrend?: boolean
}

export default function MetricCard({
  title,
  value,
  subtitle,
  change,
  changeLabel,
  icon,
  trend,
  size = 'medium',
  invertTrend = false,
}: MetricCardProps) {
  // Determine if the visual color should be "positive" or "negative"
  const visuallyPositive = invertTrend
    ? trend === 'down'
    : trend === 'up'

  const visuallyNegative = invertTrend
    ? trend === 'up'
    : trend === 'down'

  const changeBg = visuallyPositive
    ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
    : visuallyNegative
    ? 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20'
    : 'text-slate-500 bg-slate-50 dark:text-slate-400 dark:bg-slate-800/50'

  return (
    <div className={clsx('card', size === 'small' && '!p-4', size === 'large' && '!p-6')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="metric-label truncate">{title}</p>
          <p className={clsx(
            'font-semibold text-slate-900 dark:text-white tracking-tight mt-0.5',
            size === 'small' ? 'text-base' : size === 'large' ? 'text-2xl' : 'text-xl'
          )}>
            {value}
          </p>

          {subtitle && (
            <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-0.5 leading-tight truncate">{subtitle}</p>
          )}

          {change !== undefined && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className={clsx(
                'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold',
                changeBg
              )}>
                {visuallyPositive && <ArrowUpIcon className="w-2.5 h-2.5" />}
                {visuallyNegative && <ArrowDownIcon className="w-2.5 h-2.5" />}
                {Math.abs(change)}%
              </span>
              {changeLabel && (
                <span className="text-[10px] text-slate-400 dark:text-gray-500">{changeLabel}</span>
              )}
            </div>
          )}
        </div>

        {icon && (
          <div className="text-slate-300 dark:text-slate-600 flex-shrink-0 mt-0.5">
            <div className="w-4 h-4">{icon}</div>
          </div>
        )}
      </div>
    </div>
  )
}
