/**
 * Shared chart color palette — accessible, perceptually distinct categorical colors.
 *
 * Principles (per Atlassian data visualization guide):
 *  - Vary hue AND lightness so colors remain distinguishable for colorblind users
 *  - Avoid very dark colors (#0F172A) as primary data series — reserve for accents/backgrounds
 *  - Reduce saturation on non-critical series to lower visual noise
 *  - Use culturally meaningful colors for status (green = positive, red = negative)
 *
 * Palette order: blue → emerald → amber → violet → cyan → orange → pink → slate
 */
export const CHART_COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#8B5CF6', // violet-500
  '#06B6D4', // cyan-500
  '#F97316', // orange-500
  '#EC4899', // pink-500
  '#6B7280', // gray-500
] as const

/** Light/fill versions for area charts, backgrounds, tooltips */
export const CHART_COLORS_LIGHT = [
  '#EFF6FF', // blue-50
  '#ECFDF5', // emerald-50
  '#FFFBEB', // amber-50
  '#F5F3FF', // violet-50
  '#ECFEFF', // cyan-50
  '#FFF7ED', // orange-50
  '#FDF2F8', // pink-50
  '#F9FAFB', // gray-50
] as const

/** Get a color by index, wrapping around if needed */
export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}

/** Get a light background color by index */
export function getChartColorLight(index: number): string {
  return CHART_COLORS_LIGHT[index % CHART_COLORS_LIGHT.length]
}

/** Named colors for status/KPI use cases */
export const STATUS_COLORS = {
  positive: '#10B981', // emerald-500 — growth, healthy
  negative: '#EF4444', // red-500 — risk, declining
  neutral:  '#6B7280', // gray-500 — unchanged
  warning:  '#F59E0B', // amber-500 — needs attention
  info:     '#3B82F6', // blue-500 — informational
} as const

/**
 * Pie / donut chart palette — 10 distinct hues with varying lightness.
 * Colorblind-safe: Blue, Green, Amber, Violet, Cyan, Orange, Pink, Gray, Lime, Red
 */
export const PIE_COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#8B5CF6', // violet-500
  '#06B6D4', // cyan-500
  '#F97316', // orange-500
  '#EC4899', // pink-500
  '#6B7280', // gray-500
  '#84CC16', // lime-500
  '#EF4444', // red-500
] as const

/**
 * Sequential palette (single-hue blue) for continuous/ordered data.
 * Lightest → Darkest, 5 steps.
 */
export const SEQUENTIAL_BLUE = [
  '#DBEAFE', // blue-100
  '#93C5FD', // blue-300
  '#3B82F6', // blue-500
  '#1D4ED8', // blue-700
  '#1E3A8A', // blue-900
] as const

/**
 * Diverging palette (red → neutral → blue) for data with a meaningful midpoint.
 */
export const DIVERGING_RB = [
  '#EF4444', // red-500 (low / negative end)
  '#FCA5A5', // red-300
  '#E5E7EB', // gray-200 (neutral midpoint)
  '#93C5FD', // blue-300
  '#3B82F6', // blue-500 (high / positive end)
] as const

/**
 * Format a number into compact form (e.g. 1.2M, 85K).
 * Useful for financial values and large numbers on chart labels.
 */
export function formatCompactNumber(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return '0'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`
  } else if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  } else if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(0)}K`
  }
  return `${sign}${abs.toFixed(0)}`
}

/** Keys that indicate financial data */
const FINANCIAL_KEYS = [
  'salary', 'revenue', 'profit', 'cost', 'budget', 'compensation',
  'total_cost', 'amount', 'cost_per_hire', 'annual_revenue', 'annual_profit',
]

/**
 * Smart chart label formatter.
 *
 * - For financial data keys or values >= 10,000, uses compact notation (85K, 1.2M).
 * - For smaller numbers, shows up to 2 decimal places (whole numbers without decimals).
 *
 * @param value  The numeric value to format.
 * @param dataKey  Optional Recharts data key; used to detect financial context.
 */
export function formatChartLabel(value: unknown, dataKey?: string): string {
  const v = Number(value)
  if (isNaN(v)) return String(value)

  const isFinancial = dataKey && FINANCIAL_KEYS.some(k => dataKey.toLowerCase().includes(k))

  if (isFinancial || Math.abs(v) >= 10_000) {
    return formatCompactNumber(v)
  }
  return Number.isInteger(v) ? v.toString() : v.toFixed(2)
}
