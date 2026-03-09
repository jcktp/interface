import {
  CpuChipIcon,
  CheckCircleIcon,
  ClockIcon,
  PlayIcon,
  TrashIcon,
  ChartBarIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { CpuChipIcon as CpuChipSolidIcon } from '@heroicons/react/24/solid'

interface Model {
  id: string
  name: string
  description: string | null
  model_type: string
  algorithm: string
  status: string
  is_active: boolean
  metrics: Record<string, number> | null
  feature_importance: Record<string, number> | null
  model_version: number | null
  trained_at: string | null
  created_at: string | null
}

interface ModelListProps {
  models: Model[]
  onSelect: (model: Model) => void
  onTrain: (modelId: string) => void
  onActivate: (modelId: string) => void
  onDelete: (modelId: string) => void
  selectedModelId: string | null
  isLoading: boolean
}

const MODEL_TYPE_LABELS: Record<string, string> = {
  attrition: 'Attrition Prediction',
  headcount_forecast: 'Headcount Forecast',
  performance: 'Performance Prediction',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  training: 'bg-warning-100 text-warning-700',
  trained: 'bg-primary-100 text-primary-700',
  active: 'bg-success-100 text-success-700',
  archived: 'bg-gray-100 text-gray-500',
}

export default function ModelList({
  models,
  onSelect,
  onTrain,
  onActivate,
  onDelete,
  selectedModelId,
  isLoading,
}: ModelListProps) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getMetricDisplay = (model: Model) => {
    if (!model.metrics) return null
    if (model.model_type === 'attrition') {
      return model.metrics.auc_roc
        ? `AUC: ${(model.metrics.auc_roc * 100).toFixed(1)}%`
        : null
    }
    if (model.metrics.r2_score) {
      return `R²: ${(model.metrics.r2_score * 100).toFixed(1)}%`
    }
    return null
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (models.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <CpuChipIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No models yet</h3>
        <p className="text-gray-500">Create your first ML model to get started</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
      {models.map((model) => (
        <div
          key={model.id}
          onClick={() => onSelect(model)}
          className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
            selectedModelId === model.id ? 'bg-primary-50 border-l-4 border-l-primary-500' : ''
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {model.is_active ? (
                <CpuChipSolidIcon className="w-8 h-8 text-success-500 flex-shrink-0" />
              ) : (
                <CpuChipIcon className="w-8 h-8 text-gray-400 flex-shrink-0" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900">{model.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[model.status]}`}>
                    {model.status}
                  </span>
                  {model.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-success-100 text-success-700">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {MODEL_TYPE_LABELS[model.model_type] || model.model_type} • {model.algorithm}
                </p>
                {model.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-1">{model.description}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  {model.model_version && (
                    <span>v{model.model_version}</span>
                  )}
                  {getMetricDisplay(model) && (
                    <span className="flex items-center gap-1">
                      <ChartBarIcon className="w-3 h-3" />
                      {getMetricDisplay(model)}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <ClockIcon className="w-3 h-3" />
                    Trained: {formatDate(model.trained_at)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {model.status === 'draft' || model.status === 'trained' ? (
                <button
                  onClick={() => onTrain(model.id)}
                  className="p-2 text-primary-600 hover:bg-primary-50 rounded"
                  title="Train model"
                >
                  <PlayIcon className="w-4 h-4" />
                </button>
              ) : model.status === 'training' ? (
                <div className="p-2">
                  <ArrowPathIcon className="w-4 h-4 text-warning-500 animate-spin" />
                </div>
              ) : null}
              {model.status === 'trained' && !model.is_active && (
                <button
                  onClick={() => onActivate(model.id)}
                  className="p-2 text-success-600 hover:bg-success-50 rounded"
                  title="Activate model"
                >
                  <CheckCircleIcon className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm('Delete this model?')) {
                    onDelete(model.id)
                  }
                }}
                className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded"
                title="Delete model"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
