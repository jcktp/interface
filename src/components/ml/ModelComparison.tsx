import { useMemo } from 'react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

interface Model {
  id: string
  name: string
  algorithm: string
  metrics: Record<string, number> | null
  feature_importance: Record<string, number> | null
  training_samples: number | null
  trained_at: string | null
}

interface ModelComparisonProps {
  models: Model[]
}

const METRIC_LABELS: Record<string, string> = {
  accuracy: 'Accuracy',
  precision: 'Precision',
  recall: 'Recall',
  f1_score: 'F1 Score',
  auc_roc: 'AUC-ROC',
  auc_pr: 'AUC-PR',
  r2_score: 'R² Score',
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444']

export default function ModelComparison({ models }: ModelComparisonProps) {
  // Get common metrics across all models
  const commonMetrics = useMemo(() => {
    if (models.length === 0) return []

    const metricSets = models.map((m) => new Set(Object.keys(m.metrics || {})))
    const common = [...metricSets[0]].filter((metric) =>
      metricSets.every((set) => set.has(metric))
    )

    // Filter to classification metrics for radar chart
    return common.filter((m) => ['accuracy', 'precision', 'recall', 'f1_score', 'auc_roc'].includes(m))
  }, [models])

  // Prepare radar chart data
  const radarData = useMemo(() => {
    return commonMetrics.map((metric) => {
      const dataPoint: Record<string, any> = {
        metric: METRIC_LABELS[metric] || metric,
      }
      models.forEach((model, index) => {
        dataPoint[`model${index}`] = (model.metrics?.[metric] || 0) * 100
      })
      return dataPoint
    })
  }, [commonMetrics, models])

  if (models.length < 2) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-500">Select at least 2 models to compare</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-medium text-gray-900">Model Comparison</h3>
        <p className="text-xs text-gray-500 mt-1">
          Comparing {models.length} models
        </p>
      </div>

      <div className="p-4 space-y-6">
        {/* Radar chart */}
        {radarData.length > 0 && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                {models.map((model, index) => (
                  <Radar
                    key={model.id}
                    name={model.name}
                    dataKey={`model${index}`}
                    stroke={COLORS[index % COLORS.length]}
                    fill={COLORS[index % COLORS.length]}
                    fillOpacity={0.2}
                  />
                ))}
                <Legend />
                <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Metrics table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-600">Metric</th>
                {models.map((model, index) => (
                  <th key={model.id} className="text-right py-2 px-3 font-medium">
                    <span
                      className="inline-block w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    {model.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {commonMetrics.map((metric) => {
                const values = models.map((m) => m.metrics?.[metric] || 0)
                const maxValue = Math.max(...values)

                return (
                  <tr key={metric} className="border-b border-gray-100">
                    <td className="py-2 px-3 text-gray-700">
                      {METRIC_LABELS[metric] || metric}
                    </td>
                    {models.map((model) => {
                      const value = model.metrics?.[metric] || 0
                      const isMax = value === maxValue
                      return (
                        <td
                          key={model.id}
                          className={`text-right py-2 px-3 ${
                            isMax ? 'font-bold text-success-600' : 'text-gray-600'
                          }`}
                        >
                          {(value * 100).toFixed(1)}%
                          {isMax && ' ★'}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
              <tr className="border-b border-gray-100 bg-gray-50">
                <td className="py-2 px-3 text-gray-700">Algorithm</td>
                {models.map((model) => (
                  <td key={model.id} className="text-right py-2 px-3 text-gray-600">
                    {model.algorithm}
                  </td>
                ))}
              </tr>
              <tr className="bg-gray-50">
                <td className="py-2 px-3 text-gray-700">Training Samples</td>
                {models.map((model) => (
                  <td key={model.id} className="text-right py-2 px-3 text-gray-600">
                    {model.training_samples?.toLocaleString() || '-'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Winner summary */}
        {models.length >= 2 && commonMetrics.length > 0 && (
          <div className="p-3 bg-success-50 rounded-lg">
            <h4 className="text-sm font-medium text-success-800 mb-1">Recommendation</h4>
            <p className="text-xs text-success-700">
              {(() => {
                // Count wins per model
                const wins = models.map(() => 0)
                commonMetrics.forEach((metric) => {
                  const values = models.map((m) => m.metrics?.[metric] || 0)
                  const maxIndex = values.indexOf(Math.max(...values))
                  wins[maxIndex]++
                })
                const winnerIndex = wins.indexOf(Math.max(...wins))
                const winner = models[winnerIndex]
                return (
                  <>
                    <strong>{winner.name}</strong> performs best overall, winning on{' '}
                    {wins[winnerIndex]} out of {commonMetrics.length} metrics.
                    Consider activating this model for production use.
                  </>
                )
              })()}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
