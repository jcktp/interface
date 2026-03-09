import { useState } from 'react'
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface MeritCycleWizardProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (settings: MeritCycleSettings) => void
  departments: string[]
}

export interface MeritCycleSettings {
  cycle_name: string
  effective_date: string
  merit_budget_pct: number
  promotion_budget_pct: number
  market_budget_pct: number
  equity_refresh_budget: number
  department_allocations: {
    department: string
    merit_pct: number
    promotion_pct: number
    market_pct: number
    equity_budget: number
  }[]
}

const STEPS = ['Cycle Info', 'Budget Allocation', 'Department Split', 'Review']

export default function MeritCycleWizard({
  isOpen,
  onClose,
  onComplete,
  departments,
}: MeritCycleWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [cycleName, setCycleName] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [meritBudgetPctInput, setMeritBudgetPctInput] = useState('3')
  const [promotionBudgetPctInput, setPromotionBudgetPctInput] = useState('1')
  const [marketBudgetPctInput, setMarketBudgetPctInput] = useState('0.5')
  const [equityBudgetInput, setEquityBudgetInput] = useState('500000')
  
  const meritBudgetPct = parseFloat(meritBudgetPctInput) || 0
  const promotionBudgetPct = parseFloat(promotionBudgetPctInput) || 0
  const marketBudgetPct = parseFloat(marketBudgetPctInput) || 0
  const equityBudget = parseFloat(equityBudgetInput) || 0

  const [deptAllocations, setDeptAllocations] = useState<
    { department: string; merit_pct_input: string; promotion_pct_input: string; market_pct_input: string; equity_budget_input: string }[]
  >(
    departments.map((dept) => ({
      department: dept,
      merit_pct_input: '3',
      promotion_pct_input: '1',
      market_pct_input: '0.5',
      equity_budget_input: String(Math.round(500000 / departments.length))
    }))
  )

  const handleDeptChange = (
    department: string,
    field: 'merit_pct_input' | 'promotion_pct_input' | 'market_pct_input' | 'equity_budget_input',
    value: string
  ) => {
    setDeptAllocations((prev) =>
      prev.map((d) => (d.department === department ? { ...d, [field]: value } : d))
    )
  }

  const applyDefaultsToAll = () => {
    const equityPerDept = Math.round(equityBudget / departments.length)
    setDeptAllocations((prev) =>
      prev.map((d) => ({
        ...d,
        merit_pct_input: meritBudgetPctInput,
        promotion_pct_input: promotionBudgetPctInput,
        market_pct_input: marketBudgetPctInput,
        equity_budget_input: String(equityPerDept)
      }))
    )
  }

  const handleComplete = () => {
    onComplete({
      cycle_name: cycleName,
      effective_date: effectiveDate,
      merit_budget_pct: meritBudgetPct,
      promotion_budget_pct: promotionBudgetPct,
      market_budget_pct: marketBudgetPct,
      equity_refresh_budget: equityBudget,
      department_allocations: deptAllocations.map(d => ({
        department: d.department,
        merit_pct: parseFloat(d.merit_pct_input) || 0,
        promotion_pct: parseFloat(d.promotion_pct_input) || 0,
        market_pct: parseFloat(d.market_pct_input) || 0,
        equity_budget: parseFloat(d.equity_budget_input) || 0,
      })),
    })
    onClose()
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return cycleName && effectiveDate
      case 1:
        return meritBudgetPct >= 0 && promotionBudgetPct >= 0 && marketBudgetPct >= 0
      case 2:
        return deptAllocations.every((d) => (parseFloat(d.merit_pct_input) || 0) >= 0)
      default:
        return true
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Merit Cycle Setup</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    index < currentStep
                      ? 'bg-primary-500 text-white'
                      : index === currentStep
                      ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {index < currentStep ? <CheckIcon className="w-5 h-5" /> : index + 1}
                </div>
                <span
                  className={`ml-2 text-sm ${
                    index === currentStep ? 'text-primary-700 font-medium' : 'text-gray-500'
                  }`}
                >
                  {step}
                </span>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mx-4 ${
                      index < currentStep ? 'bg-primary-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentStep === 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Cycle Information</h3>
              <p className="text-sm text-gray-600">
                Set up the basic details for this merit cycle.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700">Cycle Name</label>
                <input
                  type="text"
                  value={cycleName}
                  onChange={(e) => setCycleName(e.target.value)}
                  className="input mt-1"
                  placeholder="e.g., 2025 Annual Merit Cycle"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Effective Date</label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="input mt-1"
                />
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Budget Allocation</h3>
              <p className="text-sm text-gray-600">
                Set the default budget percentages for this cycle.
              </p>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Merit Budget %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={meritBudgetPctInput}
                    onChange={(e) => setMeritBudgetPctInput(e.target.value)}
                    className="input mt-1"
                  />
                  <p className="mt-1 text-xs text-gray-500">Annual performance increases</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Promotion Budget %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={promotionBudgetPctInput}
                    onChange={(e) => setPromotionBudgetPctInput(e.target.value)}
                    className="input mt-1"
                  />
                  <p className="mt-1 text-xs text-gray-500">Role changes & promotions</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Market Adjustment %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={marketBudgetPctInput}
                    onChange={(e) => setMarketBudgetPctInput(e.target.value)}
                    className="input mt-1"
                  />
                  <p className="mt-1 text-xs text-gray-500">Market rate alignment</p>
                </div>
              </div>

              <div className="p-4 border border-indigo-100 bg-indigo-50/30 rounded-lg">
                <label className="block text-sm font-medium text-indigo-900">Total Equity Refresh Budget</label>
                <div className="mt-1 relative">
                  <input
                    type="number"
                    value={equityBudgetInput}
                    onChange={(e) => setEquityBudgetInput(e.target.value)}
                    className="input pl-8"
                    placeholder="0"
                  />
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-400 font-bold">$</span>
                </div>
                <p className="mt-1 text-xs text-indigo-600">Total pool for equity refreshes and grants in this cycle</p>
              </div>

              <div className="bg-primary-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-primary-900">
                  Salary Budget: {(meritBudgetPct + promotionBudgetPct + marketBudgetPct).toFixed(1)}%
                  of payroll
                </p>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Department Allocations</h3>
                  <p className="text-sm text-gray-600">
                    Customize budget percentages by department.
                  </p>
                </div>
                <button
                  onClick={applyDefaultsToAll}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  Apply defaults to all
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Department
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Merit %
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Promotion %
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Market %
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Equity Budget
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {deptAllocations.map((dept) => (
                      <tr key={dept.department}>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          {dept.department}
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="0.1"
                            value={dept.merit_pct_input}
                            onChange={(e) =>
                              handleDeptChange(
                                dept.department,
                                'merit_pct_input',
                                e.target.value
                              )
                            }
                            className="w-20 text-right input py-1 px-2"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="0.1"
                            value={dept.promotion_pct_input}
                            onChange={(e) =>
                              handleDeptChange(
                                dept.department,
                                'promotion_pct_input',
                                e.target.value
                              )
                            }
                            className="w-20 text-right input py-1 px-2"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="0.1"
                            value={dept.market_pct_input}
                            onChange={(e) =>
                              handleDeptChange(
                                dept.department,
                                'market_pct_input',
                                e.target.value
                              )
                            }
                            className="w-20 text-right input py-1 px-2"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={dept.equity_budget_input}
                            onChange={(e) =>
                              handleDeptChange(
                                dept.department,
                                'equity_budget_input',
                                e.target.value
                              )
                            }
                            className="w-24 text-right input py-1 px-2"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Review & Confirm</h3>

              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Cycle Name</span>
                  <span className="font-medium">{cycleName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Effective Date</span>
                  <span className="font-medium">
                    {new Date(effectiveDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Salary Budget</span>
                  <span className="font-medium">
                    {(meritBudgetPct + promotionBudgetPct + marketBudgetPct).toFixed(1)}% of payroll
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Equity Budget</span>
                  <span className="font-medium text-indigo-600">
                    ${equityBudget.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="bg-primary-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-primary-900 mb-2">
                  Department Allocations
                </h4>
                <div className="space-y-1 text-sm">
                  {deptAllocations.slice(0, 5).map((dept) => (
                    <div key={dept.department} className="flex justify-between text-primary-700">
                      <span>{dept.department}</span>
                      <span>
                        {((parseFloat(dept.merit_pct_input) || 0) + (parseFloat(dept.promotion_pct_input) || 0) + (parseFloat(dept.market_pct_input) || 0)).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                  {deptAllocations.length > 5 && (
                    <p className="text-primary-600">
                      +{deptAllocations.length - 5} more departments
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between p-6 border-t border-gray-200">
          <button
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="btn-secondary"
          >
            Back
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            {currentStep < STEPS.length - 1 ? (
              <button
                onClick={() => setCurrentStep((s) => s + 1)}
                disabled={!canProceed()}
                className="btn-primary"
              >
                Next
              </button>
            ) : (
              <button onClick={handleComplete} className="btn-primary">
                Create Merit Cycle
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
