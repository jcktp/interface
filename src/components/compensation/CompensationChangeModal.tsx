import { useState, useRef } from 'react'
import { XMarkIcon, ArrowUpTrayIcon, TableCellsIcon, UserIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { useLocalization } from '../../hooks/useLocalization'
import Papa from 'papaparse'
import toast from 'react-hot-toast'

interface CompensationChangeModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CompensationChangeData | CompensationChangeData[]) => void
  employees: { 
    id: string; 
    name: string; 
    department: string; 
    salary: number; 
    employee_id?: string;
    equity_shares?: number;
    equity_value?: number;
  }[]
  planId?: string
}

interface CompensationChangeData {
  employee_id: string
  change_type: string
  new_salary: number
  new_equity_shares?: number
  new_equity_value?: number
  effective_date: string
  reason?: string
  plan_id?: string
}

const CHANGE_TYPES = [
  { value: 'merit', label: 'Merit Increase', description: 'Annual performance-based increase' },
  { value: 'promotion', label: 'Promotion', description: 'Role change with salary adjustment' },
  { value: 'market', label: 'Market Adjustment', description: 'Alignment with market rates' },
  { value: 'equity_refresh', label: 'Equity Refresh', description: 'Stock or equity grant' },
]

const DEFAULT_REASONS = [
  'Annual Merit Review',
  'Promotion / Level Up',
  'Market Salary Adjustment',
  'Equity Alignment',
  'Retention Counter-offer',
  'Cost of Living Adjustment (COLA)',
  'Role / Responsibility Expansion',
  'Internal Transfer Adjustment',
  'Performance Correction',
  'Other (Specify in notes)',
]

export default function CompensationChangeModal({
  isOpen,
  onClose,
  onSubmit,
  employees,
  planId,
}: CompensationChangeModalProps) {
  const loc = useLocalization()
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single')
  
  // Single change state
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [changeType, setChangeType] = useState<string>('merit')
  const [newSalary, setNewSalary] = useState<string>('')
  const [newEquityShares, setNewEquityShares] = useState<string>('')
  const [newEquityValue, setNewEquityValue] = useState<string>('')
  const [effectiveDate, setEffectiveDate] = useState<string>('')
  const [reason, setReason] = useState<string>(DEFAULT_REASONS[0])
  const [notes, setNotes] = useState<string>('')

  // Bulk change state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [bulkData, setBulkData] = useState<CompensationChangeData[]>([])
  const [previewData, setPreviewData] = useState<any[]>([])

  const selectedEmployeeData = employees.find((e) => e.id === selectedEmployee)
  
  // Update state when employee or change type changes
  const handleEmployeeChange = (id: string) => {
    setSelectedEmployee(id)
    const emp = employees.find(e => e.id === id)
    if (emp) {
      setNewSalary(String(emp.salary))
      setNewEquityShares(String(emp.equity_shares || 0))
      setNewEquityValue(String(emp.equity_value || 0))
    }
  }

  const currentSalary = selectedEmployeeData?.salary || 0
  const salaryChange = newSalary ? parseFloat(newSalary) - currentSalary : 0
  const changePercent = currentSalary > 0 ? (salaryChange / currentSalary) * 100 : 0

  const currentEquityShares = selectedEmployeeData?.equity_shares || 0
  const currentEquityValue = selectedEmployeeData?.equity_value || 0

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmployee || !newSalary || !effectiveDate) return

    const combinedReason = reason === 'Other (Specify in notes)' 
      ? notes 
      : notes ? `${reason}: ${notes}` : reason

    onSubmit({
      employee_id: selectedEmployee,
      change_type: changeType,
      new_salary: parseFloat(newSalary),
      new_equity_shares: newEquityShares ? parseFloat(newEquityShares) : undefined,
      new_equity_value: newEquityValue ? parseFloat(newEquityValue) : undefined,
      effective_date: effectiveDate,
      reason: combinedReason || undefined,
      plan_id: planId,
    })

    resetSingleForm()
  }

  const resetSingleForm = () => {
    setSelectedEmployee('')
    setChangeType('merit')
    setNewSalary('')
    setNewEquityShares('')
    setNewEquityValue('')
    setEffectiveDate('')
    setReason(DEFAULT_REASONS[0])
    setNotes('')
  }

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[]
        const processed: CompensationChangeData[] = []
        const preview: any[] = []
        let errors = 0

        rows.forEach((row) => {
          // Find employee by name or ID
          const emp = employees.find(e => 
            e.id === row.employee_id || 
            e.employee_id === row.employee_id ||
            e.name.toLowerCase() === row.name?.toLowerCase()
          )

          if (emp && (row.new_salary || row.new_equity_shares) && row.effective_date) {
            const data = {
              employee_id: emp.id,
              change_type: row.change_type || 'merit',
              new_salary: row.new_salary ? parseFloat(String(row.new_salary).replace(/[^0-9.]/g, '')) : emp.salary,
              new_equity_shares: row.new_equity_shares ? parseFloat(String(row.new_equity_shares).replace(/[^0-9.]/g, '')) : emp.equity_shares,
              new_equity_value: row.new_equity_value ? parseFloat(String(row.new_equity_value).replace(/[^0-9.]/g, '')) : emp.equity_value,
              effective_date: row.effective_date,
              reason: row.reason || 'Bulk CSV import',
              plan_id: planId
            }
            processed.push(data)
            preview.push({ 
              ...data, 
              name: emp.name, 
              current_salary: emp.salary, 
              current_equity_shares: emp.equity_shares,
              new_equity_shares: data.new_equity_shares
            })
          } else {
            errors++
          }
        })

        setBulkData(processed)
        setPreviewData(preview)
        if (errors > 0) {
          toast.error(`${errors} rows could not be matched to employees`)
        }
        toast.success(`Successfully parsed ${processed.length} rows`)
      }
    })
  }

  const handleBulkSubmit = () => {
    if (bulkData.length === 0) return
    onSubmit(bulkData)
    setBulkData([])
    setPreviewData([])
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Propose Compensation Change</h2>
            <p className="text-xs text-gray-500 mt-0.5">Submit individual or bulk salary adjustments</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('single')}
            className={clsx(
              'flex-1 py-3 text-sm font-medium text-center transition-colors',
              activeTab === 'single' ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/30' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <UserIcon className="w-4 h-4 inline-block mr-2" />
            Single Employee
          </button>
          <button
            onClick={() => setActiveTab('bulk')}
            className={clsx(
              'flex-1 py-3 text-sm font-medium text-center transition-colors',
              activeTab === 'bulk' ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/30' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <TableCellsIcon className="w-4 h-4 inline-block mr-2" />
            Bulk CSV Import
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {activeTab === 'single' ? (
            <form onSubmit={handleSingleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Employee</label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => handleEmployeeChange(e.target.value)}
                  className="input mt-1"
                  required
                >
                  <option value="">Select an employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} - {emp.department}
                    </option>
                  ))}
                </select>
              </div>

              {selectedEmployeeData && (
                <div className="bg-gray-50 p-3 rounded-lg grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Current Salary</p>
                    <p className="text-sm font-bold text-gray-900">{loc.currency(currentSalary)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Current Equity</p>
                    <p className="text-sm font-bold text-gray-900">
                      {currentEquityShares.toLocaleString()} shares ({loc.currency(currentEquityValue)})
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Change Type</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {CHANGE_TYPES.map((type) => (
                    <label
                      key={type.value}
                      className={clsx(
                        'flex flex-col p-2 border rounded-lg cursor-pointer transition-colors',
                        changeType === type.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="changeType"
                          value={type.value}
                          checked={changeType === type.value}
                          onChange={(e) => setChangeType(e.target.value)}
                          className="text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-xs font-semibold text-gray-900">{type.label}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className={clsx(changeType === 'equity_refresh' && 'opacity-50')}>
                  <label className="block text-sm font-medium text-gray-700">New Salary</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      value={newSalary}
                      onChange={(e) => setNewSalary(e.target.value)}
                      className="input pl-16 font-semibold"
                      placeholder="0"
                      disabled={changeType === 'equity_refresh'}
                      required={changeType !== 'equity_refresh'}
                    />
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 font-medium pointer-events-none select-none">
                      {loc.settings.currency === 'USD' ? '$' : loc.settings.currency}
                    </span>
                  </div>
                  {newSalary && selectedEmployeeData && changeType !== 'equity_refresh' && (
                    <p className={clsx('mt-1 text-xs font-medium', salaryChange >= 0 ? 'text-success-600' : 'text-danger-600')}>
                      {salaryChange >= 0 ? '+' : ''}{loc.currency(salaryChange)} ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%)
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Effective Date</label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="input mt-1"
                    required
                  />
                </div>
              </div>

              {changeType === 'equity_refresh' && (
                <div className="p-4 border-2 border-primary-100 bg-primary-50/20 rounded-xl space-y-4">
                  <h4 className="text-sm font-bold text-primary-900 flex items-center gap-2">
                    <SparklesIcon className="w-4 h-4" />
                    New Equity Grant Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">New Total Shares</label>
                      <input
                        type="number"
                        value={newEquityShares}
                        onChange={(e) => setNewEquityShares(e.target.value)}
                        className="input font-semibold"
                        placeholder="0"
                        required
                      />
                      {newEquityShares && (
                        <p className="mt-1 text-[10px] text-primary-600 font-bold">
                          {(parseFloat(newEquityShares) - currentEquityShares) >= 0 ? '+' : ''}
                          {(parseFloat(newEquityShares) - currentEquityShares).toLocaleString()} shares diff
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Grant Value (Est.)</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={newEquityValue}
                          onChange={(e) => setNewEquityValue(e.target.value)}
                          className="input pl-10 font-semibold"
                          placeholder="0"
                          required
                        />
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 font-bold text-xs pointer-events-none">
                          {loc.settings.currency === 'USD' ? '$' : loc.settings.currency}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Primary Reason</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="input mt-1"
                  required
                >
                  {DEFAULT_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input mt-1"
                  rows={2}
                  placeholder={reason === 'Other (Specify in notes)' ? "Please describe the reason for this change..." : "Provide any additional context for this adjustment..."}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={!selectedEmployee || !newSalary || !effectiveDate} className="btn-primary">
                  Submit Proposal
                </button>
              </div>
            </form>
          ) : (
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-1">CSV Template Guide</h4>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Upload a CSV with columns: <code className="bg-blue-100 px-1 rounded font-bold">employee_id</code> (or name), 
                  <code className="bg-blue-100 px-1 rounded font-bold">new_salary</code>, 
                  <code className="bg-blue-100 px-1 rounded font-bold">effective_date</code> (YYYY-MM-DD), and optionally 
                  <code className="bg-blue-100 px-1 rounded font-bold">change_type</code> and <code className="bg-blue-100 px-1 rounded font-bold">reason</code>.
                </p>
              </div>

              {!previewData.length ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl py-12 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <ArrowUpTrayIcon className="w-10 h-10 text-gray-400 mb-3" />
                  <p className="text-sm font-medium text-gray-900">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-500 mt-1">CSV files only (max 10MB)</p>
                  <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900">Import Preview ({previewData.length} records)</h4>
                    <button onClick={() => { setBulkData([]); setPreviewData([]) }} className="text-xs text-primary-600 hover:text-primary-700 font-medium">Clear and restart</button>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Employee</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Salary (New)</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Equity (New)</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-500">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {previewData.map((row, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-medium text-gray-900">{row.name}</td>
                            <td className="px-3 py-2 text-right font-bold text-success-700">
                              {row.new_salary !== row.current_salary ? loc.currency(row.new_salary) : '-'}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-indigo-700">
                              {row.new_equity_shares !== row.current_equity_shares ? `${row.new_equity_shares?.toLocaleString()} sh` : '-'}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-500">{row.effective_date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                    <button onClick={handleBulkSubmit} className="btn-primary">
                      Submit {previewData.length} Proposals
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function clsx(...classes: any[]) {
  return classes.filter(Boolean).join(' ')
}
