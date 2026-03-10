import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useStore } from '../store'
import {
  BookmarkIcon,
  XMarkIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import api from '../api'
import {
  SqlEditor,
  QueryResults,
  SchemaExplorer,
  SavedQueries,
  QueryHistory,
} from '../components/query'

const METRIC_CATEGORIES = ['HR', 'Retention', 'Recruitment', 'Engagement', 'Compensation', 'Diversity', 'Performance', 'Attendance', 'Custom']

interface SaveQueryModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { name: string; description: string; tags: string[]; is_public: boolean }) => void
  isSaving: boolean
  sql: string
}

function SaveQueryModal({ isOpen, onClose, onSave, isSaving, sql }: SaveQueryModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [isPublic, setIsPublic] = useState(false)

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Please enter a query name')
      return
    }
    onSave({
      name: name.trim(),
      description: description.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      is_public: isPublic,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Save Query</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Query Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Headcount by Department"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this query do?"
                rows={2}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., headcount, hr, reporting"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_public"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <label htmlFor="is_public" className="text-sm text-gray-700">
                Share with organization
              </label>
            </div>

            <div className="bg-gray-50 rounded-md p-3">
              <p className="text-xs text-gray-500 mb-1">Query Preview:</p>
              <code className="text-xs text-gray-700 font-mono break-all">
                {sql.slice(0, 200)}{sql.length > 200 && '...'}
              </code>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary"
            >
              {isSaving ? 'Saving...' : 'Save Query'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function QueryEditor() {
  const queryClient = useQueryClient()
  const [sql, setSql] = useState('SELECT * FROM employees LIMIT 10')
  const [results, setResults] = useState<any>(null)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showMetricModal, setShowMetricModal] = useState(false)
  const [newMetric, setNewMetric] = useState({ name: '', category: 'Custom', formula: '', description: '' })
  const [savedQueryIdForMetric, setSavedQueryIdForMetric] = useState<string | null>(null)

  // Fetch schema
  const { data: schemaData, isLoading: schemaLoading } = useQuery({
    queryKey: ['querySchema'],
    queryFn: async () => {
      const response = await api.get('/queries/schema')
      return response.data.schema
    },
  })

  // Fetch saved queries
  const { data: savedQueriesData, isLoading: queriesLoading } = useQuery({
    queryKey: ['savedQueries'],
    queryFn: async () => {
      const response = await api.get('/queries')
      return response.data.queries
    },
  })

  // Fetch history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['queryHistory'],
    queryFn: async () => {
      const response = await api.get('/queries/history?limit=20')
      return response.data.history
    },
  })

  // Execute query mutation
  const executeMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await api.post('/queries/execute', { sql: query })
      return response.data
    },
    onSuccess: (data) => {
      setResults(data)
      queryClient.invalidateQueries({ queryKey: ['queryHistory'] })
      if (data.success) {
        toast.success(`Query completed: ${data.row_count} rows in ${data.execution_time_ms}ms`)
      }
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to execute query'
      toast.error(errorMsg)
      setResults({
        success: false,
        error: errorMsg,
        error_type: 'request',
      })
    },
  })

  // Create metric mutation
  const createMetricMutation = useMutation({
    mutationFn: async (data: { name: string; category: string; formula: string; description?: string; sql_expression?: string; saved_query_id?: string | null }) => {
      const res = await api.post('/metrics/definitions', data)
      return res.data
    },
    onSuccess: () => {
      toast.success('Metric definition created')
      queryClient.invalidateQueries({ queryKey: ['savedQueries'] })
      setShowMetricModal(false)
      setNewMetric({ name: '', category: 'Custom', formula: '', description: '' })
      setSavedQueryIdForMetric(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to create metric')
    },
  })

  // Save query mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; sql: string; description?: string; tags?: string[]; is_public: boolean }) => {
      const response = await api.post('/queries', data)
      return response.data
    },
    onSuccess: (data) => {
      toast.success('Query saved')
      setShowSaveModal(false)
      queryClient.invalidateQueries({ queryKey: ['savedQueries'] })
      // Remember the saved query ID for optional metric creation
      if (data.query?.id) setSavedQueryIdForMetric(data.query.id)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to save query')
    },
  })

  // Delete query mutation
  const deleteMutation = useMutation({
    mutationFn: async (queryId: string) => {
      await api.delete(`/queries/${queryId}`)
    },
    onSuccess: () => {
      toast.success('Query deleted')
      queryClient.invalidateQueries({ queryKey: ['savedQueries'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete query')
    },
  })

  const handleExecute = useCallback(() => {
    if (!sql.trim()) {
      toast.error('Please enter a query')
      return
    }
    executeMutation.mutate(sql)
  }, [sql, executeMutation])

  const handleInsertFromSchema = useCallback((text: string) => {
    setSql((prev) => prev + text)
  }, [])

  const handleLoadQuery = useCallback((query: any) => {
    setSql(query.sql_query)
    toast.success(`Loaded: ${query.name}`)
  }, [])

  const handleSaveQuery = useCallback(
    (data: { name: string; description: string; tags: string[]; is_public: boolean }) => {
      saveMutation.mutate({
        name: data.name,
        sql: sql,
        description: data.description || undefined,
        tags: data.tags.length > 0 ? data.tags : undefined,
        is_public: data.is_public,
      })
    },
    [sql, saveMutation]
  )

  const currentUser = useStore((s) => s.user)
  const currentUserId = currentUser?.id ?? ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SQL Editor</h1>
          <p className="text-gray-600 mt-1">
            Run read-only queries against your HR data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowMetricModal(true); setSavedQueryIdForMetric(null) }}
            disabled={!sql.trim()}
            className="btn-secondary inline-flex items-center gap-2"
            title="Create a metric definition backed by this SQL"
          >
            <ChartBarIcon className="w-4 h-4" />
            Create Metric
          </button>
          <button
            onClick={() => setShowSaveModal(true)}
            disabled={!sql.trim()}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <BookmarkIcon className="w-4 h-4" />
            Save Query
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left sidebar - Schema & Saved Queries */}
        <div className="col-span-3 space-y-6">
          <SchemaExplorer
            schema={schemaData || {}}
            onInsert={handleInsertFromSchema}
            isLoading={schemaLoading}
          />
          <SavedQueries
            queries={savedQueriesData || []}
            currentUserId={currentUserId}
            onLoad={handleLoadQuery}
            onDelete={(id) => deleteMutation.mutate(id)}
            isLoading={queriesLoading}
          />
        </div>

        {/* Main content */}
        <div className="col-span-6 space-y-6">
          <SqlEditor
            value={sql}
            onChange={setSql}
            onExecute={handleExecute}
            isExecuting={executeMutation.isPending}
            schema={schemaData}
          />

          <QueryResults
            results={results}
            isLoading={executeMutation.isPending}
          />
        </div>

        {/* Right sidebar - History */}
        <div className="col-span-3">
          <QueryHistory
            history={historyData || []}
            onRerun={setSql}
            isLoading={historyLoading}
          />
        </div>
      </div>

      {/* Save Modal */}
      <SaveQueryModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveQuery}
        isSaving={saveMutation.isPending}
        sql={sql}
      />

      {/* Create Metric from Query Modal */}
      {showMetricModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Create Metric Definition</h2>
              <button onClick={() => setShowMetricModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Create a metric definition backed by the current SQL. The query result (first cell) will be used as the metric value.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Metric Name *</label>
                <input
                  type="text"
                  value={newMetric.name}
                  onChange={e => setNewMetric(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Active Employee Count"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={newMetric.category}
                  onChange={e => setNewMetric(p => ({ ...p, category: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                >
                  {METRIC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Formula label</label>
                <input
                  type="text"
                  value={newMetric.formula}
                  onChange={e => setNewMetric(p => ({ ...p, formula: e.target.value }))}
                  placeholder="e.g. COUNT(active employees)"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newMetric.description}
                  onChange={e => setNewMetric(p => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="bg-gray-50 rounded-md p-3">
                <p className="text-xs text-gray-500 mb-1">SQL to use:</p>
                <code className="text-xs text-gray-700 font-mono break-all">{sql.slice(0, 200)}{sql.length > 200 && '...'}</code>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowMetricModal(false)} className="btn-secondary">Cancel</button>
              <button
                disabled={!newMetric.name || createMetricMutation.isPending}
                onClick={() => createMetricMutation.mutate({
                  name: newMetric.name,
                  category: newMetric.category,
                  formula: newMetric.formula || newMetric.name,
                  description: newMetric.description || undefined,
                  sql_expression: sql,
                  saved_query_id: savedQueryIdForMetric,
                })}
                className="btn-primary"
              >
                {createMetricMutation.isPending ? 'Creating...' : 'Create Metric'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
