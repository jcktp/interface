import { BoltIcon, PencilIcon, TrashIcon, PlusIcon, CheckCircleIcon, PauseIcon, PlayIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useState } from 'react'
import toast from 'react-hot-toast'

export interface Webhook {
  id: string
  name: string
  url: string
  events: string[]
  status: 'active' | 'paused'
  lastTriggered: string
  createdBy: string
  deliveries: number
  secretKey: string
}

interface WebhooksSectionProps {
  webhooks: Webhook[]
  onAdd: (wh: Partial<Webhook>) => void
  onUpdate: (id: string, wh: Partial<Webhook>) => void
  onDelete: (id: string) => void
  onToggleStatus: (id: string) => void
}

export default function WebhooksSection({ webhooks, onAdd, onUpdate, onDelete, onToggleStatus }: WebhooksSectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingWh, setEditingWh] = useState<Webhook | null>(null)
  const [form, setForm] = useState({ name: '', url: '', events: [] as string[], secretKey: '', active: true })

  const resetForm = () => {
    setForm({ name: '', url: '', events: [], secretKey: '', active: true })
    setEditingWh(null)
    setShowForm(false)
  }

  const handleEdit = (wh: Webhook) => {
    setEditingWh(wh)
    setForm({ name: wh.name, url: wh.url, events: [...wh.events], secretKey: wh.secretKey, active: wh.status === 'active' })
    setShowForm(true)
  }

  const handleSave = () => {
    if (!form.name) { toast.error('Name is required'); return }
    if (editingWh) onUpdate(editingWh.id, form)
    else onAdd(form)
    resetForm()
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div><h3 className="card-header mb-0">Webhooks</h3><p className="text-sm text-gray-500 mt-1">Receive real-time updates</p></div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm flex items-center gap-1.5"><PlusIcon className="w-4 h-4" />Create Webhook</button>
      </div>

      {webhooks.length === 0 ? (
        <div className="text-center py-8"><BoltIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No webhooks yet</p></div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div key={wh.id} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-100 text-amber-600"><BoltIcon className="w-5 h-5" /></div>
                  <div className="min-w-0"><p className="font-medium text-gray-900">{wh.name}</p><span className={clsx('badge', wh.status === 'active' ? 'badge-success' : 'badge-warning')}>{wh.status}</span></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onToggleStatus(wh.id)} className="btn-secondary p-2">{wh.status === 'active' ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}</button>
                  <button onClick={() => handleEdit(wh)} className="btn-secondary p-2"><PencilIcon className="w-4 h-4" /></button>
                  <button onClick={() => onDelete(wh.id)} className="btn-secondary p-2 text-danger-600"><TrashIcon className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="mt-4 p-4 border border-primary-200 bg-primary-50 rounded-lg space-y-4">
          <div><label className="label">Name</label><input type="text" className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary text-sm flex items-center gap-1.5"><CheckCircleIcon className="w-4 h-4" />Save</button>
            <button onClick={resetForm} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
