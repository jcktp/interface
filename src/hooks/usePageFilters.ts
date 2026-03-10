import { useState, useMemo } from 'react'
import { getDateRange } from '../utils/datePresets'

export const FILTER_DEPARTMENTS = [
  'Engineering', 'Sales', 'Marketing', 'Product', 'HR', 'Finance',
  'Operations', 'Design', 'Customer Success', 'Legal',
]

export const FILTER_LOCATIONS = [
  'New York', 'San Francisco', 'London', 'Austin', 'Remote',
  'Chicago', 'Boston', 'Seattle', 'Berlin', 'Singapore',
]

export const FILTER_TIME_PRESETS = [
  { value: 'all_time',       label: 'All Time' },
  { value: 'this_month',     label: 'This Month' },
  { value: 'last_month',     label: 'Last Month' },
  { value: 'this_quarter',   label: 'This Quarter' },
  { value: 'last_quarter',   label: 'Last Quarter' },
  { value: 'this_year',      label: 'This Year' },
  { value: 'last_year',      label: 'Last Year' },
  { value: 'last_12_months', label: 'Last 12 Months' },
]

export function usePageFilters() {
  const [department, setDepartment] = useState('')
  const [location, setLocation]     = useState('')
  const [timePeriod, setTimePeriod] = useState('all_time')

  const filterParams = useMemo(() => {
    const obj: Record<string, string> = {}
    if (department) obj.departments = department
    if (location)   obj.locations   = location
    if (timePeriod && timePeriod !== 'all_time') {
      const range = getDateRange(timePeriod)
      if (range.start) obj.start_date = range.start
      if (range.end)   obj.end_date   = range.end
    }
    return obj
  }, [department, location, timePeriod])

  const hasFilters   = !!(department || location || timePeriod !== 'all_time')
  const resetFilters = () => { setDepartment(''); setLocation(''); setTimePeriod('all_time') }

  return {
    department, setDepartment,
    location,   setLocation,
    timePeriod, setTimePeriod,
    filterParams,
    hasFilters,
    resetFilters,
  }
}
