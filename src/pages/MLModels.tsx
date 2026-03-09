import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PlusIcon,
  ArrowPathIcon,
  PlayIcon,
  CheckCircleIcon,
  ScaleIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import api from '../api'
import {
  ModelList,
  CreateModelWizard,
  HyperparameterForm,
  TrainingProgress,
  ModelEvaluation,
  FeatureImportance,
  ModelComparison,
} from '../components/ml'

interface Model {
  id: string
  name: string
  description: string | null
  model_type: string
  algorithm: string
  status: string
  is_active: boolean
  hyperparameters: Record<string, any> | null
  feature_config: Record<string, any> | null
  target_column: string | null
  metrics: Record<string, number> | null
  feature_importance: Record<string, number> | null
  confusion_matrix: Record<string, number> | null
  training_samples: number | null
  test_samples: number | null
  model_version: number | null
  trained_at: string | null
  activated_at: string | null
  created_at: string | null
}

type TabType = 'overview' | 'hyperparameters' | 'evaluation' | 'predictions' | 'compare'

export default function MLModels() {
  const queryClient = useQueryClient()
  const [showCreateWizard, setShowCreateWizard] = useState(false)
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [compareModels, setCompareModels] = useState<string[]>([])
  const [runningPrediction, setRunningPrediction] = useState(false)

  // Fetch models
  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ['mlModels'],
    queryFn: async () => {
      const response = await api.get('/ml/models')
      return response.data.models as Model[]
    },
  })

  // Fetch selected model details
  const { data: modelDetails } = useQuery({
    queryKey: ['mlModel', selectedModel?.id],
    queryFn: async () => {
      if (!selectedModel?.id) return null
      const response = await api.get(`/ml/models/${selectedModel.id}`)
      return response.data.model as Model
    },
    enabled: !!selectedModel?.id,
  })

  // Fetch hyperparameter options
  const { data: hyperparamOptions, isLoading: paramsLoading } = useQuery({
    queryKey: ['hyperparameters', modelDetails?.algorithm],
    queryFn: async () => {
      if (!modelDetails?.algorithm) return {}
      const response = await api.get(`/ml/hyperparameters/${modelDetails.algorithm}`)
      return response.data.parameters
    },
    enabled: !!modelDetails?.algorithm,
  })

  // Fetch training status
  const { data: trainingStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['trainingStatus', selectedModel?.id],
    queryFn: async () => {
      if (!selectedModel?.id) return null
      const response = await api.get(`/ml/models/${selectedModel.id}/training-status`)
      return response.data.job
    },
    enabled: !!selectedModel?.id,
    refetchInterval: selectedModel?.status === 'training' ? 2000 : false,
  })

  // Fetch comparison data
  const { data: comparisonData } = useQuery({
    queryKey: ['modelComparison', compareModels],
    queryFn: async () => {
      if (compareModels.length < 2) return null
      const response = await api.post('/ml/compare', { model_ids: compareModels })
      return response.data.models
    },
    enabled: compareModels.length >= 2,
  })

  // Fetch active models summary for insights panel
  const { data: activeModels } = useQuery({
    queryKey: ['ml-active-models'],
    queryFn: async () => {
      const response = await api.get('/ml/models?status=active')
      return response.data.models as Model[]
    },
  })

  // Fetch employee risk scores for selected attrition model
  const { data: employeeScores, isLoading: scoresLoading, refetch: refetchScores } = useQuery({
    queryKey: ['employeeScores', selectedModel?.id],
    queryFn: async () => {
      if (!selectedModel?.id || selectedModel.model_type !== 'attrition') return null
      const response = await api.get(`/ml/models/${selectedModel.id}/employee-scores?limit=50`)
      return response.data
    },
    enabled: !!selectedModel?.id && selectedModel?.model_type === 'attrition' && selectedModel?.status !== 'draft',
  })

  // Fetch headcount forecast for headcount_forecast models
  const { data: forecastData, isLoading: forecastLoading } = useQuery({
    queryKey: ['headcountForecast', selectedModel?.id],
    queryFn: async () => {
      if (!selectedModel?.id) return null
      const response = await api.get(`/ml/models/${selectedModel.id}/forecast?months=12`)
      return response.data
    },
    enabled: !!selectedModel?.id && selectedModel?.model_type === 'headcount_forecast' && selectedModel?.status !== 'draft',
  })

  // Create model mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; model_type: string; algorithm: string; description: string }) => {
      const response = await api.post('/ml/models', data)
      return response.data
    },
    onSuccess: () => {
      toast.success('Model created')
      setShowCreateWizard(false)
      queryClient.invalidateQueries({ queryKey: ['mlModels'] })
      queryClient.invalidateQueries({ queryKey: ['ml-active-models'] })
      queryClient.invalidateQueries({ queryKey: ['ml-prediction'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create model')
    },
  })

  // Update model mutation
  const updateMutation = useMutation({
    mutationFn: async ({ modelId, updates }: { modelId: string; updates: any }) => {
      const response = await api.put(`/ml/models/${modelId}`, updates)
      return response.data
    },
    onSuccess: () => {
      toast.success('Model updated')
      queryClient.invalidateQueries({ queryKey: ['mlModel', selectedModel?.id] })
      queryClient.invalidateQueries({ queryKey: ['ml-active-models'] })
      queryClient.invalidateQueries({ queryKey: ['ml-prediction'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update model')
    },
  })

  // Train model mutation
  const trainMutation = useMutation({
    mutationFn: async (modelId: string) => {
      const response = await api.post(`/ml/models/${modelId}/train`)
      return response.data
    },
    onSuccess: () => {
      toast.success('Training started')
      queryClient.invalidateQueries({ queryKey: ['mlModels'] })
      queryClient.invalidateQueries({ queryKey: ['trainingStatus', selectedModel?.id] })
      queryClient.invalidateQueries({ queryKey: ['ml-active-models'] })
      queryClient.invalidateQueries({ queryKey: ['ml-prediction'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to start training')
    },
  })

  // Activate model mutation
  const activateMutation = useMutation({
    mutationFn: async (modelId: string) => {
      const response = await api.post(`/ml/models/${modelId}/activate`)
      return response.data
    },
    onSuccess: () => {
      toast.success('Model activated')
      queryClient.invalidateQueries({ queryKey: ['mlModels'] })
      queryClient.invalidateQueries({ queryKey: ['mlModel', selectedModel?.id] })
      queryClient.invalidateQueries({ queryKey: ['ml-active-models'] })
      queryClient.invalidateQueries({ queryKey: ['ml-prediction'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to activate model')
    },
  })

  // Delete model mutation
  const deleteMutation = useMutation({
    mutationFn: async (modelId: string) => {
      await api.delete(`/ml/models/${modelId}`)
    },
    onSuccess: () => {
      toast.success('Model deleted')
      setSelectedModel(null)
      queryClient.invalidateQueries({ queryKey: ['mlModels'] })
      queryClient.invalidateQueries({ queryKey: ['ml-active-models'] })
      queryClient.invalidateQueries({ queryKey: ['ml-prediction'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete model')
    },
  })

  // Update local state when details load
  useEffect(() => {
    if (modelDetails) {
      setSelectedModel(modelDetails)
    }
  }, [modelDetails])

  // Refresh when training completes
  useEffect(() => {
    if (trainingStatus?.status === 'completed') {
      queryClient.invalidateQueries({ queryKey: ['mlModels'] })
      queryClient.invalidateQueries({ queryKey: ['mlModel', selectedModel?.id] })
      queryClient.invalidateQueries({ queryKey: ['ml-active-models'] })
      queryClient.invalidateQueries({ queryKey: ['ml-prediction'] })
    }
  }, [trainingStatus?.status, selectedModel?.id, queryClient])

  const handleHyperparameterChange = (params: Record<string, any>) => {
    if (selectedModel) {
      updateMutation.mutate({
        modelId: selectedModel.id,
        updates: { hyperparameters: params },
      })
    }
  }

  const toggleCompareModel = (modelId: string) => {
    setCompareModels((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId]
    )
  }

  const handleRunPredictions = async (modelId: string) => {
    setRunningPrediction(true)
    try {
      await api.post(`/ml/models/${modelId}/predict`)
      toast.success('Predictions generated')
      queryClient.invalidateQueries({ queryKey: ['employeeScores', modelId] })
      queryClient.invalidateQueries({ queryKey: ['headcountForecast', modelId] })
      refetchScores()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to run predictions')
    } finally {
      setRunningPrediction(false)
    }
  }

  const highRiskCount = employeeScores?.scores?.filter((s: any) => s.risk_level === 'high').length ?? 0
  const activeAttritionModel = activeModels?.find(m => m.model_type === 'attrition')
  const activeForecastModel = activeModels?.find(m => m.model_type === 'headcount_forecast')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prediction Modeling</h1>
          <p className="text-gray-600 mt-1">
            Build, train, and deploy ML models for workforce predictions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {compareModels.length >= 2 && (
            <button
              onClick={() => setActiveTab('compare')}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <ScaleIcon className="w-4 h-4" />
              Compare ({compareModels.length})
            </button>
          )}
          <button
            onClick={() => setShowCreateWizard(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            Create Model
          </button>
        </div>
      </div>

      {/* Insights Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Active Attrition Model</p>
          {activeAttritionModel ? (
            <div className="mt-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{activeAttritionModel.name}</p>
              <p className="text-xs text-gray-500">{activeAttritionModel.algorithm} · v{activeAttritionModel.model_version}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 mt-1">None active</p>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Active Forecast Model</p>
          {activeForecastModel ? (
            <div className="mt-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{activeForecastModel.name}</p>
              <p className="text-xs text-gray-500">{activeForecastModel.algorithm} · v{activeForecastModel.model_version}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 mt-1">None active</p>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">High Attrition Risk</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{highRiskCount > 0 ? highRiskCount.toLocaleString() : '—'}</p>
          <p className="text-xs text-gray-500">{highRiskCount > 0 ? 'employees flagged' : 'Run predictions to see'}</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left sidebar - Model list */}
        <div className="col-span-4">
          <ModelList
            models={modelsData || []}
            onSelect={(model) => setSelectedModel(model as Model)}
            onTrain={(id) => trainMutation.mutate(id)}
            onActivate={(id) => activateMutation.mutate(id)}
            onDelete={(id) => deleteMutation.mutate(id)}
            selectedModelId={selectedModel?.id || null}
            isLoading={modelsLoading}
          />
        </div>

        {/* Main content */}
        <div className="col-span-8">
          {selectedModel ? (
            <div className="space-y-4">
              {/* Model header */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selectedModel.name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedModel.model_type} • {selectedModel.algorithm}
                      {selectedModel.model_version && ` • v${selectedModel.model_version}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedModel.status === 'trained' && (
                      <button
                        onClick={() => setActiveTab('hyperparameters')}
                        className="btn-secondary inline-flex items-center gap-2"
                      >
                        <AdjustmentsHorizontalIcon className="w-4 h-4" />
                        Fine-tune
                      </button>
                    )}
                    {selectedModel.status === 'trained' && !selectedModel.is_active && (
                      <button
                        onClick={() => activateMutation.mutate(selectedModel.id)}
                        disabled={activateMutation.isPending}
                        className="btn-secondary inline-flex items-center gap-2"
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                        Activate
                      </button>
                    )}
                    <button
                      onClick={() => trainMutation.mutate(selectedModel.id)}
                      disabled={trainMutation.isPending || selectedModel.status === 'training'}
                      className="btn-primary inline-flex items-center gap-2"
                    >
                      {selectedModel.status === 'training' ? (
                        <>
                          <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          Training...
                        </>
                      ) : (
                        <>
                          <PlayIcon className="w-4 h-4" />
                          Train Model
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200">
                <nav className="flex gap-4">
                  {[
                    { id: 'overview', label: 'Overview' },
                    { id: 'hyperparameters', label: 'Hyperparameters' },
                    { id: 'evaluation', label: 'Evaluation' },
                    { id: 'predictions', label: 'Predictions' },
                    { id: 'compare', label: 'Compare' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as TabType)}
                      className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab content */}
              <div>
                {activeTab === 'overview' && (
                  <div className="grid grid-cols-2 gap-4">
                    <TrainingProgress
                      job={trainingStatus}
                      isLoading={statusLoading}
                    />
                    <FeatureImportance
                      importance={selectedModel.feature_importance}
                    />
                  </div>
                )}

                {activeTab === 'hyperparameters' && (
                  <div className="space-y-4">
                    {selectedModel.status === 'trained' && (
                      <div className="bg-accent-50 border border-accent-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-accent-700 mb-1">Fine-tune this model</h4>
                        <p className="text-sm text-accent-600">
                          Adjust hyperparameters below and click "Train Model" to retrain with the updated configuration.
                          {selectedModel.model_version && ` Current version: v${selectedModel.model_version}.`}
                        </p>
                      </div>
                    )}
                    <HyperparameterForm
                      algorithm={selectedModel.algorithm}
                      currentValues={selectedModel.hyperparameters || {}}
                      parameterOptions={hyperparamOptions || {}}
                      onChange={handleHyperparameterChange}
                      isLoading={paramsLoading}
                    />
                  </div>
                )}

                {activeTab === 'evaluation' && (
                  <ModelEvaluation
                    metrics={selectedModel.metrics}
                    confusionMatrix={selectedModel.confusion_matrix}
                    modelType={selectedModel.model_type}
                    trainingSamples={selectedModel.training_samples}
                    testSamples={selectedModel.test_samples}
                  />
                )}

                {activeTab === 'predictions' && (
                  <div className="space-y-4">
                    {selectedModel.status === 'draft' ? (
                      <div className="text-center py-12 text-gray-500">
                        <p className="text-sm">Train the model first to generate predictions.</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600">
                            {selectedModel.model_type === 'attrition'
                              ? 'Employee attrition risk scores based on current active employees.'
                              : selectedModel.model_type === 'headcount_forecast'
                              ? '12-month headcount projection.'
                              : 'Run predictions to see results.'}
                          </p>
                          <button
                            onClick={() => handleRunPredictions(selectedModel.id)}
                            disabled={runningPrediction}
                            className="btn-primary inline-flex items-center gap-2 text-sm"
                          >
                            {runningPrediction ? (
                              <><ArrowPathIcon className="w-4 h-4 animate-spin" />Running...</>
                            ) : (
                              <><PlayIcon className="w-4 h-4" />Run Predictions</>
                            )}
                          </button>
                        </div>

                        {/* Attrition risk table */}
                        {selectedModel.model_type === 'attrition' && (
                          scoresLoading ? (
                            <div className="space-y-2">
                              {[1,2,3,4,5].map(i => <div key={i} className="animate-pulse bg-gray-100 rounded h-10" />)}
                            </div>
                          ) : employeeScores?.scores?.length > 0 ? (
                            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                              <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">Top Attrition Risk Employees</span>
                                <div className="flex gap-3 text-xs">
                                  <span className="text-red-600 font-medium">High: {employeeScores.scores.filter((s: any) => s.risk_level === 'high').length}</span>
                                  <span className="text-yellow-600 font-medium">Med: {employeeScores.scores.filter((s: any) => s.risk_level === 'medium').length}</span>
                                  <span className="text-green-600 font-medium">Low: {employeeScores.scores.filter((s: any) => s.risk_level === 'low').length}</span>
                                </div>
                              </div>
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dept</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Engagement</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Risk Score</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Level</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {employeeScores.scores.slice(0, 20).map((s: any) => (
                                    <tr key={s.employee_id} className="hover:bg-gray-50">
                                      <td className="px-4 py-3 text-sm text-gray-900">{s.name}</td>
                                      <td className="px-4 py-3 text-sm text-gray-500">{s.department}</td>
                                      <td className="px-4 py-3 text-sm text-gray-500">{s.job_level}</td>
                                      <td className="px-4 py-3 text-sm text-right text-gray-500">{s.engagement_score?.toFixed(1) ?? '—'}</td>
                                      <td className="px-4 py-3 text-sm text-right font-mono font-medium">{(s.risk_score * 100).toFixed(1)}%</td>
                                      <td className="px-4 py-3 text-center">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                          s.risk_level === 'high' ? 'bg-red-100 text-red-700' :
                                          s.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                          'bg-green-100 text-green-700'
                                        }`}>{s.risk_level}</span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-center py-10 text-gray-400 text-sm">Click "Run Predictions" to generate risk scores.</div>
                          )
                        )}

                        {/* Headcount forecast */}
                        {selectedModel.model_type === 'headcount_forecast' && (
                          forecastLoading ? (
                            <div className="animate-pulse bg-gray-100 rounded h-48" />
                          ) : forecastData?.forecast?.length > 0 ? (
                            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                              <div className="px-4 py-3 bg-gray-50">
                                <span className="text-sm font-medium text-gray-700">12-Month Headcount Forecast</span>
                                <span className="ml-2 text-xs text-gray-400">Current: {forecastData.current_headcount?.toLocaleString()}</span>
                              </div>
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Projected</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Range</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Est. Cost</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {forecastData.forecast.map((f: any) => (
                                    <tr key={f.date} className="hover:bg-gray-50">
                                      <td className="px-4 py-3 text-sm text-gray-900">{f.month}</td>
                                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{f.headcount.toLocaleString()}</td>
                                      <td className="px-4 py-3 text-sm text-right text-gray-400">{f.lower_bound.toLocaleString()} – {f.upper_bound.toLocaleString()}</td>
                                      <td className="px-4 py-3 text-sm text-right text-gray-500">${(f.projected_cost / 1000000).toFixed(1)}M</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-center py-10 text-gray-400 text-sm">Click "Run Predictions" to generate forecast.</div>
                          )
                        )}
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'compare' && (
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Select models to compare:
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {(modelsData || [])
                          .filter((m) => m.metrics)
                          .map((model) => (
                            <button
                              key={model.id}
                              onClick={() => toggleCompareModel(model.id)}
                              className={`text-sm px-3 py-1.5 rounded-full border ${
                                compareModels.includes(model.id)
                                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                                  : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {model.name}
                            </button>
                          ))}
                      </div>
                    </div>
                    {comparisonData && comparisonData.length >= 2 && (
                      <ModelComparison models={comparisonData} />
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                Select a Model
              </h3>
              <p className="text-gray-500">
                Choose a model from the list or create a new one
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Model Wizard */}
      <CreateModelWizard
        isOpen={showCreateWizard}
        onClose={() => setShowCreateWizard(false)}
        onCreate={(data) => createMutation.mutate(data)}
        isCreating={createMutation.isPending}
      />
    </div>
  )
}
