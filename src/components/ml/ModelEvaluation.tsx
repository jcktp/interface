import {
  ChartBarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

interface ModelEvaluationProps {
  metrics: Record<string, number> | null
  confusionMatrix: Record<string, number> | null
  modelType: string
  trainingSamples: number | null
  testSamples: number | null
}

const METRIC_THRESHOLDS: Record<string, { good: number; warning: number }> = {
  accuracy: { good: 0.8, warning: 0.7 },
  precision: { good: 0.75, warning: 0.6 },
  recall: { good: 0.7, warning: 0.55 },
  f1_score: { good: 0.75, warning: 0.6 },
  auc_roc: { good: 0.8, warning: 0.7 },
  auc_pr: { good: 0.7, warning: 0.5 },
  r2_score: { good: 0.8, warning: 0.6 },
}

const METRIC_LABELS: Record<string, string> = {
  accuracy: 'Accuracy',
  precision: 'Precision',
  recall: 'Recall',
  f1_score: 'F1 Score',
  auc_roc: 'AUC-ROC',
  auc_pr: 'AUC-PR',
  rmse: 'RMSE',
  mae: 'MAE',
  r2_score: 'R² Score',
}

const METRIC_DESCRIPTIONS: Record<string, string> = {
  accuracy: 'Percentage of correct predictions',
  precision: 'Of predicted positives, how many were correct',
  recall: 'Of actual positives, how many were found',
  f1_score: 'Harmonic mean of precision and recall',
  auc_roc: 'Area under the ROC curve (higher is better)',
  auc_pr: 'Area under Precision-Recall curve',
  rmse: 'Root mean squared error (lower is better)',
  mae: 'Mean absolute error (lower is better)',
  r2_score: 'Coefficient of determination',
}

export default function ModelEvaluation({
  metrics,
  confusionMatrix,
  modelType,
  trainingSamples,
  testSamples,
}: ModelEvaluationProps) {
  if (!metrics) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <ChartBarIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="font-medium text-gray-700">No Evaluation Data</h3>
        <p className="text-sm text-gray-500 mt-1">
          Train the model to see evaluation metrics
        </p>
      </div>
    )
  }

  const getMetricColor = (key: string, value: number) => {
    const threshold = METRIC_THRESHOLDS[key]
    if (!threshold) return 'text-gray-700'
    if (key === 'rmse' || key === 'mae') {
      // Lower is better for these
      return value < 0.2 ? 'text-success-600' : value < 0.4 ? 'text-warning-600' : 'text-danger-600'
    }
    if (value >= threshold.good) return 'text-success-600'
    if (value >= threshold.warning) return 'text-warning-600'
    return 'text-danger-600'
  }

  const getMetricIcon = (key: string, value: number) => {
    const threshold = METRIC_THRESHOLDS[key]
    if (!threshold) return null
    if (key === 'rmse' || key === 'mae') {
      return value < 0.3 ? CheckCircleIcon : ExclamationTriangleIcon
    }
    return value >= threshold.warning ? CheckCircleIcon : ExclamationTriangleIcon
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-medium text-gray-900">Model Evaluation</h3>
      </div>

      <div className="p-4 space-y-6">
        {/* Sample info */}
        {(trainingSamples || testSamples) && (
          <div className="flex gap-4 text-sm">
            {trainingSamples && (
              <div className="bg-gray-50 rounded-lg px-4 py-2">
                <span className="text-gray-500">Training:</span>{' '}
                <span className="font-medium text-gray-900">{trainingSamples.toLocaleString()}</span>
              </div>
            )}
            {testSamples && (
              <div className="bg-gray-50 rounded-lg px-4 py-2">
                <span className="text-gray-500">Test:</span>{' '}
                <span className="font-medium text-gray-900">{testSamples.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Metrics grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(metrics).map(([key, value]) => {
            const Icon = getMetricIcon(key, value)
            const isPercentage = !['rmse', 'mae'].includes(key)

            return (
              <div key={key} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-500">
                    {METRIC_LABELS[key] || key}
                  </span>
                  {Icon && (
                    <Icon className={`w-4 h-4 ${getMetricColor(key, value)}`} />
                  )}
                </div>
                <div className={`text-2xl font-bold ${getMetricColor(key, value)}`}>
                  {isPercentage ? `${(value * 100).toFixed(1)}%` : value.toFixed(4)}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {METRIC_DESCRIPTIONS[key]}
                </p>
              </div>
            )
          })}
        </div>

        {/* Confusion Matrix */}
        {confusionMatrix && modelType === 'attrition' && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Confusion Matrix</h4>
            <div className="grid grid-cols-2 gap-2 max-w-xs">
              <div className="bg-success-100 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-success-700">
                  {confusionMatrix.true_negative}
                </div>
                <div className="text-xs text-success-600">True Negative</div>
              </div>
              <div className="bg-warning-100 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-warning-700">
                  {confusionMatrix.false_positive}
                </div>
                <div className="text-xs text-warning-600">False Positive</div>
              </div>
              <div className="bg-danger-100 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-danger-700">
                  {confusionMatrix.false_negative}
                </div>
                <div className="text-xs text-danger-600">False Negative</div>
              </div>
              <div className="bg-success-100 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-success-700">
                  {confusionMatrix.true_positive}
                </div>
                <div className="text-xs text-success-600">True Positive</div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Predicted vs Actual: TN (stayed/stayed), FP (left/stayed), FN (stayed/left), TP (left/left)
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
