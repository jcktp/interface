import { XMarkIcon, FunnelIcon } from '@heroicons/react/24/outline'
import { FILTER_DEPARTMENTS, FILTER_LOCATIONS, FILTER_TIME_PRESETS } from '../hooks/usePageFilters'

interface PageFilterBarProps {
  department:     string
  setDepartment:  (v: string) => void
  location?:      string
  setLocation?:   (v: string) => void
  timePeriod:     string
  setTimePeriod:  (v: string) => void
  hasFilters:     boolean
  resetFilters:   () => void
  showLocation?:  boolean
  className?:     string
}

export default function PageFilterBar({
  department, setDepartment,
  location = '', setLocation,
  timePeriod, setTimePeriod,
  hasFilters, resetFilters,
  showLocation = true,
  className = '',
}: PageFilterBarProps) {
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <FunnelIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />

      <select
        value={timePeriod}
        onChange={e => setTimePeriod(e.target.value)}
        className="text-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
      >
        {FILTER_TIME_PRESETS.map(p => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>

      <select
        value={department}
        onChange={e => setDepartment(e.target.value)}
        className="text-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
      >
        <option value="">All Departments</option>
        {FILTER_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
      </select>

      {showLocation && setLocation && (
        <select
          value={location}
          onChange={e => setLocation(e.target.value)}
          className="text-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
        >
          <option value="">All Locations</option>
          {FILTER_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      )}

      {hasFilters && (
        <button
          onClick={resetFilters}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <XMarkIcon className="w-3 h-3" />
          Clear
        </button>
      )}
    </div>
  )
}
