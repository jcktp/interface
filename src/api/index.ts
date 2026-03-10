import axios from 'axios'
import type {
  Employee,
  Candidate,
  AttritionPrediction,
} from '../types'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  // Get token from localStorage (zustand persisted state)
  const storage = localStorage.getItem('interface-storage')
  if (storage) {
    try {
      const state = JSON.parse(storage)
      if (state.state?.token) {
        config.headers.Authorization = `Bearer ${state.state.token}`
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  return config
})

// Prevent multiple simultaneous 401 redirects
let _redirectingToLogin = false

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If 401 and not already retried, try to refresh or force logout
    if (error.response?.status === 401 && !originalRequest._retry && !_redirectingToLogin) {
      originalRequest._retry = true

      const storage = localStorage.getItem('interface-storage')
      if (storage) {
        try {
          const state = JSON.parse(storage)
          if (state.state?.refreshToken) {
            const response = await axios.post('/api/auth/refresh', {
              refresh_token: state.state.refreshToken,
            })

            if (response.data.access_token) {
              state.state.token = response.data.access_token
              localStorage.setItem('interface-storage', JSON.stringify(state))
              originalRequest.headers.Authorization = `Bearer ${response.data.access_token}`
              return api(originalRequest)
            }
          }

          // No valid refresh token — force logout once
          if (state.state?.isAuthenticated && !_redirectingToLogin) {
            _redirectingToLogin = true
            state.state.token = null
            state.state.refreshToken = null
            state.state.isAuthenticated = false
            state.state.user = null
            localStorage.setItem('interface-storage', JSON.stringify(state))
            window.location.href = '/login'
          }
        } catch {
          if (!_redirectingToLogin) {
            _redirectingToLogin = true
            const stored = localStorage.getItem('interface-storage')
            if (stored) {
              const state = JSON.parse(stored)
              state.state.token = null
              state.state.refreshToken = null
              state.state.isAuthenticated = false
              state.state.user = null
              localStorage.setItem('interface-storage', JSON.stringify(state))
            }
            window.location.href = '/login'
          }
        }
      }
    }

    return Promise.reject(error)
  }
)

// Health check
export const checkHealth = () => api.get('/health')

// Auth
export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password })

export const register = (data: {
  email: string
  password: string
  name: string
  organization_name?: string
  plan?: string
}) => api.post('/auth/register', data)

export const verifyEmail = (token: string) =>
  api.post('/auth/verify-email', { token })

export const resendVerification = (email: string) =>
  api.post('/auth/resend-verification', { email })

export const forgotPassword = (email: string) =>
  api.post('/auth/forgot-password', { email })

export const resetPassword = (token: string, password: string) =>
  api.post('/auth/reset-password', { token, password })

export const refreshToken = (refresh_token: string) =>
  api.post('/auth/refresh', { refresh_token })

// Data Management
export const uploadData = (file: File, dataType: string = 'employees') => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('data_type', dataType)
  return api.post('/data/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const cleanData = (data: Record<string, unknown>[], rules: string[]) =>
  api.post('/data/clean', { data, rules })

// Metrics
export const calculateMetrics = (
  employees: Employee[],
  candidates?: Candidate[],
  dateRange?: { start: string; end: string }
) =>
  api.post('/metrics/calculate', {
    employees,
    candidates,
    date_range: dateRange,
  })

// ML Predictions
export const predictAttrition = (employees: Partial<Employee>[]) =>
  api.post<AttritionPrediction[]>('/predictions/attrition', { employees })

export const trainAttritionModel = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/predictions/attrition/train', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

// Forecasting
export const forecastHeadcount = (
  historicalData: { date: string; headcount: number }[],
  periods: number = 12,
  confidenceLevel: number = 0.9
) =>
  api.post('/forecast/headcount', {
    historical_data: historicalData,
    periods,
    confidence_level: confidenceLevel,
  })

export const forecastAttrition = (
  historicalData: { date: string; turnover_rate: number }[],
  periods: number = 12,
  confidenceLevel: number = 0.9
) =>
  api.post('/forecast/attrition', {
    historical_data: historicalData,
    periods,
    confidence_level: confidenceLevel,
  })

// Recruiter Capacity
export const analyzeRecruiterCapacity = (
  recruiters: Record<string, unknown>[],
  requisitions: Record<string, unknown>[],
  forecastMonths: number = 3
) =>
  api.post('/capacity/recruiter', {
    recruiters,
    requisitions,
    forecast_months: forecastMonths,
  })

// Integrations
export const syncIntegration = (provider: string) =>
  api.get(`/integrations/sync/${provider}`)

export const sendWebhook = (payload: Record<string, unknown>) =>
  api.post('/integrations/webhook', payload)

// Database Connection & Field Mapping
export const testDbConnection = (config: Record<string, unknown>) =>
  api.post('/integrations/database/test-connection', config)

export const getTableSchema = (config: Record<string, unknown>) =>
  api.post('/integrations/database/table-schema', config)

export const saveFieldMapping = (mapping: Record<string, unknown>) =>
  api.post('/integrations/field-mapping', mapping)

export const listFieldMappings = () =>
  api.get('/integrations/field-mappings')

export const getFieldMapping = (mappingId: string) =>
  api.get(`/integrations/field-mapping/${mappingId}`)

export const updateFieldMapping = (mappingId: string, data: Record<string, unknown>) =>
  api.put(`/integrations/field-mapping/${mappingId}`, data)

export const deleteFieldMapping = (mappingId: string) =>
  api.delete(`/integrations/field-mapping/${mappingId}`)

export const syncFromDatabase = (mappingId: string) =>
  api.post('/integrations/database/sync', { mapping_id: mappingId })

// Export
export const exportData = (
  format: 'csv' | 'xlsx' | 'json',
  data: Record<string, unknown>[],
  filename: string = 'export'
) =>
  api.post(`/export/${format}`, { data, filename })

// ===================== 2Model APIs =====================

// Command Center
export const getCommandCenterHealth = () => api.get('/command-center/health')
export const getCommandCenterTrends = (months?: number) =>
  api.get('/command-center/trends', { params: { months } })
export const getCommandCenterAlerts = () => api.get('/command-center/alerts')
export const acknowledgeAlert = (alertId: string) =>
  api.post(`/command-center/alerts/${alertId}/acknowledge`)
export const resolveAlert = (alertId: string) =>
  api.post(`/command-center/alerts/${alertId}/resolve`)
export const runDetection = () => api.post('/command-center/run-detection')

// AI Q&A
export const askAI = (question: string, conversationId?: string | null) =>
  api.post('/ai/ask', { question, conversation_id: conversationId })
export const getConversations = () => api.get('/ai/conversations')
export const getConversationMessages = (conversationId: string) =>
  api.get(`/ai/conversations/${conversationId}/messages`)

// Deep Dive
export const analyzeDeepDive = (params: {
  metric: string
  alert_id?: string
  department?: string
  location?: string
}) => api.get('/deep-dive/analyze', { params })

// Financial & Quality Metrics
export const getFinancialMetrics = () => api.get('/metrics/financial')

// Organization Financials
export const getOrgFinancials = () => api.get('/organization/financials')
export const updateOrgFinancials = (data: { annual_revenue?: number; annual_profit?: number }) =>
  api.put('/organization/financials', data)

// KPIs
export const getKPIDashboard = () => api.get('/kpis/dashboard')
export const getKPIDefinitions = (category?: string) =>
  api.get('/kpis/definitions', { params: { category } })
export const createKPIDefinition = (data: Record<string, unknown>) =>
  api.post('/kpis/definitions', data)
export const getKPITargets = (kpiId?: string, status?: string) =>
  api.get('/kpis/targets', { params: { kpi_id: kpiId, status } })
export const createKPITarget = (data: Record<string, unknown>) =>
  api.post('/kpis/targets', data)
export const updateKPITarget = (targetId: string, data: Record<string, unknown>) =>
  api.put(`/kpis/targets/${targetId}`, data)
export const approveKPITarget = (targetId: string) =>
  api.post(`/kpis/targets/${targetId}/approve`)
export const rejectKPITarget = (targetId: string) =>
  api.post(`/kpis/targets/${targetId}/reject`)
export const getKPITargetHistory = (targetId: string) =>
  api.get(`/kpis/targets/${targetId}/history`)
export const getKPIMeasurements = (kpiId: string) =>
  api.get(`/kpis/measurements/${kpiId}`)
export const calculateKPIs = () => api.post('/kpis/calculate')

// Attendance
export const getAttendanceSummary = (days?: number) =>
  api.get('/attendance/summary', { params: { days } })
export const getAttendanceTrends = (period?: string, months?: number) =>
  api.get('/attendance/trends', { params: { period, months } })
export const getAttendanceTargets = () => api.get('/attendance/targets')
export const createAttendanceTarget = (data: Record<string, unknown>) =>
  api.post('/attendance/targets', data)
export const updateAttendanceTarget = (targetId: string, data: Record<string, unknown>) =>
  api.put(`/attendance/targets/${targetId}`, data)
export const importAttendance = (records: Record<string, unknown>[]) =>
  api.post('/attendance/import', { records })
export const getAttendanceCompliance = () => api.get('/attendance/compliance')
export const getAttendancePolicy = () => api.get('/attendance/policy')
export const updateAttendancePolicy = (data: Record<string, unknown>) => api.put('/attendance/policy', data)
export const getAttendanceHierarchy = (days?: number) =>
  api.get('/attendance/hierarchy', { params: { days } })
export const getAttendanceCountries = () => api.get('/attendance/countries')
export const getAttendanceHolidays = (countryCode: string) =>
  api.get(`/attendance/holidays/${countryCode}`)
export const updatePolicyCountries = (countryConfigs: Record<string, unknown>[]) =>
  api.post('/attendance/policy/countries', { country_configs: countryConfigs })

// User Management (Admin)
export const getUsers = (params?: { role?: string; status?: string }) =>
  api.get('/admin/users', { params })
export const updateUserRole = (userId: string, role: string) =>
  api.put(`/admin/users/${userId}/role`, { role })
export const deactivateUser = (userId: string) =>
  api.put(`/admin/users/${userId}/deactivate`)
export const activateUser = (userId: string) =>
  api.put(`/admin/users/${userId}/activate`)
export const inviteUser = (data: { email: string; name: string; role: string }) =>
  api.post('/admin/users/invite', data)
export const getUserAuditLog = (userId: string) =>
  api.get(`/admin/users/${userId}/audit-log`)

// Create User (with generated or provided password)
export const createUserWithPassword = (data: { email: string; name: string; role: string; department?: string; password?: string }) =>
  api.post('/admin/users/create', data)

// Change Password
export const changePassword = (currentPassword: string, newPassword: string) =>
  api.put('/auth/change-password', { current_password: currentPassword, new_password: newPassword })

// Update User Permissions
export const updateUserPermissions = (userId: string, permissions: string[]) =>
  api.put(`/admin/users/${userId}/permissions`, { permissions })

// Compensation Bulk Increase
export const bulkSalaryIncrease = (data: Record<string, unknown>) =>
  api.post('/compensation/bulk-increase', data)

// Admin Seed
export const seedFullDatabase = () => api.post('/admin/seed-full', {}, { timeout: 300000 })
export const getDataSummary = () => api.get('/admin/data-summary')
export const clearDatabaseData = () => api.post('/admin/clear-data', {}, { timeout: 60000 })

// Warehouse
export const getWarehouseConnections = () => api.get('/warehouse/connections')
export const createWarehouseConnection = (data: Record<string, unknown>) =>
  api.post('/warehouse/connections', data)
export const deleteWarehouseConnection = (connId: string) =>
  api.delete(`/warehouse/connections/${connId}`)
export const testWarehouseConnection = (connId: string) =>
  api.post(`/warehouse/connections/${connId}/test`)
export const queryWarehouse = (connId: string, sql: string) =>
  api.post(`/warehouse/connections/${connId}/query`, { sql })
export const getWarehouseSchema = (connId: string) =>
  api.get(`/warehouse/connections/${connId}/schema`)

export default api
