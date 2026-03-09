import { useState, useEffect } from 'react'
import { XMarkIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'

interface ColumnMapping {
  [targetField: string]: string
}

interface ImportMappingModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (mappings: ColumnMapping) => void
  fileColumns: string[]
  suggestedMappings: ColumnMapping
  requiredFields: string[]
  optionalFields: string[]
  dataType: 'employees' | 'candidates' | 'requisitions'
  previewData: Record<string, any>[]
  isLoading?: boolean
}

const FIELD_LABELS: Record<string, string> = {
  // Employees
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
  // Candidates
  phone: 'Phone',
  applied_position: 'Applied Position',
  application_date: 'Application Date',
  source: 'Source',
  recruiter: 'Recruiter',
  // Requisitions
  title: 'Job Title',
  open_date: 'Open Date',
  target_fill_date: 'Target Fill Date',
  salary_min: 'Min Salary',
  salary_max: 'Max Salary',
  hiring_manager: 'Hiring Manager',
  headcount: 'Headcount',
}

export default function ImportMappingModal({
  isOpen,
  onClose,
  onConfirm,
  fileColumns,
  suggestedMappings,
  requiredFields,
  optionalFields,
  dataType,
  previewData,
  isLoading = false,
}: ImportMappingModalProps) {
  const [mappings, setMappings] = useState<ColumnMapping>({})
  const [showPreview, setShowPreview] = useState(true)

  useEffect(() => {
    setMappings(suggestedMappings)
  }, [suggestedMappings])

  if (!isOpen) return null

  const allFields = [...requiredFields, ...optionalFields]
  const missingRequired = requiredFields.filter(f => !mappings[f])
  const isValid = missingRequired.length === 0

  const handleMappingChange = (field: string, column: string) => {
    setMappings(prev => ({
      ...prev,
      [field]: column,
    }))
  }

  const getPreviewValue = (field: string) => {
    const column = mappings[field]
    if (!column || previewData.length === 0) return null
    return previewData[0][column]
  }

  const dataTypeLabels: Record<string, string> = {
    employees: 'Employee',
    candidates: 'Candidate',
    requisitions: 'Requisition',
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Map {dataTypeLabels[dataType]} Columns
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Match your file columns to the expected data fields
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <XMarkIcon className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        {/* Validation Status */}
        <div className={`px-6 py-3 ${isValid ? 'bg-success-50' : 'bg-warning-50'}`}>
          <div className="flex items-center gap-2">
            {isValid ? (
              <>
                <CheckCircleIcon className="h-5 w-5 text-success-600" />
                <span className="text-sm font-medium text-success-700">
                  All required fields are mapped
                </span>
              </>
            ) : (
              <>
                <ExclamationCircleIcon className="h-5 w-5 text-warning-600" />
                <span className="text-sm font-medium text-warning-700">
                  Missing required fields: {missingRequired.map(f => FIELD_LABELS[f] || f).join(', ')}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Required Fields */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Required Fields
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {requiredFields.map(field => (
                  <div key={field} className="flex items-center gap-3">
                    <div className="w-1/3">
                      <label className="block text-sm font-medium text-gray-700">
                        {FIELD_LABELS[field] || field}
                        <span className="text-danger-500 ml-1">*</span>
                      </label>
                    </div>
                    <div className="flex-1">
                      <select
                        value={mappings[field] || ''}
                        onChange={(e) => handleMappingChange(field, e.target.value)}
                        className={`input ${!mappings[field] ? 'border-warning-300 focus:border-warning-500 focus:ring-warning-500' : ''}`}
                      >
                        <option value="">-- Select column --</option>
                        {fileColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                    {mappings[field] && (
                      <div className="w-1/4 truncate text-sm text-gray-500" title={String(getPreviewValue(field))}>
                        {getPreviewValue(field) || '(empty)'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Optional Fields */}
            {optionalFields.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Optional Fields
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {optionalFields.map(field => (
                    <div key={field} className="flex items-center gap-3">
                      <div className="w-1/3">
                        <label className="block text-sm font-medium text-gray-700">
                          {FIELD_LABELS[field] || field}
                        </label>
                      </div>
                      <div className="flex-1">
                        <select
                          value={mappings[field] || ''}
                          onChange={(e) => handleMappingChange(field, e.target.value)}
                          className="input"
                        >
                          <option value="">-- Skip --</option>
                          {fileColumns.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      </div>
                      {mappings[field] && (
                        <div className="w-1/4 truncate text-sm text-gray-500" title={String(getPreviewValue(field))}>
                          {getPreviewValue(field) || '(empty)'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data Preview */}
            {showPreview && previewData.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-900">
                    Data Preview (First 5 Rows)
                  </h3>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    {showPreview ? 'Hide Preview' : 'Show Preview'}
                  </button>
                </div>
                <div className="border rounded-lg overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {fileColumns.slice(0, 8).map(col => (
                          <th
                            key={col}
                            className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {previewData.slice(0, 5).map((row, idx) => (
                        <tr key={idx}>
                          {fileColumns.slice(0, 8).map(col => (
                            <td key={col} className="px-3 py-2 text-sm text-gray-600 truncate max-w-[150px]">
                              {row[col] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {Object.values(mappings).filter(Boolean).length} of {allFields.length} fields mapped
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={() => onConfirm(mappings)}
              disabled={!isValid || isLoading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Importing...
                </span>
              ) : (
                'Import Data'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
