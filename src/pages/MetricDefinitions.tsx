import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PlusIcon,
  PencilSquareIcon,
  FunnelIcon,
  ArrowPathIcon,
  BoltIcon,
  LinkIcon,
} from '@heroicons/react/24/outline'
import Editor from '@monaco-editor/react'
import toast from 'react-hot-toast'
import api from '../api'

interface MetricDefinition {
  id: string
  name: string
  category: string
  formula: string
  sql_expression?: string
  source_fields?: string[]
  description?: string
  is_system: boolean
  is_active: boolean
  saved_query_id?: string | null
  created_at?: string
  updated_at?: string
}

interface SavedQuery {
  id: string
  name: string
  description?: string
  sql_query: string
  tags?: string[]
}

const CATEGORIES = [
  'All',
  'HR',
  'Retention',
  'Recruitment',
  'Engagement',
  'Compensation',
  'Diversity',
  'Performance',
  'Attendance',
  'Custom',
]

export default function MetricDefinitions() {
  const queryClient = useQueryClient()
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingMetric, setEditingMetric] = useState<MetricDefinition | null>(null)
  const [editSql, setEditSql] = useState('')
  const [editSourceFields, setEditSourceFields] = useState('')
  const [editSavedQueryId, setEditSavedQueryId] = useState<string>('')

  // Live calculation state: metric id → {loading, value, error}
  const [calcStates, setCalcStates] = useState<Record<string, { loading: boolean; value: unknown; error?: string }>>({})

  // New metric state
  const [newMetric, setNewMetric] = useState({
    name: '',
    category: 'Custom',
    formula: '',
    sql_expression: '',
    source_fields: '',
    description: '',
    saved_query_id: '',
  })

  // Fetch metric definitions
  const { data: metrics, isLoading, refetch } = useQuery({
    queryKey: ['metricDefinitions'],
    queryFn: async () => {
      const res = await api.get('/metrics/definitions')
      const d = res.data
      const data = d.data || d.definitions || (Array.isArray(d) ? d : [])
      return data as MetricDefinition[]
    },
  })

  // Fetch saved queries for the picker
  const { data: savedQueries } = useQuery({
    queryKey: ['savedQueries'],
    queryFn: async () => {
      const res = await api.get('/queries')
      return (res.data.queries || []) as SavedQuery[]
    },
  })

  // Update metric mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; sql_expression?: string; source_fields?: string[]; formula?: string; saved_query_id?: string | null }) => {
      const { id, ...updates } = data
      const res = await api.put(`/metrics/definitions/${id}`, updates)
      return res.data
    },
    onSuccess: () => {
      toast.success('Metric definition updated.')
      queryClient.invalidateQueries({ queryKey: ['metricDefinitions'] })
      setShowEditModal(false)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to update metric')
    },
  })

  // Create metric mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; category: string; formula: string; sql_expression?: string; source_fields?: string[]; description?: string; saved_query_id?: string | null }) => {
      const res = await api.post('/metrics/definitions', data)
      return res.data
    },
    onSuccess: () => {
      toast.success('Custom metric created')
      queryClient.invalidateQueries({ queryKey: ['metricDefinitions'] })
      queryClient.invalidateQueries({ queryKey: ['savedQueries'] })
      setShowCreateModal(false)
      setNewMetric({ name: '', category: 'Custom', formula: '', sql_expression: '', source_fields: '', description: '', saved_query_id: '' })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to create metric')
    },
  })

  // Seed metrics mutation
  const seedMutation = useMutation({
    mutationFn: async () => {
      await api.get('/metrics/definitions')
    },
    onSuccess: () => {
      toast.success('System metrics initialized')
      queryClient.invalidateQueries({ queryKey: ['metricDefinitions'] })
    },
  })

  const filteredMetrics = useMemo(() => {
    if (!metrics) return []
    if (categoryFilter === 'All') return metrics
    return metrics.filter(m => m.category.toLowerCase() === categoryFilter.toLowerCase())
  }, [metrics, categoryFilter])

  const handleEdit = (metric: MetricDefinition) => {
    setEditingMetric(metric)
    setEditSql(metric.sql_expression || '')
    setEditSourceFields(metric.source_fields?.join(', ') || '')
    setEditSavedQueryId(metric.saved_query_id || '')
    setShowEditModal(true)
  }

  const handleEditQuerySelect = (queryId: string) => {
    setEditSavedQueryId(queryId)
    if (queryId && savedQueries) {
      const q = savedQueries.find(sq => sq.id === queryId)
      if (q) setEditSql(q.sql_query)
    }
  }

  const handleNewQuerySelect = (queryId: string) => {
    setNewMetric(p => ({ ...p, saved_query_id: queryId }))
    if (queryId && savedQueries) {
      const q = savedQueries.find(sq => sq.id === queryId)
      if (q) setNewMetric(p => ({ ...p, sql_expression: q.sql_query }))
    }
  }

  const handleSaveEdit = () => {
    if (!editingMetric) return
    updateMutation.mutate({
      id: editingMetric.id,
      sql_expression: editSql || undefined,
      source_fields: editSourceFields ? editSourceFields.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      saved_query_id: editSavedQueryId || null,
    })
  }

  const handleCreate = () => {
    createMutation.mutate({
      name: newMetric.name,
      category: newMetric.category,
      formula: newMetric.formula,
      sql_expression: newMetric.sql_expression || undefined,
      source_fields: newMetric.source_fields ? newMetric.source_fields.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      description: newMetric.description || undefined,
      saved_query_id: newMetric.saved_query_id || null,
    })
  }

  const handleCalculate = async (metricId: string) => {
    setCalcStates(prev => ({ ...prev, [metricId]: { loading: true, value: null } }))
    try {
      const res = await api.get(`/metrics/definitions/${metricId}/calculate`)
      const { value, error } = res.data
      setCalcStates(prev => ({ ...prev, [metricId]: { loading: false, value, error } }))
    } catch (e: any) {
      const msg = e.response?.data?.error || e.message || 'Calculation failed'
      setCalcStates(prev => ({ ...prev, [metricId]: { loading: false, value: null, error: msg } }))
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-500',
    }
    return styles[status] || 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Metric Config</h1>
          <p className="text-sm text-gray-500 mt-1">View and customize how metrics are calculated. Link saved SQL queries to override built-in formulas.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Add Custom Metric
          </button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-3">
        <FunnelIcon className="h-4 w-4 text-gray-400" />
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {metrics && (
          <span className="text-sm text-gray-400">{filteredMetrics.length} metrics</span>
        )}
      </div>

      {/* Metrics Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="animate-pulse bg-gray-100 rounded h-10" />
            ))}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metric</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Formula / SQL</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Live Value</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredMetrics.map(metric => {
                const cs = calcStates[metric.id]
                const hasSql = !!(metric.sql_expression)
                return (
                  <tr key={metric.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{metric.name}</p>
                        {metric.description && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{metric.description}</p>
                        )}
                        {metric.saved_query_id && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 mt-0.5">
                            <LinkIcon className="h-3 w-3" /> Linked query
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium capitalize">{metric.category}</span>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded font-mono max-w-md truncate block">
                        {metric.sql_expression ? `SQL: ${metric.sql_expression.slice(0, 60)}…` : (metric.formula || '--')}
                      </code>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {cs?.loading ? (
                        <span className="text-xs text-gray-400">Calculating…</span>
                      ) : cs?.error ? (
                        <span className="text-xs text-red-500" title={cs.error}>Error</span>
                      ) : cs?.value !== undefined && cs.value !== null ? (
                        <span className="text-sm font-semibold text-indigo-700">{typeof cs.value === 'number' ? cs.value.toLocaleString() : String(cs.value)}</span>
                      ) : hasSql ? (
                        <button
                          onClick={() => handleCalculate(metric.id)}
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          <BoltIcon className="h-3 w-3" /> Calculate
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(metric.is_active ? 'active' : 'inactive')}`}>
                        {metric.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleEdit(metric)}
                        className="text-gray-400 hover:text-indigo-600 transition-colors"
                        title="Edit"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filteredMetrics.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="text-sm text-gray-500 mb-4">No metrics found</p>
                    <button
                      onClick={() => seedMutation.mutate()}
                      disabled={seedMutation.isPending}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <ArrowPathIcon className={`h-4 w-4 ${seedMutation.isPending ? 'animate-spin' : ''}`} />
                      Initialize System Metrics
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Metric Modal */}
      {showEditModal && editingMetric && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Edit Metric: {editingMetric.name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {editingMetric.is_system ? 'System metric — you can override with SQL' : 'Custom metric — all fields are editable'}
                </p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 text-sm">Close</button>
            </div>

            <div className="space-y-4">
              {/* Standard formula reference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Standard Formula (Reference)</label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-600 italic">
                  {editingMetric.formula || '--'}
                </div>
                <p className="text-[10px] text-gray-400 mt-1 uppercase">Used when no SQL override is set.</p>
              </div>

              {/* Source Query picker */}
              {savedQueries && savedQueries.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <LinkIcon className="h-4 w-4 inline mr-1 text-indigo-500" />
                    Link Saved Query
                  </label>
                  <select
                    value={editSavedQueryId}
                    onChange={e => handleEditQuerySelect(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">— None (write SQL manually) —</option>
                    {savedQueries.map(q => (
                      <option key={q.id} value={q.id}>{q.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">Selecting a query will populate the SQL below. Changes to the SQL below are independent of the saved query.</p>
                </div>
              )}

              {/* SQL Expression */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom SQL Override</label>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <Editor
                    height="200px"
                    defaultLanguage="sql"
                    value={editSql}
                    onChange={(val) => setEditSql(val || '')}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      readOnly: false,
                    }}
                    theme="vs-light"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 uppercase">Must return a single numeric value. Click "Calculate" on the list to verify.</p>
              </div>

              {/* Source Fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Fields <span className="text-gray-400">(comma-separated)</span></label>
                <input
                  type="text"
                  value={editSourceFields}
                  onChange={e => setEditSourceFields(e.target.value)}
                  placeholder="e.g. employees.status, employees.termination_date"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={handleSaveEdit}
                disabled={updateMutation.isPending}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Custom Metric Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Custom Metric</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 text-sm">Close</button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={newMetric.name}
                    onChange={e => setNewMetric(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Voluntary Attrition Rate"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={newMetric.category}
                    onChange={e => setNewMetric(p => ({ ...p, category: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newMetric.description}
                  onChange={e => setNewMetric(p => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description of what this metric measures"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Formula *</label>
                <input
                  type="text"
                  value={newMetric.formula}
                  onChange={e => setNewMetric(p => ({ ...p, formula: e.target.value }))}
                  placeholder="e.g. voluntary_terms_12m / (active + voluntary_terms_12m) * 100"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Source Query picker */}
              {savedQueries && savedQueries.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <LinkIcon className="h-4 w-4 inline mr-1 text-indigo-500" />
                    Start from Saved Query <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <select
                    value={newMetric.saved_query_id}
                    onChange={e => handleNewQuerySelect(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">— Select a saved query —</option>
                    {savedQueries.map(q => (
                      <option key={q.id} value={q.id}>{q.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SQL Expression <span className="text-gray-400 font-normal">(optional override)</span></label>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <Editor
                    height="200px"
                    defaultLanguage="sql"
                    value={newMetric.sql_expression}
                    onChange={(val) => setNewMetric(p => ({ ...p, sql_expression: val || '' }))}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                    }}
                    theme="vs-light"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">If provided, this SQL overrides the formula above. Must return a single scalar value.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Fields <span className="text-gray-400">(comma-separated)</span></label>
                <input
                  type="text"
                  value={newMetric.source_fields}
                  onChange={e => setNewMetric(p => ({ ...p, source_fields: e.target.value }))}
                  placeholder="e.g. employees.status, employees.termination_date"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={!newMetric.name || !newMetric.formula || createMutation.isPending}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Metric'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
