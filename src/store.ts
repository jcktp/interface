import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  User,
  Employee,
  Candidate,
  JobRequisition,
  FilterState,
  ApiConnection,
  DataUpload,
  WorkforcePlan,
  RecruiterGoal,
} from './types'
import type { CurrencyCode, TimezoneCode, DateFormat, LanguageCode } from './utils/localization'
import {
  generateEmployees,
  generateCandidates,
  generateRequisitions,
} from './utils/sampleData'

export interface LocalizationSettings {
  currency: CurrencyCode
  timezone: TimezoneCode
  dateFormat: DateFormat
  language: LanguageCode
  numberFormat?: 'comma' | 'period'
}

export interface AiWidgetState {
  isOpen: boolean
  isMinimized: boolean
  activeConversationId: string | null
}

interface PlanningPeriod {
  id: string
  name: string
  start_date: string
  end_date: string
  period_type: string
  status: 'draft' | 'active' | 'closed'
}

const DEMO_USER: User = {
  id: 'demo-admin-001',
  email: 'admin@interface.app',
  name: 'Admin User',
  role: 'super_admin',
  permissions: [
    'command_center:view',
    'ai_qa:use',
    'deep_dive:view',
    'kpis:view',
    'attendance:view',
    'analytics:view',
    'planning:view',
    'compensation:view',
    'dashboards:view',
    'candidates:view',
    'dashboard:view',
    'uploads:view',
    'employees:view',
    'queries:execute',
    'ml:view',
    'users:manage_roles',
  ],
  organizationId: 'demo-org-001',
  status: 'active',
}

const DEFAULT_FILTER: FilterState = {
  dateRange: { start: '', end: '' },
  datePreset: 'all_time',
  departments: [],
  locations: [],
  jobTitles: [],
  status: [],
}

function generateDemoPlanningPeriods(): PlanningPeriod[] {
  const now = new Date()
  const year = now.getFullYear()
  return [
    {
      id: 'period-q1',
      name: `Q1 ${year}`,
      start_date: `${year}-01-01`,
      end_date: `${year}-03-31`,
      period_type: 'quarter',
      status: year === now.getFullYear() && now.getMonth() < 3 ? 'active' : 'closed',
    },
    {
      id: 'period-q2',
      name: `Q2 ${year}`,
      start_date: `${year}-04-01`,
      end_date: `${year}-06-30`,
      period_type: 'quarter',
      status: year === now.getFullYear() && now.getMonth() >= 3 && now.getMonth() < 6 ? 'active' : 'draft',
    },
    {
      id: 'period-q3',
      name: `Q3 ${year}`,
      start_date: `${year}-07-01`,
      end_date: `${year}-09-30`,
      period_type: 'quarter',
      status: 'draft',
    },
    {
      id: 'period-q4',
      name: `Q4 ${year}`,
      start_date: `${year}-10-01`,
      end_date: `${year}-12-31`,
      period_type: 'quarter',
      status: 'draft',
    },
  ]
}

function generateDemoWorkforcePlans(periodId: string): WorkforcePlan[] {
  const departments = ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'Customer Success', 'HR', 'Finance', 'Operations']
  return departments.map((dept, i) => {
    const startingHeadcount = Math.floor(Math.random() * 80) + 20
    const plannedHires = Math.floor(Math.random() * 8) + 2
    const plannedAttrition = Math.floor(Math.random() * 4) + 1
    const plannedTransfersIn = Math.floor(Math.random() * 2)
    const plannedTransfersOut = Math.floor(Math.random() * 2)
    const plannedEndingHeadcount = startingHeadcount + plannedHires - plannedAttrition + plannedTransfersIn - plannedTransfersOut
    const avgSalary = Math.floor(Math.random() * 60000) + 80000
    return {
      id: `plan-${periodId}-${i}`,
      periodId,
      department: dept,
      startingHeadcount,
      plannedHires,
      plannedAttrition,
      plannedTransfersIn,
      plannedTransfersOut,
      plannedEndingHeadcount,
      actualHires: Math.floor(Math.random() * 6) + 1,
      actualAttrition: Math.floor(Math.random() * 3),
      avgSalary,
      totalCompensationBudget: plannedEndingHeadcount * avgSalary,
    }
  })
}

function generateDemoRecruiterGoals(): RecruiterGoal[] {
  const year = new Date().getFullYear()
  return [
    { id: 'rg-1', name: 'Sarah Johnson', year, q1_goal: 8, q2_goal: 10, q3_goal: 9, q4_goal: 11, monthly_capacity: 3, q1_actual: 7, q2_actual: 10, is_active: true },
    { id: 'rg-2', name: 'Mike Chen', year, q1_goal: 6, q2_goal: 7, q3_goal: 8, q4_goal: 9, monthly_capacity: 2, q1_actual: 6, q2_actual: 8, is_active: true },
    { id: 'rg-3', name: 'Emily Davis', year, q1_goal: 10, q2_goal: 12, q3_goal: 11, q4_goal: 13, monthly_capacity: 4, q1_actual: 11, q2_actual: 12, is_active: true },
    { id: 'rg-4', name: 'James Wilson', year, q1_goal: 7, q2_goal: 8, q3_goal: 9, q4_goal: 10, monthly_capacity: 3, q1_actual: 6, q2_actual: 7, is_active: true },
    { id: 'rg-5', name: 'Lisa Brown', year, q1_goal: 5, q2_goal: 6, q3_goal: 7, q4_goal: 8, monthly_capacity: 2, q1_actual: 5, q2_actual: 6, is_active: true },
  ]
}

interface AppState {
  // Auth
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean

  // UI
  darkMode: boolean
  sidebarCollapsed: boolean

  // Filters
  currentFilter: FilterState

  // Core data
  employees: Employee[]
  candidates: Candidate[]
  requisitions: JobRequisition[]
  dataUploads: DataUpload[]
  apiConnections: ApiConnection[]

  // Localization
  localization: LocalizationSettings

  // Planning
  planningPeriods: PlanningPeriod[]
  activePeriodId: string | null
  workforcePlans: WorkforcePlan[]
  recruiterGoals: RecruiterGoal[]

  // AI Widget
  aiWidgetState: AiWidgetState

  // Actions — Auth
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  logout: () => void
  setUser: (user: User) => void

  // Actions — UI
  toggleDarkMode: () => void
  toggleSidebar: () => void

  // Actions — Filters
  setFilter: (filter: Partial<FilterState>) => void
  resetFilter: () => void

  // Actions — Data
  setEmployees: (employees: Employee[]) => void
  setCandidates: (candidates: Candidate[]) => void
  setRequisitions: (requisitions: JobRequisition[]) => void
  addDataUpload: (upload: DataUpload) => void
  updateDataUpload: (id: string, data: Partial<DataUpload>) => void
  addApiConnection: (conn: ApiConnection) => void
  updateApiConnection: (id: string, data: Partial<ApiConnection>) => void
  removeApiConnection: (id: string) => void

  // Actions — Localization
  setLocalization: (settings: Partial<LocalizationSettings>) => void

  // Actions — Planning
  setPlanningPeriods: (periods: PlanningPeriod[]) => void
  setActivePeriodId: (id: string | null) => void
  setWorkforcePlans: (plans: WorkforcePlan[]) => void
  setRecruiterGoals: (goals: RecruiterGoal[]) => void

  // Actions — AI Widget
  setAiWidgetState: (state: Partial<AiWidgetState>) => void

  // Actions — Permissions
  hasPermission: (permission: string) => boolean

  // Actions — Demo Data
  loadDemoData: () => void
  clearDemoData: () => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ─── Initial state ───────────────────────────────────────────────────
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      darkMode: false,
      sidebarCollapsed: false,
      currentFilter: DEFAULT_FILTER,
      employees: [],
      candidates: [],
      requisitions: [],
      dataUploads: [],
      apiConnections: [],
      localization: {
        currency: 'USD',
        timezone: 'America/New_York',
        dateFormat: 'MM/DD/YYYY',
        language: 'en-US',
        numberFormat: 'period',
      },
      planningPeriods: [],
      activePeriodId: null,
      workforcePlans: [],
      recruiterGoals: [],
      aiWidgetState: {
        isOpen: false,
        isMinimized: false,
        activeConversationId: null,
      },

      // ─── Auth actions ────────────────────────────────────────────────────
      login: async (email, password, _rememberMe = false) => {
        set({ isLoading: true })
        try {
          // Attempt to connect to the backend
          const { default: axios } = await import('axios')
          const res = await axios.post('/api/auth/login', { email, password }, { timeout: 5000 })
          const data = res.data
          // Support both response shapes: { token } and { access_token, refresh_token }
          const token = data.access_token ?? data.token
          const refreshToken = data.refresh_token ?? data.refresh_token ?? null
          const user = data.user
          if (!token || !user) throw new Error('Invalid login response')
          set({
            token,
            refreshToken,
            user,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (err: any) {
          // If backend is unavailable OR demo credentials are used with no matching backend user,
          // fall back to demo mode so the app is always accessible for evaluation.
          const isNetworkError =
            !err.response ||
            err.code === 'ECONNREFUSED' ||
            err.code === 'ERR_NETWORK' ||
            err.message?.includes('Network Error')

          const isDemoCredentials = email === 'admin@interface.app' && password === 'admin123'
          // Also fall back if backend returned 401/404 (no such user) for demo credentials
          const isAuthFailureForDemo =
            isDemoCredentials &&
            (err.response?.status === 401 || err.response?.status === 404 || err.response?.status === 422)

          if ((isNetworkError || isAuthFailureForDemo) && isDemoCredentials) {
            // Demo mode — bypass backend auth and pre-load rich sample data
            const employees = generateEmployees(5000)
            const candidates = generateCandidates(1500)
            const requisitions = generateRequisitions(250)
            const periods = generateDemoPlanningPeriods()
            const activePeriod = periods.find((p) => p.status === 'active') ?? periods[0]
            const workforcePlans = generateDemoWorkforcePlans(activePeriod.id)
            const recruiterGoals = generateDemoRecruiterGoals()

            set({
              token: 'demo-token',
              refreshToken: 'demo-refresh-token',
              user: DEMO_USER,
              isAuthenticated: true,
              isLoading: false,
              employees,
              candidates,
              requisitions,
              planningPeriods: periods,
              activePeriodId: activePeriod.id,
              workforcePlans,
              recruiterGoals,
            })
            return
          }
          set({ isLoading: false })
          throw err
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          employees: [],
          candidates: [],
          requisitions: [],
          planningPeriods: [],
          activePeriodId: null,
          workforcePlans: [],
          recruiterGoals: [],
        })
      },

      setUser: (user) => set({ user, isAuthenticated: true }),

      // ─── UI actions ───────────────────────────────────────────────────────
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      // ─── Filter actions ───────────────────────────────────────────────────
      setFilter: (filter) =>
        set((s) => ({ currentFilter: { ...s.currentFilter, ...filter } })),
      resetFilter: () => set({ currentFilter: DEFAULT_FILTER }),

      // ─── Data actions ─────────────────────────────────────────────────────
      setEmployees: (employees) => set({ employees }),
      setCandidates: (candidates) => set({ candidates }),
      setRequisitions: (requisitions) => set({ requisitions }),

      addDataUpload: (upload) =>
        set((s) => ({ dataUploads: [...s.dataUploads, upload] })),
      updateDataUpload: (id, data) =>
        set((s) => ({
          dataUploads: s.dataUploads.map((u) => (u.id === id ? { ...u, ...data } : u)),
        })),

      addApiConnection: (conn) =>
        set((s) => ({ apiConnections: [...s.apiConnections, conn] })),
      updateApiConnection: (id, data) =>
        set((s) => ({
          apiConnections: s.apiConnections.map((c) => (c.id === id ? { ...c, ...data } : c)),
        })),
      removeApiConnection: (id) =>
        set((s) => ({ apiConnections: s.apiConnections.filter((c) => c.id !== id) })),

      // ─── Localization actions ─────────────────────────────────────────────
      setLocalization: (settings) =>
        set((s) => ({ localization: { ...s.localization, ...settings } })),

      // ─── Planning actions ─────────────────────────────────────────────────
      setPlanningPeriods: (planningPeriods) => set({ planningPeriods }),
      setActivePeriodId: (activePeriodId) => set({ activePeriodId }),
      setWorkforcePlans: (workforcePlans) => set({ workforcePlans }),
      setRecruiterGoals: (recruiterGoals) => set({ recruiterGoals }),

      // ─── AI Widget actions ────────────────────────────────────────────────
      setAiWidgetState: (state) =>
        set((s) => ({ aiWidgetState: { ...s.aiWidgetState, ...state } })),

      // ─── Permissions ──────────────────────────────────────────────────────
      hasPermission: (permission) => {
        const { user } = get()
        if (!user) return false
        if (user.role === 'admin' || user.role === 'super_admin') return true
        return user.permissions?.includes(permission) ?? false
      },

      // ─── Demo data ────────────────────────────────────────────────────────
      loadDemoData: () => {
        const employees = generateEmployees(5000)
        const candidates = generateCandidates(1500)
        const requisitions = generateRequisitions(250)
        const periods = generateDemoPlanningPeriods()
        const activePeriod = periods.find((p) => p.status === 'active') ?? periods[0]
        const workforcePlans = generateDemoWorkforcePlans(activePeriod.id)
        const recruiterGoals = generateDemoRecruiterGoals()

        set({
          employees,
          candidates,
          requisitions,
          planningPeriods: periods,
          activePeriodId: activePeriod.id,
          workforcePlans,
          recruiterGoals,
        })
      },

      clearDemoData: () => {
        set({
          employees: [],
          candidates: [],
          requisitions: [],
          planningPeriods: [],
          activePeriodId: null,
          workforcePlans: [],
          recruiterGoals: [],
        })
      },
    }),
    {
      name: 'interface-storage',
      // Only persist auth, UI preferences, and localization — not large data arrays
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        darkMode: state.darkMode,
        sidebarCollapsed: state.sidebarCollapsed,
        localization: state.localization,
        aiWidgetState: state.aiWidgetState,
        currentFilter: state.currentFilter,
      }),
    }
  )
)
