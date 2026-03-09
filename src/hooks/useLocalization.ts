import { useStore } from '../store'
import { formatCurrency, formatDate, formatNumber, formatPercentage, formatRelativeDate } from '../utils/localization'

/**
 * Hook that wraps localization formatters with the user's stored settings.
 * Use this instead of calling formatCurrency/formatDate directly.
 */
export function useLocalization() {
  const localization = useStore((s) => s.localization)

  return {
    /** Format a currency amount using the user's selected currency */
    currency: (amount: number, compact = false) =>
      formatCurrency(amount, localization.currency, compact),

    /** Format a date using the user's selected date format */
    date: (d: Date | string, includeTime = false) =>
      formatDate(d, localization.dateFormat, includeTime),

    /** Format a number using the user's locale */
    number: (v: number, options?: Intl.NumberFormatOptions) =>
      formatNumber(v, localization.language, options),

    /** Format a percentage using the user's locale */
    percentage: (v: number, decimals = 1) =>
      formatPercentage(v, localization.language, decimals),

    /** Format a relative date using the user's locale */
    relative: (d: Date | string) =>
      formatRelativeDate(d, localization.language),

    /** The raw settings for reference */
    settings: localization,
  }
}
