import { useState } from 'react'
import {
  ClipboardIcon,
  CheckIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'

interface QueryResultsProps {
  results: {
    success: boolean
    columns?: string[]
    rows?: Record<string, any>[]
    row_count?: number
    execution_time_ms?: number
    truncated?: boolean
    error?: string
    error_type?: string
  } | null
  isLoading: boolean
}

export default function QueryResults({ results, isLoading }: QueryResultsProps) {
  const [copied, setCopied] = useState(false)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
          <span className="ml-3 text-gray-600">Executing query...</span>
        </div>
      </div>
    )
  }

  if (!results) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
        <p>Run a query to see results here</p>
      </div>
    )
  }

  if (!results.success) {
    return (
      <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
        <h3 className="font-medium text-danger-800 mb-1">Query Error</h3>
        <p className="text-danger-700 text-sm">{results.error}</p>
        {results.error_type && (
          <span className="inline-block mt-2 text-xs text-danger-600 bg-danger-100 px-2 py-0.5 rounded">
            {results.error_type}
          </span>
        )}
      </div>
    )
  }

  const { columns = [], rows = [], row_count = 0, execution_time_ms = 0, truncated } = results

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const sortedRows = [...rows].sort((a, b) => {
    if (!sortColumn) return 0
    const aVal = a[sortColumn]
    const bVal = b[sortColumn]
    if (aVal === null || aVal === undefined) return 1
    if (bVal === null || bVal === undefined) return -1
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const handleCopyToClipboard = () => {
    const header = columns.join('\t')
    const data = sortedRows.map((row) => columns.map((col) => row[col] ?? '').join('\t')).join('\n')
    navigator.clipboard.writeText(`${header}\n${data}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadCSV = () => {
    const header = columns.join(',')
    const data = sortedRows
      .map((row) =>
        columns
          .map((col) => {
            const val = row[col]
            if (val === null || val === undefined) return ''
            if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
              return `"${val.replace(/"/g, '""')}"`
            }
            return String(val)
          })
          .join(',')
      )
      .join('\n')

    const blob = new Blob([`${header}\n${data}`], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `query_results_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadJSON = () => {
    const blob = new Blob([JSON.stringify(sortedRows, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `query_results_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Results header */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>
            <strong>{row_count.toLocaleString()}</strong> rows
            {truncated && <span className="text-warning-600 ml-1">(truncated)</span>}
          </span>
          <span>
            <strong>{execution_time_ms}</strong>ms
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyToClipboard}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Copy to clipboard"
          >
            {copied ? (
              <CheckIcon className="w-4 h-4 text-success-500" />
            ) : (
              <ClipboardIcon className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleDownloadCSV}
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Download CSV"
          >
            CSV
          </button>
          <button
            onClick={handleDownloadJSON}
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Download JSON"
          >
            JSON
          </button>
        </div>
      </div>

      {/* Results table */}
      <div className="overflow-auto max-h-[400px]">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  onClick={() => handleSort(column)}
                  className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    {column}
                    {sortColumn === column &&
                      (sortDirection === 'asc' ? (
                        <ChevronUpIcon className="w-3 h-3" />
                      ) : (
                        <ChevronDownIcon className="w-3 h-3" />
                      ))}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                  No results found
                </td>
              </tr>
            ) : (
              sortedRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  {columns.map((column) => (
                    <td key={column} className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">
                      {formatValue(row[column])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return '—'
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}
