import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useLocalization } from '../../hooks/useLocalization'
import { Scenario, MonteCarloResult } from './types'

interface Props {
  monteCarloResults: Record<string, MonteCarloResult>
  selectedScenarios: string[]
  scenarios: Scenario[]
}

export default function MonteCarloResults({ monteCarloResults, selectedScenarios, scenarios }: Props) {
  const loc = useLocalization()

  if (Object.keys(monteCarloResults).length === 0) return null

  return (
    <div className="card">
      <h3 className="card-header">Monte Carlo Simulation Results</h3>
      <p className="text-sm text-gray-500 mb-4">
        1,000 simulations with randomized parameters to assess outcome probability distributions
      </p>
      <div className="space-y-6">
        {selectedScenarios
          .filter(id => monteCarloResults[id])
          .map(scenarioId => {
            const scenario = scenarios.find(s => s.id === scenarioId)
            const mc = monteCarloResults[scenarioId]
            if (!scenario || !mc) return null

            return (
              <div key={scenarioId} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: scenario.color }} />
                  <h4 className="font-semibold text-gray-900">{scenario.name}</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Profit Distribution */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Projected Profit</span>
                      {mc.profit.probability_positive >= 0.8 ? (
                        <span className="flex items-center gap-1 text-success-600 text-xs">
                          <ArrowTrendingUpIcon className="w-4 h-4" />
                          High Confidence
                        </span>
                      ) : mc.profit.probability_positive >= 0.5 ? (
                        <span className="flex items-center gap-1 text-warning-600 text-xs">
                          <ExclamationTriangleIcon className="w-4 h-4" />
                          Moderate Risk
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-danger-600 text-xs">
                          <ArrowTrendingDownIcon className="w-4 h-4" />
                          High Risk
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Best Case (P90)</span>
                        <span className="font-medium">{loc.currency(mc.profit.p90, true)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Expected (P50)</span>
                        <span className="font-semibold text-primary-600">{loc.currency(mc.profit.p50, true)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Worst Case (P10)</span>
                        <span className="font-medium">{loc.currency(mc.profit.p10, true)}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Prob. of exceeding current</span>
                        <span className={clsx(
                          'font-semibold',
                          mc.profit.probability_positive >= 0.7 ? 'text-success-600' :
                          mc.profit.probability_positive >= 0.5 ? 'text-warning-600' : 'text-danger-600'
                        )}>
                          {(mc.profit.probability_positive * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Headcount Distribution */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 block mb-2">Projected Headcount</span>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Best Case (P90)</span>
                        <span className="font-medium">{loc.number(Math.round(mc.headcount.p90))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Expected (P50)</span>
                        <span className="font-semibold text-primary-600">{loc.number(Math.round(mc.headcount.p50))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Worst Case (P10)</span>
                        <span className="font-medium">{loc.number(Math.round(mc.headcount.p10))}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Standard Deviation</span>
                        <span className="font-medium">±{Math.round(mc.headcount.std)}</span>
                      </div>
                    </div>
                  </div>

                  {/* ROI Distribution */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 block mb-2">Expected ROI</span>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Best Case (P90)</span>
                        <span className="font-medium">{mc.roi.p90.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Expected (P50)</span>
                        <span className={clsx(
                          'font-semibold',
                          mc.roi.p50 >= 15 ? 'text-success-600' :
                          mc.roi.p50 >= 5 ? 'text-warning-600' : 'text-danger-600'
                        )}>
                          {mc.roi.p50.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Worst Case (P10)</span>
                        <span className="font-medium">{mc.roi.p10.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Risk-adjusted return</span>
                        <span className="font-medium">{(mc.roi.mean / (mc.roi.std || 1)).toFixed(2)} Sharpe</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
