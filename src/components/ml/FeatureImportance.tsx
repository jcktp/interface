import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'

interface FeatureImportanceProps {
  importance: Record<string, number> | null
  maxFeatures?: number
}

const FEATURE_LABELS: Record<string, string> = {
  tenure: 'Tenure (years)',
  age: 'Age',
  salary: 'Salary',
  performance_rating: 'Performance Rating',
  engagement_score: 'Engagement Score',
  department: 'Department',
  job_level: 'Job Level',
  location: 'Location',
  manager_tenure: 'Manager Tenure',
  promotions_last_3y: 'Promotions (3yr)',
  salary_increase_pct: 'Salary Increase %',
  commute_distance: 'Commute Distance',
  training_hours: 'Training Hours',
  goals_completed: 'Goals Completed',
}

const COLORS = [
  '#6366f1', // primary-500
  '#8b5cf6', // violet-500
  '#a855f7', // purple-500
  '#d946ef', // fuchsia-500
  '#ec4899', // pink-500
  '#f43f5e', // rose-500
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#f59e0b', // amber-500
  '#84cc16', // lime-500
]

export default function FeatureImportance({
  importance,
  maxFeatures = 10,
}: FeatureImportanceProps) {
  const chartData = useMemo(() => {
    if (!importance) return []

    return Object.entries(importance)
      .sort(([, a], [, b]) => b - a)
      .slice(0, maxFeatures)
      .map(([feature, value], index) => ({
        feature,
        label: FEATURE_LABELS[feature] || feature.replace(/_/g, ' '),
        importance: value,
        percentage: (value * 100).toFixed(1),
        color: COLORS[index % COLORS.length],
      }))
  }, [importance, maxFeatures])

  if (!importance || Object.keys(importance).length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-500">No feature importance data available</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-medium text-gray-900">Feature Importance</h3>
        <p className="text-xs text-gray-500 mt-1">
          Which features have the most impact on predictions
        </p>
      </div>

      <div className="p-4">
        {/* Bar chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <XAxis
                type="number"
                domain={[0, 'dataMax']}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 12 }}
                width={90}
              />
              <Tooltip
                formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Importance']}
                labelFormatter={(label) => label}
              />
              <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.feature} fill={entry.color} />
                ))}
                <LabelList dataKey="percentage" position="right" fontSize={11} fill="#64748b" formatter={(val: string) => `${val}%`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend / List */}
        <div className="mt-4 space-y-2">
          {chartData.map((item) => (
            <div key={item.feature} className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-gray-700 flex-1">{item.label}</span>
              <span className="text-sm font-medium text-gray-900">{item.percentage}%</span>
            </div>
          ))}
        </div>

        {/* Interpretation */}
        <div className="mt-4 p-3 bg-primary-50 rounded-lg">
          <h4 className="text-sm font-medium text-primary-800 mb-1">Interpretation</h4>
          <p className="text-xs text-primary-700">
            {chartData[0] && (
              <>
                <strong>{chartData[0].label}</strong> is the most influential feature,
                accounting for {chartData[0].percentage}% of the model's predictions.
                {chartData.length > 2 && (
                  <>
                    {' '}The top 3 features together explain{' '}
                    {(
                      (chartData[0].importance + chartData[1].importance + chartData[2].importance) * 100
                    ).toFixed(0)}%
                    of the model's decision-making.
                  </>
                )}
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
