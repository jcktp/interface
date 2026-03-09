import { useState, useEffect } from 'react'
import { InformationCircleIcon } from '@heroicons/react/24/outline'

interface ParameterOption {
  type: 'int' | 'float' | 'bool' | 'select'
  min?: number
  max?: number
  step?: number
  default: any
  options?: string[]
}

interface HyperparameterFormProps {
  algorithm?: string
  currentValues: Record<string, any>
  parameterOptions: Record<string, ParameterOption>
  onChange: (params: Record<string, any>) => void
  isLoading: boolean
}

const PARAMETER_DESCRIPTIONS: Record<string, string> = {
  n_estimators: 'Number of trees/boosting rounds. Higher = more accurate but slower.',
  max_depth: 'Maximum depth of each tree. Higher = more complex patterns but risk of overfitting.',
  learning_rate: 'Step size for gradient descent. Lower = more stable but slower convergence.',
  subsample: 'Fraction of samples used per tree. Lower = more regularization.',
  colsample_bytree: 'Fraction of features used per tree. Lower = more regularization.',
  min_child_weight: 'Minimum samples in a leaf. Higher = more conservative model.',
  gamma: 'Minimum loss reduction for split. Higher = more conservative.',
  reg_alpha: 'L1 regularization. Higher = sparser model.',
  reg_lambda: 'L2 regularization. Higher = smaller weights.',
  min_samples_split: 'Minimum samples to split a node.',
  min_samples_leaf: 'Minimum samples in a leaf node.',
  max_features: 'Number of features to consider for splits.',
  bootstrap: 'Whether to use bootstrap samples.',
  xgb_weight: 'Weight for XGBoost predictions in ensemble.',
  rf_weight: 'Weight for Random Forest predictions in ensemble.',
  voting: 'How to combine predictions: soft (probabilities) or hard (classes).',
}

export default function HyperparameterForm({
  currentValues,
  parameterOptions,
  onChange,
  isLoading,
}: HyperparameterFormProps) {
  const [values, setValues] = useState<Record<string, any>>(currentValues)
  const [inputStrings, setInputStrings] = useState<Record<string, string>>({})

  useEffect(() => {
    setValues(currentValues)
    setInputStrings({})
  }, [currentValues])

  const handleChange = (key: string, value: any) => {
    const newValues = { ...values, [key]: value }
    setValues(newValues)
    onChange(newValues)
  }

  const handleNumberInputChange = (key: string, rawValue: string, option: ParameterOption) => {
    setInputStrings(prev => ({ ...prev, [key]: rawValue }))
    const numValue = option.type === 'int' ? parseInt(rawValue) : parseFloat(rawValue)
    if (!isNaN(numValue)) {
      const newValues = { ...values, [key]: numValue }
      setValues(newValues)
      onChange(newValues)
    }
  }

  const handleNumberInputBlur = (key: string, option: ParameterOption) => {
    const rawValue = inputStrings[key]
    if (rawValue !== undefined) {
      const numValue = option.type === 'int' ? parseInt(rawValue) : parseFloat(rawValue)
      const finalValue = isNaN(numValue) ? option.default : numValue
      const newValues = { ...values, [key]: finalValue }
      setValues(newValues)
      onChange(newValues)
      setInputStrings(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const renderParameter = (key: string, option: ParameterOption) => {
    const value = values[key] ?? option.default

    if (option.type === 'bool') {
      return (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => handleChange(key, e.target.checked)}
            className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          />
          <span className="text-sm text-gray-600">{value ? 'Enabled' : 'Disabled'}</span>
        </div>
      )
    }

    if (option.type === 'select' && option.options) {
      return (
        <select
          value={value}
          onChange={(e) => handleChange(key, e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
        >
          {option.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )
    }

    // int or float
    const numberInputValue = inputStrings[key] !== undefined ? inputStrings[key] : String(value)
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={option.min}
            max={option.max}
            step={option.step}
            value={value}
            onChange={(e) =>
              handleChange(
                key,
                option.type === 'int' ? parseInt(e.target.value) : parseFloat(e.target.value)
              )
            }
            className="flex-1"
          />
          <input
            type="number"
            min={option.min}
            max={option.max}
            step={option.step}
            value={numberInputValue}
            onChange={(e) => handleNumberInputChange(key, e.target.value, option)}
            onBlur={() => handleNumberInputBlur(key, option)}
            className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm text-right focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>Min: {option.min}</span>
          <span>Default: {option.default}</span>
          <span>Max: {option.max}</span>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    )
  }

  const paramKeys = Object.keys(parameterOptions)

  if (paramKeys.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-500">
        No hyperparameters available for this algorithm
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-medium text-gray-900">Hyperparameters</h3>
        <p className="text-xs text-gray-500 mt-1">
          Adjust parameters to fine-tune model performance
        </p>
      </div>

      <div className="p-4 space-y-6">
        {paramKeys.map((key) => {
          const option = parameterOptions[key]
          const description = PARAMETER_DESCRIPTIONS[key]

          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-medium text-gray-700">
                  {key.replace(/_/g, ' ')}
                </label>
                {description && (
                  <div className="group relative">
                    <InformationCircleIcon className="w-4 h-4 text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-10">
                      <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 max-w-xs">
                        {description}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {renderParameter(key, option)}
            </div>
          )
        })}
      </div>

      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <button
          onClick={() => {
            const defaults: Record<string, any> = {}
            Object.entries(parameterOptions).forEach(([key, opt]) => {
              defaults[key] = opt.default
            })
            setValues(defaults)
            setInputStrings({})
            onChange(defaults)
          }}
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  )
}
