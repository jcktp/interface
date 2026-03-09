import { TrashIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'

interface ResetDataCardProps {
  onClear: () => Promise<void>
  loading: boolean
}

export default function ResetDataCard({ onClear, loading }: ResetDataCardProps) {
  const [confirm, setConfirm] = useState(false)

  return (
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

        {!confirm ? (
          <button
            onClick={() => setConfirm(true)}
            disabled={loading}
            className="btn-secondary text-red-600 dark:text-red-400 border-red-100 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
          >
            Reset Database
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[11px] font-bold text-red-600 dark:text-red-400 uppercase mr-1">Confirm?</span>
            <button
              onClick={async () => {
                await onClear()
                setConfirm(false)
              }}
              disabled={loading}
              className="btn-primary bg-red-600 hover:bg-red-700"
            >
              {loading ? 'Clearing...' : 'Yes, Reset'}
            </button>
            <button onClick={() => setConfirm(false)} disabled={loading} className="btn-secondary">Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}
