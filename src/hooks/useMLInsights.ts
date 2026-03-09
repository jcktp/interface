import { useQuery } from '@tanstack/react-query'
import api from '../api'

interface MLModel {
  id: string
  name: string
  model_type: string
  status: string
  is_active: boolean
  metrics: Record<string, number> | null
}

export interface MLPrediction {
  model_name: string
  model_type: string
  predictions: any
  confidence?: number
  projected_headcount?: number
}

export function useActiveModels() {
  return useQuery({
    queryKey: ['ml-active-models'],
    queryFn: async () => {
      const res = await api.get('/ml/models')
      const models = res.data.models as MLModel[]
      return models.filter(m => m.is_active || m.status === 'trained')
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  })
}

export function useMLPrediction(modelType: string, enabled = true) {
  const { data: models } = useActiveModels()
  const activeModel = models?.find(m => m.model_type === modelType && (m.is_active || m.status === 'trained'))

  return useQuery({
    queryKey: ['ml-prediction', modelType, activeModel?.id],
    queryFn: async () => {
      if (!activeModel) return null
      const res = await api.post(`/ml/models/${activeModel.id}/predict`)
      return {
        model_name: activeModel.name,
        model_type: activeModel.model_type,
        predictions: res.data,
        confidence: activeModel.metrics?.accuracy || activeModel.metrics?.r2_score,
      } as MLPrediction
    },
    enabled: enabled && !!activeModel,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })
}
