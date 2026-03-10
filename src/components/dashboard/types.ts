export type WidgetType = 'metric' | 'line' | 'bar' | 'area' | 'pie' | 'table' | 'gauge' | 'sql'

export interface Widget {
  id: string
  type: WidgetType
  title: string
  config: WidgetConfig
}

export interface WidgetConfig {
  metric?: string
  data_source?: string
  group_by?: string
  columns?: string[]
  limit?: number
  thresholds?: { low: number; medium: number; high: number }
  color?: string
  showLegend?: boolean
  showGrid?: boolean
  sql_query?: string
  saved_query_id?: string
  department?: string
  // Filters
  time_period?: string          // e.g. 'this_month', 'last_quarter', 'last_12_months'
  comparison?: string           // e.g. 'wow', 'mom', 'yoy', 'vs_target'
  location?: string
  job_level?: string
}

export interface DashboardLayout {
  i: string  // Widget ID
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
}

export interface Dashboard {
  id: string
  name: string
  description?: string
  is_default: boolean
  is_public: boolean
  layout: DashboardLayout[]
  widgets: Widget[]
  theme: 'light' | 'dark'
  refresh_interval?: number
  created_at: string
  updated_at: string
}

export interface WidgetData {
  value?: number | string
  label?: string
  prefix?: string
  suffix?: string
  labels?: string[]
  datasets?: { label: string; data: number[] }[]
  columns?: string[]
  rows?: Record<string, any>[]
  min?: number
  max?: number
  thresholds?: { low: number; medium: number; high: number }
}
