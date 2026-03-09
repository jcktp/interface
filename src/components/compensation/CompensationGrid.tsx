import { useState } from 'react'
import { ChevronUpIcon, ChevronDownIcon, MinusIcon } from '@heroicons/react/24/outline'
import { CURRENCIES } from '../../utils/localization'
import { useStore } from '../../store'
import clsx from 'clsx'

export interface CompensationPlan {
  id: string
  period_id: string
  department: string
  job_level?: string
  location?: string
  currency: string
  current_headcount: number
  current_total_salary: number
  current_salary_base?: number
  current_avg_salary: number
  current_total_equity: number
  merit_increase_pct: number
  promotion_budget: number
  market_adjustment_budget: number
  new_hire_budget: number
  equity_budget: number
  planned_total_budget: number
  planned_budget_base?: number
  planned_avg_salary: number
  actual_total_spend?: number
  actual_spend_base?: number
  actual_avg_salary?: number
  budget_variance?: number
  notes?: string
  last_synced_at?: string
}

interface CompensationGridProps {
  plans: CompensationPlan[]
  isEditable: boolean
  onPlanUpdate: (planId: string, updates: Partial<CompensationPlan>) => void
  showActuals: boolean
  currency?: string
}

function formatCurrency(value: number | null | undefined, currency: string = 'USD'): string {
  if (value === null || value === undefined) return '-'
  const config = CURRENCIES[currency as keyof typeof CURRENCIES]
  const locale = config?.locale || 'en-US'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function VarianceIndicator({ value, currency }: { value?: number; currency?: string }) {
  if (value === undefined || value === null) return <span className="text-gray-400">-</span>

  if (value > 0) {
    return (
      <span className="inline-flex items-center text-danger-600 font-medium">
        <ChevronUpIcon className="h-4 w-4" />
        +{formatCurrency(value, currency)}
      </span>
    )
  } else if (value < 0) {
    return (
      <span className="inline-flex items-center text-success-600 font-medium">
        <ChevronDownIcon className="h-4 w-4" />
        {formatCurrency(value, currency)}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-gray-500">
      <MinusIcon className="h-4 w-4" />
      {formatCurrency(0, currency)}
    </span>
  )
}

export default function CompensationGrid({
  plans,
  isEditable,
  onPlanUpdate,
  showActuals,
  currency: currencyProp,
}: CompensationGridProps) {
  const storeCurrency = useStore((s) => s.localization.currency)
  const currency = currencyProp || storeCurrency || 'USD'
  const [editingCell, setEditingCell] = useState<{ planId: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState<string>('')

  const handleCellClick = (planId: string, field: string, currentValue: number) => {
    if (!isEditable) return
    setEditingCell({ planId, field })
    setEditValue(String(currentValue || 0))
  }

  const handleCellBlur = () => {
    if (editingCell) {
      const numValue = parseFloat(editValue) || 0
      onPlanUpdate(editingCell.planId, { [editingCell.field]: numValue })
      setEditingCell(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur()
    } else if (e.key === 'Escape') {
      setEditingCell(null)
    }
  }

  const EditableCell = ({
    planId,
    field,
    value,
    isPercentage = false,
  }: {
    planId: string
    field: string
    value: number
    isPercentage?: boolean
  }) => {
    const isEditing = editingCell?.planId === planId && editingCell?.field === field

    if (isEditing) {
      return (
        <input
          type="number"
          step={isPercentage ? '0.1' : '1000'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleCellBlur}
          onKeyDown={handleKeyDown}
          className="w-full px-2 py-1 text-sm border border-primary-500 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
          autoFocus
        />
      )
    }

    return (
      <span
        onClick={() => handleCellClick(planId, field, value)}
        className={`block px-2 py-1 rounded ${
          isEditable ? 'cursor-pointer hover:bg-primary-50 hover:text-primary-700' : ''
        }`}
      >
        {isPercentage ? `${(value || 0).toFixed(1)}%` : formatCurrency(value, currency)}
      </span>
    )
  }

  // Calculate totals - ALWAYS in base currency for the footer
  const totals = plans.reduce(
    (acc, plan) => ({
      headcount: acc.headcount + (plan.current_headcount || 0),
      currentSalary: acc.currentSalary + (plan.current_salary_base || plan.current_total_salary || 0),
      currentEquity: acc.currentEquity + (plan.current_total_equity || 0),
      promotionBudget: acc.promotionBudget + (plan.promotion_budget || 0),
      marketBudget: acc.marketBudget + (plan.market_adjustment_budget || 0),
      newHireBudget: acc.newHireBudget + (plan.new_hire_budget || 0),
      equityBudget: acc.equityBudget + (plan.equity_budget || 0),
      plannedBudget: acc.plannedBudget + (plan.planned_budget_base || plan.planned_total_budget || 0),
      actualSpend: acc.actualSpend + (plan.actual_spend_base || plan.actual_total_spend || 0),
    }),
    {
      headcount: 0,
      currentSalary: 0,
      currentEquity: 0,
      promotionBudget: 0,
      marketBudget: 0,
      newHireBudget: 0,
      equityBudget: 0,
      plannedBudget: 0,
      actualSpend: 0,
    }
  )

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
              Department
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Headcount
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Current Salary
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Current Equity
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-primary-50">
              Merit %
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-success-50">
              Promotion
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-warning-50">
              Market Adj
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-info-50">
              New Hire
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-indigo-50">
              Equity Grant
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-slate-50 border-l border-slate-200">
              Projected Increase
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-slate-50">
              % Change
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-semibold">
              New Total Budget
            </th>
            {showActuals && (
              <>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-l-2 border-gray-300">
                  Actual Spend
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Variance
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {plans.map((plan) => (
            <tr key={plan.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                {plan.department}
                {plan.location && (
                  <span className="text-gray-500 text-xs ml-2">({plan.location})</span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">
                {plan.current_headcount ?? 0}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">
                {formatCurrency(plan.current_salary_base || plan.current_total_salary, currency)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">
                {formatCurrency(plan.current_total_equity, plan.currency)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-primary-700 bg-primary-50/50">
                <EditableCell
                  planId={plan.id}
                  field="merit_increase_pct"
                  value={plan.merit_increase_pct}
                  isPercentage
                />
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-success-700 bg-success-50/50">
                <EditableCell
                  planId={plan.id}
                  field="promotion_budget"
                  value={plan.promotion_budget}
                />
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-warning-700 bg-warning-50/50">
                <EditableCell
                  planId={plan.id}
                  field="market_adjustment_budget"
                  value={plan.market_adjustment_budget}
                />
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-info-700 bg-info-50/50">
                <EditableCell
                  planId={plan.id}
                  field="new_hire_budget"
                  value={plan.new_hire_budget}
                />
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-indigo-700 bg-indigo-50/50">
                <EditableCell
                  planId={plan.id}
                  field="equity_budget"
                  value={plan.equity_budget}
                />
              </td>
              {(() => {
                const currentSalary = plan.current_salary_base || plan.current_total_salary || 0
                const meritAmt = (plan.merit_increase_pct / 100) * currentSalary
                const increaseAmt = meritAmt + (plan.promotion_budget || 0) + (plan.market_adjustment_budget || 0)
                const totalNew = currentSalary + increaseAmt + (plan.new_hire_budget || 0)
                const pctChange = currentSalary > 0 ? (increaseAmt / currentSalary) * 100 : 0
                
                return (
                  <>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-700 bg-slate-50/30 border-l border-slate-100 font-medium">
                      {formatCurrency(increaseAmt, currency)}
                    </td>
                    <td className={clsx(
                      "px-4 py-3 whitespace-nowrap text-sm text-right bg-slate-50/30 font-medium",
                      pctChange > 5 ? "text-amber-600" : "text-slate-600"
                    )}>
                      {pctChange.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-gray-900 bg-slate-50/50">
                      {formatCurrency(totalNew, currency)}
                    </td>
                  </>
                )
              })()}
              {showActuals && (
                <>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700 border-l-2 border-gray-200">
                    {(plan.actual_spend_base || plan.actual_total_spend)
                      ? formatCurrency(plan.actual_spend_base || plan.actual_total_spend, currency)
                      : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                    <VarianceIndicator value={plan.budget_variance} currency={currency} />
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-100 font-semibold">
          <tr>
            <td className="px-4 py-3 text-sm text-gray-900 sticky left-0 bg-gray-100 z-10">
              Total
            </td>
            <td className="px-4 py-3 text-sm text-right text-gray-900">{totals.headcount}</td>
            <td className="px-4 py-3 text-sm text-right text-gray-900">
              {formatCurrency(totals.currentSalary, currency)}
            </td>
            <td className="px-4 py-3 text-sm text-right text-gray-900">
              {formatCurrency(totals.currentEquity, currency)}
            </td>
            <td className="px-4 py-3 text-sm text-right text-primary-700 bg-primary-100/50">-</td>
            <td className="px-4 py-3 text-sm text-right text-success-700 bg-success-100/50">
              {formatCurrency(totals.promotionBudget, currency)}
            </td>
            <td className="px-4 py-3 text-sm text-right text-warning-700 bg-warning-100/50">
              {formatCurrency(totals.marketBudget, currency)}
            </td>
            <td className="px-4 py-3 text-sm text-right text-info-700 bg-info-100/50">
              {formatCurrency(totals.newHireBudget, currency)}
            </td>
            <td className="px-4 py-3 text-sm text-right text-indigo-700 bg-indigo-100/50">
              {formatCurrency(totals.equityBudget, currency)}
            </td>
            {(() => {
              const totalCurrent = totals.currentSalary
              const totalMerit = plans.reduce((acc, p) => acc + ((p.merit_increase_pct / 100) * (p.current_salary_base || p.current_total_salary || 0)), 0)
              const totalIncrease = totalMerit + totals.promotionBudget + totals.marketBudget
              const totalNew = totalCurrent + totalIncrease + totals.newHireBudget
              const totalPctChange = totalCurrent > 0 ? (totalIncrease / totalCurrent) * 100 : 0
              
              return (
                <>
                  <td className="px-4 py-3 text-sm text-right text-slate-800 bg-slate-100/50 border-l border-slate-200">
                    {formatCurrency(totalIncrease, currency)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-slate-800 bg-slate-100/50">
                    {totalPctChange.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 bg-slate-100/70 font-bold">
                    {formatCurrency(totalNew, currency)}
                  </td>
                </>
              )
            })()}
            {showActuals && (
              <>
                <td className="px-4 py-3 text-sm text-right text-gray-900 border-l-2 border-gray-300">
                  {totals.actualSpend ? formatCurrency(totals.actualSpend, currency) : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <VarianceIndicator
                    value={totals.actualSpend - totals.plannedBudget}
                    currency={currency}
                  />
                </td>
              </>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
