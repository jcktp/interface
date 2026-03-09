import { useState } from 'react'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useStore } from '../store'
import { format, subDays, subMonths, subYears, startOfYear, startOfQuarter } from 'date-fns'

interface DateRangePickerProps {
  onClose: () => void
}

const presets = [
  { label: 'Last 7 days', getValue: () => ({ start: subDays(new Date(), 7), end: new Date() }) },
  { label: 'Last 30 days', getValue: () => ({ start: subDays(new Date(), 30), end: new Date() }) },
  { label: 'Last 90 days', getValue: () => ({ start: subDays(new Date(), 90), end: new Date() }) },
  { label: 'Last 12 months', getValue: () => ({ start: subMonths(new Date(), 12), end: new Date() }) },
  { label: 'Year to date', getValue: () => ({ start: startOfYear(new Date()), end: new Date() }) },
  { label: 'Quarter to date', getValue: () => ({ start: startOfQuarter(new Date()), end: new Date() }) },
  { label: 'Last year', getValue: () => ({ start: subYears(new Date(), 2), end: subYears(new Date(), 1) }) },
]

export default function DateRangePicker({ onClose }: DateRangePickerProps) {
  const { currentFilter, setFilter } = useStore()
  const [startDate, setStartDate] = useState(currentFilter.dateRange.start)
  const [endDate, setEndDate] = useState(currentFilter.dateRange.end)

  const handlePreset = (preset: typeof presets[0]) => {
    const { start, end } = preset.getValue()
    setStartDate(format(start, 'yyyy-MM-dd'))
    setEndDate(format(end, 'yyyy-MM-dd'))
  }

  const handleApply = () => {
    setFilter({ dateRange: { start: startDate, end: endDate } })
    onClose()
  }

  return (
    <Dialog open={true} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/30" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="bg-white rounded-xl shadow-xl w-full max-w-md">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Select Date Range
            </DialogTitle>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4">
            {/* Presets */}
            <div className="mb-4">
              <label className="label">Quick Select</label>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handlePreset(preset)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleApply} className="btn-primary">
              Apply
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
