import { useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useNavAnimation } from '../hooks/useNavAnimation'
import NavAnimation from './NavAnimation'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import {
  CalendarIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  TableCellsIcon,
  DocumentArrowDownIcon,
  ChevronDownIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline'
import { useStore } from '../store'
import { useGlobalFilters } from '../hooks/useGlobalFilters'
import FilterModal from './FilterModal'
import { exportEmployeesToPdf, exportDashboardToPdf, exportCandidatesToPdf } from '../utils/exportPdf'
import { DATE_PRESETS, getDateRange, getPresetLabel } from '../utils/datePresets'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

export default function Header() {
  const location = useLocation()
  const isAnimating = useNavAnimation()
  const { currentFilter, employees, candidates, localization, setFilter, darkMode, toggleDarkMode, user } = useStore()
  const { hasActiveFilters, activeFilterCount } = useGlobalFilters()
  const [showFilterModal, setShowFilterModal] = useState(false)

  const selectedPreset = currentFilter.datePreset || 'all_time'
  const isCustom = selectedPreset === 'custom'

  const handlePresetChange = (preset: string) => {
    if (preset === 'custom') {
      setFilter({
        datePreset: 'custom',
        dateRange: {
          start: currentFilter.dateRange.start || new Date().toISOString().split('T')[0],
          end: currentFilter.dateRange.end || new Date().toISOString().split('T')[0],
        },
      })
    } else {
      const range = getDateRange(preset)
      setFilter({
        datePreset: preset,
        dateRange: {
          start: range.start || '',
          end: range.end || '',
        },
      })
    }
  }

  // Export functions
  const handleExportCSV = () => {
    let data: Record<string, unknown>[] = []
    let filename = 'export'

    if (location.pathname === '/app/recruitment' && candidates.length > 0) {
      data = candidates.map(c => ({
        Name: `${c.firstName} ${c.lastName}`,
        Email: c.email,
        Position: c.appliedPosition,
        Department: c.department,
        Source: c.source,
        Status: c.status,
        ApplicationDate: c.applicationDate,
        Recruiter: c.recruiter || 'Unassigned',
      }))
      filename = 'candidates'
    } else if (employees.length > 0) {
      data = employees.map(e => ({
        EmployeeID: e.employeeId,
        Name: `${e.firstName} ${e.lastName}`,
        Email: e.email,
        Department: e.department,
        JobTitle: e.jobTitle,
        Status: e.status,
        HireDate: e.hireDate,
        Salary: e.salary,
        Location: e.location,
      }))
      filename = 'employees'
    }

    if (data.length === 0) {
      toast.error('No data to export')
      return
    }

    const csv = Papa.unparse(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported successfully')
  }

  const handleExportExcel = () => {
    let data: Record<string, unknown>[] = []
    let filename = 'export'

    if (location.pathname === '/app/recruitment' && candidates.length > 0) {
      data = candidates.map(c => ({
        Name: `${c.firstName} ${c.lastName}`,
        Email: c.email,
        Position: c.appliedPosition,
        Department: c.department,
        Source: c.source,
        Status: c.status,
        'Application Date': c.applicationDate,
        Recruiter: c.recruiter || 'Unassigned',
      }))
      filename = 'candidates'
    } else if (employees.length > 0) {
      data = employees.map(e => ({
        'Employee ID': e.employeeId,
        Name: `${e.firstName} ${e.lastName}`,
        Email: e.email,
        Department: e.department,
        'Job Title': e.jobTitle,
        Status: e.status,
        'Hire Date': e.hireDate,
        Salary: e.salary,
        Location: e.location,
      }))
      filename = 'employees'
    }

    if (data.length === 0) {
      toast.error('No data to export')
      return
    }

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data')
    XLSX.writeFile(wb, `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success('Excel file exported successfully')
  }

  const handleExportPDF = () => {
    const options = {
      currency: localization.currency,
      dateFormat: localization.dateFormat,
      companyName: 'Interface',
    }

    if (location.pathname === '/app/recruitment' && candidates.length > 0) {
      exportCandidatesToPdf(candidates, { ...options, title: 'Recruitment Pipeline Report' })
      toast.success('PDF exported successfully')
    } else if (location.pathname === '/app/dashboard') {
      // Export dashboard metrics
      exportDashboardToPdf(
        {
          hr: {
            totalHeadcount: employees.length,
            activeEmployees: employees.filter(e => e.status === 'active').length,
            newHires: 0,
            avgTenure: 0,
            avgSalary: 0,
            engagementScore: 0,
          },
          retention: {
            voluntaryTurnover: 0,
            involuntaryTurnover: 0,
            retentionRate: 0,
            firstYearTurnover: 0,
          },
          recruitment: {
            openPositions: 0,
            timeToHire: 0,
            costPerHire: 0,
            offerAcceptanceRate: 0,
            qualityOfHire: 0,
          },
        },
        { ...options, title: 'Executive Dashboard Report' }
      )
      toast.success('PDF exported successfully')
    } else if (employees.length > 0) {
      exportEmployeesToPdf(employees, { ...options, title: 'Employee Report' })
      toast.success('PDF exported successfully')
    } else {
      toast.error('No data to export')
    }
  }

  return (
    <header className="h-11 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 sticky top-0 z-20 transition-all duration-300 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <NavAnimation isRunning={isAnimating} />
      </div>
      <div className="relative z-10 flex items-center gap-6">
        <div className="flex flex-col">
          <h2 className="text-lg font-bold text-white leading-tight capitalize tracking-tight">
            {(() => {
              const segment = location.pathname.split('/').pop() || 'overview'
              const overrides: Record<string, string> = {
                'command-center': 'Pulse',
                'ai': 'AI Assistant',
                'ml-models': 'ML Models',
                'workforce-planning': 'Workforce Planning',
                'strategic-planner': 'Full-Cycle Planner',
                'deep-dive': 'Deep Dive',
                'query-editor': 'SQL Editor',
                'api-docs': 'API Docs',
                'data': 'Data & Integrations',
              }
              return overrides[segment] ?? segment.replace(/-/g, ' ')
            })()}
          </h2>
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-2">
        {/* Date Range Preset */}
        <div className="flex items-center gap-1.5">
          <Menu as="div" className="relative">
            <MenuButton className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-200 hover:bg-slate-800 transition-colors">
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>{getPresetLabel(selectedPreset)}</span>
              <ChevronDownIcon className="w-3 h-3 text-slate-400" />
            </MenuButton>
            <MenuItems className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50 max-h-80 overflow-y-auto">
              {DATE_PRESETS.map((preset) => (
                <MenuItem key={preset.value}>
                  <button
                    onClick={() => handlePresetChange(preset.value)}
                    className={`w-full px-4 py-2 text-xs text-left transition-colors ${
                      selectedPreset === preset.value
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 data-[focus]:bg-gray-50 dark:data-[focus]:bg-gray-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                </MenuItem>
              ))}
            </MenuItems>
          </Menu>

          {isCustom && (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={currentFilter.dateRange.start}
                onChange={(e) =>
                  setFilter({
                    dateRange: { ...currentFilter.dateRange, start: e.target.value },
                  })
                }
                className="px-1.5 py-1 rounded-lg border border-slate-700 text-[10px] text-slate-200 bg-slate-800"
              />
              <input
                type="date"
                value={currentFilter.dateRange.end}
                onChange={(e) =>
                  setFilter({
                    dateRange: { ...currentFilter.dateRange, end: e.target.value },
                  })
                }
                className="px-1.5 py-1 rounded-lg border border-slate-700 text-[10px] text-slate-200 bg-slate-800"
              />
            </div>
          )}
        </div>

        {/* Filter */}
        <button
          onClick={() => setShowFilterModal(true)}
          className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <FunnelIcon className="w-3.5 h-3.5" />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="inline-flex items-center justify-center min-w-[1rem] h-4 px-1 rounded-full bg-primary-500 text-white text-[10px] font-medium">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Export */}
        <Menu as="div" className="relative">
          <MenuButton className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-200 hover:bg-slate-800 transition-colors">
            <ArrowDownTrayIcon className="w-3.5 h-3.5" />
            <span>Export</span>
          </MenuButton>
          <MenuItems className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
            <MenuItem>
              <button
                onClick={handleExportCSV}
                className="w-full px-4 py-2 text-xs text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 data-[focus]:bg-gray-50 dark:data-[focus]:bg-gray-700 flex items-center gap-2"
              >
                <TableCellsIcon className="w-3.5 h-3.5" />
                Export as CSV
              </button>
            </MenuItem>
            <MenuItem>
              <button
                onClick={handleExportExcel}
                className="w-full px-4 py-2 text-xs text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 data-[focus]:bg-gray-50 dark:data-[focus]:bg-gray-700 flex items-center gap-2"
              >
                <DocumentArrowDownIcon className="w-3.5 h-3.5" />
                Export as Excel
              </button>
            </MenuItem>
            <MenuItem>
              <button
                onClick={handleExportPDF}
                className="w-full px-4 py-2 text-xs text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 data-[focus]:bg-gray-50 dark:data-[focus]:bg-gray-700 flex items-center gap-2"
              >
                <DocumentTextIcon className="w-3.5 h-3.5" />
                Export as PDF
              </button>
            </MenuItem>
          </MenuItems>
        </Menu>

        <div className="h-6 w-px bg-blue-800 mx-1" />

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-1.5 text-slate-400 hover:text-white transition-colors"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? (
            <SunIcon className="w-4 h-4 text-yellow-500" />
          ) : (
            <MoonIcon className="w-4 h-4" />
          )}
        </button>

        {/* User Menu */}
        <Menu as="div" className="relative">
          <MenuButton className="flex items-center">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover border border-slate-700" />
            ) : (
              <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
                <span className="text-slate-200 font-medium text-[10px]">
                  {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                </span>
              </div>
            )}
          </MenuButton>
          <MenuItems className="absolute right-0 mt-2 w-52 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50">
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-900 dark:text-white">{user?.name || 'User'}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{user?.email || ''}</p>
            </div>
            <MenuItem>
              <Link
                to="/app/settings?tab=profile"
                className="block w-full px-4 py-2 text-xs text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 data-[focus]:bg-gray-50 dark:data-[focus]:bg-gray-700"
              >
                Your Profile
              </Link>
            </MenuItem>
            <MenuItem>
              <Link
                to="/app/settings"
                className="block w-full px-4 py-2 text-xs text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 data-[focus]:bg-gray-50 dark:data-[focus]:bg-gray-700"
              >
                Settings
              </Link>
            </MenuItem>
            <hr className="my-1 border-gray-100 dark:border-gray-700" />
            <MenuItem>
              <button
                onClick={() => {
                  useStore.getState().logout()
                  window.location.href = '/login'
                }}
                className="w-full px-4 py-2 text-xs text-left text-danger-600 hover:bg-danger-50 data-[focus]:bg-danger-50 dark:hover:bg-danger-900/20"
              >
                Sign out
              </button>
            </MenuItem>
          </MenuItems>
        </Menu>
      </div>

      {/* Modals */}
      {showFilterModal && (
        <FilterModal onClose={() => setShowFilterModal(false)} />
      )}
    </header>
  )
}
