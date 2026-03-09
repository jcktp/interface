import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts'
import toast from 'react-hot-toast'
import api from '../api'
import { getAttendancePolicy, updateAttendancePolicy } from '../api'
import { useGlobalFilters } from '../hooks/useGlobalFilters'
import { usePermissions } from '../hooks/usePermissions'
import { CHART_COLORS, formatChartLabel } from '../utils/chartColors'
import {
  BuildingOfficeIcon,
  HomeModernIcon,
  UserMinusIcon,
  CalendarDaysIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  UserGroupIcon,
  UserIcon,
  ShieldCheckIcon,
  SunIcon,
  GlobeAltIcon,
  Squares2X2Icon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import DataSourceSelector from '../components/DataSourceSelector'

// ── Types for the hierarchy drill-down ──────────────────────────────

interface HierarchyEmployee {
  id: string
  name: string
  job_title: string
  total: number
  present: number
  in_office: number
  remote: number
  absent: number
  leave: number
  attendance_rate: number
  office_rate: number
}

interface HierarchyManager {
  id: string
  name: string
  employees: HierarchyEmployee[]
  total: number
  present: number
  in_office: number
  remote: number
  absent: number
  leave: number
  employee_count: number
  attendance_rate: number
  office_rate: number
}

interface HierarchyTeam {
  name: string
  managers: HierarchyManager[]
  total: number
  present: number
  in_office: number
  remote: number
  absent: number
  leave: number
  employee_count: number
  attendance_rate: number
  office_rate: number
}

interface HierarchyDepartment {
  name: string
  teams: HierarchyTeam[]
  total: number
  present: number
  in_office: number
  remote: number
  absent: number
  leave: number
  employee_count: number
  attendance_rate: number
  office_rate: number
}

// ── Rate badge helper ───────────────────────────────────────────────

function RateBadge({ rate }: { rate: number }) {
  const color =
    rate >= 80
      ? 'bg-green-100 text-green-700'
      : rate >= 60
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-red-100 text-red-700'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {rate}%
    </span>
  )
}

// ── Shared stat cells ────────────────────────────────────────────────

function StatCells({ row, size = 'sm' }: { row: { total: number; in_office: number; remote: number; absent: number; leave: number; employee_count: number; attendance_rate: number; office_rate: number }, size?: 'sm' | 'xs' }) {
  const cls = `px-4 py-2.5 text-center text-${size} text-gray-500`
  return (
    <>
      <td className={cls}>{row.employee_count}</td>
      <td className={cls}>{row.total}</td>
      <td className={cls}>{row.in_office}</td>
      <td className={cls}>{row.remote}</td>
      <td className={cls}>{row.absent}</td>
      <td className={cls}>{row.leave}</td>
      <td className="px-4 py-2.5 text-center"><RateBadge rate={row.attendance_rate} /></td>
      <td className="px-4 py-2.5 text-center"><RateBadge rate={row.office_rate} /></td>
    </>
  )
}

// ── Drill-down table component ──────────────────────────────────────

function AttendanceHierarchyTable({ data, loading }: { data: HierarchyDepartment[]; loading: boolean }) {
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())
  const [expandedMgrs, setExpandedMgrs] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const toggle = (setFn: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    setFn(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  const collapseAll = () => { setExpandedDepts(new Set()); setExpandedTeams(new Set()); setExpandedMgrs(new Set()) }

  // When search is active, filter + auto-expand matching branches
  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data
    return data
      .map(dept => {
        const deptMatch = dept.name.toLowerCase().includes(q)
        const teams = dept.teams
          .map(team => {
            const teamMatch = team.name.toLowerCase().includes(q)
            const managers = team.managers
              .map(mgr => {
                const mgrMatch = mgr.name.toLowerCase().includes(q)
                const employees = mgr.employees.filter(e =>
                  e.name.toLowerCase().includes(q) || (e.job_title || '').toLowerCase().includes(q)
                )
                if (mgrMatch || employees.length) return { ...mgr, employees: mgrMatch ? mgr.employees : employees }
                return null
              })
              .filter(Boolean) as HierarchyManager[]
            if (teamMatch || managers.length) return { ...team, managers: teamMatch ? team.managers : managers }
            return null
          })
          .filter(Boolean) as HierarchyTeam[]
        if (deptMatch || teams.length) return { ...dept, teams: deptMatch ? dept.teams : teams }
        return null
      })
      .filter(Boolean) as HierarchyDepartment[]
  }, [data, search])

  // Auto-expand all when searching
  const autoExpanded = useMemo(() => {
    if (!search.trim()) return { depts: new Set<string>(), teams: new Set<string>(), mgrs: new Set<string>() }
    const depts = new Set<string>()
    const teams = new Set<string>()
    const mgrs = new Set<string>()
    filteredData.forEach(d => {
      depts.add(d.name)
      d.teams.forEach(t => {
        const tk = `${d.name}::${t.name}`
        teams.add(tk)
        t.managers.forEach(m => mgrs.add(`${tk}::${m.id}`))
      })
    })
    return { depts, teams, mgrs }
  }, [filteredData, search])

  const effDepts = search ? autoExpanded.depts : expandedDepts
  const effTeams = search ? autoExpanded.teams : expandedTeams
  const effMgrs = search ? autoExpanded.mgrs : expandedMgrs

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200"><div className="animate-pulse h-4 w-48 bg-gray-200 rounded" /></div>
        <div className="p-6 space-y-3">{[1,2,3,4].map(i => <div key={i} className="animate-pulse h-10 bg-gray-100 rounded" />)}</div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-sm font-semibold text-gray-900">Attendance Drill-Down</h3></div>
        <div className="flex items-center justify-center py-12 text-sm text-gray-400">No attendance hierarchy data available</div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Attendance Drill-Down</h3>
          <p className="text-xs text-gray-500 mt-0.5">Department &rarr; Team &rarr; Manager &rarr; Employee</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, team, dept…"
              className="pl-8 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-300 w-52"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {!search && (
            <button onClick={collapseAll} className="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
              Collapse All
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-[320px]">Name</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Employees</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Records</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">In Office</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Remote</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Absent</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Leave</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Attendance %</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Office %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredData.map(dept => (
              <DepartmentRows
                key={dept.name}
                dept={dept}
                isExpanded={effDepts.has(dept.name)}
                expandedTeams={effTeams}
                expandedMgrs={effMgrs}
                onToggleDept={() => toggle(setExpandedDepts, dept.name)}
                onToggleTeam={(tk) => toggle(setExpandedTeams, tk)}
                onToggleMgr={(mk) => toggle(setExpandedMgrs, mk)}
              />
            ))}
            {filteredData.length === 0 && search && (
              <tr><td colSpan={9} className="py-10 text-center text-sm text-gray-400">No results for "{search}"</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Department row + children ───────────────────────────────────────

function DepartmentRows({
  dept, isExpanded, expandedTeams, expandedMgrs, onToggleDept, onToggleTeam, onToggleMgr,
}: {
  dept: HierarchyDepartment; isExpanded: boolean; expandedTeams: Set<string>; expandedMgrs: Set<string>
  onToggleDept: () => void; onToggleTeam: (tk: string) => void; onToggleMgr: (mk: string) => void
}) {
  return (
    <>
      <tr onClick={onToggleDept} className="cursor-pointer hover:bg-slate-50 bg-white transition-colors">
        <td className="px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">{isExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}</span>
            <BuildingOfficeIcon className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-gray-900">{dept.name}</span>
          </div>
        </td>
        <StatCells row={dept} />
      </tr>
      {isExpanded && dept.teams.map(team => {
        const tk = `${dept.name}::${team.name}`
        return (
          <TeamRows
            key={tk}
            team={team}
            teamKey={tk}
            isExpanded={expandedTeams.has(tk)}
            expandedMgrs={expandedMgrs}
            onToggle={() => onToggleTeam(tk)}
            onToggleMgr={onToggleMgr}
          />
        )
      })}
    </>
  )
}

// ── Team row + children ─────────────────────────────────────────────

function TeamRows({ team, teamKey, isExpanded, expandedMgrs, onToggle, onToggleMgr }: {
  team: HierarchyTeam; teamKey: string; isExpanded: boolean; expandedMgrs: Set<string>
  onToggle: () => void; onToggleMgr: (mk: string) => void
}) {
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer hover:bg-indigo-50/30 bg-gray-50/40 transition-colors">
        <td className="px-6 py-2.5 pl-10">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">{isExpanded ? <ChevronDownIcon className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}</span>
            <Squares2X2Icon className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-medium text-gray-700">{team.name}</span>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 rounded-full">{team.employee_count}</span>
          </div>
        </td>
        <StatCells row={team} />
      </tr>
      {isExpanded && team.managers.map(mgr => {
        const mk = `${teamKey}::${mgr.id}`
        return (
          <ManagerRows key={mk} mgr={mgr} mgrKey={mk} isExpanded={expandedMgrs.has(mk)} onToggle={() => onToggleMgr(mk)} />
        )
      })}
    </>
  )
}

// ── Manager row + children ──────────────────────────────────────────

function ManagerRows({ mgr, mgrKey: _mgrKey, isExpanded, onToggle }: {
  mgr: HierarchyManager; mgrKey: string; isExpanded: boolean; onToggle: () => void
}) {
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer hover:bg-blue-50/40 bg-gray-50/20 transition-colors">
        <td className="px-6 py-2.5 pl-16">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">{isExpanded ? <ChevronDownIcon className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}</span>
            <UserGroupIcon className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-gray-700">{mgr.name}</span>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 rounded-full">{mgr.employee_count}</span>
          </div>
        </td>
        <StatCells row={mgr} />
      </tr>
      {isExpanded && mgr.employees.map(emp => (
        <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
          <td className="px-6 py-2 pl-24">
            <div className="flex items-center gap-2">
              <UserIcon className="h-3.5 w-3.5 text-gray-400" />
              <div>
                <div className="text-xs font-medium text-gray-700">{emp.name}</div>
                {emp.job_title && <div className="text-[10px] text-gray-400">{emp.job_title}</div>}
              </div>
            </div>
          </td>
          <td className="px-4 py-2 text-center text-xs text-gray-400">—</td>
          <td className="px-4 py-2 text-center text-xs text-gray-500">{emp.total}</td>
          <td className="px-4 py-2 text-center text-xs text-gray-500">{emp.in_office}</td>
          <td className="px-4 py-2 text-center text-xs text-gray-500">{emp.remote}</td>
          <td className="px-4 py-2 text-center text-xs text-gray-500">{emp.absent}</td>
          <td className="px-4 py-2 text-center text-xs text-gray-500">{emp.leave}</td>
          <td className="px-4 py-2 text-center"><RateBadge rate={emp.attendance_rate} /></td>
          <td className="px-4 py-2 text-center"><RateBadge rate={emp.office_rate} /></td>
        </tr>
      ))}
    </>
  )
}

// ── Compliance color helper ──────────────────────────────────────────

function complianceColor(value: number, thresholdGreen = 90, thresholdAmber = 70) {
  if (value >= thresholdGreen) return 'text-green-600'
  if (value >= thresholdAmber) return 'text-amber-600'
  return 'text-red-600'
}

function complianceBg(value: number, thresholdGreen = 90, thresholdAmber = 70) {
  if (value >= thresholdGreen) return 'bg-green-100'
  if (value >= thresholdAmber) return 'bg-amber-100'
  return 'bg-red-100'
}

function ptoColor(value: number) {
  if (value >= 15) return 'text-green-600'
  if (value >= 8) return 'text-amber-600'
  return 'text-red-600'
}

function ptoBg(value: number) {
  if (value >= 15) return 'bg-green-100'
  if (value >= 8) return 'bg-amber-100'
  return 'bg-red-100'
}

// ── Workplace Policy Section ─────────────────────────────────────────

function WorkplacePolicySection() {
  const queryClient = useQueryClient()
  const { filterObj } = useGlobalFilters()

  const { data: policyData, isLoading: policyLoading } = useQuery({
    queryKey: ['attendance-policy'],
    queryFn: () => getAttendancePolicy().then(r => r.data),
    staleTime: 30000,
  })

  const { data: complianceData, isLoading: complianceLoading } = useQuery({
    queryKey: ['attendance-compliance-metrics', filterObj],
    queryFn: () => api.get('/attendance/compliance', { params: filterObj }).then(r => r.data),
    staleTime: 30000,
  })

  const [localPolicy, setLocalPolicy] = useState({
    expected_office_days_per_week: 3,
    max_remote_days_per_week: 2,
  })
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (policyData) {
      setLocalPolicy({
        expected_office_days_per_week: policyData.expected_office_days_per_week ?? 3,
        max_remote_days_per_week: policyData.max_remote_days_per_week ?? 2,
      })
      setDirty(false)
    }
  }, [policyData])

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateAttendancePolicy(data),
    onSuccess: () => {
      toast.success('Workplace policy updated')
      queryClient.invalidateQueries({ queryKey: ['attendance-policy'] })
      queryClient.invalidateQueries({ queryKey: ['attendance-compliance-metrics'] })
      setDirty(false)
    },
    onError: () => {
      toast.error('Failed to update policy')
    },
  })

  const handleSave = () => {
    saveMutation.mutate(localPolicy)
  }

  const metrics = complianceData?.policy_metrics

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Global Workplace Policy</h2>
        {filterObj.locations && filterObj.locations.length > 0 && (
          <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md border border-indigo-100 flex items-center gap-1.5">
            <GlobeAltIcon className="h-3 w-3" />
            Filtered to: {filterObj.locations}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Policy Configuration Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Mandatory Attendance Settings</h3>
          </div>
          {policyLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="animate-pulse h-8 bg-gray-100 rounded" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-600">Expected Office Days / Week</label>
                <select
                  value={localPolicy.expected_office_days_per_week}
                  onChange={e => {
                    setLocalPolicy(p => ({ ...p, expected_office_days_per_week: parseInt(e.target.value) }))
                    setDirty(true)
                  }}
                  className="w-32 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {[0, 1, 2, 3, 4, 5].map(d => (
                    <option key={d} value={d}>{d} days</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-600">Max Remote Days / Week</label>
                <select
                  value={localPolicy.max_remote_days_per_week}
                  onChange={e => {
                    setLocalPolicy(p => ({ ...p, max_remote_days_per_week: parseInt(e.target.value) }))
                    setDirty(true)
                  }}
                  className="w-32 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {[0, 1, 2, 3, 4, 5].map(d => (
                    <option key={d} value={d}>{d} days</option>
                  ))}
                </select>
              </div>
              
              <div className="pt-2">
                <p className="text-[10px] text-gray-400 mb-3 uppercase font-semibold">
                  * Compliance is calculated automatically deducting bank holidays and weekends.
                </p>
                <button
                  onClick={handleSave}
                  disabled={!dirty || saveMutation.isPending}
                  className="w-full px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {saveMutation.isPending ? 'Saving...' : 'Update Global Policy'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Compliance Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Compliance Rate</p>
                {complianceLoading ? (
                  <div className="animate-pulse h-7 w-16 bg-gray-100 rounded mt-1" />
                ) : (
                  <p className={`text-xl font-bold mt-0.5 ${complianceColor(metrics?.office_compliance_pct ?? 0)}`}>
                    {metrics?.office_compliance_pct ?? 0}%
                  </p>
                )}
                <p className="text-[10px] text-gray-400 mt-1">Target: {localPolicy.expected_office_days_per_week} days/wk</p>
              </div>
              <div className={`p-2 rounded-lg ${complianceBg(metrics?.office_compliance_pct ?? 0)}`}>
                <ShieldCheckIcon className="h-5 w-5 text-current" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Time Off Usage</p>
                {complianceLoading ? (
                  <div className="animate-pulse h-7 w-16 bg-gray-100 rounded mt-1" />
                ) : (
                  <p className={`text-xl font-bold mt-0.5 ${ptoColor(metrics?.pto_usage_pct ?? 0)}`}>
                    {metrics?.pto_usage_pct ?? 0}%
                  </p>
                )}
                <p className="text-[10px] text-gray-400 mt-1">Target: &gt; 15% YTD</p>
              </div>
              <div className={`p-2 rounded-lg ${ptoBg(metrics?.pto_usage_pct ?? 0)}`}>
                <SunIcon className="h-5 w-5 text-current" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Avg Office Days</p>
                {complianceLoading ? (
                  <div className="animate-pulse h-7 w-16 bg-gray-100 rounded mt-1" />
                ) : (
                  <p className="text-xl font-bold text-gray-900 mt-0.5">
                    {metrics?.avg_office_days_per_week ?? '-'}
                  </p>
                )}
                <p className="text-[10px] text-gray-400 mt-1">Per week per employee</p>
              </div>
              <div className="bg-blue-100 p-2 rounded-lg">
                <BuildingOfficeIcon className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Avg Remote Days</p>
                {complianceLoading ? (
                  <div className="animate-pulse h-7 w-16 bg-gray-100 rounded mt-1" />
                ) : (
                  <p className="text-xl font-bold text-gray-900 mt-0.5">
                    {metrics?.avg_remote_days_per_week ?? '-'}
                  </p>
                )}
                <p className="text-[10px] text-gray-400 mt-1">Per week per employee</p>
              </div>
              <div className="bg-purple-100 p-2 rounded-lg">
                <GlobeAltIcon className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page component ─────────────────────────────────────────────

export default function AttendanceMonitoring() {
  const { hasPermission } = usePermissions()
  const { filterObj } = useGlobalFilters()
  const [dataSource, setDataSource] = useState('live-api')
  const [summary, setSummary] = useState<any>(null)
  const [trends, setTrends] = useState<any[]>([])
  const [compliance, setCompliance] = useState<any[]>([])
  const [hierarchy, setHierarchy] = useState<HierarchyDepartment[]>([])
  const [loading, setLoading] = useState(true)
  const [hierarchyLoading, setHierarchyLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setHierarchyLoading(true)
    try {
      const [summRes, trendsRes, compRes, hierRes] = await Promise.all([
        api.get('/attendance/summary', { params: filterObj }).catch(() => ({ data: null })),
        api.get('/attendance/trends', { params: filterObj }).catch(() => ({ data: [] })),
        api.get('/attendance/compliance', { params: filterObj }).catch(() => ({ data: [] })),
        api.get('/attendance/hierarchy', { params: filterObj }).catch(() => ({ data: [] })),
      ])
      setSummary(summRes.data)
      setTrends(Array.isArray(trendsRes.data) ? trendsRes.data : trendsRes.data?.trends || [])
      setCompliance(Array.isArray(compRes.data) ? compRes.data : compRes.data?.report || [])
      setHierarchy(Array.isArray(hierRes.data) ? hierRes.data : [])
    } catch {
      toast.error('Failed to load attendance data')
    } finally {
      setLoading(false)
      setHierarchyLoading(false)
    }
  }, [filterObj])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.csv'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        let records
        if (file.name.endsWith('.json')) {
          records = JSON.parse(text)
        } else {
          const lines = text.split('\n').filter((l: string) => l.trim())
          const headers = lines[0].split(',')
          records = lines.slice(1).map((line: string) => {
            const vals = line.split(',')
            const obj: any = {}
            headers.forEach((h: string, i: number) => { obj[h.trim()] = vals[i]?.trim() })
            return obj
          })
        }
        toast.loading('Importing records...')
        const res = await api.post('/attendance/import', { records })
        toast.dismiss()
        toast.success(`Imported: ${res.data.created} created, ${res.data.updated} updated`)
        fetchData()
      } catch {
        toast.dismiss()
        toast.error('Import failed')
      }
    }
    input.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance Monitoring</h1>
          <p className="text-sm text-gray-500 mt-1">Track office attendance and compliance</p>
        </div>
        <div className="flex items-center gap-3">
          <DataSourceSelector module="Attendance" selectedSource={dataSource} onSourceChange={setDataSource} compact />
          <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
          {hasPermission('attendance:import') && (
            <button onClick={handleImport} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              <ArrowUpTrayIcon className="h-4 w-4" />
              Import
            </button>
          )}
        </div>
      </div>

      {/* Workplace Policy Section */}
      <WorkplacePolicySection />

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl h-28" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Attendance Rate</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{summary.attendance_rate}%</p>
              </div>
              <div className="bg-green-100 dark:bg-green-900/40 p-2 rounded-lg">
                <CalendarDaysIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Office Attendance</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{summary.office_attendance_pct}%</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{summary.in_office} records</p>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-lg">
                <BuildingOfficeIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Remote</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{summary.remote_rate}%</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{summary.remote} records</p>
              </div>
              <div className="bg-purple-100 dark:bg-purple-900/40 p-2 rounded-lg">
                <HomeModernIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Holidays & PTO</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                  {summary.total_records > 0
                    ? (((summary.holiday || 0) + (summary.on_leave || 0)) / summary.total_records * 100).toFixed(1)
                    : '0.0'}%
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{summary.holiday} hol | {summary.on_leave} pto records</p>
              </div>
              <div className="bg-orange-100 dark:bg-orange-900/40 p-2 rounded-lg">
                <SunIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Absences</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                  {summary.total_records > 0
                    ? ((summary.absent || 0) / summary.total_records * 100).toFixed(1)
                    : '0.0'}%
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{summary.absent} records · {summary.unique_employees} employees</p>
              </div>
              <div className="bg-red-100 dark:bg-red-900/40 p-2 rounded-lg">
                <UserMinusIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trends Chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Attendance Trend</h3>
          <div className="h-64">
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends} margin={{ top: 25, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="attendance_rate" stroke={CHART_COLORS[1]} strokeWidth={2} name="Attendance %" dot={{ r: 3 }}>
                    {trends.length <= 12 && (
                      <LabelList dataKey="attendance_rate" position="top" fontSize={11} fill="#64748b" formatter={formatChartLabel} />
                    )}
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">No trend data available</div>
            )}
          </div>
        </div>

        {/* Breakdown Chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Status Breakdown</h3>
          <div className="h-64">
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends} margin={{ top: 25, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} unit="%" />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Legend />
                  <Bar dataKey="in_office_rate" fill={CHART_COLORS[2]} stackId="a" name="In Office %" />
                  <Bar dataKey="remote_rate" fill={CHART_COLORS[1]} stackId="a" name="Remote %" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">No breakdown data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Attendance Drill-Down Hierarchy Table */}
      <AttendanceHierarchyTable data={hierarchy} loading={hierarchyLoading} />

      {/* Compliance Report */}
      {compliance.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Compliance Report</h3>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actual Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gap</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {compliance.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.department}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{row.target_rate}%</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{row.actual_rate}%</td>
                  <td className={`px-6 py-4 text-sm font-medium ${row.gap >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {row.gap > 0 ? '+' : ''}{row.gap}%
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${row.compliant ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {row.compliant ? 'Compliant' : 'Below Target'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
