import type { WidgetData, WidgetConfig } from '../types'

interface TableWidgetProps {
  data: WidgetData
  config: WidgetConfig
}

export default function TableWidget({ data }: TableWidgetProps) {
  const columns = data.columns || []
  const rows = data.rows || []

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No data to display
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
    return value
  }

  return (
    <div className="overflow-auto h-full">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {columns.map((col) => (
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
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50">
              {columns.map((col) => (
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
