import { ServerStackIcon, ArrowPathIcon, PlusIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface DemoDataBannerProps {
  onSeed: () => void
  loading: boolean
  result: Record<string, number> | null
}

export default function DemoDataBanner({ onSeed, loading, result }: DemoDataBannerProps) {
  return (
    <div className="card border-primary-100 dark:border-primary-800/30 bg-gradient-to-r from-primary-50/50 to-indigo-50/50 dark:from-primary-900/10 dark:to-indigo-900/10 p-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <ServerStackIcon className="w-6 h-6 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">Load Demo Data</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed max-w-2xl">
              Populate with 10k employees (2018-2026), 4k candidates, 1k requisitions, 60 recruiters, 
              KPIs, attendance, compensation bands, and ML alerts. Replaces existing data.
            </p>
          </div>
        </div>
        <button
          onClick={onSeed}
          disabled={loading}
          className={clsx(
            'btn-primary px-4 py-2 flex-shrink-0',
            loading && 'opacity-50 cursor-not-allowed'
          )}
        >
          {loading ? (
            <><ArrowPathIcon className="w-3.5 h-3.5 animate-spin mr-1.5" />Seeding...</>
          ) : (
            <><PlusIcon className="w-3.5 h-3.5 mr-1.5" />Load Demo Data</>
          )}
        </button>
      </div>

      {result && (
        <div className="mt-3 pt-3 border-t border-primary-100 dark:border-primary-800/30">
          <div className="flex items-center gap-1.5 mb-2">
            <CheckCircleIcon className="w-4 h-4 text-success-600" />
            <span className="text-[11px] font-bold text-success-700 dark:text-success-400 uppercase tracking-wider">Seeded Successfully</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {Object.entries(result).map(([key, value]) => (
              <div key={key} className="bg-white/50 dark:bg-gray-800/50 rounded px-2 py-1.5 border border-gray-100 dark:border-gray-700/50">
                <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-tighter truncate">{key.replace(/_/g, ' ')}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
