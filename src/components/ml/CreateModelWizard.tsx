import { useState, useCallback } from 'react'
import { XMarkIcon, ChevronRightIcon, ChevronLeftIcon, CloudArrowUpIcon, CodeBracketIcon } from '@heroicons/react/24/outline'
import {
  UserMinusIcon,
  ChartBarIcon,
  TrophyIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline'
import Editor from '@monaco-editor/react'
import toast from 'react-hot-toast'
import api from '../../api'

interface CreateModelWizardProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (data: {
    name: string
    model_type: string
    algorithm: string
    description: string
  }) => void
  isCreating: boolean
}

const MODEL_TYPES = [
  {
    id: 'attrition',
    name: 'Attrition Prediction',
    description: 'Predict which employees are at risk of leaving',
    icon: UserMinusIcon,
    features: ['Tenure', 'Salary', 'Performance', 'Engagement', 'Department'],
  },
  {
    id: 'headcount_forecast',
    name: 'Headcount Forecast',
    description: 'Forecast future headcount based on historical trends',
    icon: ChartBarIcon,
    features: ['Historical data', 'Seasonality', 'Growth rate', 'Department trends'],
  },
  {
    id: 'performance',
    name: 'Performance Prediction',
    description: 'Predict employee performance ratings',
    icon: TrophyIcon,
    features: ['Training hours', 'Goals', 'Tenure', 'Manager feedback'],
  },
]

const ALGORITHMS = [
  {
    id: 'xgboost',
    name: 'XGBoost',
    description: 'Gradient boosting with excellent accuracy for tabular data',
    pros: ['High accuracy', 'Handles missing data', 'Feature importance'],
  },
  {
    id: 'random_forest',
    name: 'Random Forest',
    description: 'Ensemble of decision trees with good generalization',
    pros: ['Robust to outliers', 'Less overfitting', 'Interpretable'],
  },
  {
    id: 'ensemble',
    name: 'Ensemble',
    description: 'Combination of XGBoost and Random Forest',
    pros: ['Best of both', 'Higher accuracy', 'More stable predictions'],
  },
]

const IMPORT_FORMATS = ['.joblib', '.pkl', '.onnx']

const DEFAULT_CODE_TEMPLATE = `import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import GradientBoostingClassifier

# Define your model pipeline
def build_model():
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('classifier', GradientBoostingClassifier(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=3,
            random_state=42,
        ))
    ])
    return pipeline

# Feature columns used for training
FEATURE_COLUMNS = [
    'tenure_months',
    'salary',
    'performance_score',
    'engagement_score',
    'department_encoded',
]

# Target column
TARGET_COLUMN = 'attrition'
`

type WizardTab = 'template' | 'import' | 'custom'

export default function CreateModelWizard({
  isOpen,
  onClose,
  onCreate,
  isCreating,
}: CreateModelWizardProps) {
  const [activeWizardTab, setActiveWizardTab] = useState<WizardTab>('template')

  // Template tab state
  const [step, setStep] = useState(1)
  const [modelType, setModelType] = useState('')
  const [algorithm, setAlgorithm] = useState('xgboost')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  // Import tab state
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importName, setImportName] = useState('')
  const [importDescription, setImportDescription] = useState('')
  const [importModelType, setImportModelType] = useState('attrition')
  const [isDragging, setIsDragging] = useState(false)
  const [importing, setImporting] = useState(false)

  // Custom code tab state
  const [customCode, setCustomCode] = useState(DEFAULT_CODE_TEMPLATE)
  const [customName, setCustomName] = useState('')
  const [customDescription, setCustomDescription] = useState('')
  const [customModelType, setCustomModelType] = useState('attrition')
  const [savingCustom, setSavingCustom] = useState(false)

  const handleClose = () => {
    setStep(1)
    setModelType('')
    setAlgorithm('xgboost')
    setName('')
    setDescription('')
    setImportFile(null)
    setImportName('')
    setImportDescription('')
    setImportModelType('attrition')
    setCustomCode(DEFAULT_CODE_TEMPLATE)
    setCustomName('')
    setCustomDescription('')
    setCustomModelType('attrition')
    setActiveWizardTab('template')
    onClose()
  }

  const handleCreate = () => {
    onCreate({
      name,
      model_type: modelType,
      algorithm,
      description,
    })
  }

  const canProceed = () => {
    if (step === 1) return !!modelType
    if (step === 2) return !!algorithm
    if (step === 3) return !!name.trim()
    return true
  }

  // Import handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (IMPORT_FORMATS.includes(ext)) {
        setImportFile(file)
      } else {
        toast.error(`Unsupported format. Please use ${IMPORT_FORMATS.join(', ')}`)
      }
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (IMPORT_FORMATS.includes(ext)) {
        setImportFile(file)
      } else {
        toast.error(`Unsupported format. Please use ${IMPORT_FORMATS.join(', ')}`)
      }
    }
  }

  const handleImport = async () => {
    if (!importFile || !importName.trim()) return
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      formData.append('name', importName)
      formData.append('description', importDescription)
      formData.append('model_type', importModelType)
      await api.post('/ml/models/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Model imported successfully')
      handleClose()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to import model')
    } finally {
      setImporting(false)
    }
  }

  const handleSaveCustom = async () => {
    if (!customName.trim() || !customCode.trim()) return
    setSavingCustom(true)
    try {
      await api.post('/ml/models/custom', {
        name: customName,
        description: customDescription,
        model_type: customModelType,
        code: customCode,
      })
      toast.success('Custom model saved and training started')
      handleClose()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save custom model')
    } finally {
      setSavingCustom(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Create ML Model</h2>
            {activeWizardTab === 'template' && (
              <p className="text-sm text-gray-500">Step {step} of 3</p>
            )}
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-6 pt-4 pb-0 border-b border-gray-200 flex-shrink-0">
          <div className="flex gap-1">
            {([
              { id: 'template', label: 'Use Template', icon: CpuChipIcon },
              { id: 'import', label: 'Import Model', icon: CloudArrowUpIcon },
              { id: 'custom', label: 'Custom Code', icon: CodeBracketIcon },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveWizardTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeWizardTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Progress bar (template only) */}
        {activeWizardTab === 'template' && (
          <div className="h-1 bg-gray-100 flex-shrink-0">
            <div
              className="h-full bg-primary-500 transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* ==================== TEMPLATE TAB ==================== */}
          {activeWizardTab === 'template' && (
            <>
              {step === 1 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Select Model Type</h3>
                  <div className="space-y-3">
                    {MODEL_TYPES.map((type) => (
                      <div
                        key={type.id}
                        onClick={() => setModelType(type.id)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          modelType === type.id
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <type.icon className={`w-8 h-8 flex-shrink-0 ${
                            modelType === type.id ? 'text-primary-600' : 'text-gray-400'
                          }`} />
                          <div>
                            <h4 className="font-medium text-gray-900">{type.name}</h4>
                            <p className="text-sm text-gray-500 mt-1">{type.description}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {type.features.map((feature) => (
                                <span
                                  key={feature}
                                  className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                                >
                                  {feature}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Select Algorithm</h3>
                  <div className="space-y-3">
                    {ALGORITHMS.map((alg) => (
                      <div
                        key={alg.id}
                        onClick={() => setAlgorithm(alg.id)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          algorithm === alg.id
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <CpuChipIcon className={`w-8 h-8 flex-shrink-0 ${
                            algorithm === alg.id ? 'text-primary-600' : 'text-gray-400'
                          }`} />
                          <div>
                            <h4 className="font-medium text-gray-900">{alg.name}</h4>
                            <p className="text-sm text-gray-500 mt-1">{alg.description}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {alg.pros.map((pro) => (
                                <span
                                  key={pro}
                                  className="text-xs bg-success-100 text-success-700 px-2 py-0.5 rounded"
                                >
                                  {pro}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Model Details</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Model Name *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Q1 2025 Attrition Model"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optional description of this model's purpose..."
                        rows={3}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Summary</h4>
                      <dl className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Model Type:</dt>
                          <dd className="text-gray-900">
                            {MODEL_TYPES.find((t) => t.id === modelType)?.name}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Algorithm:</dt>
                          <dd className="text-gray-900">
                            {ALGORITHMS.find((a) => a.id === algorithm)?.name}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ==================== IMPORT TAB ==================== */}
          {activeWizardTab === 'import' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Import Existing Model</h3>
              <p className="text-sm text-gray-500">Upload a pre-trained model file in .joblib, .pkl, or .onnx format.</p>

              {/* File Upload Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging
                    ? 'border-primary-400 bg-primary-50'
                    : importFile
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                {importFile ? (
                  <div>
                    <CloudArrowUpIcon className="h-10 w-10 text-green-500 mx-auto mb-2" />
                    <p className="text-sm font-medium text-green-700">{importFile.name}</p>
                    <p className="text-xs text-green-500 mt-1">{(importFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    <button
                      onClick={() => setImportFile(null)}
                      className="text-xs text-red-500 hover:text-red-700 mt-2"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <CloudArrowUpIcon className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      Drag and drop your model file here, or{' '}
                      <label className="text-primary-600 hover:text-primary-700 cursor-pointer font-medium">
                        browse
                        <input
                          type="file"
                          accept=".joblib,.pkl,.onnx"
                          onChange={handleFileSelect}
                          className="sr-only"
                        />
                      </label>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Supported: {IMPORT_FORMATS.join(', ')}</p>
                  </div>
                )}
              </div>

              {/* Import form fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model Name *</label>
                <input
                  type="text"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  placeholder="e.g., Production Attrition Model v2"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={importDescription}
                  onChange={(e) => setImportDescription(e.target.value)}
                  placeholder="Optional description..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model Type</label>
                <select
                  value={importModelType}
                  onChange={(e) => setImportModelType(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                >
                  {MODEL_TYPES.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* ==================== CUSTOM CODE TAB ==================== */}
          {activeWizardTab === 'custom' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Custom Code Model</h3>
              <p className="text-sm text-gray-500">Write a custom sklearn pipeline. The code will be saved and executed during training.</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model Name *</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g., Custom Engagement Model"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model Type</label>
                  <select
                    value={customModelType}
                    onChange={(e) => setCustomModelType(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {MODEL_TYPES.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="Optional description..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Python Code</label>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <Editor
                    height="350px"
                    defaultLanguage="python"
                    value={customCode}
                    onChange={(val) => setCustomCode(val || '')}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      tabSize: 4,
                    }}
                    theme="vs-dark"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between flex-shrink-0">
          {activeWizardTab === 'template' ? (
            <>
              <button
                onClick={() => step > 1 && setStep(step - 1)}
                disabled={step === 1}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <ChevronLeftIcon className="w-4 h-4" />
                Back
              </button>

              {step < 3 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={!canProceed()}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  Next
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleCreate}
                  disabled={!canProceed() || isCreating}
                  className="btn-primary"
                >
                  {isCreating ? 'Creating...' : 'Create Model'}
                </button>
              )}
            </>
          ) : activeWizardTab === 'import' ? (
            <>
              <div />
              <button
                onClick={handleImport}
                disabled={!importFile || !importName.trim() || importing}
                className="btn-primary inline-flex items-center gap-2"
              >
                <CloudArrowUpIcon className="w-4 h-4" />
                {importing ? 'Importing...' : 'Import'}
              </button>
            </>
          ) : (
            <>
              <div />
              <button
                onClick={handleSaveCustom}
                disabled={!customName.trim() || !customCode.trim() || savingCustom}
                className="btn-primary inline-flex items-center gap-2"
              >
                <CodeBracketIcon className="w-4 h-4" />
                {savingCustom ? 'Saving...' : 'Save & Train'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
