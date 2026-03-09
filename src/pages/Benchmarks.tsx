import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api'
import { useLocalization } from '../hooks/useLocalization'
import { CHART_COLORS } from '../utils/chartColors'
import MetricCard from '../components/MetricCard'
import {
  ScaleIcon,
  ArrowUpTrayIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  FunnelIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
} from '@heroicons/react/24/outline'
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import Papa from 'papaparse'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Benchmark {
  id: string
  name: string
  category: string | null
  metric_name: string
  metric_value: number
  unit: string | null
  source: string | null
  year: number | null
  region: string | null
  industry: string | null
  created_at: string | null
  updated_at: string | null
}

interface ComparisonItem {
  benchmark_id: string
  name: string
  category: string | null
  metric_name: string
  benchmark_value: number
  unit: string | null
  org_value: number | null
  difference: number | null
  difference_pct: number | null
  source: string | null
  year: number | null
  industry: string | null
  region: string | null
}

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

export default function Benchmarks() {
  const loc = useLocalization()
  const queryClient = useQueryClient()

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterIndustry, setFilterIndustry] = useState<string>('')
  const [filterYear, setFilterYear] = useState<string>('')

  // Active tab
  const [activeTab, setActiveTab] = useState<'benchmarks' | 'compare' | 'upload'>('benchmarks')

  // Create/edit form
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    metric_name: '',
    metric_value: '',
    unit: '',
    source: '',
    year: '',
    region: '',
    industry: '',
  })

  // CSV state
  const [csvPreview, setCsvPreview] = useState<Record<string, unknown>[] | null>(null)

  // Queries
  const filterParams: Record<string, string> = {}
  if (filterCategory) filterParams.category = filterCategory
  if (filterIndustry) filterParams.industry = filterIndustry
  if (filterYear) filterParams.year = filterYear

  const { data: benchmarksRes, isLoading } = useQuery({
    queryKey: ['benchmarks', filterParams],
    queryFn: async () => {
      try {
        const res = await api.get('/benchmarks', { params: filterParams })
        return res.data
      } catch {
        return { data: [] }
      }
    },
    retry: false,
  })

  const { data: compareRes, isLoading: compareLoading } = useQuery({
    queryKey: ['benchmarks-compare', filterCategory, filterYear],
    queryFn: async () => {
      try {
        const params: Record<string, string> = {}
        if (filterCategory) params.category = filterCategory
        if (filterYear) params.year = filterYear
        const res = await api.get('/benchmarks/compare', { params })
        return res.data
      } catch {
        return { data: { comparisons: [], org_metrics: {} } }
      }
    },
    enabled: activeTab === 'compare',
    retry: false,
  })

  const benchmarks: Benchmark[] = benchmarksRes?.data ?? []
  const comparisons: ComparisonItem[] = compareRes?.data?.comparisons ?? []
  const orgMetrics = compareRes?.data?.org_metrics ?? {}

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post('/benchmarks', data)
      return res.data
    },
    onSuccess: () => {
      toast.success('Benchmark created')
      queryClient.invalidateQueries({ queryKey: ['benchmarks'] })
      setShowForm(false)
      resetForm()
    },
    onError: () => toast.error('Failed to create benchmark'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await api.put(`/benchmarks/${id}`, data)
      return res.data
    },
    onSuccess: () => {
      toast.success('Benchmark updated')
      queryClient.invalidateQueries({ queryKey: ['benchmarks'] })
      setShowForm(false)
      setEditingId(null)
      resetForm()
    },
    onError: () => toast.error('Failed to update benchmark'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/benchmarks/${id}`)
      return res.data
    },
    onSuccess: () => {
      toast.success('Benchmark deleted')
      queryClient.invalidateQueries({ queryKey: ['benchmarks'] })
    },
    onError: () => toast.error('Failed to delete benchmark'),
  })

  const csvImportMutation = useMutation({
    mutationFn: async (file: File) => {
      const formDataObj = new FormData()
      formDataObj.append('file', file)
      const res = await api.post('/benchmarks/import-csv', formDataObj, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data
    },
    onSuccess: (data: any) => {
      toast.success(`Imported ${data.created} benchmarks`)
      queryClient.invalidateQueries({ queryKey: ['benchmarks'] })
      setCsvPreview(null)
    },
    onError: () => toast.error('Failed to import CSV'),
  })

  const resetForm = () => {
    setFormData({ name: '', category: '', metric_name: '', metric_value: '', unit: '', source: '', year: '', region: '', industry: '' })
  }

  const handleEdit = (b: Benchmark) => {
    setEditingId(b.id)
    setFormData({
      name: b.name,
      category: b.category ?? '',
      metric_name: b.metric_name,
      metric_value: String(b.metric_value),
      unit: b.unit ?? '',
      source: b.source ?? '',
      year: b.year ? String(b.year) : '',
      region: b.region ?? '',
      industry: b.industry ?? '',
    })
    setShowForm(true)
  }

  const handleSubmit = () => {
    const payload: Record<string, unknown> = {
      ...formData,
      metric_value: parseFloat(formData.metric_value) || 0,
      year: formData.year ? parseInt(formData.year) : null,
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Delete benchmark "${name}"? This cannot be undone.`)) {
      deleteMutation.mutate(id)
    }
  }

  const handleCsvFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim().toLowerCase().replace(/\s+/g, '_'),
      })
      setCsvPreview(result.data as Record<string, unknown>[])
    }
    reader.readAsText(file)
  }, [])

  const handleCsvUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    csvImportMutation.mutate(file)
  }, [csvImportMutation])

  // Extract unique categories/industries/years for filter dropdowns
  const categories = [...new Set(benchmarks.map(b => b.category).filter(Boolean))] as string[]
  const industries = [...new Set(benchmarks.map(b => b.industry).filter(Boolean))] as string[]
  const years = [...new Set(benchmarks.map(b => b.year).filter(Boolean))].sort((a, b) => (b ?? 0) - (a ?? 0)) as number[]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Industry Benchmarks</h2>
          <p className="text-sm text-gray-500">Compare your organization metrics against industry standards</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="btn-secondary flex items-center gap-1.5 cursor-pointer text-sm">
            <ArrowUpTrayIcon className="w-4 h-4" />
            Upload CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
          </label>
          <button
            className="btn-primary flex items-center gap-1.5 text-sm"
            onClick={() => { resetForm(); setEditingId(null); setShowForm(true) }}
          >
            <PlusIcon className="w-4 h-4" />
            Add Benchmark
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['benchmarks', 'compare', 'upload'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize',
              activeTab === tab
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab === 'benchmarks' ? 'All Benchmarks' : tab === 'compare' ? 'Comparison View' : 'Import Data'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <FunnelIcon className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500">Filters:</span>
        </div>
        <select
          className="input-field text-sm w-40"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className="input-field text-sm w-40"
          value={filterIndustry}
          onChange={(e) => setFilterIndustry(e.target.value)}
        >
          <option value="">All Industries</option>
          {industries.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <select
          className="input-field text-sm w-32"
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
        >
          <option value="">All Years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Benchmark Form Modal */}
      {showForm && (
        <div className="card border-primary-200 bg-primary-50/30">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">{editingId ? 'Edit Benchmark' : 'Add New Benchmark'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Name *</label>
              <input className="input-field text-sm" value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Tech Industry 2025" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Metric Name *</label>
              <input className="input-field text-sm" value={formData.metric_name} onChange={(e) => setFormData(p => ({ ...p, metric_name: e.target.value }))} placeholder="e.g., avg_salary_engineering" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Metric Value *</label>
              <input className="input-field text-sm" type="number" value={formData.metric_value} onChange={(e) => setFormData(p => ({ ...p, metric_value: e.target.value }))} placeholder="e.g., 145000" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Category</label>
              <input className="input-field text-sm" value={formData.category} onChange={(e) => setFormData(p => ({ ...p, category: e.target.value }))} placeholder="e.g., compensation" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Unit</label>
              <input className="input-field text-sm" value={formData.unit} onChange={(e) => setFormData(p => ({ ...p, unit: e.target.value }))} placeholder="e.g., USD, percent" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Source</label>
              <input className="input-field text-sm" value={formData.source} onChange={(e) => setFormData(p => ({ ...p, source: e.target.value }))} placeholder="e.g., Radford Survey" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Year</label>
              <input className="input-field text-sm" type="number" value={formData.year} onChange={(e) => setFormData(p => ({ ...p, year: e.target.value }))} placeholder="e.g., 2025" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Region</label>
              <input className="input-field text-sm" value={formData.region} onChange={(e) => setFormData(p => ({ ...p, region: e.target.value }))} placeholder="e.g., US, EMEA" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Industry</label>
              <input className="input-field text-sm" value={formData.industry} onChange={(e) => setFormData(p => ({ ...p, industry: e.target.value }))} placeholder="e.g., Technology" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button className="btn-primary text-sm" onClick={handleSubmit} disabled={!formData.name || !formData.metric_name || !formData.metric_value}>
              {editingId ? 'Update' : 'Create'} Benchmark
            </button>
            <button className="btn-secondary text-sm" onClick={() => { setShowForm(false); setEditingId(null); resetForm() }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* All Benchmarks Tab */}
      {activeTab === 'benchmarks' && (
        <>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : benchmarks.length === 0 ? (
            <div className="card text-center py-12">
              <ScaleIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-gray-500 font-medium mb-1">No benchmarks yet</h3>
              <p className="text-sm text-gray-400">Upload a CSV or add benchmarks manually to get started.</p>
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Metric</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Value</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Unit</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Source</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Industry</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-500">Year</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Region</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {benchmarks.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{b.name}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {b.category && (
                            <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">{b.category}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{b.metric_name}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {b.unit === 'USD' || b.unit === 'usd' ? loc.currency(b.metric_value) :
                           b.unit === 'percent' ? `${b.metric_value}%` :
                           b.metric_value.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{b.unit}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{b.source}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{b.industry}</td>
                        <td className="px-4 py-3 text-center text-gray-500 text-xs">{b.year}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{b.region}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                              title="Edit"
                              onClick={() => handleEdit(b)}
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                            <button
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              title="Delete"
                              onClick={() => handleDelete(b.id, b.name)}
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
                {benchmarks.length} benchmark{benchmarks.length !== 1 ? 's' : ''} total
              </div>
            </div>
          )}
        </>
      )}

      {/* Comparison View Tab */}
      {activeTab === 'compare' && (
        <>
          {compareLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : comparisons.length === 0 ? (
            <div className="card text-center py-12">
              <ScaleIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-gray-500 font-medium mb-1">No comparisons available</h3>
              <p className="text-sm text-gray-400">Add benchmarks first to compare against your organization metrics.</p>
            </div>
          ) : (
            <>
              {/* Org metrics summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Avg Salary"
                  value={orgMetrics.avg_salary ? loc.currency(orgMetrics.avg_salary) : '--'}
                  icon={<ScaleIcon className="w-6 h-6" />}
                />
                <MetricCard
                  title="Retention Rate"
                  value={orgMetrics.retention_rate ? `${orgMetrics.retention_rate}%` : '--'}
                  icon={<ScaleIcon className="w-6 h-6" />}
                />
                <MetricCard
                  title="Avg Quality of Hire"
                  value={orgMetrics.avg_quality_of_hire?.toFixed(1) ?? '--'}
                  icon={<ScaleIcon className="w-6 h-6" />}
                />
                <MetricCard
                  title="Avg Cost Per Hire"
                  value={orgMetrics.avg_cost_per_hire ? loc.currency(orgMetrics.avg_cost_per_hire) : '--'}
                  icon={<ScaleIcon className="w-6 h-6" />}
                />
              </div>

              {/* Comparison chart */}
              {comparisons.filter(c => c.org_value !== null).length > 0 && (
                <div className="card">
                  <h3 className="card-header">Your Organization vs Benchmarks</h3>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart
                        data={comparisons.filter(c => c.org_value !== null).slice(0, 10).map(c => ({
                          name: c.metric_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).substring(0, 25),
                          'Your Org': c.org_value,
                          Benchmark: c.benchmark_value,
                        }))}
                        margin={{ left: 20, right: 20, bottom: 40 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#6b7280' }} angle={-20} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '11px' }} />
                        <Legend />
                        <Bar dataKey="Your Org" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Benchmark" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Comparison table */}
              <div className="card overflow-hidden p-0">
                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Benchmark</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Metric</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">Your Org</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">Benchmark</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">Difference</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">% Diff</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {comparisons.map((c) => (
                        <tr key={c.benchmark_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                          <td className="px-4 py-3 text-gray-600 font-mono text-xs">{c.metric_name}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            {c.org_value !== null ? (c.unit === 'USD' ? loc.currency(c.org_value) : c.org_value.toLocaleString()) : '--'}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {c.unit === 'USD' ? loc.currency(c.benchmark_value) : c.benchmark_value.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {c.difference !== null ? (
                              <span className={clsx('flex items-center justify-end gap-0.5 font-medium',
                                c.difference > 0 ? 'text-green-600' : c.difference < 0 ? 'text-red-600' : 'text-gray-500'
                              )}>
                                {c.difference > 0 ? <ArrowTrendingUpIcon className="w-3.5 h-3.5" /> :
                                 c.difference < 0 ? <ArrowTrendingDownIcon className="w-3.5 h-3.5" /> :
                                 <MinusIcon className="w-3.5 h-3.5" />}
                                {c.unit === 'USD' ? loc.currency(Math.abs(c.difference)) : Math.abs(c.difference).toLocaleString()}
                              </span>
                            ) : '--'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {c.difference_pct !== null ? (
                              <span className={clsx('font-medium',
                                c.difference_pct > 0 ? 'text-green-600' : c.difference_pct < 0 ? 'text-red-600' : 'text-gray-500'
                              )}>
                                {c.difference_pct > 0 ? '+' : ''}{c.difference_pct.toFixed(1)}%
                              </span>
                            ) : '--'}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{c.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="card-header">Import Benchmarks from CSV</h3>
            <p className="text-sm text-gray-500 mb-4">
              Upload a CSV file with columns: <code className="bg-gray-100 px-1 rounded text-xs">metric_name, metric_value</code> (required),
              and optionally: <code className="bg-gray-100 px-1 rounded text-xs">name, category, unit, source, year, region, industry</code>
            </p>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors">
              <ArrowUpTrayIcon className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <label className="btn-primary inline-flex items-center gap-1.5 cursor-pointer text-sm">
                <ArrowUpTrayIcon className="w-4 h-4" />
                Select CSV File
                <input type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />
              </label>
              <p className="text-xs text-gray-400 mt-2">CSV files only, max 10MB</p>
            </div>

            {csvPreview && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Preview ({csvPreview.length} rows)</h4>
                <div className="overflow-auto max-h-[300px] border rounded">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {Object.keys(csvPreview[0] || {}).map(col => (
                          <th key={col} className="px-3 py-2 text-left font-medium text-gray-500">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {csvPreview.slice(0, 10).map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((val, j) => (
                            <td key={j} className="px-3 py-1.5 text-gray-600">{String(val ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    className="btn-primary text-sm"
                    onClick={() => {
                      // Reconstruct file from preview and upload
                      const csv = Papa.unparse(csvPreview)
                      const blob = new Blob([csv], { type: 'text/csv' })
                      const file = new File([blob], 'benchmarks.csv', { type: 'text/csv' })
                      csvImportMutation.mutate(file)
                    }}
                    disabled={csvImportMutation.isPending}
                  >
                    {csvImportMutation.isPending ? 'Importing...' : `Import ${csvPreview.length} Benchmarks`}
                  </button>
                  <button className="btn-secondary text-sm" onClick={() => setCsvPreview(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Example CSV format */}
          <div className="card bg-gray-50">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Example CSV Format</h4>
            <pre className="text-xs text-gray-600 bg-white rounded p-3 border overflow-x-auto">
{`name,category,metric_name,metric_value,unit,source,year,region,industry
Tech Salaries 2025,compensation,avg_salary_engineering,145000,USD,Radford Survey,2025,US,Technology
Tech Retention 2025,retention,avg_retention_rate,88.5,percent,Industry Report,2025,US,Technology
Tech Hiring 2025,recruitment,avg_cost_per_hire,15000,USD,SHRM Benchmarks,2025,US,Technology`}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
