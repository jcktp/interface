/**
 * Localization utilities for Interface
 * Supports European and international date, currency, and timezone formatting
 */

// Currency configuration
export const CURRENCIES = {
  EUR: { symbol: '\u20ac', code: 'EUR', name: 'Euro', locale: 'en-IE', position: 'before' },
  USD: { symbol: '$', code: 'USD', name: 'US Dollar', locale: 'en-US', position: 'before' },
  GBP: { symbol: '\u00a3', code: 'GBP', name: 'British Pound', locale: 'en-GB', position: 'before' },
  AED: { symbol: '\u062f.\u0625', code: 'AED', name: 'UAE Dirham', locale: 'ar-AE', position: 'before' },
  ARS: { symbol: '$', code: 'ARS', name: 'Argentine Peso', locale: 'es-AR', position: 'before' },
  AUD: { symbol: 'A$', code: 'AUD', name: 'Australian Dollar', locale: 'en-AU', position: 'before' },
  BRL: { symbol: 'R$', code: 'BRL', name: 'Brazilian Real', locale: 'pt-BR', position: 'before' },
  CAD: { symbol: 'C$', code: 'CAD', name: 'Canadian Dollar', locale: 'en-CA', position: 'before' },
  CHF: { symbol: 'CHF', code: 'CHF', name: 'Swiss Franc', locale: 'de-CH', position: 'before' },
  CLP: { symbol: '$', code: 'CLP', name: 'Chilean Peso', locale: 'es-CL', position: 'before' },
  CNY: { symbol: '\u00a5', code: 'CNY', name: 'Chinese Yuan', locale: 'zh-CN', position: 'before' },
  COP: { symbol: '$', code: 'COP', name: 'Colombian Peso', locale: 'es-CO', position: 'before' },
  CRC: { symbol: '\u20a1', code: 'CRC', name: 'Costa Rican Colon', locale: 'es-CR', position: 'before' },
  CZK: { symbol: 'K\u010d', code: 'CZK', name: 'Czech Koruna', locale: 'cs-CZ', position: 'after' },
  DKK: { symbol: 'kr', code: 'DKK', name: 'Danish Krone', locale: 'da-DK', position: 'after' },
  EGP: { symbol: 'E\u00a3', code: 'EGP', name: 'Egyptian Pound', locale: 'ar-EG', position: 'before' },
  HKD: { symbol: 'HK$', code: 'HKD', name: 'Hong Kong Dollar', locale: 'en-HK', position: 'before' },
  HUF: { symbol: 'Ft', code: 'HUF', name: 'Hungarian Forint', locale: 'hu-HU', position: 'after' },
  IDR: { symbol: 'Rp', code: 'IDR', name: 'Indonesian Rupiah', locale: 'id-ID', position: 'before' },
  ILS: { symbol: '\u20aa', code: 'ILS', name: 'Israeli Shekel', locale: 'he-IL', position: 'before' },
  INR: { symbol: '\u20b9', code: 'INR', name: 'Indian Rupee', locale: 'en-IN', position: 'before' },
  JPY: { symbol: '\u00a5', code: 'JPY', name: 'Japanese Yen', locale: 'ja-JP', position: 'before' },
  KES: { symbol: 'KSh', code: 'KES', name: 'Kenyan Shilling', locale: 'en-KE', position: 'before' },
  KRW: { symbol: '\u20a9', code: 'KRW', name: 'South Korean Won', locale: 'ko-KR', position: 'before' },
  MXN: { symbol: '$', code: 'MXN', name: 'Mexican Peso', locale: 'es-MX', position: 'before' },
  MYR: { symbol: 'RM', code: 'MYR', name: 'Malaysian Ringgit', locale: 'ms-MY', position: 'before' },
  NGN: { symbol: '\u20a6', code: 'NGN', name: 'Nigerian Naira', locale: 'en-NG', position: 'before' },
  NOK: { symbol: 'kr', code: 'NOK', name: 'Norwegian Krone', locale: 'nb-NO', position: 'after' },
  NZD: { symbol: 'NZ$', code: 'NZD', name: 'New Zealand Dollar', locale: 'en-NZ', position: 'before' },
  PEN: { symbol: 'S/.', code: 'PEN', name: 'Peruvian Sol', locale: 'es-PE', position: 'before' },
  PHP: { symbol: '\u20b1', code: 'PHP', name: 'Philippine Peso', locale: 'en-PH', position: 'before' },
  PLN: { symbol: 'z\u0142', code: 'PLN', name: 'Polish Zloty', locale: 'pl-PL', position: 'after' },
  QAR: { symbol: '\ufdfc', code: 'QAR', name: 'Qatari Riyal', locale: 'ar-QA', position: 'before' },
  RON: { symbol: 'lei', code: 'RON', name: 'Romanian Leu', locale: 'ro-RO', position: 'after' },
  SAR: { symbol: '\ufdfc', code: 'SAR', name: 'Saudi Riyal', locale: 'ar-SA', position: 'before' },
  SEK: { symbol: 'kr', code: 'SEK', name: 'Swedish Krona', locale: 'sv-SE', position: 'after' },
  SGD: { symbol: 'S$', code: 'SGD', name: 'Singapore Dollar', locale: 'en-SG', position: 'before' },
  THB: { symbol: '\u0e3f', code: 'THB', name: 'Thai Baht', locale: 'th-TH', position: 'before' },
  TRY: { symbol: '\u20ba', code: 'TRY', name: 'Turkish Lira', locale: 'tr-TR', position: 'before' },
  TWD: { symbol: 'NT$', code: 'TWD', name: 'Taiwan Dollar', locale: 'zh-TW', position: 'before' },
  VND: { symbol: '\u20ab', code: 'VND', name: 'Vietnamese Dong', locale: 'vi-VN', position: 'after' },
  ZAR: { symbol: 'R', code: 'ZAR', name: 'South African Rand', locale: 'en-ZA', position: 'before' },
} as const

export type CurrencyCode = keyof typeof CURRENCIES

// Timezone configuration - including all major European timezones
export const TIMEZONES = {
  // Americas
  'America/Los_Angeles': { name: 'Pacific Time (PT)', offset: -8, region: 'Americas' },
  'America/Denver': { name: 'Mountain Time (MT)', offset: -7, region: 'Americas' },
  'America/Chicago': { name: 'Central Time (CT)', offset: -6, region: 'Americas' },
  'America/New_York': { name: 'Eastern Time (ET)', offset: -5, region: 'Americas' },

  // Europe
  'Europe/London': { name: 'Western European Time (WET/GMT)', offset: 0, region: 'Europe' },
  'Europe/Dublin': { name: 'Irish Standard Time (IST)', offset: 0, region: 'Europe' },
  'Europe/Paris': { name: 'Central European Time (CET)', offset: 1, region: 'Europe' },
  'Europe/Berlin': { name: 'Central European Time (CET)', offset: 1, region: 'Europe' },
  'Europe/Amsterdam': { name: 'Central European Time (CET)', offset: 1, region: 'Europe' },
  'Europe/Brussels': { name: 'Central European Time (CET)', offset: 1, region: 'Europe' },
  'Europe/Rome': { name: 'Central European Time (CET)', offset: 1, region: 'Europe' },
  'Europe/Madrid': { name: 'Central European Time (CET)', offset: 1, region: 'Europe' },
  'Europe/Vienna': { name: 'Central European Time (CET)', offset: 1, region: 'Europe' },
  'Europe/Warsaw': { name: 'Central European Time (CET)', offset: 1, region: 'Europe' },
  'Europe/Stockholm': { name: 'Central European Time (CET)', offset: 1, region: 'Europe' },
  'Europe/Zurich': { name: 'Central European Time (CET)', offset: 1, region: 'Europe' },
  'Europe/Helsinki': { name: 'Eastern European Time (EET)', offset: 2, region: 'Europe' },
  'Europe/Athens': { name: 'Eastern European Time (EET)', offset: 2, region: 'Europe' },
  'Europe/Bucharest': { name: 'Eastern European Time (EET)', offset: 2, region: 'Europe' },
  'Europe/Kiev': { name: 'Eastern European Time (EET)', offset: 2, region: 'Europe' },
  'Europe/Moscow': { name: 'Moscow Time (MSK)', offset: 3, region: 'Europe' },

  // UTC
  'UTC': { name: 'Coordinated Universal Time (UTC)', offset: 0, region: 'Universal' },
} as const

export type TimezoneCode = keyof typeof TIMEZONES

// Date format configuration
export const DATE_FORMATS = {
  'MM/DD/YYYY': { name: 'MM/DD/YYYY (US)', example: '01/25/2026', locale: 'en-US' },
  'DD/MM/YYYY': { name: 'DD/MM/YYYY (Europe)', example: '25/01/2026', locale: 'en-GB' },
  'DD.MM.YYYY': { name: 'DD.MM.YYYY (Germany)', example: '25.01.2026', locale: 'de-DE' },
  'YYYY-MM-DD': { name: 'YYYY-MM-DD (ISO)', example: '2026-01-25', locale: 'sv-SE' },
  'DD-MM-YYYY': { name: 'DD-MM-YYYY', example: '25-01-2026', locale: 'nl-NL' },
} as const

export type DateFormat = keyof typeof DATE_FORMATS

// Language configuration
export const LANGUAGES = {
  'en-US': { name: 'English (US)', nativeName: 'English (US)' },
  'en-GB': { name: 'English (UK)', nativeName: 'English (UK)' },
  'de-DE': { name: 'German', nativeName: 'Deutsch' },
  'fr-FR': { name: 'French', nativeName: 'Français' },
  'es-ES': { name: 'Spanish', nativeName: 'Español' },
  'it-IT': { name: 'Italian', nativeName: 'Italiano' },
  'nl-NL': { name: 'Dutch', nativeName: 'Nederlands' },
  'pl-PL': { name: 'Polish', nativeName: 'Polski' },
  'pt-PT': { name: 'Portuguese', nativeName: 'Português' },
  'sv-SE': { name: 'Swedish', nativeName: 'Svenska' },
} as const

export type LanguageCode = keyof typeof LANGUAGES

// Localization settings interface
export interface LocalizationSettings {
  currency: CurrencyCode
  timezone: TimezoneCode
  dateFormat: DateFormat
  language: LanguageCode
  numberFormat: 'comma' | 'period' // Decimal separator
}

// Default settings (can be changed based on detected locale)
export const DEFAULT_SETTINGS: LocalizationSettings = {
  currency: 'EUR',
  timezone: 'Europe/London',
  dateFormat: 'DD/MM/YYYY',
  language: 'en-GB',
  numberFormat: 'comma',
}

/**
 * Format currency according to settings
 */
export function formatCurrency(
  amount: number,
  currency: CurrencyCode = 'EUR',
  compact = false
): string {
  const config = CURRENCIES[currency]

  if (compact && Math.abs(amount) >= 1000000) {
    const millions = amount / 1000000
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.code,
      maximumFractionDigits: 1,
    }).format(millions).replace(/[\d.,]+/, `${millions.toFixed(1)}M`)
  }

  if (compact && Math.abs(amount) >= 1000) {
    const thousands = amount / 1000
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.code,
      maximumFractionDigits: 1,
    }).format(thousands).replace(/[\d.,]+/, `${thousands.toFixed(1)}K`)
  }

  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.code,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format date according to settings
 */
export function formatDate(
  date: Date | string,
  dateFormat: DateFormat = 'DD/MM/YYYY',
  includeTime = false
): string {
  const d = typeof date === 'string' ? new Date(date) : date

  if (isNaN(d.getTime())) {
    return 'Invalid date'
  }

  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear()

  let formatted: string

  switch (dateFormat) {
    case 'MM/DD/YYYY':
      formatted = `${month}/${day}/${year}`
      break
    case 'DD/MM/YYYY':
      formatted = `${day}/${month}/${year}`
      break
    case 'DD.MM.YYYY':
      formatted = `${day}.${month}.${year}`
      break
    case 'YYYY-MM-DD':
      formatted = `${year}-${month}-${day}`
      break
    case 'DD-MM-YYYY':
      formatted = `${day}-${month}-${year}`
      break
    default:
      formatted = `${day}/${month}/${year}`
  }

  if (includeTime) {
    const hours = d.getHours().toString().padStart(2, '0')
    const minutes = d.getMinutes().toString().padStart(2, '0')
    formatted += ` ${hours}:${minutes}`
  }

  return formatted
}

/**
 * Format date relative to now (e.g., "2 days ago", "in 3 hours")
 */
export function formatRelativeDate(date: Date | string, language: LanguageCode = 'en-GB'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  const rtf = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })

  if (Math.abs(diffDays) < 1) {
    const diffHours = Math.round(diffMs / (1000 * 60 * 60))
    if (Math.abs(diffHours) < 1) {
      const diffMinutes = Math.round(diffMs / (1000 * 60))
      return rtf.format(diffMinutes, 'minute')
    }
    return rtf.format(diffHours, 'hour')
  }

  if (Math.abs(diffDays) < 30) {
    return rtf.format(diffDays, 'day')
  }

  if (Math.abs(diffDays) < 365) {
    return rtf.format(Math.round(diffDays / 30), 'month')
  }

  return rtf.format(Math.round(diffDays / 365), 'year')
}

/**
 * Format number according to locale
 */
export function formatNumber(
  value: number,
  language: LanguageCode = 'en-GB',
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(language, options).format(value)
}

/**
 * Format percentage
 */
export function formatPercentage(
  value: number,
  language: LanguageCode = 'en-GB',
  decimals = 1
): string {
  return new Intl.NumberFormat(language, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100)
}

/**
 * Convert date to specified timezone
 */
export function toTimezone(date: Date | string, timezone: TimezoneCode): Date {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Date(d.toLocaleString('en-US', { timeZone: timezone }))
}

/**
 * Get current time in specified timezone
 */
export function getCurrentTimeInTimezone(timezone: TimezoneCode): string {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * Detect user's locale settings from browser
 */
export function detectUserLocale(): Partial<LocalizationSettings> {
  const browserLanguage = navigator.language as LanguageCode
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone as TimezoneCode

  // Detect currency based on language/region
  let currency: CurrencyCode = 'USD'
  if (browserLanguage.startsWith('en-GB')) currency = 'GBP'
  else if (browserLanguage.startsWith('en-AU')) currency = 'AUD'
  else if (browserLanguage.startsWith('en-NZ')) currency = 'NZD'
  else if (browserLanguage.startsWith('en-SG')) currency = 'SGD'
  else if (browserLanguage.startsWith('en-IN')) currency = 'INR'
  else if (browserLanguage.startsWith('en-ZA')) currency = 'ZAR'
  else if (browserLanguage.startsWith('de')) currency = 'EUR'
  else if (browserLanguage.startsWith('fr')) currency = 'EUR'
  else if (browserLanguage.startsWith('es')) currency = 'EUR'
  else if (browserLanguage.startsWith('it')) currency = 'EUR'
  else if (browserLanguage.startsWith('nl')) currency = 'EUR'
  else if (browserLanguage.startsWith('pl')) currency = 'PLN'
  else if (browserLanguage.startsWith('sv')) currency = 'SEK'
  else if (browserLanguage.startsWith('da')) currency = 'DKK'
  else if (browserLanguage.startsWith('no') || browserLanguage.startsWith('nb')) currency = 'NOK'
  else if (browserLanguage.startsWith('ja')) currency = 'JPY'
  else if (browserLanguage.startsWith('ko')) currency = 'KRW'
  else if (browserLanguage.startsWith('zh')) currency = 'CNY'
  else if (browserLanguage.startsWith('pt-BR')) currency = 'BRL'
  else if (browserLanguage.startsWith('pt')) currency = 'EUR'
  else if (browserLanguage.startsWith('ar')) currency = 'AED'
  else if (browserLanguage.startsWith('he')) currency = 'ILS'
  else if (browserLanguage.startsWith('th')) currency = 'THB'
  else if (browserLanguage.startsWith('vi')) currency = 'VND'
  else if (browserLanguage.startsWith('id')) currency = 'IDR'
  else if (browserLanguage.startsWith('ms')) currency = 'MYR'
  else if (browserLanguage.startsWith('tr')) currency = 'TRY'
  else if (browserLanguage.startsWith('ro')) currency = 'RON'
  else if (browserLanguage.startsWith('hu')) currency = 'HUF'
  else if (browserLanguage.startsWith('cs')) currency = 'CZK'

  // Detect date format based on region
  let dateFormat: DateFormat = 'DD/MM/YYYY'
  if (browserLanguage === 'en-US') dateFormat = 'MM/DD/YYYY'
  else if (browserLanguage.startsWith('de')) dateFormat = 'DD.MM.YYYY'
  else if (browserLanguage.startsWith('sv') || browserLanguage.startsWith('ja')) dateFormat = 'YYYY-MM-DD'

  return {
    language: LANGUAGES[browserLanguage] ? browserLanguage : 'en-GB',
    timezone: TIMEZONES[browserTimezone] ? browserTimezone : 'Europe/London',
    currency,
    dateFormat,
  }
}
