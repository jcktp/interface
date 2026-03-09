import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { useStore } from './store'
import api from './api'

// Public pages
import Login from './pages/Login'
import Signup from './pages/Signup'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Onboarding from './pages/Onboarding'
import SSOCallback from './pages/SSOCallback'

// Protected pages
import Dashboard from './pages/Dashboard'
import WorkforcePlanning from './pages/WorkforcePlanning'
import WorkforcePlanningInteractive from './pages/WorkforcePlanningInteractive'
import StrategicPlanner from './pages/StrategicPlanner'
import CompensationPlanning from './pages/CompensationPlanning'
import DashboardBuilder from './pages/DashboardBuilder'
import MyDashboards from './pages/MyDashboards'
import Recruitment from './pages/Recruitment'
import Retention from './pages/Retention'
import Diversity from './pages/Diversity'
import ScenarioPlanning from './pages/ScenarioPlanning'
import DataManagement from './pages/DataManagement'
import ApiConnections from './pages/ApiConnections'
import Employees from './pages/Employees'
import Settings from './pages/Settings'

// Admin pages
import SSOSettings from './pages/admin/SSOSettings'
import SlackSettings from './pages/admin/SlackSettings'
import QueryEditor from './pages/QueryEditor'
import MLModels from './pages/MLModels'

// 2Model pages
import Pulse from './pages/Pulse'
import AIChat from './pages/AIChat'
import DeepDive from './pages/DeepDive'
import KPIManagement from './pages/KPIManagement'
import AttendanceMonitoring from './pages/AttendanceMonitoring'
import UserManagement from './pages/UserManagement'
import ApiDocs from './pages/ApiDocs'
import Reports from './pages/Reports'
import SharedReport from './pages/SharedReport'
import MetricDefinitions from './pages/MetricDefinitions'
import Benchmarks from './pages/Benchmarks'
import PerformanceManagement from './pages/PerformanceManagement'

function PermissionGuard({ permission, children }: { permission: string; children: React.ReactNode }) {
  const hasPermission = useStore(s => s.hasPermission)
  if (!hasPermission(permission)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-700">Access Denied</p>
          <p className="text-sm text-gray-500 mt-1">You don't have permission to view this page.</p>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

function App() {
  const { user, isAuthenticated } = useStore()

  useEffect(() => {
    if (isAuthenticated && user) {
      api.get('/organization/settings').then(res => {
        const color = res.data?.settings?.accent_color
        if (color) {
          const root = document.documentElement
          root.style.setProperty('--color-primary-50', `${color}10`)
          root.style.setProperty('--color-primary-100', `${color}20`)
          root.style.setProperty('--color-primary-500', color)
          root.style.setProperty('--color-primary-600', color)
          root.style.setProperty('--color-primary-700', color)
        }
      }).catch(() => {
        // Silently ignore if org settings fail to load
      })
    }
  }, [isAuthenticated, user])

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/auth/oauth/:provider/callback" element={<SSOCallback />} />

      {/* Onboarding (requires auth but not full layout) */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />

      {/* Protected routes - moved to /app prefix */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/command-center" replace />} />

        {/* 2Model pages */}
        <Route path="command-center" element={<PermissionGuard permission="command_center:view"><Pulse /></PermissionGuard>} />
        <Route path="ai" element={<PermissionGuard permission="ai_qa:use"><AIChat /></PermissionGuard>} />
        <Route path="deep-dive" element={<PermissionGuard permission="deep_dive:view"><DeepDive /></PermissionGuard>} />
        <Route path="kpis" element={<PermissionGuard permission="kpis:view"><KPIManagement /></PermissionGuard>} />
        <Route path="attendance" element={<PermissionGuard permission="attendance:view"><AttendanceMonitoring /></PermissionGuard>} />

        {/* Original pages */}
        <Route path="dashboard" element={<PermissionGuard permission="analytics:view"><Dashboard /></PermissionGuard>} />
        <Route path="workforce" element={<PermissionGuard permission="planning:view"><WorkforcePlanning /></PermissionGuard>} />
        <Route path="workforce-planning" element={<PermissionGuard permission="planning:view"><WorkforcePlanningInteractive /></PermissionGuard>} />
        <Route path="strategic-planner" element={<PermissionGuard permission="planning:view"><StrategicPlanner /></PermissionGuard>} />
        <Route path="compensation" element={<PermissionGuard permission="compensation:view"><CompensationPlanning /></PermissionGuard>} />
        <Route path="dashboard-builder/:dashboardId" element={<PermissionGuard permission="dashboards:view"><DashboardBuilder /></PermissionGuard>} />
        <Route path="dashboard-builder" element={<PermissionGuard permission="dashboards:view"><DashboardBuilder /></PermissionGuard>} />
        <Route path="dashboards" element={<PermissionGuard permission="analytics:view"><MyDashboards /></PermissionGuard>} />
        <Route path="recruitment" element={<PermissionGuard permission="candidates:view"><Recruitment /></PermissionGuard>} />
        <Route path="retention" element={<PermissionGuard permission="analytics:view"><Retention /></PermissionGuard>} />
        <Route path="performance" element={<PermissionGuard permission="dashboard:view"><PerformanceManagement /></PermissionGuard>} />
        <Route path="diversity" element={<PermissionGuard permission="analytics:view"><Diversity /></PermissionGuard>} />
        <Route path="scenarios" element={<PermissionGuard permission="planning:view"><ScenarioPlanning /></PermissionGuard>} />
        <Route path="data" element={<PermissionGuard permission="uploads:view"><DataManagement /></PermissionGuard>} />
        <Route path="api-connections" element={<PermissionGuard permission="uploads:view"><ApiConnections /></PermissionGuard>} />
        <Route path="employees" element={<PermissionGuard permission="employees:view"><Employees /></PermissionGuard>} />
        <Route path="api-docs" element={<ApiDocs />} />
        <Route path="settings" element={<Settings />} />

        {/* Admin pages */}
        <Route path="admin/sso" element={<SSOSettings />} />
        <Route path="admin/slack" element={<SlackSettings />} />
        <Route path="admin/users" element={<PermissionGuard permission="users:manage_roles"><UserManagement /></PermissionGuard>} />
        <Route path="query-editor" element={<PermissionGuard permission="queries:execute"><QueryEditor /></PermissionGuard>} />
        <Route path="ml-models" element={<PermissionGuard permission="ml:view"><MLModels /></PermissionGuard>} />
        <Route path="reports" element={<PermissionGuard permission="analytics:view"><Reports /></PermissionGuard>} />
        <Route path="metrics" element={<PermissionGuard permission="kpis:view"><MetricDefinitions /></PermissionGuard>} />
        <Route path="benchmarks" element={<PermissionGuard permission="analytics:view"><Benchmarks /></PermissionGuard>} />
      </Route>

      {/* Public shared report view */}
      <Route path="/report/:shareToken" element={<SharedReport />} />

      {/* Legacy routes - redirect to new /app prefix */}
      <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/workforce" element={<Navigate to="/app/workforce" replace />} />
      <Route path="/recruitment" element={<Navigate to="/app/recruitment" replace />} />
      <Route path="/retention" element={<Navigate to="/app/retention" replace />} />
      <Route path="/diversity" element={<Navigate to="/app/diversity" replace />} />
      <Route path="/scenarios" element={<Navigate to="/app/scenarios" replace />} />
      <Route path="/data" element={<Navigate to="/app/data" replace />} />
      <Route path="/api" element={<Navigate to="/app/data" replace />} />
      <Route path="/settings" element={<Navigate to="/app/settings" replace />} />

      {/* Catch all - redirect to landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
