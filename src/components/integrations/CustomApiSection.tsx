import { LinkIcon, BoltIcon, PencilIcon, TrashIcon, PlusIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useState } from 'react'
import toast from 'react-hot-toast'

export interface CustomApiIntegration {
  id: string
  name: string
  endpoint: string
  authType: string
  authCredential?: string
  dataMapping: string
  syncFrequency: string
  status: 'active' | 'inactive'
  lastUsed: string
  createdBy: string
}

interface CustomApiSectionProps {
  customApis: CustomApiIntegration[]
  onAdd: (api: Partial<CustomApiIntegration>) => void
  onUpdate: (id: string, api: Partial<CustomApiIntegration>) => void
  onDelete: (id: string) => void
}

export default function CustomApiSection({ customApis, onAdd, onUpdate, onDelete }: CustomApiSectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingApi, setEditingApi] = useState<CustomApiIntegration | null>(null)
  const [form, setForm] = useState({
    name: '',
    endpoint: '',
    authType: 'API Key (Header)',
    authCredential: '',
    dataMapping: 'Employees',
    syncFrequency: 'Manual',
  })

  const resetForm = () => {
    setForm({ name: '', endpoint: '', authType: 'API Key (Header)', authCredential: '', dataMapping: 'Employees', syncFrequency: 'Manual' })
    setEditingApi(null)
    setShowForm(false)
  }

  const handleEdit = (api: CustomApiIntegration) => {
    setEditingApi(api)
    setForm({
      name: api.name,
      endpoint: api.endpoint,
      authType: api.authType,
      authCredential: api.authCredential || '',
      dataMapping: api.dataMapping,
      syncFrequency: api.syncFrequency,
    })
    setShowForm(true)
  }

  const handleSave = () => {
    if (!form.name || !form.endpoint) {
      toast.error('Name and endpoint are required')
      return
    }
    if (editingApi) {
      onUpdate(editingApi.id, form)
    } else {
      onAdd(form)
    }
    resetForm()
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="card-header mb-0">Custom API Integrations</h3>
          <p className="text-sm text-gray-500 mt-1">Connect to any REST API with custom authentication</p>
        </div>
        <button onClick={() => { setEditingApi(null); setShowForm(true); }} className="btn-primary text-sm flex items-center gap-1.5">
          <PlusIcon className="w-4 h-4" />
          Add Custom Integration
        </button>
      </div>

      {customApis.length === 0 ? (
        <div className="text-center py-8">
          <LinkIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No custom API integrations yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {customApis.map((api) => (
            <div key={api.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-100 text-indigo-600 flex-shrink-0">
                  <BoltIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900">{api.name}</p>
                    <span className={clsx('badge', api.status === 'active' ? 'badge-success' : 'badge-danger')}>{api.status}</span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">{api.endpoint}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <button onClick={() => handleEdit(api)} className="btn-secondary p-2"><PencilIcon className="w-4 h-4" /></button>
                <button onClick={() => onDelete(api.id)} className="btn-secondary p-2 text-danger-600 hover:bg-danger-50"><TrashIcon className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="mt-4 p-4 border border-primary-200 bg-primary-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-4">{editingApi ? 'Edit Custom Integration' : 'Add Custom Integration'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Name</label><input type="text" className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="label">API Endpoint URL</label><input type="url" className="input" value={form.endpoint} onChange={e => setForm(f => ({ ...f, endpoint: e.target.value }))} /></div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button onClick={handleSave} className="btn-primary text-sm flex items-center gap-1.5"><CheckCircleIcon className="w-4 h-4" />Save</button>
            <button onClick={resetForm} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
