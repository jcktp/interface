/**
 * Shared chart color palette — professional, cohesive, not monochromatic.
 * Uses a blue-to-teal-to-amber spectrum to avoid conflicting hues.
 * Order: navy, blue, teal, amber, slate, indigo
 */
export const CHART_COLORS = [
  '#0F172A', // deep navy (primary)
  '#2563EB', // blue-600
  '#0D9488', // teal-600
  '#D97706', // amber-600
  '#475569', // slate-600
  '#4F46E5', // indigo-600
] as const

export const CHART_COLORS_LIGHT = [
  '#EFF6FF', // blue-50
  '#F0FDFA', // teal-50
  '#FFFBEB', // amber-50
  '#F1F5F9', // slate-100
  '#EEF2FF', // indigo-50
  '#F8FAFC', // slate-50
] as const

/** Get a color by index, wrapping around if needed */
export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}

/** Get a light background color by index */
export function getChartColorLight(index: number): string {
  return CHART_COLORS_LIGHT[index % CHART_COLORS_LIGHT.length]
}

/** Named colors for specific use cases */
export const STATUS_COLORS = {
  positive: '#16a34a',
  negative: '#dc2626',
  neutral: '#475569',
  warning: '#eab308',
  info: '#7c6aad',
} as const

/** Pie/donut chart palette — cohesive blues, teals, ambers */
export const PIE_COLORS = ['#0F172A', '#2563EB', '#0D9488', '#D97706', '#4F46E5', '#475569', '#7C3AED', '#0891B2'] as const

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
