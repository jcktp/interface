import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChatBubbleLeftRightIcon,
  LinkIcon,
  XMarkIcon,
  PlusIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import api from '../../api'

interface SlackWorkspace {
  id: string
  team_id: string
  team_name: string
  bot_user_id: string
  is_active: boolean
  created_at: string
}

interface ScheduledReport {
  id: string
  channel_id: string
  report_type: string
  schedule: string
  is_active: boolean
  last_run_at: string | null
  next_run_at: string | null
}

const REPORT_TYPES = [
  { value: 'daily_metrics', label: 'Daily Metrics Summary', description: 'Headcount, turnover, and open positions' },
  { value: 'weekly_summary', label: 'Weekly HR Summary', description: 'Comprehensive weekly HR report' },
  { value: 'attrition_alert', label: 'Attrition Alerts', description: 'Notify when attrition exceeds threshold' },
]

const SCHEDULE_OPTIONS = [
  { value: 'daily_9am', label: 'Daily at 9 AM' },
  { value: 'weekly_monday', label: 'Weekly on Monday' },
  { value: 'weekly_friday', label: 'Weekly on Friday' },
  { value: 'monthly', label: 'Monthly (1st of month)' },
]

export default function SlackSettings() {
  const queryClient = useQueryClient()
  const [showAddReport, setShowAddReport] = useState(false)
  const [newReport, setNewReport] = useState({
    channel_id: '',
    report_type: 'daily_metrics',
    schedule: 'daily_9am',
  })

  // Fetch workspace
  const { data: workspaceData, isLoading: workspaceLoading } = useQuery({
    queryKey: ['slack-workspace'],
    queryFn: async () => {
      const response = await api.get('/slack/workspace')
      return response.data
    },
  })

  // Fetch scheduled reports
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['slack-reports'],
    queryFn: async () => {
      const response = await api.get('/slack/scheduled-reports')
      return response.data.reports as ScheduledReport[]
    },
    enabled: workspaceData?.connected,
  })

  // Create scheduled report
  const createReportMutation = useMutation({
    mutationFn: async (data: { channel_id: string; report_type: string; schedule: string }) => {
      const response = await api.post('/slack/scheduled-reports', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack-reports'] })
      toast.success('Scheduled report created')
      setShowAddReport(false)
      setNewReport({ channel_id: '', report_type: 'daily_metrics', schedule: 'daily_9am' })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create report')
    },
  })

  // Disconnect workspace
  const disconnectMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const response = await api.delete(`/slack/workspaces/${teamId}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack-workspace'] })
      toast.success('Slack workspace disconnected')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to disconnect')
    },
  })

  const workspace = workspaceData?.workspace as SlackWorkspace | null
  const isConnected = workspaceData?.connected
  const reports = reportsData || []

  const handleInstallSlack = () => {
    // In production, this would redirect to Slack OAuth flow
    const clientId = import.meta.env.VITE_SLACK_CLIENT_ID
    const redirectUri = `${window.location.origin}/auth/slack/callback`
    const scopes = 'chat:write,commands,app_mentions:read,im:history,users:read'

    if (clientId) {
      window.location.href = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`
    } else {
      toast.error('Slack integration not configured. Please contact your administrator.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Slack Integration</h1>
        <p className="mt-1 text-sm text-gray-500">
          Connect Slack to query HR metrics and receive automated reports
        </p>
      </div>

      {/* Connection Status */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Workspace Connection</h2>

        {workspaceLoading ? (
          <div className="animate-pulse flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-200 rounded-lg" />
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/3" />
            </div>
          </div>
        ) : isConnected && workspace ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#4A154B] rounded-lg flex items-center justify-center">
                <ChatBubbleLeftRightIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900">{workspace.team_name}</h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success-100 text-success-700">
                    <CheckCircleIcon className="w-3 h-3 mr-1" />
                    Connected
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  Team ID: {workspace.team_id} | Bot ID: {workspace.bot_user_id}
                </p>
              </div>
            </div>
            <button
              onClick={() => disconnectMutation.mutate(workspace.team_id)}
              disabled={disconnectMutation.isPending}
              className="btn-secondary text-danger-600 hover:text-danger-700"
            >
              <XMarkIcon className="w-4 h-4 mr-1" />
              Disconnect
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            <ChatBubbleLeftRightIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Slack Workspace Connected</h3>
            <p className="text-gray-500 mb-4">
              Connect your Slack workspace to enable HR metrics queries and automated reports
            </p>
            <button onClick={handleInstallSlack} className="btn-primary inline-flex items-center gap-2">
              <LinkIcon className="w-5 h-5" />
              Connect to Slack
            </button>
          </div>
        )}
      </div>

      {/* Available Commands */}
      {isConnected && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Commands</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <code className="text-sm font-mono text-primary-600">/hr metrics [department]</code>
              <p className="text-sm text-gray-600 mt-1">Get key HR metrics, optionally filtered by department</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <code className="text-sm font-mono text-primary-600">/hr headcount [by department]</code>
              <p className="text-sm text-gray-600 mt-1">Get headcount breakdown by department or location</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <code className="text-sm font-mono text-primary-600">/hr plan</code>
              <p className="text-sm text-gray-600 mt-1">Open a form to update your workforce plan</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <code className="text-sm font-mono text-primary-600">@HRBot [question]</code>
              <p className="text-sm text-gray-600 mt-1">Ask natural language questions about HR data</p>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled Reports */}
      {isConnected && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Scheduled Reports</h2>
            <button
              onClick={() => setShowAddReport(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Add Report
            </button>
          </div>

          {reportsLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ClockIcon className="w-10 h-10 mx-auto mb-2 text-gray-400" />
              <p>No scheduled reports yet</p>
              <p className="text-sm">Set up automated reports to receive HR metrics in Slack</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => {
                const reportType = REPORT_TYPES.find((t) => t.value === report.report_type)
                const schedule = SCHEDULE_OPTIONS.find((s) => s.value === report.schedule)

                return (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">
                          {reportType?.label || report.report_type}
                        </h4>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            report.is_active
                              ? 'bg-success-100 text-success-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {report.is_active ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {schedule?.label || report.schedule} | Channel: #{report.channel_id}
                      </p>
                      {report.next_run_at && (
                        <p className="text-xs text-gray-400 mt-1">
                          Next run: {new Date(report.next_run_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Report Modal */}
      {showAddReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Add Scheduled Report</h2>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                createReportMutation.mutate(newReport)
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700">Report Type</label>
                <select
                  value={newReport.report_type}
                  onChange={(e) => setNewReport((prev) => ({ ...prev, report_type: e.target.value }))}
                  className="input mt-1"
                >
                  {REPORT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {REPORT_TYPES.find((t) => t.value === newReport.report_type)?.description}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Slack Channel</label>
                <input
                  type="text"
                  value={newReport.channel_id}
                  onChange={(e) => setNewReport((prev) => ({ ...prev, channel_id: e.target.value }))}
                  className="input mt-1"
                  placeholder="e.g., hr-team or C0123456789"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter the channel name or ID where reports will be posted
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Schedule</label>
                <select
                  value={newReport.schedule}
                  onChange={(e) => setNewReport((prev) => ({ ...prev, schedule: e.target.value }))}
                  className="input mt-1"
                >
                  {SCHEDULE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddReport(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createReportMutation.isPending}
                  className="btn-primary"
                >
                  {createReportMutation.isPending ? 'Creating...' : 'Create Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
