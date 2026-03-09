export type DatePresetValue =
  | 'last_7_days'
  | 'last_14_days'
  | 'last_30_days'
  | 'last_60_days'
  | 'last_90_days'
  | 'current_week'
  | 'last_week'
  | 'current_month'
  | 'last_month'
  | 'current_year'
  | 'ytd'
  | 'last_year'
  | 'today'
  | 'yesterday'
  | 'all_time'
  | 'custom'

export interface DatePreset {
  label: string
  value: DatePresetValue
}

export const DATE_PRESETS: DatePreset[] = [
  { label: 'Last 7 Days', value: 'last_7_days' },
  { label: 'Last 14 Days', value: 'last_14_days' },
  { label: 'Last 30 Days', value: 'last_30_days' },
  { label: 'Last 60 Days', value: 'last_60_days' },
  { label: 'Last 90 Days', value: 'last_90_days' },
  { label: 'Current Week', value: 'current_week' },
  { label: 'Last Week', value: 'last_week' },
  { label: 'Current Month', value: 'current_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'Current Year', value: 'current_year' },
  { label: 'Year to Date', value: 'ytd' },
  { label: 'Last Year', value: 'last_year' },
  { label: 'Current Day', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'All Time', value: 'all_time' },
  { label: 'Custom', value: 'custom' },
]

export function getDateRange(preset: string): { start: string | null; end: string | null } {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  switch (preset) {
    case 'last_7_days': {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return { start: d.toISOString().split('T')[0], end: today }
    }
    case 'last_14_days': {
      const d = new Date(now)
      d.setDate(d.getDate() - 14)
      return { start: d.toISOString().split('T')[0], end: today }
    }
    case 'last_30_days': {
      const d = new Date(now)
      d.setDate(d.getDate() - 30)
      return { start: d.toISOString().split('T')[0], end: today }
    }
    case 'last_60_days': {
      const d = new Date(now)
      d.setDate(d.getDate() - 60)
      return { start: d.toISOString().split('T')[0], end: today }
    }
    case 'last_90_days': {
      const d = new Date(now)
      d.setDate(d.getDate() - 90)
      return { start: d.toISOString().split('T')[0], end: today }
    }
    case 'current_week': {
      const dayOfWeek = now.getDay()
      const monday = new Date(now)
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      return { start: monday.toISOString().split('T')[0], end: today }
    }
    case 'last_week': {
      const dayOfWeek = now.getDay()
      const thisMonday = new Date(now)
      thisMonday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      const lastMonday = new Date(thisMonday)
      lastMonday.setDate(thisMonday.getDate() - 7)
      const lastSunday = new Date(thisMonday)
      lastSunday.setDate(thisMonday.getDate() - 1)
      return { start: lastMonday.toISOString().split('T')[0], end: lastSunday.toISOString().split('T')[0] }
    }
    case 'current_month': {
      return {
        start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
        end: today,
      }
    }
    case 'last_month': {
      const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
      const month = now.getMonth() === 0 ? 12 : now.getMonth()
      const lastDay = new Date(year, month, 0).getDate()
      return {
        start: `${year}-${String(month).padStart(2, '0')}-01`,
        end: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      }
    }
    case 'current_year': {
      return { start: `${now.getFullYear()}-01-01`, end: today }
    }
    case 'ytd': {
      return { start: `${now.getFullYear()}-01-01`, end: today }
    }
    case 'last_year': {
      const year = now.getFullYear() - 1
      return { start: `${year}-01-01`, end: `${year}-12-31` }
    }
    case 'today': {
      return { start: today, end: today }
    }
    case 'yesterday': {
      const d = new Date(now)
      d.setDate(d.getDate() - 1)
      const y = d.toISOString().split('T')[0]
      return { start: y, end: y }
    }
    case 'all_time':
      return { start: null, end: null }
    case 'custom':
    default:
      return { start: null, end: null }
  }
}

export function getPresetLabel(value: string): string {
  const preset = DATE_PRESETS.find((p) => p.value === value)
  return preset ? preset.label : 'Custom'
}
