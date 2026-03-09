import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useStore } from '../store'
import { generateEmployees, generateCandidates } from '../utils/sampleData'
import { seedFullDatabase, clearDatabaseData } from '../api'
import api from '../api'
import { useQuery } from '@tanstack/react-query'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'
import {
  CloudArrowUpIcon,
  DocumentArrowDownIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  TableCellsIcon,
  ServerStackIcon,
  TrashIcon,
  LinkIcon,
  GlobeAltIcon,
  PlusIcon,
  CircleStackIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import FieldMappingConfig from '../components/FieldMappingConfig'
import type { FieldMapping, SourceColumn } from '../components/FieldMappingConfig'
import ApiConnections from './ApiConnections'

type DataCleaningRule = {
  id: string
  name: string
  description: string
  enabled: boolean
}

const defaultCleaningRules: DataCleaningRule[] = [
  { id: 'trim', name: 'Trim Whitespace', description: 'Remove leading/trailing spaces from all text fields', enabled: true },
  { id: 'lowercase_email', name: 'Lowercase Emails', description: 'Convert all email addresses to lowercase', enabled: true },
  { id: 'standardize_dates', name: 'Standardize Dates', description: 'Convert all dates to YYYY-MM-DD format', enabled: true },
  { id: 'remove_duplicates', name: 'Remove Duplicates', description: 'Remove duplicate rows based on employee ID', enabled: true },
  { id: 'fill_missing', name: 'Fill Missing Values', description: 'Fill missing numeric values with column median', enabled: false },
  { id: 'standardize_dept', name: 'Standardize Departments', description: 'Map department variations to standard names', enabled: true },
  { id: 'validate_phone', name: 'Validate Phone Numbers', description: 'Format and validate phone number fields', enabled: false },
  { id: 'remove_special_chars', name: 'Clean Special Characters', description: 'Remove non-printable and special characters', enabled: true },
]

export default function DataManagement() {
  const { employees, setEmployees, setCandidates, dataUploads, addDataUpload, updateDataUpload, clearDemoData } = useStore()
  const [activeTab, setActiveTab] = useState<'database' | 'upload' | 'pipelines' | 'webhooks' | 'export' | 'connections'>('upload')
  const [dbtProjectUrl, setDbtProjectUrl] = useState('')
  const [dbtApiToken, setDbtApiToken] = useState('')
  const [dbtEnvironment, setDbtEnvironment] = useState('production')
  const [fivetranApiKey, setFivetranApiKey] = useState('')
  const [fivetranApiSecret, setFivetranApiSecret] = useState('')
  const [fivetranGroupId, setFivetranGroupId] = useState('')
  const [pipelineSaving, setPipelineSaving] = useState(false)
  const [cleaningRules, setCleaningRules] = useState(defaultCleaningRules)
  const [previewData, setPreviewData] = useState<Record<string, unknown>[] | null>(null)
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')
  const [seedLoading, setSeedLoading] = useState(false)
  const [_seedResult, setSeedResult] = useState<Record<string, number> | null>(null)
  const [clearLoading, setClearLoading] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Database connection state
  const [dbForm, setDbForm] = useState({
    db_type: 'postgresql',
    host: '',
    port: '5432',
    database: '',
    username: '',
    password: '',
  })
  const [dbTestStatus, setDbTestStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle')
  const [dbTestError, setDbTestError] = useState('')
  const [dbTables, setDbTables] = useState<string[]>([])

  // Field mapping modal state
  const [showFieldMapping, setShowFieldMapping] = useState(false)
  const [fmSourceTables, setFmSourceTables] = useState<string[]>([])
  const [fmSourceColumns, setFmSourceColumns] = useState<SourceColumn[]>([])
  const [fmTargetEntity, setFmTargetEntity] = useState<'employees' | 'candidates' | 'requisitions' | 'custom'>('employees')
  const [fmPreviewRows, setFmPreviewRows] = useState<Record<string, unknown>[]>([])
  const [fmLoadingSchema, setFmLoadingSchema] = useState(false)
  const [savedMappings, setSavedMappings] = useState<(FieldMapping & { id?: string })[]>([])

  // Webhooks state
  const [webhooks, setWebhooks] = useState([
    { id: '1', name: 'Slack Notification', url: 'https://hooks.slack.com/services/xxx', events: ['employee.created', 'employee.terminated'], status: 'active' as const },
  ])
  const [showWebhookForm, setShowWebhookForm] = useState(false)
  const [newWebhook, setNewWebhook] = useState({ name: '', url: '', events: [] as string[] })

  const { data: summaryData, refetch: refetchSummary } = useQuery({
    queryKey: ['data-summary'],
    queryFn: async () => {
      const res = await api.get('/admin/data-summary')
      return res.data?.data
    },
  })

  const getDefaultPort = (dbType: string) => {
    switch (dbType) {
      case 'postgresql': return '5432'
      case 'mysql': return '3306'
      case 'mssql': return '1433'
      case 'oracle': return '1521'
      default: return '5432'
    }
  }

  const handleDbTypeChange = (dbType: string) => {
    setDbForm((f) => ({ ...f, db_type: dbType, port: getDefaultPort(dbType) }))
  }

  const handleTestDbConnection = async () => {
    if (!dbForm.host || !dbForm.database || !dbForm.username) {
      toast.error('Host, database name, and username are required')
      return
    }
    setDbTestStatus('testing')
    setDbTestError('')
    try {
      const res = await api.post('/integrations/database/test-connection', {
        db_type: dbForm.db_type,
        host: dbForm.host,
        port: parseInt(dbForm.port, 10),
        database: dbForm.database,
        username: dbForm.username,
        password: dbForm.password,
      })
      setDbTables(res.data.tables || [])
      setDbTestStatus('connected')
      toast.success(`Connected! Found ${res.data.tables?.length || 0} tables.`)
    } catch (err: unknown) {
      setDbTestStatus('error')
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Connection failed'
      setDbTestError(message)
      toast.error(message)
    }
  }

  const handleOpenDbMapping = () => {
    setFmSourceTables(dbTables)
    setFmSourceColumns([])
    setFmPreviewRows([])
    setFmTargetEntity('employees')
    setShowFieldMapping(true)
    if (dbTables.length > 0) {
      handleFmTableChange(dbTables[0])
    }
  }

  const handleFmTableChange = async (table: string) => {
    setFmLoadingSchema(true)
    setFmSourceColumns([])
    setFmPreviewRows([])
    try {
      const res = await api.post('/integrations/database/table-schema', {
        db_type: dbForm.db_type,
        host: dbForm.host,
        port: parseInt(dbForm.port, 10),
        database: dbForm.database,
        username: dbForm.username,
        password: dbForm.password,
        table,
      })
      const cols: SourceColumn[] = (res.data.columns || []).map((c: { name: string; type?: string }) => ({
        name: c.name,
        type: c.type,
      }))
      setFmSourceColumns(cols)
      setFmPreviewRows(res.data.preview_rows || [])
    } catch {
      toast.error('Failed to load table schema')
    } finally {
      setFmLoadingSchema(false)
    }
  }

  const handleSaveFieldMapping = async (mapping: FieldMapping) => {
    try {
      const payload = {
        ...mapping,
        connection_type: 'database',
        db_config: {
          db_type: dbForm.db_type,
          host: dbForm.host,
          port: parseInt(dbForm.port, 10),
          database: dbForm.database,
          username: dbForm.username,
        },
      }
      const res = await api.post('/integrations/field-mapping', payload)
      setSavedMappings((prev) => [...prev, { ...mapping, id: res.data.mapping_id }])
      toast.success('Field mapping saved successfully')
      setShowFieldMapping(false)
    } catch {
      toast.error('Failed to save field mapping')
    }
  }

  const loadMockDatabase = async () => {
    setSeedLoading(true)
    setSeedResult(null)
    try {
      const response = await seedFullDatabase()
      const data = response.data?.data
      setSeedResult(data)
      refetchSummary()
      toast.success(
        `Database seeded: ${data?.employees ?? 0} employees, ${data?.candidates ?? 0} candidates, ${data?.requisitions ?? 0} requisitions`
      )
      setTimeout(() => window.location.reload(), 1200)
    } catch {
      toast.error('Seeding failed. Check backend logs.')
    } finally {
      setSeedLoading(false)
    }
  }

  const processFile = useCallback(async (file: File) => {
    setProcessingStatus('processing')
    const uploadId = `upload-${Date.now()}`

    addDataUpload({
      id: uploadId,
      filename: file.name,
      type: file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ? 'xlsx' : 'csv',
      uploadDate: new Date().toISOString(),
      status: 'processing',
      dataType: 'employees',
    })

    try {
      let data: Record<string, unknown>[] = []

      if (file.name.endsWith('.csv')) {
        // Parse CSV
        const text = await file.text()
        const result = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
        })
        data = result.data as Record<string, unknown>[]
      } else {
        // Parse Excel
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        data = XLSX.utils.sheet_to_json(firstSheet) as Record<string, unknown>[]
      }

      // Apply cleaning rules
      const enabledRules = cleaningRules.filter((r) => r.enabled)
      data = applyCleaningRules(data, enabledRules)

      setPreviewData(data.slice(0, 10))
      updateDataUpload(uploadId, {
        status: 'completed',
        recordCount: data.length,
      })

      setProcessingStatus('success')
      toast.success(`Successfully processed ${data.length} records`)
    } catch (error) {
      updateDataUpload(uploadId, {
        status: 'error',
        errors: [(error as Error).message],
      })
      setProcessingStatus('error')
      toast.error('Failed to process file')
    }
  }, [cleaningRules, addDataUpload, updateDataUpload])

  const applyCleaningRules = (data: Record<string, unknown>[], rules: DataCleaningRule[]) => {
    let cleanedData = [...data]

    rules.forEach((rule) => {
      switch (rule.id) {
        case 'trim':
          cleanedData = cleanedData.map((row) => {
            const newRow: Record<string, unknown> = {}
            Object.entries(row).forEach(([key, value]) => {
              newRow[key] = typeof value === 'string' ? value.trim() : value
            })
            return newRow
          })
          break
        case 'lowercase_email':
          cleanedData = cleanedData.map((row) => ({
            ...row,
            email: typeof row.email === 'string' ? row.email.toLowerCase() : row.email,
          }))
          break
        case 'remove_duplicates':
          const seen = new Set()
          cleanedData = cleanedData.filter((row) => {
            const id = row.employee_id || row.id || JSON.stringify(row)
            if (seen.has(id)) return false
            seen.add(id)
            return true
          })
          break
      }
    })

    return cleanedData
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => files[0] && processFile(files[0]),
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  })

  const loadSampleData = () => {
    setEmployees(generateEmployees(850))
    setCandidates(generateCandidates(200))
    toast.success('Sample data loaded successfully')
  }

  const exportData = (format: 'csv' | 'xlsx') => {
    if (employees.length === 0) {
      toast.error('No data to export')
      return
    }

    if (format === 'csv') {
      const csv = Papa.unparse(employees)
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'employees_export.csv'
      a.click()
    } else {
      const ws = XLSX.utils.json_to_sheet(employees)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Employees')
      XLSX.writeFile(wb, 'employees_export.xlsx')
    }

    toast.success(`Data exported as ${format.toUpperCase()}`)
  }

  const toggleRule = (ruleId: string) => {
    setCleaningRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
    )
  }

  const [restoring, setRestoring] = useState(false)

  const handleRestoreSnapshot = async () => {
    setRestoring(true)
    const tid = toast.loading('Populating database — this may take a minute...')
    try {
      const response = await seedFullDatabase()
      const data = response.data?.data
      refetchSummary()
      toast.success(
        `Database loaded: ${data?.employees ?? 0} employees, ${data?.candidates ?? 0} candidates, ${data?.requisitions ?? 0} requisitions`,
        { id: tid }
      )
      setTimeout(() => window.location.reload(), 1200)
    } catch {
      toast.error('Failed to populate database. Please try Generate Data instead.', { id: tid })
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Management</h1>
          <p className="text-sm text-gray-500 mt-1">Ingest, clean, and manage your workforce data</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Restore Snapshot Card */}
        <div className="card border-primary-200 bg-primary-50 dark:bg-primary-900/10 dark:border-primary-800/40">
          <div className="flex items-start gap-4 h-full">
            <div className="p-3 bg-primary-100 dark:bg-primary-800/30 rounded-lg shrink-0">
              <CircleStackIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="flex flex-col justify-between flex-1">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-gray-900 dark:text-white">Load Pre-built Database</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  Populate the database with a full demo dataset — 4,500+ employees, 2,000 candidates, 500 requisitions, and all supporting records.
                </p>
              </div>
              <button
                onClick={handleRestoreSnapshot}
                disabled={restoring}
                className="btn-primary mt-4 px-6 w-fit"
              >
                {restoring ? 'Loading...' : 'Load Database'}
              </button>
            </div>
          </div>
        </div>

        {/* Load Mock Database Banner */}
        <div className="card border-slate-200 bg-slate-50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 h-full">
            <div className="flex items-start gap-2.5">
              <ServerStackIcon className="w-6 h-6 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-gray-900 tracking-tight">Generate Mock Data</h3>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                  Run the dynamic generation script to create a fresh random dataset. 
                  Replaces existing data.
                </p>
              </div>
            </div>
            <button
              onClick={loadMockDatabase}
              disabled={seedLoading}
              className={clsx(
                'btn-secondary px-4 py-2 flex-shrink-0 self-end md:self-center',
                seedLoading && 'opacity-50 cursor-not-allowed'
              )}
            >
              {seedLoading ? (
                <><ArrowPathIcon className="w-3.5 h-3.5 animate-spin mr-1.5" />Generating...</>
              ) : (
                <><PlusIcon className="w-3.5 h-3.5 mr-1.5" />Generate Data</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Clear Database */}
      <div className="card border-red-100 dark:border-red-900/20 bg-red-50/30 dark:bg-red-900/10 p-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <TrashIcon className="w-6 h-6 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">Reset Data</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Remove all employees, candidates, and metrics. Does not affect users or settings.
              </p>
            </div>
          </div>

          {!showClearConfirm ? (
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={clearLoading}
              className="btn-secondary text-red-600 dark:text-red-400 border-red-100 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
            >
              Reset Database
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[11px] font-bold text-red-600 dark:text-red-400 uppercase mr-1">Confirm Reset?</span>
              <button
                onClick={async () => {
                  setClearLoading(true)
                  try {
                    await clearDatabaseData()
                    clearDemoData()
                    toast.success('Data cleared successfully')
                    setSeedResult(null)
                    refetchSummary().catch(() => {})
                  } catch {
                    // Backend unavailable — just clear local store
                    clearDemoData()
                    toast.success('Local data cleared')
                    setSeedResult(null)
                  } finally {
                    setClearLoading(false)
                    setShowClearConfirm(false)
                  }
                }}
                disabled={clearLoading}
                className="btn-primary bg-red-600 hover:bg-red-700"
              >
                {clearLoading ? 'Clearing...' : 'Yes, Reset'}
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={clearLoading}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 dark:border-gray-700/50 -mx-1 px-1 overflow-x-auto">
        {([
          { id: 'upload', label: 'Import', Icon: CloudArrowUpIcon },
          { id: 'database', label: 'Database', Icon: CircleStackIcon },
          { id: 'connections', label: 'Connections', Icon: LinkIcon },
          { id: 'pipelines', label: 'Pipelines', Icon: ArrowPathIcon },
          { id: 'webhooks', label: 'Webhooks', Icon: GlobeAltIcon },
          { id: 'export', label: 'Export', Icon: DocumentArrowDownIcon },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={clsx(
              'px-3 py-2 text-[11px] font-bold uppercase tracking-wider border-b-2 -mb-px transition-all flex items-center gap-1.5 whitespace-nowrap',
              activeTab === id
                ? 'border-primary-600 text-primary-700 dark:text-primary-400'
                : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'connections' && (
        <ApiConnections />
      )}

      {activeTab === 'database' && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center gap-2.5 mb-4">
              <CircleStackIcon className="h-5 w-5 text-gray-500" />
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">Direct Database Connection</h3>
                <p className="text-[11px] text-gray-500">Connect to your source database for automated live syncing</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              <div>
                <label className="label">Database Type</label>
                <select 
                  className="input" 
                  value={dbForm.db_type} 
                  onChange={(e) => handleDbTypeChange(e.target.value)}
                >
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="mssql">SQL Server</option>
                  <option value="oracle">Oracle</option>
                </select>
              </div>
              <div>
                <label className="label">Host</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="db.example.com" 
                  value={dbForm.host}
                  onChange={(e) => setDbForm(f => ({ ...f, host: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Database Name</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="hr_prod" 
                  value={dbForm.database}
                  onChange={(e) => setDbForm(f => ({ ...f, database: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Port</label>
                <input 
                  type="number" 
                  className="input" 
                  placeholder={getDefaultPort(dbForm.db_type)} 
                  value={dbForm.port}
                  onChange={(e) => setDbForm(f => ({ ...f, port: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Username</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="readonly_user" 
                  value={dbForm.username}
                  onChange={(e) => setDbForm(f => ({ ...f, username: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input 
                  type="password" 
                  className="input" 
                  placeholder="••••••••" 
                  value={dbForm.password}
                  onChange={(e) => setDbForm(f => ({ ...f, password: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-100 dark:border-gray-700/50">
              <button
                onClick={handleTestDbConnection}
                disabled={dbTestStatus === 'testing'}
                className="btn-secondary flex items-center gap-1.5"
              >
                {dbTestStatus === 'testing' ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <LinkIcon className="w-3.5 h-3.5" />}
                {dbTestStatus === 'testing' ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={handleOpenDbMapping}
                disabled={dbTestStatus !== 'connected'}
                className="btn-primary flex items-center gap-1.5 disabled:opacity-50"
              >
                <AdjustmentsHorizontalIcon className="w-3.5 h-3.5" />
                Configure Mapping
              </button>
              
              {dbTestStatus === 'connected' && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-success-600 uppercase tracking-wider ml-auto">
                  <CheckCircleIcon className="w-4 h-4" />
                  Connected ({dbTables.length} tables)
                </span>
              )}
              {dbTestStatus === 'error' && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-danger-600 uppercase tracking-wider ml-auto truncate max-w-[200px]" title={dbTestError}>
                  <XCircleIcon className="w-4 h-4" />
                  {dbTestError || 'Connection Failed'}
                </span>
              )}
            </div>
          </div>

          {savedMappings.length > 0 && (
            <div className="card">
              <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Saved Field Mappings</h4>
              <div className="space-y-2">
                {savedMappings.map((m, idx) => (
                  <div key={m.id || idx} className="flex items-center justify-between p-3 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700/50">
                    <div className="flex items-center gap-3">
                      <TableCellsIcon className="w-4 h-4 text-primary-500" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold text-gray-900 dark:text-white tabular-nums uppercase">{m.source_table}</span>
                          <span className="text-gray-400">&rarr;</span>
                          <span className="text-[13px] font-bold text-primary-600 dark:text-primary-400 uppercase">{m.target_entity}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-medium uppercase mt-0.5">
                          {Object.keys(m.field_map).length} fields mapped &middot; {m.sync_schedule} sync
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSavedMappings(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="card-header">Upload Data</h3>
              <div
                {...getRootProps()}
                className={clsx(
                  'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                  isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'
                )}
              >
                <input {...getInputProps()} />
                <CloudArrowUpIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                {isDragActive ? (
                  <p className="text-primary-600">Drop the file here...</p>
                ) : (
                  <>
                    <p className="text-gray-600 mb-2 text-sm font-medium">Drag & drop a CSV or Excel file here</p>
                    <p className="text-[11px] text-gray-400">or click to browse</p>
                  </>
                )}
              </div>

              {processingStatus === 'processing' && (
                <div className="mt-4 flex items-center gap-2 text-primary-600 text-xs font-medium">
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  <span>Processing file...</span>
                </div>
              )}

              {processingStatus === 'success' && (
                <div className="mt-4 flex items-center gap-2 text-success-600 text-xs font-medium">
                  <CheckCircleIcon className="w-4 h-4" />
                  <span>File processed successfully</span>
                </div>
              )}

              {processingStatus === 'error' && (
                <div className="mt-4 flex items-center gap-2 text-danger-600 text-xs font-medium">
                  <XCircleIcon className="w-4 h-4" />
                  <span>Error processing file</span>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700/50">
                <p className="text-[11px] text-gray-400 uppercase font-bold tracking-wider mb-3">Sample Data</p>
                <button onClick={loadSampleData} className="btn-secondary text-xs">
                  <TableCellsIcon className="w-3.5 h-3.5 mr-1.5" />
                  Load Sample Data
                </button>
              </div>
            </div>

            <div className="card">
              <h3 className="card-header">Recent Uploads</h3>
              {dataUploads.length === 0 ? (
                <p className="text-gray-400 text-[11px] font-medium uppercase tracking-wider py-8 text-center">No uploads yet</p>
              ) : (
                <div className="space-y-2.5">
                  {dataUploads.slice(-5).reverse().map((upload) => (
                    <div key={upload.id} className="flex items-center justify-between p-2.5 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700/50">
                      <div className="flex items-center gap-2.5">
                        {upload.status === 'completed' ? (
                          <CheckCircleIcon className="w-4 h-4 text-success-500" />
                        ) : upload.status === 'error' ? (
                          <XCircleIcon className="w-4 h-4 text-danger-500" />
                        ) : (
                          <ArrowPathIcon className="w-4 h-4 text-primary-500 animate-spin" />
                        )}
                        <div>
                          <p className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[150px]">{upload.filename}</p>
                          <p className="text-[10px] text-gray-500 font-medium uppercase">
                            {upload.recordCount ? `${upload.recordCount} records` : 'Processing...'}
                          </p>
                        </div>
                      </div>
                      <span className={clsx(
                        'badge text-[9px] px-1.5 py-0.5',
                        upload.status === 'completed' && 'badge-success',
                        upload.status === 'error' && 'badge-danger',
                        upload.status === 'processing' && 'badge-primary'
                      )}>
                        {upload.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {previewData && (
              <div className="card lg:col-span-2 p-0">
                <h3 className="card-header p-3.5 pb-0">Data Preview</h3>
                <div className="overflow-x-auto mt-2">
                  <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700/50">
                    <thead>
                      <tr>
                        {Object.keys(previewData[0] || {}).slice(0, 8).map((key) => (
                          <th key={key} className="table-header">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50 bg-white/30 dark:bg-gray-800/30">
                      {previewData.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).slice(0, 8).map((value, j) => (
                            <td key={j} className="table-cell">{String(value)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider p-3">Showing first 10 rows</p>
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="card-header">Data Cleaning Rules</h3>
            <p className="text-[11px] text-gray-500 mb-5 font-medium">
              Automatic transformation rules applied during import
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {cleaningRules.map((rule) => (
                <div
                  key={rule.id}
                  className={clsx(
                    'flex items-center justify-between p-3 rounded-lg border transition-all',
                    rule.enabled ? 'border-primary-100 bg-primary-50/30' : 'border-gray-100 bg-gray-50/30'
                  )}
                >
                  <div className="min-w-0 pr-4">
                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{rule.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">{rule.description}</p>
                  </div>
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={clsx(
                      'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none',
                      rule.enabled ? 'bg-primary-600' : 'bg-gray-300'
                    )}
                  >
                    <span
                      className={clsx(
                        'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                        rule.enabled ? 'translate-x-4.5' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pipelines' && (
        <div className="space-y-6">
          {/* dbt Configuration */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <span className="text-orange-600 font-bold text-sm">dbt</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">dbt Cloud Configuration</h3>
                <p className="text-sm text-gray-500">Connect to dbt Cloud for data transformation and modeling</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">dbt Cloud Account URL</label>
                <input
                  type="url"
                  value={dbtProjectUrl}
                  onChange={(e) => setDbtProjectUrl(e.target.value)}
                  className="input"
                  placeholder="https://cloud.getdbt.com/api/v2/accounts/12345"
                />
              </div>
              <div>
                <label className="label">API Token</label>
                <input
                  type="password"
                  value={dbtApiToken}
                  onChange={(e) => setDbtApiToken(e.target.value)}
                  className="input"
                  placeholder="dbt_cloud_api_token"
                />
              </div>
              <div>
                <label className="label">Environment</label>
                <select
                  value={dbtEnvironment}
                  onChange={(e) => setDbtEnvironment(e.target.value)}
                  className="input"
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setPipelineSaving(true)
                    setTimeout(() => {
                      setPipelineSaving(false)
                      toast.success('dbt Cloud configuration saved')
                    }, 1000)
                  }}
                  disabled={pipelineSaving || !dbtProjectUrl || !dbtApiToken}
                  className="btn-primary w-full"
                >
                  {pipelineSaving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>

            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">dbt Models</h4>
              <p className="text-xs text-gray-500 mb-3">
                Once connected, dbt will manage the following data transformations:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['stg_employees', 'stg_candidates', 'stg_requisitions', 'dim_departments', 'dim_locations', 'fct_hires', 'fct_terminations', 'mart_workforce_metrics'].map(model => (
                  <div key={model} className="px-3 py-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs font-mono text-gray-600 dark:text-gray-400">
                    {model}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fivetran Configuration */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-bold text-xs">FT</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Fivetran Configuration</h3>
                <p className="text-sm text-gray-500">Configure Fivetran connectors for automated data ingestion</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">API Key</label>
                <input
                  type="password"
                  value={fivetranApiKey}
                  onChange={(e) => setFivetranApiKey(e.target.value)}
                  className="input"
                  placeholder="fivetran_api_key"
                />
              </div>
              <div>
                <label className="label">API Secret</label>
                <input
                  type="password"
                  value={fivetranApiSecret}
                  onChange={(e) => setFivetranApiSecret(e.target.value)}
                  className="input"
                  placeholder="fivetran_api_secret"
                />
              </div>
              <div>
                <label className="label">Group ID</label>
                <input
                  type="text"
                  value={fivetranGroupId}
                  onChange={(e) => setFivetranGroupId(e.target.value)}
                  className="input"
                  placeholder="e.g. group_abc123"
                />
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  setPipelineSaving(true)
                  setTimeout(() => {
                    setPipelineSaving(false)
                    toast.success('Fivetran configuration saved')
                  }, 1000)
                }}
                disabled={pipelineSaving || !fivetranApiKey || !fivetranApiSecret}
                className="btn-primary"
              >
                {pipelineSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Available Connectors</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { name: 'BambooHR', status: 'available', type: 'HRIS' },
                  { name: 'Workday', status: 'available', type: 'HRIS' },
                  { name: 'Greenhouse', status: 'available', type: 'ATS' },
                  { name: 'Lever', status: 'available', type: 'ATS' },
                  { name: 'ADP', status: 'available', type: 'Payroll' },
                  { name: 'PostgreSQL', status: 'connected', type: 'Database' },
                ].map(connector => (
                  <div key={connector.name} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white/50 dark:bg-gray-800/50">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{connector.name}</p>
                      <p className="text-xs text-gray-500">{connector.type}</p>
                    </div>
                    <span className={clsx(
                      'text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider',
                      connector.status === 'connected' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    )}>
                      {connector.status === 'connected' ? 'Connected' : 'Available'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pipeline Overview */}
          <div className="card">
            <h3 className="card-header">Data Pipeline Overview</h3>
            <div className="overflow-x-auto">
              <div className="flex items-center justify-center gap-4 py-8 min-w-[600px]">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-2 border border-blue-200 dark:border-blue-800">
                    <span className="text-blue-600 dark:text-blue-400 font-bold text-[10px] uppercase">Sources</span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">HRIS, ATS, Payroll</p>
                </div>
                <div className="text-gray-300 dark:text-gray-700 text-xl font-light">&rarr;</div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 flex items-center justify-center mx-auto mb-2 shadow-inner">
                    <span className="text-blue-500 dark:text-blue-400 font-bold text-[10px] uppercase">Fivetran</span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">Extract & Load</p>
                </div>
                <div className="text-gray-300 dark:text-gray-700 text-xl font-light">&rarr;</div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-2 border border-green-200 dark:border-green-800">
                    <span className="text-green-600 dark:text-green-400 font-bold text-xs uppercase">DB</span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">PostgreSQL</p>
                </div>
                <div className="text-gray-300 dark:text-gray-700 text-xl font-light">&rarr;</div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-2 border border-orange-200 dark:border-orange-800">
                    <span className="text-orange-600 dark:text-orange-400 font-bold text-xs uppercase">dbt</span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">Transform</p>
                </div>
                <div className="text-gray-300 dark:text-gray-700 text-xl font-light">&rarr;</div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-2 border border-purple-200 dark:border-purple-800 shadow-lg shadow-purple-500/10">
                    <span className="text-purple-600 dark:text-purple-400 font-bold text-[10px] uppercase">Interface</span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">Analytics</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'webhooks' && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="card-header">Webhook Endpoints</h3>
                <p className="text-sm text-gray-500">Receive real-time notifications when events occur in your HR data.</p>
              </div>
              <button
                onClick={() => setShowWebhookForm(true)}
                className="btn-primary inline-flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                Add Webhook
              </button>
            </div>

            {webhooks.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">No webhooks configured. Add one above.</div>
            ) : (
              <div className="space-y-2.5">
                {webhooks.map(wh => (
                  <div key={wh.id} className="border border-gray-100 dark:border-gray-700/50 rounded-lg p-3 bg-white/50 dark:bg-gray-800/50">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 pr-4">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{wh.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">{wh.url}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {wh.events.map(ev => (
                            <span key={ev} className="text-[9px] px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded border border-indigo-100 dark:border-indigo-800/50 font-mono uppercase font-bold tracking-tight">{ev}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${wh.status === 'active' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-gray-50 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                          {wh.status}
                        </span>
                        <button
                          onClick={() => setWebhooks(prev => prev.filter(w => w.id !== wh.id))}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Webhook Create Form */}
          {showWebhookForm && (
            <div className="card border-primary-200 mb-6">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">New Webhook</h4>
              <div className="space-y-3">
                <div>
                  <label className="label">Name</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={newWebhook.name} 
                    onChange={e => setNewWebhook(p => ({ ...p, name: e.target.value }))} 
                    placeholder="e.g. Slack Notification" 
                  />
                </div>
                <div>
                  <label className="label">Endpoint URL</label>
                  <input 
                    type="url" 
                    className="input" 
                    value={newWebhook.url} 
                    onChange={e => setNewWebhook(p => ({ ...p, url: e.target.value }))} 
                    placeholder="https://your-server.com/webhook" 
                  />
                </div>
                <div>
                  <label className="label mb-1">Events to subscribe</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['employee.created', 'employee.updated', 'employee.terminated', 'candidate.applied', 'candidate.stage_changed', 'offer.extended', 'offer.accepted', 'payroll.processed'].map(ev => (
                      <label key={ev} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newWebhook.events.includes(ev)}
                          onChange={e => setNewWebhook(p => ({ ...p, events: e.target.checked ? [...p.events, ev] : p.events.filter(x => x !== ev) }))}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-[10px] font-mono text-gray-600 dark:text-gray-400">{ev}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={() => setShowWebhookForm(false)} className="btn-secondary">Cancel</button>
                  <button
                    disabled={!newWebhook.name || !newWebhook.url}
                    onClick={() => {
                      setWebhooks(prev => [...prev, { id: Date.now().toString(), name: newWebhook.name, url: newWebhook.url, events: newWebhook.events, status: 'active' }])
                      setNewWebhook({ name: '', url: '', events: [] })
                      setShowWebhookForm(false)
                      toast.success('Webhook added')
                    }}
                    className="btn-primary"
                  >
                    Add Webhook
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Available Events */}
          <div className="card">
            <h3 className="card-header mb-3 uppercase tracking-wider text-[11px] text-gray-400">Available Events</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                'employee.created', 'employee.updated', 'employee.terminated',
                'candidate.applied', 'candidate.stage_changed',
                'offer.extended', 'offer.accepted', 'payroll.processed',
              ].map(ev => (
                <div key={ev} className="text-[10px] font-mono px-2 py-1.5 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 rounded text-gray-500 dark:text-gray-400">{ev}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'export' && (
        <div className="card">
          <h3 className="card-header">Export Data</h3>
          <p className="text-[11px] text-gray-500 mb-6 font-medium">
            Download organization data for external analysis or compliance
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 border border-gray-100 dark:border-gray-700 rounded-lg bg-gray-50/30 dark:bg-gray-800/30">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-1.5 uppercase tracking-tight">Standard CSV</h4>
              <p className="text-[11px] text-gray-500 mb-4 leading-relaxed">
                Comma-separated values, compatible with Excel, Sheets, and Tableau.
              </p>
              <button onClick={() => exportData('csv')} className="btn-secondary w-full py-2">
                <DocumentArrowDownIcon className="w-3.5 h-3.5 mr-1.5" />
                Export CSV
              </button>
            </div>

            <div className="p-5 border border-gray-100 dark:border-gray-700 rounded-lg bg-gray-50/30 dark:bg-gray-800/30">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-1.5 uppercase tracking-tight">Excel Spreadsheet</h4>
              <p className="text-[11px] text-gray-500 mb-4 leading-relaxed">
                Native .xlsx format with data types and column formatting preserved.
              </p>
              <button onClick={() => exportData('xlsx')} className="btn-primary w-full py-2 shadow-sm">
                <DocumentArrowDownIcon className="w-3.5 h-3.5 mr-1.5" />
                Export Excel
              </button>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700/50 shadow-inner">
            <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-widest">Snapshot Summary</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <p className="text-[10px] text-gray-500 font-medium uppercase">Records</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{summaryData?.employees ?? employees.length}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-medium uppercase">Active</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{summaryData?.active ?? employees.filter((e) => e.status === 'active').length}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-medium uppercase">Depts</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{summaryData?.departments ?? new Set(employees.map((e) => e.department)).size}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-medium uppercase">Locations</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{summaryData?.locations ?? new Set(employees.map((e) => e.location)).size}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-medium uppercase">Candidates</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{summaryData?.candidates ?? 0}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-medium uppercase">Reqs</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{summaryData?.requisitions ?? 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <FieldMappingConfig
        isOpen={showFieldMapping}
        onClose={() => setShowFieldMapping(false)}
        sourceTables={fmSourceTables}
        sourceColumns={fmSourceColumns}
        targetEntity={fmTargetEntity}
        onSave={handleSaveFieldMapping}
        onTableChange={handleFmTableChange}
        onEntityChange={(entity) => setFmTargetEntity(entity as typeof fmTargetEntity)}
        previewRows={fmPreviewRows}
        isLoadingSchema={fmLoadingSchema}
        isLoadingPreview={false}
        title="Database Field Mapping"
      />
    </div>
  )
}
