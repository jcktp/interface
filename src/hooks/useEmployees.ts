import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api'
import type { Employee } from '../types'

interface EmployeesResponse {
  status: string
  data: Employee[]
  total: number
  source: string
  message?: string
}

interface EmployeeResponse {
  status: string
  data: Employee
}

interface EmployeeMetricsResponse {
  status: string
  data: {
    total_headcount: number
    active_employees: number
    avg_salary: number
    avg_tenure: number
    avg_engagement: number
    turnover_rate: number
    by_department: Array<{ department: string; count: number }>
  }
  source: string
}

interface EmployeeFilters {
  department?: string
  status?: string
  location?: string
  skip?: number
  limit?: number
}

export function useEmployees(filters: EmployeeFilters = {}) {
  return useQuery<EmployeesResponse>({
    queryKey: ['employees', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.department) params.append('department', filters.department)
      if (filters.status) params.append('status', filters.status)
      if (filters.location) params.append('location', filters.location)
      if (filters.skip !== undefined) params.append('skip', filters.skip.toString())
      if (filters.limit !== undefined) params.append('limit', filters.limit.toString())

      const response = await api.get(`/employees?${params.toString()}`)
      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useEmployee(employeeId: string | undefined) {
  return useQuery<EmployeeResponse>({
    queryKey: ['employee', employeeId],
    queryFn: async () => {
      const response = await api.get(`/employees/${employeeId}`)
      return response.data
    },
    enabled: !!employeeId,
  })
}

export function useEmployeeMetrics() {
  return useQuery<EmployeeMetricsResponse>({
    queryKey: ['employee-metrics'],
    queryFn: async () => {
      const response = await api.get('/employees/metrics/summary')
      return response.data
    },
    staleTime: 5 * 60 * 1000,
  })
}

interface CreateEmployeeData {
  employee_id: string
  first_name: string
  last_name: string
  email: string
  department: string
  job_title: string
  hire_date: string
  location: string
  salary: number
  phone?: string
  job_level?: string
  work_type?: string
  status?: string
  performance_rating?: number
  engagement_score?: number
  age?: number
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateEmployeeData) => {
      const response = await api.post('/employees', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employee-metrics'] })
    },
  })
}

interface UpdateEmployeeData {
  first_name?: string
  last_name?: string
  department?: string
  job_title?: string
  location?: string
  salary?: number
  phone?: string
  job_level?: string
  work_type?: string
  status?: string
  performance_rating?: number
  engagement_score?: number
  termination_date?: string
  termination_reason?: string
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateEmployeeData }) => {
      const response = await api.put(`/employees/${id}`, data)
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employee', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['employee-metrics'] })
    },
  })
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/employees/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employee-metrics'] })
    },
  })
}
