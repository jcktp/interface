import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api'
import type { Candidate } from '../types'

interface CandidatesResponse {
  status: string
  data: Candidate[]
  source: string
}

interface CandidateResponse {
  status: string
  data: Candidate
}

interface PipelineStatsResponse {
  status: string
  data: {
    pipeline: Record<string, number>
    source_effectiveness: Array<{
      source: string
      applications: number
      hired: number
      conversion_rate: number
    }>
  }
  source: string
}

interface CandidateFilters {
  status?: string
  department?: string
  source?: string
  skip?: number
  limit?: number
}

export function useCandidates(filters: CandidateFilters = {}) {
  return useQuery<CandidatesResponse>({
    queryKey: ['candidates', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.department) params.append('department', filters.department)
      if (filters.source) params.append('source', filters.source)
      if (filters.skip !== undefined) params.append('skip', filters.skip.toString())
      if (filters.limit !== undefined) params.append('limit', filters.limit.toString())

      const response = await api.get(`/candidates?${params.toString()}`)
      return response.data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useCandidate(candidateId: string | undefined) {
  return useQuery<CandidateResponse>({
    queryKey: ['candidate', candidateId],
    queryFn: async () => {
      const response = await api.get(`/candidates/${candidateId}`)
      return response.data
    },
    enabled: !!candidateId,
  })
}

export function usePipelineStats() {
  return useQuery<PipelineStatsResponse>({
    queryKey: ['pipeline-stats'],
    queryFn: async () => {
      const response = await api.get('/candidates/pipeline/stats')
      return response.data
    },
    staleTime: 5 * 60 * 1000,
  })
}

interface CreateCandidateData {
  first_name: string
  last_name: string
  email: string
  applied_position: string
  department: string
  application_date: string
  source?: string
  phone?: string
  status?: string
  requisition_id?: string
  expected_salary?: number
}

export function useCreateCandidate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateCandidateData) => {
      const response = await api.post('/candidates', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline-stats'] })
    },
  })
}

interface UpdateCandidateData {
  status?: string
  stage?: string
  interview_score?: number
  assessment_score?: number
  offered_salary?: number
  offer_date?: string
  rejection_reason?: string
  notes?: string
}

export function useUpdateCandidate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateCandidateData }) => {
      const response = await api.put(`/candidates/${id}`, data)
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['candidate', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['pipeline-stats'] })
    },
  })
}
