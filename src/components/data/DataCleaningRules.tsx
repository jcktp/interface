import clsx from 'clsx'

export type DataCleaningRule = {
  id: string
  name: string
  description: string
  enabled: boolean
}

interface DataCleaningRulesProps {
  rules: DataCleaningRule[]
  onToggle: (id: string) => void
}

export default function DataCleaningRules({ rules, onToggle }: DataCleaningRulesProps) {
  return (
    <div className="card">
      <h3 className="card-header">Data Cleaning Rules</h3>
      <p className="text-[11px] text-gray-500 mb-5 font-medium">Automatic transformation rules applied during import</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rules.map((rule) => (
          <div key={rule.id} className={clsx('flex items-center justify-between p-3 rounded-lg border transition-all', rule.enabled ? 'border-primary-100 bg-primary-50/30' : 'border-gray-100 bg-gray-50/30')}>
            <div className="min-w-0 pr-4">
              <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{rule.name}</p>
              <p className="text-[10px] text-gray-500 truncate">{rule.description}</p>
            </div>
            <button
              onClick={() => onToggle(rule.id)}
              className={clsx('relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none', rule.enabled ? 'bg-primary-600' : 'bg-gray-300')}
            >
              <span className={clsx('inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform', rule.enabled ? 'translate-x-4.5' : 'translate-x-1')} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
