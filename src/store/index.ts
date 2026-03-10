import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { 
  Employee, 
  Candidate, 
  JobRequisition, 
  ApiConnection, 
  FilterState, 
  DataUpload, 
  User,
  WorkforcePlan,
  RecruiterGoal
} from '../types'
import type { LocalizationSettings } from '../utils/localization'
import { DEFAULT_SETTINGS, detectUserLocale } from '../utils/localization'

export interface PlanningPeriod {
  id: string
  name: string
  description?: string
  start_date: string
  end_date: string
  status: 'draft' | 'active' | 'closed'
  period_type: string
}

interface AppState {
  // Auth
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  needsOnboarding: boolean

  // Data
  employees: Employee[]
  candidates: Candidate[]
  requisitions: JobRequisition[]
  apiConnections: ApiConnection[]
  dataUploads: DataUpload[]
  
  // Planning & Goals
  planningPeriods: PlanningPeriod[]
  activePeriodId: string | null
  workforcePlans: WorkforcePlan[]
  recruiterGoals: RecruiterGoal[]

  // UI State
  sidebarCollapsed: boolean
  currentFilter: FilterState
  darkMode: boolean
  localization: LocalizationSettings
  aiWidgetState: {
    isOpen: boolean
    isMinimized: boolean
    activeConversationId: string | null
  }

  // Auth Actions
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<{ requiresVerification: boolean }>
  logout: () => void
  checkAuth: () => boolean
  setNeedsOnboarding: (needs: boolean) => void
  setUser: (user: User) => void

  // Actions
  setEmployees: (employees: Employee[]) => void
  addEmployees: (employees: Employee[]) => void
  updateEmployee: (id: string, data: Partial<Employee>) => void
  deleteEmployee: (id: string) => void

  setCandidates: (candidates: Candidate[]) => void
  addCandidates: (candidates: Candidate[]) => void
  updateCandidate: (id: string, data: Partial<Candidate>) => void

  setRequisitions: (requisitions: JobRequisition[]) => void
  addRequisition: (requisition: JobRequisition) => void
  updateRequisition: (id: string, data: Partial<JobRequisition>) => void

  addApiConnection: (connection: ApiConnection) => void
  updateApiConnection: (id: string, data: Partial<ApiConnection>) => void
  removeApiConnection: (id: string) => void

  addDataUpload: (upload: DataUpload) => void
  updateDataUpload: (id: string, data: Partial<DataUpload>) => void
  
  // Planning & Goal Actions
  setPlanningPeriods: (periods: PlanningPeriod[]) => void
  setActivePeriodId: (id: string | null) => void
  setWorkforcePlans: (plans: WorkforcePlan[]) => void
  setRecruiterGoals: (goals: RecruiterGoal[]) => void

  // Permission helper
  hasPermission: (permission: string) => boolean

  toggleSidebar: () => void
  setFilter: (filter: Partial<FilterState>) => void
  resetFilter: () => void
  toggleDarkMode: () => void
  setLocalization: (settings: Partial<LocalizationSettings>) => void
  setAiWidgetState: (state: Partial<AppState['aiWidgetState']>) => void
}

const defaultFilter: FilterState = {
  dateRange: {
    start: '',
    end: '',
  },
  datePreset: 'this_year',
  departments: [],
  locations: [],
  jobTitles: [],
  status: [],
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial Auth State
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      needsOnboarding: false,

      // Initial Data
      employees: [],
      candidates: [],
      requisitions: [],
      apiConnections: [],
      dataUploads: [],
      
      // Initial Planning Data
      planningPeriods: [],
      activePeriodId: null,
      workforcePlans: [],
      recruiterGoals: [],

      // Initial UI State
      sidebarCollapsed: false,
      currentFilter: defaultFilter,
      darkMode: false,
      localization: { ...DEFAULT_SETTINGS, ...detectUserLocale() },
      aiWidgetState: {
        isOpen: false,
        isMinimized: false,
        activeConversationId: null,
      },

      // Auth Actions
      login: async (email: string, password: string, _rememberMe?: boolean) => {
        set({ isLoading: true })
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })

          if (!response.ok) {
            throw new Error('Login failed')
          }

          const data = await response.json()
          set({
            user: { ...data.user, permissions: data.permissions || data.user?.permissions || [] },
            token: data.token,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      register: async (email: string, password: string, name: string) => {
        set({ isLoading: true })
        try {
          const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name }),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.detail || 'Registration failed')
          }

          const data = await response.json()

          // If email verification is required, don't log in yet
          if (data.requires_verification) {
            set({ isLoading: false })
            return { requiresVerification: true }
          }

          // Otherwise, log in directly
          set({
            user: data.user,
            token: data.access_token,
            refreshToken: data.refresh_token,
            isAuthenticated: true,
            isLoading: false,
            needsOnboarding: true,
          })
          return { requiresVerification: false }
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          needsOnboarding: false,
        })
      },

      checkAuth: () => {
        const state = get()
        return state.isAuthenticated && state.token !== null
      },

      setNeedsOnboarding: (needs: boolean) => {
        set({ needsOnboarding: needs })
      },

      setUser: (user: User) => {
        set({ user })
      },

      // Employee Actions
      setEmployees: (employees) => set({ employees }),
      addEmployees: (newEmployees) =>
        set((state) => ({ employees: [...state.employees, ...newEmployees] })),
      updateEmployee: (id, data) =>
        set((state) => ({
          employees: state.employees.map((e) => (e.id === id ? { ...e, ...data } : e)),
        })),
      deleteEmployee: (id) =>
        set((state) => ({
          employees: state.employees.filter((e) => e.id !== id),
        })),

      // Candidate Actions
      setCandidates: (candidates) => set({ candidates }),
      addCandidates: (newCandidates) =>
        set((state) => ({ candidates: [...state.candidates, ...newCandidates] })),
      updateCandidate: (id, data) =>
        set((state) => ({
          candidates: state.candidates.map((c) => (c.id === id ? { ...c, ...data } : c)),
        })),

      // Requisition Actions
      setRequisitions: (requisitions) => set({ requisitions }),
      addRequisition: (requisition) =>
        set((state) => ({ requisitions: [...state.requisitions, requisition] })),
      updateRequisition: (id, data) =>
        set((state) => ({
          requisitions: state.requisitions.map((r) => (r.id === id ? { ...r, ...data } : r)),
        })),

      // API Connection Actions
      addApiConnection: (connection) =>
        set((state) => ({ apiConnections: [...state.apiConnections, connection] })),
      updateApiConnection: (id, data) =>
        set((state) => ({
          apiConnections: state.apiConnections.map((c) => (c.id === id ? { ...c, ...data } : c)),
        })),
      removeApiConnection: (id) =>
        set((state) => ({
          apiConnections: state.apiConnections.filter((c) => c.id !== id),
        })),

      // Data Upload Actions
      addDataUpload: (upload) =>
        set((state) => ({ dataUploads: [...state.dataUploads, upload] })),
      updateDataUpload: (id, data) =>
        set((state) => ({
          dataUploads: state.dataUploads.map((u) => (u.id === id ? { ...u, ...data } : u)),
        })),
        
      // Planning Actions
      setPlanningPeriods: (planningPeriods) => set({ planningPeriods }),
      setActivePeriodId: (activePeriodId) => set({ activePeriodId }),
      setWorkforcePlans: (workforcePlans) => set({ workforcePlans }),
      setRecruiterGoals: (recruiterGoals) => set({ recruiterGoals }),

      // Permission helper
      hasPermission: (permission: string): boolean => {
        const state = get()
        const u = state.user
        if (!u) return false
        if (u.role === 'super_admin' || u.role === 'admin') return true
        return u.permissions?.includes(permission) ?? false
      },

      // UI Actions
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setFilter: (filter) =>
        set((state) => ({ currentFilter: { ...state.currentFilter, ...filter } })),
      resetFilter: () => set({ currentFilter: defaultFilter }),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      setLocalization: (settings) =>
        set((state) => ({ localization: { ...state.localization, ...settings } })),
      setAiWidgetState: (aiState) =>
        set((state) => ({ aiWidgetState: { ...state.aiWidgetState, ...aiState } })),
    }),
    {
      name: 'interface-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        needsOnboarding: state.needsOnboarding,
        employees: state.employees,
        candidates: state.candidates,
        requisitions: state.requisitions,
        apiConnections: state.apiConnections,
        sidebarCollapsed: state.sidebarCollapsed,
        currentFilter: state.currentFilter,
        darkMode: state.darkMode,
        localization: state.localization,
        planningPeriods: state.planningPeriods,
        activePeriodId: state.activePeriodId,
        workforcePlans: state.workforcePlans,
        recruiterGoals: state.recruiterGoals,
        aiWidgetState: state.aiWidgetState,
      }),
    }
  )
)
