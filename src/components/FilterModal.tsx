import { useState, useEffect } from 'react'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useStore } from '../store'
import api from '../api'
import clsx from 'clsx'

interface FilterModalProps {
  onClose: () => void
}

const statuses = ['active', 'terminated', 'on_leave']

export default function FilterModal({ onClose }: FilterModalProps) {
  const { currentFilter, setFilter, resetFilter } = useStore()
  const [selectedDepts, setSelectedDepts] = useState<string[]>(currentFilter.departments)
  const [selectedLocations, setSelectedLocations] = useState<string[]>(currentFilter.locations)
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(currentFilter.status)

  // Fetch departments and locations from the database
  const [departments, setDepartments] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchOptions() {
      setOptionsLoading(true)
      try {
        const [deptRes, locRes] = await Promise.all([
          api.get('/employees/departments'),
          api.get('/employees/locations'),
        ])
        if (!cancelled) {
          setDepartments(deptRes.data?.departments ?? [])
          setLocations(locRes.data?.locations ?? [])
        }
      } catch (err) {
        console.error('Failed to fetch filter options:', err)
        // Keep empty arrays so UI still renders
      } finally {
        if (!cancelled) setOptionsLoading(false)
      }
    }

    fetchOptions()
    return () => { cancelled = true }
  }, [])

  const toggleDept = (dept: string) => {
    setSelectedDepts((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    )
  }

  const toggleLocation = (location: string) => {
    setSelectedLocations((prev) =>
      prev.includes(location) ? prev.filter((l) => l !== location) : [...prev, location]
    )
  }

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    )
  }

  const handleApply = () => {
    setFilter({
      departments: selectedDepts,
      locations: selectedLocations,
      status: selectedStatuses,
    })
    onClose()
  }

  const handleReset = () => {
    resetFilter()
    setSelectedDepts([])
    setSelectedLocations([])
    setSelectedStatuses([])
  }

  return (
    <Dialog open={true} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/30" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              Filters
            </DialogTitle>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Departments */}
            <div>
              <label className="label">Departments</label>
              {optionsLoading ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-8 w-24 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : departments.length === 0 ? (
                <p className="text-sm text-gray-400">No departments found</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {departments.map((dept) => (
                    <button
                      key={dept}
                      onClick={() => toggleDept(dept)}
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors',
                        selectedDepts.includes(dept)
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                      )}
                    >
                      {selectedDepts.includes(dept) && <CheckIcon className="w-4 h-4" />}
                      {dept}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Locations */}
            <div>
              <label className="label">Locations</label>
              {optionsLoading ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-8 w-24 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : locations.length === 0 ? (
                <p className="text-sm text-gray-400">No locations found</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {locations.map((location) => (
                    <button
                      key={location}
                      onClick={() => toggleLocation(location)}
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors',
                        selectedLocations.includes(location)
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                      )}
                    >
                      {selectedLocations.includes(location) && <CheckIcon className="w-4 h-4" />}
                      {location}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="label">Employee Status</label>
              <div className="flex flex-wrap gap-2">
                {statuses.map((status) => (
                  <button
                    key={status}
                    onClick={() => toggleStatus(status)}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors capitalize',
                      selectedStatuses.includes(status)
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    )}
                  >
                    {selectedStatuses.includes(status) && <CheckIcon className="w-4 h-4" />}
                    {status.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between p-4 border-t border-gray-200 dark:border-gray-700">
            <button onClick={handleReset} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              Reset all
            </button>
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleApply} className="btn-primary">
                Apply Filters
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
