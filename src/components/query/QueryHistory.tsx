import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'

interface ExecutionHistory {
  id: string
  sql_query: string
  status: string
  rows_returned: number | null
  execution_time_ms: number | null
  error_message: string | null
  started_at: string | null
  completed_at: string | null
}

interface QueryHistoryProps {
  history: ExecutionHistory[]
  onRerun: (sql: string) => void
  isLoading: boolean
}

export default function QueryHistory({ history, onRerun, isLoading }: QueryHistoryProps) {
  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 60000) {
      return 'Just now'
    } else if (diff < 3600000) {
      const mins = Math.floor(diff / 60000)
      return `${mins}m ago`
    } else if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours}h ago`
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-4">Recent Queries</h3>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <ClockIcon className="w-5 h-5 text-gray-400" />
          Recent Queries
        </h3>
      </div>

      <div className="max-h-[300px] overflow-auto">
        {history.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No query history yet
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {history.map((item) => (
              <li
                key={item.id}
                className="px-4 py-3 hover:bg-gray-50 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {item.status === 'completed' ? (
                        <CheckCircleIcon className="w-4 h-4 text-success-500 flex-shrink-0" />
                      ) : item.status === 'failed' ? (
                        <XCircleIcon className="w-4 h-4 text-danger-500 flex-shrink-0" />
                      ) : (
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin flex-shrink-0" />
                      )}
                      <span className="text-xs text-gray-500">{formatTime(item.started_at)}</span>
                      {item.rows_returned !== null && (
                        <span className="text-xs text-gray-400">
                          {item.rows_returned} rows
                        </span>
                      )}
                      {item.execution_time_ms !== null && (
                        <span className="text-xs text-gray-400">
                          {item.execution_time_ms}ms
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-xs text-gray-600 font-mono truncate">
                      {item.sql_query}
                    </div>

                    {item.error_message && (
                      <div className="mt-1 text-xs text-danger-600 truncate">
                        {item.error_message}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => onRerun(item.sql_query)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Rerun query"
                  >
                    <PlayIcon className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
