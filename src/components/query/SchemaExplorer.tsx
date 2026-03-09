import { useState } from 'react'
import {
  TableCellsIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'

interface Column {
  name: string
  type: string
  nullable: boolean
}

interface SchemaExplorerProps {
  schema: Record<string, { columns: Column[] }>
  onInsert: (text: string) => void
  isLoading: boolean
}

export default function SchemaExplorer({ schema, onInsert, isLoading }: SchemaExplorerProps) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())

  const toggleTable = (tableName: string) => {
    const newExpanded = new Set(expandedTables)
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName)
    } else {
      newExpanded.add(tableName)
    }
    setExpandedTables(newExpanded)
  }

  const handleTableClick = (tableName: string, e: React.MouseEvent) => {
    if (e.detail === 2) {
      // Double click - insert table name
      onInsert(tableName)
    } else {
      // Single click - toggle expansion
      toggleTable(tableName)
    }
  }

  const handleColumnClick = (tableName: string, columnName: string) => {
    onInsert(`${tableName}.${columnName}`)
  }

  const getTypeColor = (type: string) => {
    const t = type.toLowerCase()
    if (t.includes('int') || t.includes('numeric') || t.includes('decimal') || t.includes('float')) {
      return 'text-blue-600'
    }
    if (t.includes('varchar') || t.includes('text') || t.includes('char')) {
      return 'text-green-600'
    }
    if (t.includes('date') || t.includes('time') || t.includes('timestamp')) {
      return 'text-purple-600'
    }
    if (t.includes('bool')) {
      return 'text-orange-600'
    }
    if (t.includes('uuid')) {
      return 'text-pink-600'
    }
    return 'text-gray-600'
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-4">Schema Explorer</h3>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-6 bg-gray-100 rounded w-3/4" />
          ))}
        </div>
      </div>
    )
  }

  const tables = Object.keys(schema).sort()

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-medium text-gray-900">Schema Explorer</h3>
        <p className="text-xs text-gray-500 mt-1">Double-click to insert into query</p>
      </div>

      <div className="max-h-[500px] overflow-auto">
        {tables.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No schema information available
          </div>
        ) : (
          <ul className="py-2">
            {tables.map((tableName) => (
              <li key={tableName}>
                <div
                  onClick={(e) => handleTableClick(tableName, e)}
                  className="flex items-center gap-2 px-4 py-1.5 hover:bg-gray-50 cursor-pointer"
                >
                  {expandedTables.has(tableName) ? (
                    <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                  )}
                  <TableCellsIcon className="w-4 h-4 text-primary-500" />
                  <span className="text-sm font-medium text-gray-700">{tableName}</span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {schema[tableName].columns.length} cols
                  </span>
                </div>

                {expandedTables.has(tableName) && (
                  <ul className="ml-6 border-l border-gray-100">
                    {schema[tableName].columns.map((column) => (
                      <li
                        key={column.name}
                        onClick={() => handleColumnClick(tableName, column.name)}
                        className="flex items-center gap-2 px-4 py-1 hover:bg-gray-50 cursor-pointer ml-2"
                      >
                        <span className="w-2 h-2 rounded-full bg-gray-300" />
                        <span className="text-sm text-gray-600">{column.name}</span>
                        <span className={`text-xs ${getTypeColor(column.type)}`}>
                          {column.type}
                        </span>
                        {column.nullable && (
                          <span className="text-xs text-gray-400 italic">null</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quick templates */}
      <div className="border-t border-gray-200 p-4">
        <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Quick Templates</h4>
        <div className="space-y-1">
          <button
            onClick={() => onInsert('SELECT * FROM  LIMIT 100')}
            className="w-full text-left text-xs text-primary-600 hover:text-primary-800 hover:bg-primary-50 px-2 py-1 rounded"
          >
            SELECT * FROM ... LIMIT 100
          </button>
          <button
            onClick={() => onInsert('SELECT COUNT(*) FROM ')}
            className="w-full text-left text-xs text-primary-600 hover:text-primary-800 hover:bg-primary-50 px-2 py-1 rounded"
          >
            SELECT COUNT(*) FROM ...
          </button>
          <button
            onClick={() => onInsert('SELECT department, COUNT(*) as count\nFROM employees\nGROUP BY department\nORDER BY count DESC')}
            className="w-full text-left text-xs text-primary-600 hover:text-primary-800 hover:bg-primary-50 px-2 py-1 rounded"
          >
            Group by department
          </button>
        </div>
      </div>
    </div>
  )
}
