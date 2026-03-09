import { useState } from 'react'
import { useStore } from '../store'
import toast from 'react-hot-toast'
import {
  XMarkIcon,
  CircleStackIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import type { IntegrationCredentials } from '../types'
import IntegrationWizard from '../components/IntegrationWizard'
import FieldMappingConfig from '../components/FieldMappingConfig'
import type { SourceColumn } from '../components/FieldMappingConfig'
import api from '../api'

// Modular Components
import IntegrationGuide from '../components/integrations/IntegrationGuide'
import ActiveConnectionsList from '../components/integrations/ActiveConnectionsList'
import AvailableIntegrationsGrid, { availableIntegrations, type Integration } from '../components/integrations/AvailableIntegrationsGrid'
import CustomApiSection, { type CustomApiIntegration } from '../components/integrations/CustomApiSection'
import WebhooksSection, { type Webhook } from '../components/integrations/WebhooksSection'

export default function ApiConnections() {
  const { apiConnections, addApiConnection, updateApiConnection, removeApiConnection } = useStore()
  
  // UI State
  const [showWizard, setShowWizard] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<Integration | null>(null)
  const [detailIntegration, setDetailIntegration] = useState<Integration | null>(null)
  const [showFieldMapping, setShowFieldMapping] = useState(false)

  // Sub-data states
  const [customApis, setCustomApis] = useState<CustomApiIntegration[]>([])
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  
  // DB Connection State
  const [dbForm, setDbForm] = useState({ db_type: 'postgresql', host: '', port: '5432', database: '', username: '', password: '' })
  const [dbStatus, setDbStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle')

  // Field Mapping State
  const [_fmSourceTables] = useState<string[]>([])
  const [_fmSourceColumns] = useState<SourceColumn[]>([])
  const [fmTargetEntity, setFmTargetEntity] = useState<'employees' | 'candidates' | 'requisitions' | 'custom'>('employees')
  const [_fmPreviewRows] = useState<Record<string, unknown>[]>([])
  const [_fmLoadingSchema] = useState(false)

  const handleTestDb = async () => {
    setDbStatus('testing')
    try {
      const res = await api.post('/integrations/database/test-connection', { ...dbForm, port: parseInt(dbForm.port) })
      void res
      setDbStatus('connected')
      toast.success('Database connected!')
    } catch {
      setDbStatus('error')
      toast.error('Connection failed')
    }
  }

  const handleConnect = (creds: IntegrationCredentials) => {
    if (!selectedProvider) return
    addApiConnection({
      id: `conn-${Date.now()}`,
      name: selectedProvider.name,
      type: selectedProvider.type,
      provider: selectedProvider.id,
      status: 'connected',
      lastSync: new Date().toISOString(),
      apiKey: creds.apiKey,
    })
    setShowWizard(false)
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">API Connections</h2>
          <p className="text-sm text-gray-500">Manage your data integrations and webhooks</p>
        </div>
      </div>

      <IntegrationGuide integrationCount={availableIntegrations.length} />

      {/* Database Card */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-slate-100 rounded-lg"><CircleStackIcon className="w-5 h-5 text-slate-600" /></div>
          <h3 className="card-header mb-0">Direct Database Connection</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <input className="input" placeholder="Host" value={dbForm.host} onChange={e => setDbForm({...dbForm, host: e.target.value})} />
          <input className="input" placeholder="Database" value={dbForm.database} onChange={e => setDbForm({...dbForm, database: e.target.value})} />
          <input className="input" placeholder="Username" value={dbForm.username} onChange={e => setDbForm({...dbForm, username: e.target.value})} />
          <input className="input" type="password" placeholder="Password" value={dbForm.password} onChange={e => setDbForm({...dbForm, password: e.target.value})} />
        </div>
        <div className="mt-4 flex gap-3 items-center">
          <button onClick={handleTestDb} className="btn-secondary" disabled={dbStatus === 'testing'}>
            {dbStatus === 'testing' ? 'Testing...' : 'Test Connection'}
          </button>
          {dbStatus === 'connected' && <span className="text-xs text-green-600 font-bold flex items-center gap-1"><CheckCircleIcon className="w-4 h-4" /> Connected</span>}
        </div>
      </div>

      <ActiveConnectionsList 
        apiConnections={apiConnections}
        getProviderInfo={id => availableIntegrations.find(i => i.id === id)}
        onOpenMapping={_id => { /* Implementation */ }}
        onSync={id => { updateApiConnection(id, { lastSync: new Date().toISOString() }); toast.success('Sync started') }}
        onDisconnect={id => removeApiConnection(id)}
      />

      <AvailableIntegrationsGrid 
        connectedProviderIds={apiConnections.map(c => c.provider)}
        onShowDetail={setDetailIntegration}
      />

      <CustomApiSection 
        customApis={customApis}
        onAdd={api => setCustomApis([...customApis, { ...api, id: `c-${Date.now()}` } as any])}
        onUpdate={(id, data) => setCustomApis(customApis.map(a => a.id === id ? { ...a, ...data } : a))}
        onDelete={id => setCustomApis(customApis.filter(a => a.id !== id))}
      />

      <WebhooksSection 
        webhooks={webhooks}
        onAdd={wh => setWebhooks([...webhooks, { ...wh, id: `wh-${Date.now()}`, status: 'active' } as any])}
        onUpdate={(id, data) => setWebhooks(webhooks.map(w => w.id === id ? { ...w, ...data } : w))}
        onDelete={id => setWebhooks(webhooks.filter(w => w.id !== id))}
        onToggleStatus={id => setWebhooks(webhooks.map(w => w.id === id ? { ...w, status: w.status === 'active' ? 'paused' : 'active' } : w))}
      />

      {/* Detail Modal */}
      {detailIntegration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold">{detailIntegration.name}</h3>
              <button onClick={() => setDetailIntegration(null)}><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">{detailIntegration.description}</p>
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">Setup Steps</h4>
                <ol className="text-sm space-y-2 list-decimal pl-4">{detailIntegration.setupSteps.map((s, i) => <li key={i}>{s}</li>)}</ol>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setDetailIntegration(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => { setShowWizard(true); setSelectedProvider(detailIntegration); setDetailIntegration(null); }} className="btn-primary">Continue</button>
            </div>
          </div>
        </div>
      )}

      {showWizard && selectedProvider && (
        <IntegrationWizard 
          provider={selectedProvider} 
          onClose={() => setShowWizard(false)} 
          onConnect={handleConnect} 
        />
      )}

      <FieldMappingConfig
        isOpen={showFieldMapping}
        onClose={() => setShowFieldMapping(false)}
        sourceTables={_fmSourceTables}
        sourceColumns={_fmSourceColumns}
        targetEntity={fmTargetEntity}
        onSave={() => {}}
        onTableChange={() => {}}
        onEntityChange={e => setFmTargetEntity(e as any)}
        previewRows={_fmPreviewRows}
        isLoadingSchema={_fmLoadingSchema}
        isLoadingPreview={false}
        title="Field Mapping"
      />
    </div>
  )
}
