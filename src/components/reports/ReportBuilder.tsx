import { useState } from 'react'
import { ChevronLeftIcon, ArrowDownTrayIcon, MagnifyingGlassIcon, FunnelIcon, TableCellsIcon } from '@heroicons/react/24/outline'

interface ReportBuilderProps {
  reportName: string
  setReportName: (name: string) => void
  onBack: () => void
  onSave: () => void
  onExportCsv: () => void
  onExportPdf: () => void
  columnGroups: any
  selectedColumns: string[]
  toggleColumn: (key: string) => void
  toggleCategoryAll: (cat: string) => void
  reportData: any
  dataLoading: boolean
  _filters: any
  _setFilters: (f: any) => void
  _datePreset: string
  _setDatePreset: (p: string) => void
  sortBy: string | null
  onSort: (key: string) => void
  sortDirection: 'asc' | 'desc'
}

export default function ReportBuilder({
  reportName, setReportName, onBack, onSave, onExportCsv, onExportPdf,
  columnGroups, selectedColumns, toggleColumn, toggleCategoryAll,
  reportData, dataLoading, _filters, _setFilters, _datePreset, _setDatePreset,
  sortBy, onSort, sortDirection
}: ReportBuilderProps) {
  const [columnSearch, setColumnSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  void _filters
  void _setFilters
  void _datePreset
  void _setDatePreset

  return (
    <div className="flex flex-col h-[calc(100vh-112px)] -m-6 -mb-6">
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"><ChevronLeftIcon className="w-5 h-5" /></button>
          <input type="text" value={reportName} onChange={e => setReportName(e.target.value)} className="text-lg font-semibold bg-transparent border-b-2 border-transparent focus:border-primary-500 outline-none" />
        </div>
        <div className="flex gap-2">
          <button onClick={onExportCsv} className="btn-secondary text-xs px-3 py-1.5"><ArrowDownTrayIcon className="w-4 h-4 mr-1" />CSV</button>
          <button onClick={onExportPdf} className="btn-secondary text-xs px-3 py-1.5"><ArrowDownTrayIcon className="w-4 h-4 mr-1" />PDF</button>
          <button onClick={onSave} className="btn-primary text-xs px-4 py-1.5">Save Report</button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b">
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search columns..." className="input pl-9" value={columnSearch} onChange={e => setColumnSearch(e.target.value)} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {columnGroups && Object.entries(columnGroups).map(([cat, cols]: [string, any]) => (
              <div key={cat}>
                <button onClick={() => toggleCategoryAll(cat)} className="w-full text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{cat.replace('_', ' ')}</button>
                <div className="space-y-1">
                  {cols.map((col: any) => (
                    <label key={col.key} className="flex items-center gap-2 p-1 cursor-pointer hover:bg-gray-50 rounded">
                      <input type="checkbox" checked={selectedColumns.includes(col.key)} onChange={() => toggleColumn(col.key)} className="rounded text-primary-600" />
                      <span className="text-xs text-gray-700">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
          <div className="p-4 border-b bg-white flex items-center justify-between">
            <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary text-xs px-3 py-1.5"><FunnelIcon className="w-4 h-4 mr-1" />Filters</button>
            <div className="text-xs text-gray-500">{selectedColumns.length} columns selected</div>
          </div>
          
          <div className="flex-1 overflow-auto p-6">
            {dataLoading ? (
              <div className="h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
            ) : selectedColumns.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <TableCellsIcon className="w-12 h-12 mb-4 opacity-20" />
                <p>Select columns to build report</p>
              </div>
            ) : (
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {selectedColumns.map(col => (
                          <th key={col} onClick={() => onSort(col)} className="table-header cursor-pointer hover:bg-gray-100">
                            <span className="flex items-center gap-1">{col} {sortBy === col && (sortDirection === 'asc' ? '↑' : '↓')}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {reportData?.rows.map((row: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50">
                          {selectedColumns.map(col => <td key={col} className="table-cell">{String(row[col] ?? '--')}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
