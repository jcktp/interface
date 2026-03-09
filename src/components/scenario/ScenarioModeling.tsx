import { PlusIcon, PencilIcon, TrashIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import LineChart from '../charts/LineChart'
import { Scenario } from './types'

interface Props {
  scenarios: Scenario[]
  selectedScenarios: string[]
  forecastMonths: number
  setForecastMonths: (months: number) => void
  addCustomScenario: () => void
  toggleScenario: (id: string) => void
  editingScenario: string | null
  startEditingScenario: (id: string | null) => void
  deleteScenario: (id: string) => void
  scenarioParamInputs: Record<string, string>
  updateScenarioParamInput: (param: keyof Scenario['parameters'], value: string) => void
  commitScenarioParams: (id: string) => void
  runMonteCarloSimulation: (id: string) => void
  isRunningMonteCarlo: boolean
  scenarioProjections: any[]
}

export default function ScenarioModeling({
  scenarios,
  selectedScenarios,
  forecastMonths,
  setForecastMonths,
  addCustomScenario,
  toggleScenario,
  editingScenario,
  startEditingScenario,
  deleteScenario,
  scenarioParamInputs,
  updateScenarioParamInput,
  commitScenarioParams,
  runMonteCarloSimulation,
  isRunningMonteCarlo,
  scenarioProjections,
}: Props) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="card-header mb-0">Scenario Modeling</h3>
        <div className="flex items-center gap-3">
          <select
            value={forecastMonths}
            onChange={(e) => setForecastMonths(Number(e.target.value))}
            className="input py-1 px-3 w-auto"
          >
            <option value={12}>12 months</option>
            <option value={24}>24 months</option>
            <option value={36}>36 months</option>
          </select>
          <button onClick={addCustomScenario} className="btn-primary">
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Scenario
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {scenarios.map((scenario) => (
          <div
            key={scenario.id}
            className={clsx(
              'p-3 rounded-lg border-2 transition-all relative group',
              selectedScenarios.includes(scenario.id)
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <button
                onClick={() => toggleScenario(scenario.id)}
                className="flex items-center gap-2 flex-1"
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: scenario.color }} />
                <span className="font-medium text-sm">{scenario.name}</span>
              </button>
              {scenario.type === 'custom' && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEditingScenario(editingScenario === scenario.id ? null : scenario.id)}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Edit"
                  >
                    <PencilIcon className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <button
                    onClick={() => deleteScenario(scenario.id)}
                    className="p-1 hover:bg-danger-100 rounded"
                    title="Delete"
                  >
                    <TrashIcon className="w-3.5 h-3.5 text-danger-500" />
                  </button>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 mb-2">
              Growth: {scenario.parameters.growthRate > 0 ? '+' : ''}{scenario.parameters.growthRate}% |
              Attrition: {scenario.parameters.attritionRate}%
            </div>

            {/* Inline Parameter Editor */}
            {editingScenario === scenario.id && (
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                <div>
                  <label className="text-xs text-gray-500">Growth Rate (%)</label>
                  <input
                    type="number"
                    value={scenarioParamInputs.growthRate ?? ''}
                    onChange={(e) => updateScenarioParamInput('growthRate', e.target.value)}
                    onBlur={() => commitScenarioParams(scenario.id)}
                    className="input py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Attrition Rate (%)</label>
                  <input
                    type="number"
                    value={scenarioParamInputs.attritionRate ?? ''}
                    onChange={(e) => updateScenarioParamInput('attritionRate', e.target.value)}
                    onBlur={() => commitScenarioParams(scenario.id)}
                    className="input py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Revenue Growth (%)</label>
                  <input
                    type="number"
                    value={scenarioParamInputs.revenueGrowth ?? ''}
                    onChange={(e) => updateScenarioParamInput('revenueGrowth', e.target.value)}
                    onBlur={() => commitScenarioParams(scenario.id)}
                    className="input py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Hiring Pace (%)</label>
                  <input
                    type="number"
                    value={scenarioParamInputs.hiringPace ?? ''}
                    onChange={(e) => updateScenarioParamInput('hiringPace', e.target.value)}
                    onBlur={() => commitScenarioParams(scenario.id)}
                    className="input py-1 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Monte Carlo Run Button */}
            {selectedScenarios.includes(scenario.id) && (
              <button
                onClick={() => runMonteCarloSimulation(scenario.id)}
                disabled={isRunningMonteCarlo}
                className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-primary-600 hover:text-primary-700 py-1"
              >
                <ChartBarIcon className="w-3.5 h-3.5" />
                {isRunningMonteCarlo ? 'Running...' : 'Run Monte Carlo'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Headcount Projection Chart */}
      <h4 className="font-medium text-gray-900 mb-3">Headcount Projection</h4>
      <LineChart
        data={scenarioProjections}
        xKey="date"
        lines={scenarios
          .filter((s) => selectedScenarios.includes(s.id))
          .map((s) => ({
            key: s.id,
            name: s.name,
            color: s.color,
            dashed: s.type === 'custom',
          }))}
        height={350}
        showDots={false}
      />
    </div>
  )
}
