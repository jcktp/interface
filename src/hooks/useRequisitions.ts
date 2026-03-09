import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api'

interface RequisitionsResponse {
  status: string
  data: Array<{
    id: string
    title: string
    department: string
    location: string
    job_level?: string
    status: string
    open_date: string
    salary_min?: number
    salary_max?: number
    headcount: number
    applicant_count: number
    urgency: string
  }>
  source: string
}

interface OpenCountResponse {
  status: string
  count: number
  source: string
}

interface RequisitionFilters {
  status?: string
  department?: string
  skip?: number
  limit?: number
}

export function useRequisitions(filters: RequisitionFilters = {}) {
  return useQuery<RequisitionsResponse>({
    queryKey: ['requisitions', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.department) params.append('department', filters.department)
      if (filters.skip !== undefined) params.append('skip', filters.skip.toString())
      if (filters.limit !== undefined) params.append('limit', filters.limit.toString())

      const response = await api.get(`/requisitions?${params.toString()}`)
      return response.data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useOpenRequisitionsCount() {
  return useQuery<OpenCountResponse>({
    queryKey: ['requisitions-open-count'],
    queryFn: async () => {
      const response = await api.get('/requisitions/open/count')
      return response.data
    },
    staleTime: 5 * 60 * 1000,
  })
}

interface CreateRequisitionData {
  title: string
  department: string
  location: string
  open_date: string
  job_level?: string
  salary_min?: number
  salary_max?: number
  description?: string
  requirements?: string
  headcount?: number
  urgency?: string
}

export function useCreateRequisition() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateRequisitionData) => {
      const response = await api.post('/requisitions', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisitions'] })
      queryClient.invalidateQueries({ queryKey: ['requisitions-open-count'] })
    },
  })
}
