import { useStore } from '../store'
import { useMemo } from 'react'
import { getDateRange } from '../utils/datePresets'

export function useGlobalFilters() {
  const currentFilter = useStore((s) => s.currentFilter)

  // Resolve effective date range from preset (or use custom values)
  const effectiveDateRange = useMemo(() => {
    if (currentFilter.datePreset && currentFilter.datePreset !== 'custom') {
      return getDateRange(currentFilter.datePreset)
    }
    return {
      start: currentFilter.dateRange.start || null,
      end: currentFilter.dateRange.end || null,
    }
  }, [currentFilter.datePreset, currentFilter.dateRange])

  // Build query params string for API calls
  const filterParams = useMemo(() => {
    const params = new URLSearchParams()
    if (effectiveDateRange.start) params.append('start_date', effectiveDateRange.start)
    if (effectiveDateRange.end) params.append('end_date', effectiveDateRange.end)
    if (currentFilter.departments.length > 0) params.append('departments', currentFilter.departments.join(','))
    if (currentFilter.locations.length > 0) params.append('locations', currentFilter.locations.join(','))
    if (currentFilter.status.length > 0) params.append('status', currentFilter.status.join(','))
    return params.toString()
  }, [currentFilter, effectiveDateRange])

  // Return as object for direct use in axios params
  const filterObj = useMemo(() => {
    const obj: Record<string, string> = {}
    if (effectiveDateRange.start) obj.start_date = effectiveDateRange.start
    if (effectiveDateRange.end) obj.end_date = effectiveDateRange.end
    if (currentFilter.departments.length > 0) obj.departments = currentFilter.departments.join(',')
    if (currentFilter.locations.length > 0) obj.locations = currentFilter.locations.join(',')
    if (currentFilter.status.length > 0) obj.status = currentFilter.status.join(',')
    return obj
  }, [currentFilter, effectiveDateRange])

  const hasActiveFilters = currentFilter.departments.length > 0 ||
    currentFilter.locations.length > 0 ||
    currentFilter.status.length > 0

  const hasDateFilter = currentFilter.datePreset !== 'all_time'

  const activeFilterCount = currentFilter.departments.length +
    currentFilter.locations.length +
    currentFilter.status.length

  return { currentFilter, filterParams, filterObj, hasActiveFilters, hasDateFilter, activeFilterCount, effectiveDateRange }
}
