import { useState } from 'react'
import { ChevronUpIcon, ChevronDownIcon, MinusIcon } from '@heroicons/react/24/outline'
import type { WorkforcePlan } from '../../types'

interface PlanningGridProps {
  plans: WorkforcePlan[]
  isEditable: boolean
  onPlanUpdate: (planId: string, updates: Partial<WorkforcePlan>) => void
  showActuals: boolean
}

function VarianceIndicator({ value, invertColor }: { value?: number; invertColor?: boolean }) {
  if (value === undefined || value === null) return <span className="text-gray-400">-</span>

  // For attrition variance, lower actual is better (invertColor = true)
  const isPositive = invertColor ? value < 0 : value > 0
  const isNegative = invertColor ? value > 0 : value < 0

  if (isPositive) {
    return (
      <span className="inline-flex items-center text-success-600 font-medium">
        <ChevronUpIcon className="h-4 w-4" />
        +{Math.abs(value)}
      </span>
    )
  } else if (isNegative) {
    return (
      <span className="inline-flex items-center text-danger-600 font-medium">
        <ChevronDownIcon className="h-4 w-4" />
        -{Math.abs(value)}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-gray-500">
      <MinusIcon className="h-4 w-4" />
      0
    </span>
  )
}

export default function PlanningGrid({
  plans,
  isEditable,
  onPlanUpdate,
  showActuals,
}: PlanningGridProps) {
  const [editingCell, setEditingCell] = useState<{ planId: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState<string>('')

  const handleCellClick = (planId: string, field: string, currentValue: number) => {
    if (!isEditable) return
    setEditingCell({ planId, field })
    setEditValue(String(currentValue || 0))
  }

  const handleCellBlur = () => {
    if (editingCell) {
      const numValue = parseInt(editValue) || 0
      const plan = plans.find((p) => p.id === editingCell.planId)
      const updates: Partial<WorkforcePlan> = { [editingCell.field]: numValue }

      // Auto-recalculate ending headcount on the client side for immediate feedback
      if (plan) {
        const starting =
          editingCell.field === 'startingHeadcount' ? numValue : plan.startingHeadcount || 0
        const hires =
          editingCell.field === 'plannedHires' ? numValue : plan.plannedHires || 0
        const attrition =
          editingCell.field === 'plannedAttrition' ? numValue : plan.plannedAttrition || 0
        const transfersIn =
          editingCell.field === 'plannedTransfersIn' ? numValue : plan.plannedTransfersIn || 0
        const transfersOut =
          editingCell.field === 'plannedTransfersOut' ? numValue : plan.plannedTransfersOut || 0

        updates.plannedEndingHeadcount =
          starting + hires - attrition + transfersIn - transfersOut
      }

      onPlanUpdate(editingCell.planId, updates)
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
  }: {
    planId: string
    field: string
    value: number
  }) => {
    const isEditing = editingCell?.planId === planId && editingCell?.field === field

    if (isEditing) {
      return (
        <input
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleCellBlur}
          onKeyDown={handleKeyDown}
          className="w-20 px-2 py-1 text-sm border border-primary-500 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 text-right"
          autoFocus
        />
      )
    }

    return (
      <span
        onClick={() => handleCellClick(planId, field, value)}
        className={`block px-2 py-1 rounded text-right ${
          isEditable
            ? 'cursor-pointer hover:bg-primary-50 hover:text-primary-700 border border-transparent hover:border-primary-200'
            : ''
        }`}
        title={isEditable ? 'Click to edit' : undefined}
      >
        {value ?? 0}
      </span>
    )
  }

  // Check if any plan has actual data
  const hasActualData = plans.some(
    (p) => p.actualHeadcount !== null && p.actualHeadcount !== undefined
  )

  // Calculate totals
  const totals = plans.reduce(
    (acc, plan) => ({
      starting: acc.starting + (plan.startingHeadcount || 0),
      hires: acc.hires + (plan.plannedHires || 0),
      attrition: acc.attrition + (plan.plannedAttrition || 0),
      transfersIn: acc.transfersIn + (plan.plannedTransfersIn || 0),
      transfersOut: acc.transfersOut + (plan.plannedTransfersOut || 0),
      ending: acc.ending + (plan.plannedEndingHeadcount || 0),
      actualHeadcount: acc.actualHeadcount + (plan.actualHeadcount || 0),
      actualHires: acc.actualHires + (plan.actualHires || 0),
      actualAttrition: acc.actualAttrition + (plan.actualAttrition || 0),
    }),
    {
      starting: 0,
      hires: 0,
      attrition: 0,
      transfersIn: 0,
      transfersOut: 0,
      ending: 0,
      actualHeadcount: 0,
      actualHires: 0,
      actualAttrition: 0,
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
              Starting HC
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-success-700 uppercase tracking-wider bg-success-50">
              + Hires
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-danger-700 uppercase tracking-wider bg-danger-50">
              - Attrition
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              + Transfers In
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              - Transfers Out
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-primary-700 uppercase tracking-wider bg-primary-50">
              Ending HC
            </th>
            {showActuals && (
              <>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-l-2 border-gray-300">
                  Actual HC
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actual Hires
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actual Attrition
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  HC Variance
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hire Variance
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {plans.map((plan) => {
            // Calculate variances for display
            const hcVariance =
              plan.actualHeadcount !== null && plan.actualHeadcount !== undefined
                ? (plan.actualHeadcount || 0) - (plan.plannedEndingHeadcount || 0)
                : plan.headcountVariance
            const hireVariance =
              plan.actualHires !== null && plan.actualHires !== undefined
                ? (plan.actualHires || 0) - (plan.plannedHires || 0)
                : plan.hiresVariance

            return (
              <tr key={plan.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                  {plan.department}
                  {plan.location && (
                    <span className="text-gray-500 text-xs ml-2">({plan.location})</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">
                  <EditableCell
                    planId={plan.id}
                    field="startingHeadcount"
                    value={plan.startingHeadcount}
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-success-700 bg-success-50/50">
                  <EditableCell
                    planId={plan.id}
                    field="plannedHires"
                    value={plan.plannedHires}
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-danger-700 bg-danger-50/50">
                  <EditableCell
                    planId={plan.id}
                    field="plannedAttrition"
                    value={plan.plannedAttrition}
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">
                  <EditableCell
                    planId={plan.id}
                    field="plannedTransfersIn"
                    value={plan.plannedTransfersIn}
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">
                  <EditableCell
                    planId={plan.id}
                    field="plannedTransfersOut"
                    value={plan.plannedTransfersOut}
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-primary-700 bg-primary-50/50">
                  {plan.plannedEndingHeadcount ?? 0}
                </td>
                {showActuals && (
                  <>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700 border-l-2 border-gray-200">
                      {plan.actualHeadcount ?? '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">
                      {plan.actualHires ?? '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">
                      {plan.actualAttrition ?? '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                      <VarianceIndicator value={hcVariance} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                      <VarianceIndicator value={hireVariance} />
                    </td>
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
        <tfoot className="bg-gray-100 font-semibold">
          <tr>
            <td className="px-4 py-3 text-sm text-gray-900 sticky left-0 bg-gray-100 z-10">
              Total
            </td>
            <td className="px-4 py-3 text-sm text-right text-gray-900">
              {totals.starting}
            </td>
            <td className="px-4 py-3 text-sm text-right text-success-700 bg-success-100/50">
              {totals.hires}
            </td>
            <td className="px-4 py-3 text-sm text-right text-danger-700 bg-danger-100/50">
              {totals.attrition}
            </td>
            <td className="px-4 py-3 text-sm text-right text-gray-900">
              {totals.transfersIn}
            </td>
            <td className="px-4 py-3 text-sm text-right text-gray-900">
              {totals.transfersOut}
            </td>
            <td className="px-4 py-3 text-sm text-right text-primary-700 bg-primary-100/50">
              {totals.ending}
            </td>
            {showActuals && (
              <>
                <td className="px-4 py-3 text-sm text-right text-gray-900 border-l-2 border-gray-300">
                  {hasActualData ? totals.actualHeadcount : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-900">
                  {hasActualData ? totals.actualHires : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-900">
                  {hasActualData ? totals.actualAttrition : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  {hasActualData ? (
                    <VarianceIndicator
                      value={totals.actualHeadcount - totals.ending}
                    />
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  {hasActualData ? (
                    <VarianceIndicator
                      value={totals.actualHires - totals.hires}
                    />
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
              </>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
