import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  UsersIcon,
  UserPlusIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  BriefcaseIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import api from '../api'
import { useGlobalFilters } from '../hooks/useGlobalFilters'
import { useStore } from '../store'
import MetricCard from '../components/MetricCard'
import DataTable from '../components/DataTable'
import { ColumnDef } from '@tanstack/react-table'
import clsx from 'clsx'

// Unified display type that normalises both API (snake_case) and store (camelCase) shapes
interface DisplayEmployee {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  department: string
  jobTitle: string
  location: string
  status: string
  hireDate: string
  salary: number
  performanceRating: number | null
  engagementScore: number | null
  tenure: number | null
  flightRisk: string | null
}

function normaliseApiEmployee(e: Record<string, unknown>): DisplayEmployee {
  return {
    id: String(e.id ?? e.employee_id ?? ''),
    employeeId: String(e.employee_id ?? e.employeeId ?? ''),
    firstName: String(e.first_name ?? e.firstName ?? ''),
    lastName: String(e.last_name ?? e.lastName ?? ''),
    email: String(e.email ?? ''),
    department: String(e.department ?? ''),
    jobTitle: String(e.job_title ?? e.jobTitle ?? ''),
    location: String(e.location ?? ''),
    status: String(e.status ?? 'active'),
    hireDate: String(e.hire_date ?? e.hireDate ?? ''),
    salary: Number(e.salary ?? 0),
    performanceRating: e.performance_rating != null ? Number(e.performance_rating) : e.performanceRating != null ? Number(e.performanceRating) : null,
    engagementScore: e.engagement_score != null ? Number(e.engagement_score) : e.engagementScore != null ? Number(e.engagementScore) : null,
    tenure: e.tenure != null ? Number(e.tenure) : null,
    flightRisk: String(e.flight_risk ?? e.flightRisk ?? ''),
  }
}


const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  terminated: 'bg-slate-100 text-slate-500 border-slate-200',
  on_leave: 'bg-amber-50 text-amber-700 border-amber-200',
}

const RISK_COLORS: Record<string, string> = {
  high: 'text-red-600',
  medium: 'text-amber-600',
  low: 'text-emerald-600',
}

export default function Employees() {
  const { filterObj } = useGlobalFilters()
  const storeEmployees = useStore((s) => s.employees)
  const [search, setSearch] = useState('')

  const { data: apiRes, isError } = useQuery({
    queryKey: ['employees-list', filterObj],
    queryFn: async () => {
      const res = await api.get('/employees', { params: { ...filterObj, limit: 2000 } })
      return res.data
    },
    retry: 1,
  })

  // Prefer API data; fall back to store when API is unavailable
  const employees: DisplayEmployee[] = useMemo(() => {
    const apiList: Record<string, unknown>[] =
      apiRes?.employees ?? apiRes?.data ?? (Array.isArray(apiRes) ? apiRes : null)

    if (apiList && !isError) {
      return apiList.map(normaliseApiEmployee)
    }
    // Fallback: use Zustand store (may contain snake_case from useDataSync)
    return storeEmployees.map(e => normaliseApiEmployee(e as unknown as Record<string, unknown>))
  }, [apiRes, isError, storeEmployees])

  // Client-side search
  const filtered = useMemo(() => {
    if (!search.trim()) return employees
    const q = search.toLowerCase()
    return employees.filter(
      (e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.jobTitle.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.employeeId.toLowerCase().includes(q)
    )
  }, [employees, search])

  const metrics = useMemo(() => {
    const active = employees.filter((e) => e.status === 'active').length
    const depts = new Set(employees.map((e) => e.department)).size
    const locs = new Set(employees.map((e) => e.location)).size
    const avgSalary = employees.length > 0
      ? Math.round(employees.reduce((s, e) => s + e.salary, 0) / employees.length)
      : 0
    return { active, depts, locs, avgSalary }
  }, [employees])

  const columns: ColumnDef<DisplayEmployee>[] = [
    {
      id: 'employee',
      header: 'Employee',
      accessorFn: (row) => `${row.firstName} ${row.lastName}`,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white font-bold text-[11px] uppercase shrink-0 shadow-sm">
            {row.original.firstName[0]}{row.original.lastName[0]}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-white truncate">
              {row.original.firstName} {row.original.lastName}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">{row.original.employeeId}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'jobTitle',
      header: 'Role',
      cell: ({ getValue }) => (
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{String(getValue())}</span>
      ),
    },
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'location', header: 'Location' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const val = String(getValue())
        return (
          <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize', STATUS_COLORS[val] ?? 'bg-slate-100 text-slate-500 border-slate-200')}>
            {val.replace('_', ' ')}
          </span>
        )
      },
    },
    {
      accessorKey: 'hireDate',
      header: 'Hire Date',
      cell: ({ getValue }) => {
        const v = String(getValue() ?? '')
        return v ? new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
      },
    },
    {
      accessorKey: 'tenure',
      header: 'Tenure',
      cell: ({ getValue }) => {
        const v = getValue()
        if (v == null) return '—'
        return `${Number(v)}y`
      },
    },
    {
      accessorKey: 'performanceRating',
      header: 'Performance',
      cell: ({ getValue }) => {
        const v = getValue()
        if (v == null) return '—'
        const pct = (Number(v) / 5) * 100
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-slate-800 dark:bg-slate-300 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{Number(v).toFixed(1)}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'flightRisk',
      header: 'Risk',
      cell: ({ getValue }) => {
        const v = String(getValue() ?? '').toLowerCase()
        if (!v || v === 'null' || v === 'undefined') return <span className="text-slate-300">—</span>
        return (
          <span className={clsx('text-xs font-bold capitalize flex items-center gap-1', RISK_COLORS[v] ?? 'text-slate-400')}>
            {v === 'high' ? <ChevronUpIcon className="w-3 h-3" /> : v === 'low' ? <ChevronDownIcon className="w-3 h-3" /> : null}
            {v}
          </span>
        )
      },
    },
  ]

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Directory</h1>
          <p className="text-sm text-gray-500 mt-1">
            {employees.length.toLocaleString()} employees across {metrics.depts} departments
          </p>
        </div>
        <button className="btn-primary">
          <UserPlusIcon className="w-4 h-4 mr-2" />
          Add Employee
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Employees" value={employees.length.toLocaleString()} icon={<UsersIcon className="w-6 h-6" />} />
        <MetricCard title="Active" value={metrics.active.toLocaleString()} icon={<UsersIcon className="w-6 h-6" />} />
        <MetricCard title="Departments" value={metrics.depts} icon={<BriefcaseIcon className="w-6 h-6" />} />
        <MetricCard title="Locations" value={metrics.locs} icon={<MapPinIcon className="w-6 h-6" />} />
      </div>

      {/* Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-5 gap-4">
          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, ID, role, department…"
              className="input pl-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-xs text-slate-500">
            {filtered.length.toLocaleString()} of {employees.length.toLocaleString()}
          </span>
        </div>

        <DataTable
          data={filtered}
          columns={columns}
          pageSize={15}
        />
      </div>
    </div>
  )
}
