import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  DocumentTextIcon,
  ExclamationTriangleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import axios from 'axios'

interface SharedReportData {
  id: string
  name: string
  description: string | null
  report_type: string
  config: Record<string, any> | null
  dashboard: {
    id: string
    name: string
    description: string | null
    layout: any[]
    widgets: any[]
    theme: string
  } | null
  created_at: string | null
  organization_name: string | null
}

// Use a plain axios instance without auth interceptors for public access
const publicApi = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export default function SharedReport() {
  const { shareToken } = useParams<{ shareToken: string }>()

  const { data, isLoading, error } = useQuery({
    queryKey: ['sharedReport', shareToken],
    queryFn: async () => {
      const response = await publicApi.get(`/reports/shared/${shareToken}`)
      return response.data.report as SharedReportData
    },
    enabled: !!shareToken,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-800 mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading report...</p>
        </div>
      </div>
    )
  }

  if (error) {
    const status = (error as any)?.response?.status
    const isExpired = status === 410

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            {isExpired ? (
              <ClockIcon className="w-8 h-8 text-red-500" />
            ) : (
              <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {isExpired ? 'Link Expired' : 'Report Not Found'}
          </h1>
          <p className="text-sm text-gray-500">
            {isExpired
              ? 'This shared report link has expired. Please request a new link from the report owner.'
              : 'This report link is invalid or the report has been removed.'}
          </p>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const dashboard = data.dashboard
  const widgets = dashboard?.widgets || []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">IF</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-900 truncate">{data.name}</h1>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {dashboard && <span>Dashboard: {dashboard.name}</span>}
                {data.organization_name && <span>{data.organization_name}</span>}
                {data.created_at && (
                  <span>Generated: {new Date(data.created_at).toLocaleDateString()}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full flex-shrink-0">
              <DocumentTextIcon className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs text-gray-500 font-medium">View Only</span>
            </div>
          </div>
          {data.description && (
            <p className="text-sm text-gray-500 mt-2">{data.description}</p>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {widgets.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
            <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-base font-medium text-gray-900 mb-1">No widgets in this report</h3>
            <p className="text-sm text-gray-500">
              This report does not have any dashboard widgets to display.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {widgets.map((widget: any, index: number) => (
              <div
                key={widget.id || index}
                className={`bg-white rounded-xl border border-gray-200 p-5 ${
                  widget.type === 'table' ? 'md:col-span-2 lg:col-span-3' : ''
                }`}
              >
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  {widget.title || widget.name || `Widget ${index + 1}`}
                </h3>

                {widget.type === 'metric' && (
                  <div>
                    <p className="text-3xl font-bold text-gray-900">
                      {widget.config?.value ?? widget.data?.value ?? '--'}
                    </p>
                    {(widget.config?.subtitle || widget.data?.subtitle) && (
                      <p className="text-sm text-gray-500 mt-1">
                        {widget.config?.subtitle || widget.data?.subtitle}
                      </p>
                    )}
                    {(widget.config?.change !== undefined || widget.data?.change !== undefined) && (
                      <div className="flex items-center gap-1 mt-2">
                        <span
                          className={`text-sm font-medium ${
                            (widget.config?.change ?? widget.data?.change ?? 0) >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {(widget.config?.change ?? widget.data?.change ?? 0) >= 0 ? '+' : ''}
                          {widget.config?.change ?? widget.data?.change}%
                        </span>
                        <span className="text-xs text-gray-400">vs last period</span>
                      </div>
                    )}
                  </div>
                )}

                {(widget.type === 'bar' || widget.type === 'line' || widget.type === 'area') && (
                  <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-2">
                        {[40, 65, 45, 80, 55, 70, 60].map((h, i) => (
                          <div
                            key={i}
                            className="w-6 bg-primary-200 rounded-t"
                            style={{ height: `${h}%` }}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 capitalize">{widget.type} chart</p>
                    </div>
                  </div>
                )}

                {widget.type === 'pie' && (
                  <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="w-24 h-24 rounded-full border-8 border-primary-200 border-t-primary-600 border-r-primary-400 mx-auto mb-2" />
                      <p className="text-xs text-gray-400">Pie chart</p>
                    </div>
                  </div>
                )}

                {widget.type === 'gauge' && (
                  <div className="h-32 flex items-center justify-center bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary-600">
                        {widget.config?.value ?? '75'}%
                      </div>
                      <p className="text-xs text-gray-400">Gauge</p>
                    </div>
                  </div>
                )}

                {widget.type === 'table' && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="space-y-2">
                      <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-500 border-b border-gray-200 pb-2">
                        <span>Column 1</span>
                        <span>Column 2</span>
                        <span>Column 3</span>
                        <span>Column 4</span>
                      </div>
                      {[1, 2, 3].map((row) => (
                        <div key={row} className="grid grid-cols-4 gap-2 text-xs text-gray-600">
                          <span className="bg-gray-100 rounded px-2 py-1">--</span>
                          <span className="bg-gray-100 rounded px-2 py-1">--</span>
                          <span className="bg-gray-100 rounded px-2 py-1">--</span>
                          <span className="bg-gray-100 rounded px-2 py-1">--</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center">
          <p className="text-xs text-gray-400">
            Powered by <span className="font-semibold text-gray-500">Interface</span>
          </p>
        </div>
      </footer>
    </div>
  )
}
