import { CloudIcon, CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, AdjustmentsHorizontalIcon, ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import type { ApiConnection } from '../../types'

interface ActiveConnectionsListProps {
  apiConnections: ApiConnection[]
  getProviderInfo: (providerId: string) => any
  onOpenMapping: (id: string) => void
  onSync: (id: string) => void
  onDisconnect: (id: string) => void
}

export default function ActiveConnectionsList({
  apiConnections,
  getProviderInfo,
  onOpenMapping,
  onSync,
  onDisconnect
}: ActiveConnectionsListProps) {
  const getStatusIcon = (status: ApiConnection['status']) => {
    switch (status) {
      case 'connected': return <CheckCircleIcon className="w-5 h-5 text-success-500" />
      case 'disconnected': return <XCircleIcon className="w-5 h-5 text-gray-400" />
      case 'error': return <ExclamationTriangleIcon className="w-5 h-5 text-danger-500" />
    }
  }

  return (
    <div className="card">
      <h3 className="card-header">Active Connections</h3>
      {apiConnections.length === 0 ? (
        <div className="text-center py-8">
          <CloudIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No connections yet</p>
          <p className="text-sm text-gray-400">Connect your HR systems to import data automatically</p>
        </div>
      ) : (
        <div className="space-y-4">
          {apiConnections.map((connection) => {
            const provider = getProviderInfo(connection.provider)
            return (
              <div key={connection.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold', provider?.color || 'bg-gray-500')}>
                    {provider?.logo || '?'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{connection.name}</p>
                      {getStatusIcon(connection.status)}
                    </div>
                    <p className="text-sm text-gray-500">
                      {connection.type.toUpperCase()} • Last synced: {connection.lastSync ? new Date(connection.lastSync).toLocaleString() : 'Never'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => onOpenMapping(connection.id)} className="btn-secondary p-2"><AdjustmentsHorizontalIcon className="w-4 h-4" /></button>
                  <button onClick={() => onSync(connection.id)} className="btn-secondary p-2"><ArrowPathIcon className="w-4 h-4" /></button>
                  <button onClick={() => onDisconnect(connection.id)} className="btn-secondary p-2 text-danger-600 hover:bg-danger-50"><TrashIcon className="w-4 h-4" /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
