import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../store'
import toast from 'react-hot-toast'
import api, { changePassword as changePasswordApi } from '../api'
import {
  UserCircleIcon,
  BellIcon,
  ShieldCheckIcon,
  PaintBrushIcon,
  KeyIcon,
  GlobeAltIcon,
  CurrencyDollarIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import {
  CURRENCIES,
  TIMEZONES,
  DATE_FORMATS,
  LANGUAGES,
  type CurrencyCode,
  type TimezoneCode,
  type DateFormat,
  type LanguageCode,
} from '../utils/localization'

interface BackendCurrency {
  code: string
  name: string
  symbol: string
}

function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const handleChangePassword = useCallback(async () => {
    if (!currentPassword || !newPassword) {
      toast.error('Please fill in all fields')
      return
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    setChangingPassword(true)
    try {
      await changePasswordApi(currentPassword, newPassword)
      toast.success('Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update password')
    } finally {
      setChangingPassword(false)
    }
  }, [currentPassword, newPassword, confirmPassword])

  return (
    <div>
      <h3 className="card-header">Security Settings</h3>
      <div className="space-y-6">
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <KeyIcon className="w-5 h-5 text-gray-600" />
            <h4 className="font-medium text-gray-900">Change Password</h4>
          </div>
          <div className="space-y-3">
            <div>
              <label className="label">Current Password</label>
              <input
                type="password"
                className="input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
            <div>
              <label className="label">New Password</label>
              <input
                type="password"
                className="input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input
                type="password"
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
              />
            </div>
            <button
              className="btn-secondary"
              onClick={handleChangePassword}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            >
              {changingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Two-Factor Authentication</h4>
              <p className="text-sm text-gray-500">Add an extra layer of security</p>
            </div>
            <button className="btn-primary">Enable 2FA</button>
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">Active Sessions</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">Current Session</p>
                <p className="text-xs text-gray-500">Active now</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FinancialsTab() {
  const [financials, setFinancials] = useState({
    annual_revenue: 0,
    annual_profit: 0,
    equity_pool_total: 0,
    equity_pool_remaining: 0,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/organization/financials')
      .then(res => {
        setFinancials(res.data)
      })
      .catch(() => toast.error('Failed to load financial settings'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put('/organization/financials', financials)
      toast.success('Financial settings updated')
    } catch {
      toast.error('Failed to update financial settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center animate-pulse text-gray-400">Loading financials...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="card-header">Organization Financials</h3>
        <p className="text-sm text-gray-500 mb-6">
          Set company-wide financial targets and equity pools for compensation planning
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
          <label className="label">Annual Revenue Target</label>
          <input
            type="number"
            className="input mt-1"
            value={financials.annual_revenue}
            onChange={e => setFinancials({ ...financials, annual_revenue: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
          <label className="label">Annual Profit Target</label>
          <input
            type="number"
            className="input mt-1"
            value={financials.annual_profit}
            onChange={e => setFinancials({ ...financials, annual_profit: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="p-6 border-2 border-indigo-50 bg-indigo-50/20 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <SparklesIcon className="w-5 h-5 text-indigo-600" />
          <h4 className="font-bold text-indigo-900">Equity Pool Management</h4>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="label">Total Equity Pool Value</label>
            <p className="text-xs text-gray-500 mb-2">Total monetary value of the approved equity pool</p>
            <input
              type="number"
              className="input"
              value={financials.equity_pool_total}
              onChange={e => setFinancials({ ...financials, equity_pool_total: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="label">Remaining Equity Pool</label>
            <p className="text-xs text-gray-500 mb-2">Currently available for new grants and refreshes</p>
            <input
              type="number"
              className="input"
              value={financials.equity_pool_remaining}
              onChange={e => setFinancials({ ...financials, equity_pool_remaining: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-indigo-100 flex items-center justify-between">
          <div className="text-sm text-indigo-700">
            Utilization: <span className="font-bold">
              {financials.equity_pool_total > 0 
                ? (((financials.equity_pool_total - financials.equity_pool_remaining) / financials.equity_pool_total) * 100).toFixed(1) 
                : 0}%
            </span>
          </div>
          <p className="text-xs text-indigo-500 italic">Values are used in Compensation Planning module</p>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="btn-primary"
        >
          {saving ? 'Saving...' : 'Save Financial Settings'}
        </button>
      </div>
    </div>
  )
}

function LocalizationTab({
  localization,
  setLocalization,
  handleSave,
}: {
  localization: { currency: CurrencyCode; timezone: TimezoneCode; dateFormat: DateFormat; language: LanguageCode }
  setLocalization: (settings: Partial<{ currency: CurrencyCode; timezone: TimezoneCode; dateFormat: DateFormat; language: LanguageCode }>) => void
  handleSave: () => void
}) {
  const [backendCurrencies, setBackendCurrencies] = useState<BackendCurrency[]>([])
  const [reportingCurrency, setReportingCurrency] = useState<string>('USD')
  const [loadingOrgSettings, setLoadingOrgSettings] = useState(true)

  useEffect(() => {
    // Fetch available currencies from backend
    api.get('/currencies').then((res) => {
      setBackendCurrencies(res.data?.currencies || [])
    }).catch(() => {
      // Fallback: empty list, user still has frontend currencies
    })
    // Fetch org settings for reporting currency
    api.get('/organization/settings').then((res) => {
      setReportingCurrency(res.data?.display_currency || res.data?.currency || 'USD')
    }).catch(() => {
      // Ignore — org settings not available
    }).finally(() => setLoadingOrgSettings(false))
  }, [])

  const handleReportingCurrencyChange = async (code: string) => {
    setReportingCurrency(code)
    try {
      await api.put('/organization/settings', { display_currency: code })
      toast.success('Reporting currency updated')
    } catch {
      toast.error('Failed to update reporting currency')
    }
  }

  // Build currency options: EUR, USD, GBP first, then rest alphabetically
  const priorityCodes = ['EUR', 'USD', 'GBP']
  const sortedBackendCurrencies = [
    ...backendCurrencies.filter((c) => priorityCodes.includes(c.code)),
    ...backendCurrencies
      .filter((c) => !priorityCodes.includes(c.code))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ]

  return (
    <div>
      <h3 className="card-header">Localization Settings</h3>
      <p className="text-sm text-gray-500 mb-6">
        Configure regional settings for dates, currencies, and language preferences
      </p>
      <div className="space-y-6">
        {/* Reporting Currency (org-level, from backend) */}
        <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-lg">
          <label className="label flex items-center gap-2">
            <span>Reporting Currency</span>
            <span className="text-xs font-normal text-gray-400">(company-wide)</span>
          </label>
          <p className="text-xs text-gray-500 mb-2">
            The currency used for financial reports, dashboards, and company-level metrics
          </p>
          {loadingOrgSettings ? (
            <div className="animate-pulse bg-gray-200 rounded h-10 w-full" />
          ) : (
            <select
              className="input"
              value={reportingCurrency}
              onChange={(e) => handleReportingCurrencyChange(e.target.value)}
            >
              {sortedBackendCurrencies.length > 0
                ? sortedBackendCurrencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.symbol} - {c.name} ({c.code})
                    </option>
                  ))
                : Object.entries(CURRENCIES).map(([code, currency]) => (
                    <option key={code} value={code}>
                      {currency.symbol} - {currency.name} ({code})
                    </option>
                  ))}
            </select>
          )}
        </div>

        <div>
          <label className="label">Timezone</label>
          <select
            className="input"
            value={localization.timezone}
            onChange={(e) => setLocalization({ timezone: e.target.value as TimezoneCode })}
          >
            <optgroup label="Europe">
              {Object.entries(TIMEZONES)
                .filter(([, tz]) => tz.region === 'Europe')
                .map(([code, tz]) => (
                  <option key={code} value={code}>{tz.name}</option>
                ))}
            </optgroup>
            <optgroup label="Americas">
              {Object.entries(TIMEZONES)
                .filter(([, tz]) => tz.region === 'Americas')
                .map(([code, tz]) => (
                  <option key={code} value={code}>{tz.name}</option>
                ))}
            </optgroup>
            <optgroup label="Universal">
              {Object.entries(TIMEZONES)
                .filter(([, tz]) => tz.region === 'Universal')
                .map(([code, tz]) => (
                  <option key={code} value={code}>{tz.name}</option>
                ))}
            </optgroup>
          </select>
        </div>

        <div>
          <label className="label">Date Format</label>
          <select
            className="input"
            value={localization.dateFormat}
            onChange={(e) => setLocalization({ dateFormat: e.target.value as DateFormat })}
          >
            {Object.entries(DATE_FORMATS).map(([code, format]) => (
              <option key={code} value={code}>
                {format.name} - Example: {format.example}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Display Currency</label>
          <p className="text-xs text-gray-500 mb-1">
            Your personal preference for how currency values are formatted
          </p>
          <select
            className="input"
            value={localization.currency}
            onChange={(e) => setLocalization({ currency: e.target.value as CurrencyCode })}
          >
            {Object.entries(CURRENCIES).map(([code, currency]) => (
              <option key={code} value={code}>
                {currency.symbol} - {currency.name} ({code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Language</label>
          <select
            className="input"
            value={localization.language}
            onChange={(e) => setLocalization({ language: e.target.value as LanguageCode })}
          >
            {Object.entries(LANGUAGES).map(([code, lang]) => (
              <option key={code} value={code}>
                {lang.name} ({lang.nativeName})
              </option>
            ))}
          </select>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Preview</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Date:</span>
              <span className="ml-2 font-medium">
                {new Date().toLocaleDateString(LANGUAGES[localization.language]?.name === 'English (US)' ? 'en-US' : 'en-GB')}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Currency:</span>
              <span className="ml-2 font-medium">
                {new Intl.NumberFormat(CURRENCIES[localization.currency].locale, {
                  style: 'currency',
                  currency: localization.currency,
                }).format(75000)}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <button onClick={handleSave} className="btn-primary">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}

type TabId = 'profile' | 'notifications' | 'security' | 'appearance' | 'localization' | 'financials'

const tabs: { id: TabId; name: string; icon: any }[] = [
  { id: 'profile', name: 'Profile', icon: UserCircleIcon },
  { id: 'notifications', name: 'Notifications', icon: BellIcon },
  { id: 'security', name: 'Security', icon: ShieldCheckIcon },
  { id: 'appearance', name: 'Appearance', icon: PaintBrushIcon },
  { id: 'localization', name: 'Localization', icon: GlobeAltIcon },
  { id: 'financials', name: 'Financials', icon: CurrencyDollarIcon },
]

export default function Settings() {
  const { darkMode, toggleDarkMode, user, localization, setLocalization, setUser } = useStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as TabId) || 'localization'
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)

  useEffect(() => {
    const tab = searchParams.get('tab') as TabId
    if (tab && tabs.find(t => t.id === tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId)
    setSearchParams({ tab: tabId })
  }
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [dashboardLayout, setDashboardLayout] = useState<'compact' | 'comfortable'>('compact')
  const [profile, setProfile] = useState({
    name: user?.name || 'User',
    email: user?.email || 'user@company.com',
    role: user?.role || 'Viewer',
    department: user?.department || 'N/A',
  })

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return }
    const reader = new FileReader()
    reader.onload = () => {
      if (user) setUser({ ...user, avatar: reader.result as string })
      toast.success('Avatar updated')
    }
    reader.readAsDataURL(file)
  }
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    weeklyDigest: true,
    attritionAlerts: true,
    recruitmentUpdates: false,
    systemAnnouncements: true,
  })

  const handleSave = () => {
    toast.success('Settings saved successfully')
  }

  return (
    <div className="w-full">
      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                )}
              >
                <tab.icon className="w-5 h-5" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 card">
          {activeTab === 'profile' && (
            <div>
              <h3 className="card-header">Profile Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700" />
                  ) : (
                    <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-primary-700 dark:text-primary-300">
                        {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                      </span>
                    </div>
                  )}
                  <div>
                    <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    <button className="btn-secondary text-sm" onClick={() => avatarInputRef.current?.click()}>
                      Change Avatar
                    </button>
                    <p className="text-xs text-gray-500 mt-1">JPG, PNG or GIF. Max 2MB.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Full Name</label>
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Role</label>
                    <input
                      type="text"
                      value={profile.role}
                      onChange={(e) => setProfile({ ...profile, role: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Department</label>
                    <input
                      type="text"
                      value={profile.department}
                      onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <button onClick={handleSave} className="btn-primary">
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div>
              <h3 className="card-header">Notification Preferences</h3>
              <div className="space-y-4">
                {Object.entries(notifications).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </p>
                      <p className="text-sm text-gray-500">
                        {key === 'emailAlerts' && 'Receive important alerts via email'}
                        {key === 'weeklyDigest' && 'Weekly summary of key metrics'}
                        {key === 'attritionAlerts' && 'Alerts when employees are flagged high risk'}
                        {key === 'recruitmentUpdates' && 'Updates on recruitment pipeline changes'}
                        {key === 'systemAnnouncements' && 'Platform updates and maintenance notices'}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setNotifications({ ...notifications, [key]: !value })
                      }
                      className={clsx(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                        value ? 'bg-primary-600' : 'bg-gray-300'
                      )}
                    >
                      <span
                        className={clsx(
                          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                          value ? 'translate-x-6' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>
                ))}

                <div className="pt-4">
                  <button onClick={handleSave} className="btn-primary">
                    Save Preferences
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <SecurityTab />
          )}

          {activeTab === 'appearance' && (
            <div>
              <h3 className="card-header">Appearance</h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Dark Mode</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Switch to dark theme</p>
                  </div>
                  <button
                    onClick={toggleDarkMode}
                    className={clsx(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                      darkMode ? 'bg-primary-600' : 'bg-gray-300'
                    )}
                  >
                    <span className={clsx('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', darkMode ? 'translate-x-6' : 'translate-x-1')} />
                  </button>
                </div>

                <div>
                  <label className="label">Dashboard Density</label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Controls spacing and card padding across dashboards</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(['compact', 'comfortable'] as const).map(layout => (
                      <button
                        key={layout}
                        onClick={() => setDashboardLayout(layout)}
                        className={clsx(
                          'p-4 border-2 rounded-lg text-center transition-all',
                          dashboardLayout === layout
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        )}
                      >
                        <div className={clsx(
                          'w-full rounded mb-2 bg-gray-200 dark:bg-gray-600',
                          layout === 'compact' ? 'h-8' : 'h-12'
                        )} />
                        <span className={clsx('text-sm font-medium capitalize', dashboardLayout === layout ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300')}>
                          {layout}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'localization' && (
            <LocalizationTab
              localization={localization}
              setLocalization={setLocalization}
              handleSave={handleSave}
            />
          )}

          {activeTab === 'financials' && (
            <FinancialsTab />
          )}
        </div>
      </div>
    </div>
  )
}
