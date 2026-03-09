import {
  BanknotesIcon,
  ChartBarIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import MetricCard from '../MetricCard'
import { useLocalization } from '../../hooks/useLocalization'

interface BudgetSummary {
  total_current_salary: number
  total_planned_budget: number
  total_actual_spend: number | null
  total_equity_budget: number
  equity_pool_total: number
  equity_pool_remaining: number
  budget_variance: number | null
  budget_variance_pct: number | null
  plans_count: number
}

interface BudgetOverviewCardsProps {
  summary: BudgetSummary | null
  currency?: string
}

export default function BudgetOverviewCards({ summary }: BudgetOverviewCardsProps) {
  const loc = useLocalization()

  if (!summary) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-20 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    )
  }

  const budgetGrowth = summary.total_current_salary > 0
    ? ((summary.total_planned_budget - summary.total_current_salary) / summary.total_current_salary) * 100
    : 0

  const equityUtilization = summary.equity_pool_total > 0
    ? ((summary.equity_pool_total - summary.equity_pool_remaining) / summary.equity_pool_total) * 100
    : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <MetricCard
        title="Current Salary Spend"
        value={loc.currency(summary.total_current_salary)}
        subtitle={`${summary.plans_count} departments`}
        icon={<BanknotesIcon className="w-6 h-6" />}
      />

      <MetricCard
        title="Planned Budget"
        value={loc.currency(summary.total_planned_budget)}
        subtitle={`${budgetGrowth >= 0 ? '+' : ''}${budgetGrowth.toFixed(1)}% growth`}
        change={budgetGrowth}
        trend={budgetGrowth >= 0 ? 'up' : 'down'}
        icon={<ChartBarIcon className="w-6 h-6" />}
      />

      <MetricCard
        title="Actual Spend"
        value={summary.total_actual_spend ? loc.currency(summary.total_actual_spend) : '-'}
        subtitle={summary.total_actual_spend ? 'Year to date' : 'Not yet synced'}
        icon={<BanknotesIcon className="w-6 h-6" />}
      />

      <MetricCard
        title="Planned Equity"
        value={loc.currency(summary.total_equity_budget)}
        subtitle={`From ${loc.currency(summary.equity_pool_total)} pool`}
        icon={<SparklesIcon className="w-6 h-6 text-indigo-500" />}
      />

      <MetricCard
        title="Equity Pool Remaining"
        value={loc.currency(summary.equity_pool_remaining)}
        subtitle={`${equityUtilization.toFixed(1)}% utilized`}
        change={-equityUtilization}
        trend={equityUtilization <= 90 ? 'up' : 'down'}
        icon={<ChartBarIcon className="w-6 h-6 text-indigo-600" />}
      />
    </div>
  )
}
