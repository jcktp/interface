import { CHANGE_TYPES } from './types'

interface Props {
  isOpen: boolean
  onClose: () => void
  bulkScope: 'company' | 'department' | 'location' | 'team'
  setBulkScope: (scope: 'company' | 'department' | 'location' | 'team') => void
  bulkScopeValue: string
  setBulkScopeValue: (val: string) => void
  bulkPercentage: string
  setBulkPercentage: (val: string) => void
  bulkChangeType: string
  setBulkChangeType: (val: string) => void
  bulkEffectiveDate: string
  setBulkEffectiveDate: (val: string) => void
  bulkPreview: any
  loadingPreview: boolean
  onPreview: () => void
  onApply: () => void
  isApplying: boolean
  getScopeOptions: () => string[]
  formatCurrency: (val: number) => string
}

export default function BulkIncreaseModal({
  isOpen,
  onClose,
  bulkScope,
  setBulkScope,
  bulkScopeValue,
  setBulkScopeValue,
  bulkPercentage,
  setBulkPercentage,
  bulkChangeType,
  setBulkChangeType,
  bulkEffectiveDate,
  setBulkEffectiveDate,
  bulkPreview,
  loadingPreview,
  onPreview,
  onApply,
  isApplying,
  getScopeOptions,
  formatCurrency,
}: Props) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Bulk Salary Increase</h3>
            <p className="text-sm text-gray-500 mt-0.5">Apply a percentage increase across employees</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">Close</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Scope</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'company', label: 'Company Wide' },
                { value: 'department', label: 'By Department' },
                { value: 'location', label: 'By Location' },
                { value: 'team', label: 'By Team' },
              ] as const).map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-sm transition-colors ${
                    bulkScope === opt.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="bulkScope"
                    value={opt.value}
                    checked={bulkScope === opt.value}
                    onChange={() => setBulkScope(opt.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {bulkScope !== 'company' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {bulkScope === 'department' ? 'Department' : bulkScope === 'location' ? 'Location' : 'Team'}
              </label>
              <select
                value={bulkScopeValue}
                onChange={e => setBulkScopeValue(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select...</option>
                {getScopeOptions().map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Increase Percentage</label>
            <div className="relative">
              <input
                type="number"
                value={bulkPercentage}
                onChange={e => setBulkPercentage(e.target.value)}
                min="0.1"
                max="50"
                step="0.1"
                placeholder="e.g. 5.0"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Change Type</label>
            <select
              value={bulkChangeType}
              onChange={e => setBulkChangeType(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {CHANGE_TYPES.map(ct => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
            <input
              type="date"
              value={bulkEffectiveDate}
              onChange={e => setBulkEffectiveDate(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            onClick={onPreview}
            disabled={!bulkPercentage || loadingPreview || (bulkScope !== 'company' && !bulkScopeValue)}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            {loadingPreview ? 'Calculating...' : 'Preview Impact'}
          </button>

          {bulkPreview && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-semibold text-gray-700">Impact Preview</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Employees affected</span>
                  <p className="font-semibold text-gray-900">{bulkPreview.employees_affected.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-500">Current total</span>
                  <p className="font-semibold text-gray-900">{formatCurrency(bulkPreview.current_total)}</p>
                </div>
                <div>
                  <span className="text-gray-500">New total</span>
                  <p className="font-semibold text-green-700">{formatCurrency(bulkPreview.new_total)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Cost increase</span>
                  <p className="font-semibold text-amber-700">+{formatCurrency(bulkPreview.cost_increase)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button
            onClick={onApply}
            disabled={
              !bulkPercentage ||
              !bulkEffectiveDate ||
              isApplying ||
              (bulkScope !== 'company' && !bulkScopeValue)
            }
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {isApplying ? 'Applying...' : 'Apply Increase'}
          </button>
        </div>
      </div>
    </div>
  )
}
