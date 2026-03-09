import { useState, useEffect, useMemo } from 'react'
import {
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  EyeIcon,
  TrashIcon,
  PlusIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransformRule {
  type: 'direct' | 'uppercase' | 'lowercase' | 'date_format' | 'number' | 'lookup' | 'concatenate'
  params?: Record<string, string>
}

export interface FieldMapping {
  source_table: string
  target_entity: string
  field_map: Record<string, string> // source_column -> target_field
  transform_rules?: Record<string, TransformRule>
  sync_schedule?: 'manual' | 'hourly' | 'daily' | 'weekly'
}

export interface SourceColumn {
  name: string
  type?: string
}

export interface FieldMappingConfigProps {
  isOpen: boolean
  onClose: () => void
  sourceTables: string[]
  sourceColumns: SourceColumn[]
  targetEntity: 'employees' | 'candidates' | 'requisitions' | 'custom'
  onSave: (mapping: FieldMapping) => void
  onTableChange: (table: string) => void
  onEntityChange?: (entity: string) => void
  existingMapping?: FieldMapping
  previewRows?: Record<string, unknown>[]
  isLoadingSchema?: boolean
  isLoadingPreview?: boolean
  title?: string
}

// ---------------------------------------------------------------------------
// Target field definitions (mirrors FIELD_LABELS in ImportMappingModal.tsx)
// ---------------------------------------------------------------------------

const ENTITY_FIELDS: Record<string, { required: string[]; optional: string[] }> = {
  employees: {
    required: ['employee_id', 'first_name', 'last_name', 'email', 'department', 'job_title', 'hire_date'],
    optional: [
      'termination_date', 'location', 'salary', 'manager_email', 'status',
      'performance_rating', 'engagement_score', 'age', 'gender', 'ethnicity',
    ],
  },
  candidates: {
    required: ['first_name', 'last_name', 'email', 'applied_position', 'application_date'],
    optional: [
      'phone', 'department', 'source', 'status', 'recruiter', 'location',
    ],
  },
  requisitions: {
    required: ['title', 'department', 'status', 'open_date', 'hiring_manager'],
    optional: [
      'location', 'target_fill_date', 'salary_min', 'salary_max', 'headcount',
    ],
  },
  custom: {
    required: [],
    optional: [],
  },
}

const FIELD_LABELS: Record<string, string> = {
  employee_id: 'Employee ID',
  first_name: 'First Name',
  last_name: 'Last Name',
  email: 'Email',
  department: 'Department',
  job_title: 'Job Title',
  hire_date: 'Hire Date',
  termination_date: 'Termination Date',
  location: 'Location',
  salary: 'Salary',
  manager_email: 'Manager Email',
  status: 'Status',
  performance_rating: 'Performance Rating',
  engagement_score: 'Engagement Score',
  age: 'Age',
  gender: 'Gender',
  ethnicity: 'Ethnicity',
  phone: 'Phone',
  applied_position: 'Applied Position',
  application_date: 'Application Date',
  source: 'Source',
  recruiter: 'Recruiter',
  title: 'Job Title',
  open_date: 'Open Date',
  target_fill_date: 'Target Fill Date',
  salary_min: 'Min Salary',
  salary_max: 'Max Salary',
  hiring_manager: 'Hiring Manager',
  headcount: 'Headcount',
}

const TRANSFORM_LABELS: Record<string, string> = {
  direct: 'Direct (no change)',
  uppercase: 'UPPERCASE',
  lowercase: 'lowercase',
  date_format: 'Date Format',
  number: 'Parse Number',
  lookup: 'Lookup Table',
  concatenate: 'Concatenate',
}

// ---------------------------------------------------------------------------
// Name similarity helper for auto-suggestion
// ---------------------------------------------------------------------------

function normalise(s: string): string {
  return s.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function similarity(a: string, b: string): number {
  const na = normalise(a)
  const nb = normalise(b)
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.8
  // simple bigram overlap
  const bigrams = (s: string) => {
    const set = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
    return set
  }
  const ba = bigrams(na)
  const bb = bigrams(nb)
  if (ba.size === 0 || bb.size === 0) return 0
  let overlap = 0
  ba.forEach((b) => { if (bb.has(b)) overlap++ })
  return (2 * overlap) / (ba.size + bb.size)
}

function suggestTargetField(sourceCol: string, targetFields: string[]): string | null {
  let best = ''
  let bestScore = 0.35 // minimum threshold
  for (const tf of targetFields) {
    const label = FIELD_LABELS[tf] || tf
    const s = Math.max(similarity(sourceCol, tf), similarity(sourceCol, label))
    if (s > bestScore) {
      bestScore = s
      best = tf
    }
  }
  return best || null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FieldMappingConfig({
  isOpen,
  onClose,
  sourceTables,
  sourceColumns,
  targetEntity: initialEntity,
  onSave,
  onTableChange,
  onEntityChange,
  existingMapping,
  previewRows = [],
  isLoadingSchema = false,
  isLoadingPreview = false,
  title,
}: FieldMappingConfigProps) {
  const [selectedTable, setSelectedTable] = useState(existingMapping?.source_table || (sourceTables[0] ?? ''))
  const [targetEntity, setTargetEntity] = useState<string>(existingMapping?.target_entity || initialEntity)
  const [fieldMap, setFieldMap] = useState<Record<string, string>>(existingMapping?.field_map || {})
  const [transforms, setTransforms] = useState<Record<string, TransformRule>>(existingMapping?.transform_rules || {})
  const [syncSchedule, setSyncSchedule] = useState<'manual' | 'hourly' | 'daily' | 'weekly'>(existingMapping?.sync_schedule || 'manual')
  const [customFields, setCustomFields] = useState<string[]>([])
  const [newCustomField, setNewCustomField] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [showTransforms, setShowTransforms] = useState(false)

  // Available target fields for the chosen entity
  const entityDef = ENTITY_FIELDS[targetEntity] || ENTITY_FIELDS.custom
  const allTargetFields = useMemo(() => [...entityDef.required, ...entityDef.optional, ...customFields], [entityDef, customFields])

  // Auto-suggest when sourceColumns change and there is no existing mapping
  useEffect(() => {
    if (sourceColumns.length > 0 && Object.keys(fieldMap).length === 0) {
      const auto: Record<string, string> = {}
      for (const col of sourceColumns) {
        const match = suggestTargetField(col.name, allTargetFields)
        if (match) auto[col.name] = match
      }
      setFieldMap(auto)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceColumns])

  // Validation: check that all required fields of the entity are mapped
  const mappedTargetValues = new Set(Object.values(fieldMap).filter(Boolean))
  const missingRequired = entityDef.required.filter((f) => !mappedTargetValues.has(f))
  const isValid = missingRequired.length === 0

  // Handler helpers
  const handleTableChange = (table: string) => {
    setSelectedTable(table)
    setFieldMap({})
    setTransforms({})
    onTableChange(table)
  }

  const handleEntityChange = (entity: string) => {
    setTargetEntity(entity)
    setFieldMap({})
    setTransforms({})
    onEntityChange?.(entity)
  }

  const handleTargetChange = (sourceCol: string, targetField: string) => {
    setFieldMap((prev) => {
      const next = { ...prev }
      if (targetField === '' || targetField === '__skip__') {
        delete next[sourceCol]
      } else {
        next[sourceCol] = targetField
      }
      return next
    })
  }

  const handleTransformChange = (sourceCol: string, type: TransformRule['type']) => {
    setTransforms((prev) => {
      const next = { ...prev }
      if (type === 'direct') {
        delete next[sourceCol]
      } else {
        next[sourceCol] = { type }
      }
      return next
    })
  }

  const handleAddCustomField = () => {
    const slug = newCustomField.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (slug && !allTargetFields.includes(slug)) {
      setCustomFields((prev) => [...prev, slug])
      FIELD_LABELS[slug] = newCustomField.trim()
      setNewCustomField('')
    }
  }

  const handleAutoSuggest = () => {
    const auto: Record<string, string> = {}
    for (const col of sourceColumns) {
      const match = suggestTargetField(col.name, allTargetFields)
      if (match) auto[col.name] = match
    }
    setFieldMap(auto)
  }

  const handleSave = () => {
    const mapping: FieldMapping = {
      source_table: selectedTable,
      target_entity: targetEntity,
      field_map: fieldMap,
      transform_rules: Object.keys(transforms).length > 0 ? transforms : undefined,
      sync_schedule: syncSchedule,
    }
    onSave(mapping)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col">
        {/* ─── Header ─── */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {title || 'Configure Field Mapping'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Map source columns to target fields, set transforms, and configure sync schedule
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <XMarkIcon className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        {/* ─── Validation bar ─── */}
        <div className={clsx('px-6 py-3', isValid ? 'bg-success-50' : 'bg-warning-50')}>
          <div className="flex items-center gap-2">
            {isValid ? (
              <>
                <CheckCircleIcon className="h-5 w-5 text-success-600" />
                <span className="text-sm font-medium text-success-700">All required fields are mapped</span>
              </>
            ) : (
              <>
                <ExclamationCircleIcon className="h-5 w-5 text-warning-600" />
                <span className="text-sm font-medium text-warning-700">
                  Missing required fields: {missingRequired.map((f) => FIELD_LABELS[f] || f).join(', ')}
                </span>
              </>
            )}
          </div>
        </div>

        {/* ─── Body ─── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Source table + target entity selectors */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Source Table</label>
              <select
                className="input"
                value={selectedTable}
                onChange={(e) => handleTableChange(e.target.value)}
                disabled={sourceTables.length === 0}
              >
                {sourceTables.length === 0 && <option value="">No tables available</option>}
                {sourceTables.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Target Entity</label>
              <select
                className="input"
                value={targetEntity}
                onChange={(e) => handleEntityChange(e.target.value)}
              >
                <option value="employees">Employees</option>
                <option value="candidates">Candidates</option>
                <option value="requisitions">Requisitions</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="label">Sync Schedule</label>
              <select
                className="input"
                value={syncSchedule}
                onChange={(e) => setSyncSchedule(e.target.value as typeof syncSchedule)}
              >
                <option value="manual">Manual</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleAutoSuggest} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
              <SparklesIcon className="w-3.5 h-3.5" />
              Auto-Suggest Mappings
            </button>
            <button
              onClick={() => setShowTransforms(!showTransforms)}
              className={clsx('btn-secondary text-xs py-1.5 px-3', showTransforms && 'ring-2 ring-primary-300')}
            >
              {showTransforms ? 'Hide Transforms' : 'Show Transforms'}
            </button>
            <button
              onClick={() => setFieldMap({})}
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-danger-600 hover:bg-danger-50"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              Clear All
            </button>
          </div>

          {/* ─── Mapping table ─── */}
          {isLoadingSchema ? (
            <div className="text-center py-12">
              <ArrowPathIcon className="w-8 h-8 mx-auto text-gray-300 animate-spin mb-3" />
              <p className="text-sm text-gray-500">Loading table schema...</p>
            </div>
          ) : sourceColumns.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500">Select a table to view its columns</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Table header */}
              <div className={clsx(
                'grid gap-2 px-4 py-2.5 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider',
                showTransforms ? 'grid-cols-[1fr_2rem_1fr_1fr]' : 'grid-cols-[1fr_2rem_1fr]'
              )}>
                <div>Source Column</div>
                <div></div>
                <div>Target Field</div>
                {showTransforms && <div>Transform</div>}
              </div>

              {/* Rows */}
              <div className="divide-y divide-gray-100">
                {sourceColumns.map((col) => {
                  const mapped = fieldMap[col.name] || ''
                  const isRequired = mapped && entityDef.required.includes(mapped)
                  return (
                    <div
                      key={col.name}
                      className={clsx(
                        'grid gap-2 px-4 py-2 items-center text-sm',
                        showTransforms ? 'grid-cols-[1fr_2rem_1fr_1fr]' : 'grid-cols-[1fr_2rem_1fr]',
                        mapped ? 'bg-white' : 'bg-gray-50/50'
                      )}
                    >
                      {/* Source */}
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 truncate">{col.name}</span>
                        {col.type && (
                          <span className="badge bg-gray-100 text-gray-500 text-[10px] font-mono">{col.type}</span>
                        )}
                      </div>

                      {/* Arrow */}
                      <ArrowRightIcon className="w-4 h-4 text-gray-300" />

                      {/* Target dropdown */}
                      <div>
                        <select
                          value={mapped}
                          onChange={(e) => handleTargetChange(col.name, e.target.value)}
                          className={clsx('input py-1.5 text-sm', isRequired && 'border-primary-300')}
                        >
                          <option value="__skip__">-- Skip --</option>
                          <optgroup label="Required Fields">
                            {entityDef.required.map((f) => (
                              <option key={f} value={f}>{FIELD_LABELS[f] || f}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Optional Fields">
                            {entityDef.optional.map((f) => (
                              <option key={f} value={f}>{FIELD_LABELS[f] || f}</option>
                            ))}
                          </optgroup>
                          {customFields.length > 0 && (
                            <optgroup label="Custom Fields">
                              {customFields.map((f) => (
                                <option key={f} value={f}>{FIELD_LABELS[f] || f}</option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>

                      {/* Transform dropdown */}
                      {showTransforms && (
                        <div>
                          <select
                            value={transforms[col.name]?.type || 'direct'}
                            onChange={(e) => handleTransformChange(col.name, e.target.value as TransformRule['type'])}
                            className="input py-1.5 text-sm"
                          >
                            {Object.entries(TRANSFORM_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ─── Add Custom Field ─── */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="label">Add Custom Target Field</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Cost Center, Badge Number"
                value={newCustomField}
                onChange={(e) => setNewCustomField(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomField() }}
              />
            </div>
            <button
              onClick={handleAddCustomField}
              disabled={!newCustomField.trim()}
              className="btn-secondary py-2 px-3 disabled:opacity-40"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>

          {customFields.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {customFields.map((cf) => (
                <span key={cf} className="badge bg-indigo-100 text-indigo-700 flex items-center gap-1">
                  {FIELD_LABELS[cf] || cf}
                  <button
                    onClick={() => setCustomFields((prev) => prev.filter((f) => f !== cf))}
                    className="ml-0.5 hover:text-indigo-900"
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* ─── Preview ─── */}
          <div>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <EyeIcon className="w-3.5 h-3.5" />
              {showPreview ? 'Hide Data Preview' : 'Preview Mapped Data'}
            </button>
          </div>

          {showPreview && (
            <div className="border border-gray-200 rounded-lg overflow-x-auto">
              {isLoadingPreview ? (
                <div className="text-center py-8">
                  <ArrowPathIcon className="w-6 h-6 mx-auto text-gray-300 animate-spin mb-2" />
                  <p className="text-sm text-gray-500">Loading preview...</p>
                </div>
              ) : previewRows.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">No preview data available. Save mapping and sync to see results.</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.entries(fieldMap).map(([src, tgt]) => (
                        <th key={src} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div>{FIELD_LABELS[tgt] || tgt}</div>
                          <div className="font-normal normal-case text-gray-400 text-[10px]">{src}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {previewRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx}>
                        {Object.keys(fieldMap).map((src) => (
                          <td key={src} className="px-3 py-2 text-gray-600 truncate max-w-[180px]">
                            {String(row[src] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {Object.values(fieldMap).filter(Boolean).length} of {sourceColumns.length} columns mapped
            {' '}|{' '}
            Sync: <span className="font-medium">{syncSchedule}</span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={handleSave}
              disabled={!isValid}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <CheckCircleIcon className="w-4 h-4" />
              Save Mapping
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
