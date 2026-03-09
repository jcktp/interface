import { useState, useEffect } from 'react'
import api from '../../../api'
import type { WidgetConfig } from '../types'

interface SQLWidgetProps {
  config: WidgetConfig
}

interface QueryResult {
  columns: string[]
  rows: Record<string, any>[]
}

export default function SQLWidget({ config }: SQLWidgetProps) {
  const [result, setResult] = useState<QueryResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!config.sql_query) return

    const executeQuery = async () => {
      setIsLoading(true)
      setError(null)
      setResult(null)
      try {
        const response = await api.post('/queries/execute', { sql: config.sql_query })
        setResult(response.data)
      } catch (err: any) {
        setError(err.response?.data?.detail || err.message || 'Query execution failed')
      } finally {
        setIsLoading(false)
      }
    }

    executeQuery()
  }, [config.sql_query])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded p-3 w-full">
          <p className="font-medium mb-1">Query Error</p>
          <p className="text-xs">{error}</p>
        </div>
      </div>
    )
  }

  if (!result || !result.columns || result.rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        {config.sql_query ? 'No results returned' : 'No SQL query configured'}
      </div>
    )
  }

  const formatColumnHeader = (col: string) => {
    return col
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const formatCellValue = (value: any) => {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'number') return value.toLocaleString()
    return String(value)
  }

  return (
    <div className="overflow-auto h-full">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {result.columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {formatColumnHeader(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {result.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50">
              {result.columns.map((col) => (
                <td key={col} className="px-3 py-2 whitespace-nowrap text-gray-700">
                  {formatCellValue(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
