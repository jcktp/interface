import { useQuery } from '@tanstack/react-query'
import api from '../api'
import { useGlobalFilters } from './useGlobalFilters'

interface MetricsData {
  headcount: {
    total: number
    active: number
    terminated: number
    on_leave: number
    change_vs_last_month: number
  }
  turnover: {
    rate: number
    voluntary: number
    involuntary: number
    change_vs_last_year: number
  }
  recruitment: {
    open_positions: number
    avg_time_to_hire: number
    hires_this_quarter: number
    offer_acceptance_rate: number
  }
  compensation: {
    avg_salary: number
    median_salary: number
    yoy_change: number
  }
  engagement: {
    avg_score: number
    change_vs_last_survey: number
  }
  performance: {
    avg_rating: number
    high_performers: number
    low_performers: number
  }
  diversity: {
    gender_ratio: Record<string, number>
    ethnicity_distribution: Record<string, number>
  }
  by_department: Array<{
    department: string
    headcount: number
    open_positions: number
    turnover_rate: number
    avg_tenure: number
    engagement_score: number
    avg_salary: number
  }>
  by_location: Array<{
    location: string
    headcount: number
    avg_salary: number
  }>
  time_series: {
    headcount: Array<{ date: string; value: number }>
    turnover: Array<{ date: string; voluntary: number; involuntary: number }>
    hires: Array<{ date: string; value: number }>
  }
}

interface MetricsResponse {
  status: string
  data: MetricsData
  source: string
}

// Comprehensive dashboard metrics endpoint
export function useDashboardMetrics() {
  const { filterObj } = useGlobalFilters()
  return useQuery<MetricsResponse>({
    queryKey: ['dashboard-metrics', filterObj],
    queryFn: async () => {
      const response = await api.get('/metrics/dashboard', { params: filterObj })
      return response.data
    },
    staleTime: 5 * 60 * 1000,
  })
}

// Financial & quality-of-hire metrics endpoint
interface FinancialMetricsData {
  revenue_per_employee: number
  profit_per_employee: number
  quality_of_hire: number
  revenue_per_employee_yoy?: number
  profit_per_employee_yoy?: number
  details: {
    total_revenue: number
    total_profit: number
    headcount: number
    profit_margin: number
    quality_components: {
      performance_score: number
      new_hire_retention: number
      productivity_score: number
      hiring_manager_satisfaction: number
    }
  }
  trends: Array<{
    month: string
    revenue_per_employee: number
    profit_per_employee: number
    quality_of_hire: number
  }>
}

interface FinancialMetricsResponse {
  status: string
  data: FinancialMetricsData
}

export function useFinancialMetrics() {
  const { filterObj } = useGlobalFilters()
  return useQuery<FinancialMetricsResponse>({
    queryKey: ['financial-metrics', filterObj],
    queryFn: async () => {
      const response = await api.get('/metrics/financial', { params: filterObj })
      return response.data
    },
    staleTime: 5 * 60 * 1000,
  })
}

// Database connection status
export function useDatabaseStatus() {
  return useQuery<{ status: string; message: string }>({
    queryKey: ['db-status'],
    queryFn: async () => {
      const response = await api.get('/db/status')
      return response.data
    },
    staleTime: 30 * 1000, // 30 seconds
  })
}

// Health check
export function useHealthCheck() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await api.get('/health')
      return response.data
    },
    staleTime: 60 * 1000, // 1 minute
  })
}

// Seed data endpoint
export function useSeedData() {
  return useQuery({
    queryKey: ['seed-status'],
    queryFn: async () => {
      const response = await api.get('/admin/seed/status')
      return response.data
    },
    enabled: false, // Only run when explicitly requested
  })
}
