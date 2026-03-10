import React, { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api'
import { usePageFilters } from '../hooks/usePageFilters'
import PageFilterBar from '../components/PageFilterBar'
import { useLocalization } from '../hooks/useLocalization'
import MetricCard from '../components/MetricCard'
import LineChart from '../components/charts/LineChart'
import PieChart from '../components/charts/PieChart'
import DataTable from '../components/DataTable'
import { CHART_COLORS, PIE_COLORS } from '../utils/chartColors'
import { ColumnDef } from '@tanstack/react-table'
import Papa from 'papaparse'
import toast from 'react-hot-toast'
import AIInsightsPanel from '../components/AIInsightsPanel'
import {
  StarIcon,
  HeartIcon,
  ShieldCheckIcon,
  UsersIcon,
  ArrowDownTrayIcon,
  BuildingOfficeIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  UserIcon,
  Squares2X2Icon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

// ------- Types -------

interface HierarchyEmployee {
  id: string
  name: string
  job_title: string
  performance_rating: number
  engagement_score: number
  tenure: number
}

interface HierarchyManager {
  id: string
  name: string
  job_title: string | null
  employee_count: number
  avg_performance: number
  avg_engagement: number
  employees: HierarchyEmployee[]
}

interface HierarchyTeam {
  name: string
  employee_count: number
  avg_performance: number
  avg_engagement: number
  managers: HierarchyManager[]
}

interface HierarchyDepartment {
  name: string
  employee_count: number
  avg_performance: number
  avg_engagement: number
  teams: HierarchyTeam[]
}

interface PerformanceSummary {
  avg_performance_rating: number
  avg_engagement_score: number
  total_employees_rated: number
  promotion_rate?: number
  retention_rate: number
}

interface DistributionBucket {
  count: number
  pct: number
}

interface PerformanceDistribution {
  top_performers: DistributionBucket
  good_performers: DistributionBucket
  mid_performers: DistributionBucket
  low_performers: DistributionBucket
}

interface GroupRow {
  department: string
  headcount: number
  avg_performance: number
  avg_engagement: number
  avg_salary: number
  top_performer_count: number
  low_performer_count: number
}

interface ManagerRow {
  manager_name: string
  department: string
  direct_reports: number
  avg_team_performance: number
  avg_team_engagement: number
  top_performers: number
  low_performers: number
}

interface TopEmployee {
  name: string
  department: string
  team: string
  location: string
  performance_rating: number
  engagement_score: number
  tenure: number
  salary: number
}

interface TrendPoint {
  month: string
  avg_engagement: number
  avg_performance: number
}

interface PerformanceData {
  summary: PerformanceSummary
  distribution: PerformanceDistribution
  by_department: GroupRow[]
  by_team: GroupRow[]
  by_location: GroupRow[]
  by_manager: ManagerRow[]
  top_employees: TopEmployee[]
  low_employees: TopEmployee[]
  satisfaction_trend: TrendPoint[]
}

// ------- Skeleton Components -------

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-20 mb-2"></div>
          <div className="h-3 bg-gray-100 rounded w-32"></div>
        </div>
        <div className="p-3 rounded-lg bg-gray-100 w-12 h-12"></div>
      </div>
    </div>
  )
}

function SkeletonChart() {
  return (
    <div className="card animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-40 mb-4"></div>
      <div className="h-[280px] bg-gray-100 rounded"></div>
    </div>
  )
}

function SkeletonTable() {
  return (
    <div className="card animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-48 mb-4"></div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded"></div>
        ))}
      </div>
    </div>
  )
}

// ------- Tab types -------

type DimensionTab = 'department' | 'team' | 'location' | 'manager'
type PerformerTab = 'top' | 'low'

// ------- Hierarchy Components -------

function RatingBadge({ val }: { val: number }) {
  const cls = val >= 4.0
    ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
    : val >= 3.0
      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
      : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{val.toFixed(2)}</span>
}

function EmployeeRow({ emp }: { emp: HierarchyEmployee }) {
  return (
    <tr className="bg-gray-50/30 dark:bg-gray-900/20">
      <td className="px-6 py-2 pl-24">
        <div className="flex items-center gap-2">
          <UserIcon className="h-3.5 w-3.5 text-gray-400" />
          <div disk-name="emp-name">
            <div className="text-xs font-medium text-gray-900 dark:text-white">{emp.name}</div>
            <div className="text-[10px] text-gray-500">{emp.job_title}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-2 text-center">
        <RatingBadge val={emp.performance_rating} />
      </td>
      <td className="px-4 py-2 text-center text-xs text-gray-600 dark:text-gray-400">
        {emp.engagement_score.toFixed(1)}
      </td>
      <td className="px-4 py-2 text-center text-xs text-gray-500">
        {emp.tenure.toFixed(1)}y
      </td>
    </tr>
  )
}

function ManagerRows({ mgr, isExpanded, onToggle }: { mgr: HierarchyManager, isExpanded: boolean, onToggle: () => void }) {
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
        <td className="px-6 py-2.5 pl-16">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">
              {isExpanded ? <ChevronDownIcon className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
            </span>
            <UsersIcon className="h-4 w-4 text-blue-500" />
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-200">{mgr.name}</div>
              {mgr.job_title && <div className="text-[10px] text-gray-500">{mgr.job_title}</div>}
            </div>
            <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 rounded-full">{mgr.employee_count}</span>
          </div>
        </td>
        <td className="px-4 py-2.5 text-center">
          <RatingBadge val={mgr.avg_performance} />
        </td>
        <td className="px-4 py-2.5 text-center text-sm font-medium text-gray-600 dark:text-gray-400">
          {mgr.avg_engagement.toFixed(2)}
        </td>
        <td className="px-4 py-2.5"></td>
      </tr>
      {isExpanded && mgr.employees.map(emp => (
        <EmployeeRow key={emp.id} emp={emp} />
      ))}
    </>
  )
}

function TeamRows({ team, isExpanded, expandedMgrs, onToggle, onToggleMgr }: {
  team: HierarchyTeam,
  isExpanded: boolean,
  expandedMgrs: Set<string>,
  onToggle: () => void,
  onToggleMgr: (mgrId: string) => void
}) {
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
        <td className="px-6 py-2.5 pl-10">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">
              {isExpanded ? <ChevronDownIcon className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
            </span>
            <Squares2X2Icon className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{team.name}</span>
            <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 rounded-full">{team.employee_count}</span>
          </div>
        </td>
        <td className="px-4 py-2.5 text-center">
          <RatingBadge val={team.avg_performance} />
        </td>
        <td className="px-4 py-2.5 text-center text-sm text-gray-600 dark:text-gray-400">
          {team.avg_engagement.toFixed(2)}
        </td>
        <td className="px-4 py-2.5"></td>
      </tr>
      {isExpanded && team.managers.map(mgr => (
        <ManagerRows
          key={mgr.id}
          mgr={mgr}
          isExpanded={expandedMgrs.has(mgr.id)}
          onToggle={() => onToggleMgr(mgr.id)}
        />
      ))}
    </>
  )
}

function DepartmentRows({ dept, isExpanded, expandedTeams, expandedMgrs, onToggleDept, onToggleTeam, onToggleMgr }: {
  dept: HierarchyDepartment,
  isExpanded: boolean,
  expandedTeams: Set<string>,
  expandedMgrs: Set<string>,
  onToggleDept: () => void,
  onToggleTeam: (teamKey: string) => void,
  onToggleMgr: (mgrId: string) => void
}) {
  return (
    <>
      <tr onClick={onToggleDept} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 bg-white dark:bg-gray-800 transition-colors">
        <td className="px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">
              {isExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
            </span>
            <BuildingOfficeIcon className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{dept.name}</span>
            <span className="text-xs text-gray-400 font-normal">({dept.employee_count} employees)</span>
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          <RatingBadge val={dept.avg_performance} />
        </td>
        <td className="px-4 py-3 text-center text-sm font-bold text-gray-900 dark:text-white">
          {dept.avg_engagement.toFixed(2)}
        </td>
        <td className="px-4 py-3"></td>
      </tr>
      {isExpanded && dept.teams.map(team => {
        const teamKey = `${dept.name}|${team.name}`
        return (
          <TeamRows
            key={teamKey}
            team={team}
            isExpanded={expandedTeams.has(teamKey)}
            expandedMgrs={expandedMgrs}
            onToggle={() => onToggleTeam(teamKey)}
            onToggleMgr={onToggleMgr}
          />
        )
      })}
    </>
  )
}

function PerformanceHierarchyTable({ data, loading }: { data: HierarchyDepartment[], loading: boolean }) {
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())
  const [expandedMgrs, setExpandedMgrs] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const toggle = (_set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    setFn(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const q = search.trim().toLowerCase()

  const filteredData = useMemo(() => {
    if (!q) return data
    return data
      .map(dept => ({
        ...dept,
        teams: dept.teams
          .map(team => ({
            ...team,
            managers: team.managers
              .map(mgr => ({
                ...mgr,
                employees: mgr.employees.filter(emp =>
                  emp.name.toLowerCase().includes(q) || (emp.job_title || '').toLowerCase().includes(q)
                ),
              }))
              .filter(mgr =>
                mgr.name.toLowerCase().includes(q) ||
                (mgr.job_title || '').toLowerCase().includes(q) ||
                mgr.employees.length > 0
              ),
          }))
          .filter(team => team.name.toLowerCase().includes(q) || team.managers.length > 0),
      }))
      .filter(dept => dept.name.toLowerCase().includes(q) || dept.teams.length > 0)
  }, [data, q])

  const autoExpanded = useMemo(() => {
    if (!q) return { depts: new Set<string>(), teams: new Set<string>(), mgrs: new Set<string>() }
    const depts = new Set<string>()
    const teams = new Set<string>()
    const mgrs = new Set<string>()
    filteredData.forEach(dept => {
      depts.add(dept.name)
      dept.teams.forEach(team => {
        const teamKey = `${dept.name}|${team.name}`
        teams.add(teamKey)
        team.managers.forEach(mgr => mgrs.add(mgr.id))
      })
    })
    return { depts, teams, mgrs }
  }, [filteredData, q])

  const activeDepts = q ? autoExpanded.depts : expandedDepts
  const activeTeams = q ? autoExpanded.teams : expandedTeams
  const activeMgrs = q ? autoExpanded.mgrs : expandedMgrs

  if (loading) return <SkeletonTable />

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm mt-6">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Performance Drill-Down</h3>
          <p className="text-xs text-gray-500 mt-0.5">Department &rarr; Team &rarr; Manager &rarr; Individual</p>
        </div>
        <div className="relative flex-shrink-0">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="pl-8 pr-7 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 w-48"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hierarchy</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Performance</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Engagement</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Tenure</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">No results for "{search}"</td>
              </tr>
            ) : filteredData.map(dept => (
              <DepartmentRows
                key={dept.name}
                dept={dept}
                isExpanded={activeDepts.has(dept.name)}
                expandedTeams={activeTeams}
                expandedMgrs={activeMgrs}
                onToggleDept={() => !q && toggle(expandedDepts, setExpandedDepts, dept.name)}
                onToggleTeam={(key) => !q && toggle(expandedTeams, setExpandedTeams, key)}
                onToggleMgr={(id) => !q && toggle(expandedMgrs, setExpandedMgrs, id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ------- Main Component -------

export default function PerformanceManagement() {
  const loc = useLocalization()
  const { department, setDepartment, location, setLocation, timePeriod, setTimePeriod, filterParams, hasFilters, resetFilters } = usePageFilters()
  const [activeTab, setActiveTab] = useState<DimensionTab>('department')
  const [performerTab, setPerformerTab] = useState<PerformerTab>('top')

  const { data, isLoading } = useQuery({
    queryKey: ['performance-dashboard', filterParams],
    queryFn: async () => {
      const res = await api.get('/performance/dashboard', { params: filterParams })
      return res.data.data as PerformanceData
    },
  })

  const { data: hierarchyData, isLoading: hierarchyLoading } = useQuery({
    queryKey: ['performance-hierarchy', filterParams],
    queryFn: async () => {
      const res = await api.get('/performance/hierarchy', { params: filterParams })
      return res.data.data as HierarchyDepartment[]
    },
  })

  // ------- Pie chart data -------
  const distributionData = useMemo(() => {
    if (!data?.distribution) return []
    const d = data.distribution
    return [
      { name: 'Top Performers', value: d.top_performers.count, color: PIE_COLORS[0] },
      { name: 'Good Performers', value: d.good_performers.count, color: PIE_COLORS[1] },
      { name: 'Mid Performers', value: d.mid_performers.count, color: PIE_COLORS[2] },
      { name: 'Low Performers', value: d.low_performers.count, color: PIE_COLORS[3] },
    ]
  }, [data?.distribution])

  // ------- Group table data (dept / team / location) -------
  const groupData: GroupRow[] = useMemo(() => {
    if (!data) return []
    if (activeTab === 'department') return data.by_department
    if (activeTab === 'team') return data.by_team
    if (activeTab === 'location') return data.by_location
    return []
  }, [data, activeTab])

  // ------- Group table columns -------
  const groupColumns: ColumnDef<GroupRow>[] = useMemo(() => [
    { accessorKey: 'department', header: activeTab === 'department' ? 'Department' : activeTab === 'team' ? 'Team' : 'Location', size: 160 },
    { accessorKey: 'headcount', header: 'Headcount', cell: ({ getValue }) => loc.number(getValue() as number) },
    { accessorKey: 'avg_performance', header: 'Avg Performance', cell: ({ getValue }) => (getValue() as number).toFixed(2) },
    { accessorKey: 'avg_engagement', header: 'Avg Engagement', cell: ({ getValue }) => (getValue() as number).toFixed(2) },
    { accessorKey: 'avg_salary', header: 'Avg Salary', cell: ({ getValue }) => loc.currency(getValue() as number, true) },
    { accessorKey: 'top_performer_count', header: 'Top Performers' },
    { accessorKey: 'low_performer_count', header: 'Low Performers' },
  ], [activeTab, loc])

  // ------- Manager table columns -------
  const managerColumns: ColumnDef<ManagerRow>[] = useMemo(() => [
    { accessorKey: 'manager_name', header: 'Manager', size: 160 },
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'direct_reports', header: 'Direct Reports' },
    { accessorKey: 'avg_team_performance', header: 'Avg Team Performance', cell: ({ getValue }) => (getValue() as number).toFixed(2) },
    { accessorKey: 'avg_team_engagement', header: 'Avg Team Engagement', cell: ({ getValue }) => (getValue() as number).toFixed(2) },
    { accessorKey: 'top_performers', header: 'Top Performers' },
    { accessorKey: 'low_performers', header: 'Low Performers' },
  ], [])

  // ------- Top employees table columns -------
  const topEmployeeColumns: ColumnDef<TopEmployee>[] = useMemo(() => [
    { accessorKey: 'name', header: 'Name', size: 160 },
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'team', header: 'Team' },
    { accessorKey: 'location', header: 'Location' },
    {
      accessorKey: 'performance_rating',
      header: 'Rating',
      cell: ({ getValue }) => {
        const v = getValue() as number
        const cls = v >= 4.0
          ? 'bg-green-100 text-green-800'
          : v >= 3.0
            ? 'bg-amber-100 text-amber-800'
            : 'bg-red-100 text-red-800'
        return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{v.toFixed(2)}</span>
      },
    },
    {
      accessorKey: 'engagement_score',
      header: 'Engagement',
      cell: ({ getValue }) => {
        const v = getValue() as number
        const cls = v >= 80
          ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
          : v >= 60
            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
            : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
        return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{v.toFixed(2)}</span>
      },
    },
    {
      accessorKey: 'tenure',
      header: 'Tenure (yrs)',
      cell: ({ getValue }) => {
        const v = getValue() as number
        const [cls, label] = v >= 5
          ? ['bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300', 'veteran']
          : v >= 2
            ? ['bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300', 'established']
            : ['bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300', 'new']
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls} dark:bg-opacity-30`}>
            {v.toFixed(1)} <span className="opacity-70">({label})</span>
          </span>
        )
      },
    },
    {
      accessorKey: 'salary',
      header: 'Salary',
      cell: ({ getValue }) => loc.currency(getValue() as number, true),
    },
  ], [loc])

  const tabs: { key: DimensionTab; label: string }[] = [
    { key: 'department', label: 'By Department' },
    { key: 'team', label: 'By Team' },
    { key: 'location', label: 'By Location' },
    { key: 'manager', label: 'By Manager' },
  ]

  const handleExportCSV = useCallback(() => {
    if (!data) {
      toast.error('No performance data available to export')
      return
    }

    const allEmployees = [...(data.top_employees || []), ...(data.low_employees || [])]
    // Deduplicate by name + department (in case of overlap)
    const seen = new Set<string>()
    const uniqueEmployees = allEmployees.filter((e) => {
      const key = `${e.name}|${e.department}|${e.team}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const employeeRows = uniqueEmployees.map((e) => ({
      Name: e.name,
      Department: e.department,
      Team: e.team,
      Location: e.location,
      'Performance Rating': e.performance_rating,
      'Engagement Score': e.engagement_score,
      'Tenure (Years)': e.tenure,
      Salary: e.salary,
    }))

    const sections: string[] = []

    // Employees section
    sections.push('--- Performers ---')
    sections.push(Papa.unparse(employeeRows))

    // Department breakdown
    if (data.by_department?.length) {
      sections.push('\n--- By Department ---')
      sections.push(Papa.unparse(data.by_department))
    }

    // Team breakdown
    if (data.by_team?.length) {
      sections.push('\n--- By Team ---')
      sections.push(Papa.unparse(data.by_team))
    }

    // Location breakdown
    if (data.by_location?.length) {
      sections.push('\n--- By Location ---')
      sections.push(Papa.unparse(data.by_location))
    }

    // Manager breakdown
    if (data.by_manager?.length) {
      sections.push('\n--- By Manager ---')
      sections.push(Papa.unparse(data.by_manager))
    }

    const csv = sections.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `performance-report-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Performance data exported to CSV')
  }, [data])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Performance</h1>
          <p className="text-sm text-gray-500 mt-1">
            Comprehensive view of employee performance, engagement, and organizational health
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={isLoading || !data}
          className="btn-secondary flex items-center gap-2 disabled:opacity-50"
        >
          <ArrowDownTrayIcon className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <PageFilterBar
        department={department} setDepartment={setDepartment}
        location={location} setLocation={setLocation}
        timePeriod={timePeriod} setTimePeriod={setTimePeriod}
        hasFilters={hasFilters} resetFilters={resetFilters}
      />

      <AIInsightsPanel
        pageContext="Performance Management"
        prompt="Analyse the performance management data including rating distributions, high and low performer percentages, engagement scores, review completion rates, and performance trends. Identify concerning patterns such as performance clustering, disengagement risk, or review coverage gaps. Provide 3-5 actionable recommendations for HR leadership."
      />

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : data?.summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Avg Performance Rating"
            value={data.summary.avg_performance_rating.toFixed(2)}
            subtitle="Out of 5.0"
            icon={<StarIcon className="w-6 h-6" />}
          />
          <MetricCard
            title="Avg Engagement Score"
            value={data.summary.avg_engagement_score.toFixed(2)}
            subtitle="Out of 5.0"
            icon={<HeartIcon className="w-6 h-6" />}
          />
          <MetricCard
            title="Retention Rate"
            value={`${data.summary.retention_rate}%`}
            subtitle="12-month cohort"
            icon={<ShieldCheckIcon className="w-6 h-6" />}
          />
          <MetricCard
            title="Total Rated Employees"
            value={loc.number(data.summary.total_employees_rated)}
            subtitle="With performance rating"
            icon={<UsersIcon className="w-6 h-6" />}
          />
        </div>
      ) : null}

      {/* Distribution + Trend row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Performance Distribution */}
        {isLoading ? (
          <SkeletonChart />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 overflow-hidden">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Performance Distribution</h2>
            {distributionData.length > 0 ? (
              <PieChart
                data={distributionData}
                height={300}
                innerRadius={50}
                outerRadius={90}
                showLegend
                showLabels
              />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">No data available</div>
            )}
          </div>
        )}

        {/* Satisfaction / Engagement Trend */}
        {isLoading ? (
          <SkeletonChart />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Engagement & Performance Trend</h2>
            {data?.satisfaction_trend && data.satisfaction_trend.length > 0 ? (
              <LineChart
                data={data.satisfaction_trend as unknown as Record<string, unknown>[]}
                xKey="month"
                lines={[
                  { key: 'avg_engagement', name: 'Avg Engagement', color: CHART_COLORS[0] },
                  { key: 'avg_performance', name: 'Avg Performance', color: CHART_COLORS[1] },
                ]}
                height={300}
                showDots
                showLegend
              />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">No data available</div>
            )}
          </div>
        )}
      </div>

      {/* Hierarchy Drill-Down Table */}
      <PerformanceHierarchyTable 
        data={hierarchyData ?? []} 
        loading={hierarchyLoading} 
      />

      {/* Filter Tabs + Main Table */}
      {isLoading ? (
        <SkeletonTable />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          {/* Tabs */}
          <div className="flex items-center gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.key
                    ? 'border-primary-600 text-primary-700 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Table content */}
          {activeTab === 'manager' ? (
            <DataTable<ManagerRow>
              data={data?.by_manager ?? []}
              columns={managerColumns}
              searchable
              searchPlaceholder="Search managers..."
              pageSize={10}
            />
          ) : (
            <DataTable<GroupRow>
              data={groupData}
              columns={groupColumns}
              searchable
              searchPlaceholder={`Search ${activeTab}s...`}
              pageSize={10}
            />
          )}
        </div>
      )}

      {/* Top & Low Performers Tabs */}
      {isLoading ? (
        <SkeletonTable />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-1 -mb-px">
              <button
                onClick={() => setPerformerTab('top')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  performerTab === 'top'
                    ? 'border-primary-600 text-primary-700 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                Top 20 Performers
              </button>
              <button
                onClick={() => setPerformerTab('low')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  performerTab === 'low'
                    ? 'border-primary-600 text-primary-700 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                Low 20 Performers
              </button>
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider pb-2">
              Sorted by Performance Rating
            </div>
          </div>

          {performerTab === 'top' ? (
            <DataTable<TopEmployee>
              data={data?.top_employees ?? []}
              columns={topEmployeeColumns}
              searchable
              searchPlaceholder="Search top performers..."
              pageSize={10}
            />
          ) : (
            <DataTable<TopEmployee>
              data={data?.low_employees ?? []}
              columns={topEmployeeColumns}
              searchable
              searchPlaceholder="Search low performers..."
              pageSize={10}
            />
          )}
        </div>
      )}
    </div>
  )
}
