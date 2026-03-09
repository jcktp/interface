import { PlayIcon, TrashIcon, StopIcon } from '@heroicons/react/24/outline'
import { PlanningPeriod } from '../planning/PlanningPeriodSelector'

interface Props {
  periods: PlanningPeriod[]
  selectedPeriod: PlanningPeriod | null
  setSelectedPeriod: (period: PlanningPeriod) => void
  onActivate: (id: string) => void
  onDeactivate: (id: string) => void
  onDelete: (id: string) => void
  isActivating: boolean
  isDeactivating: boolean
  isDeleting: boolean
}

export default function PlanningPeriodsTable({
  periods,
  selectedPeriod,
  setSelectedPeriod,
  onActivate,
  onDeactivate,
  onDelete,
  isActivating,
  isDeactivating,
  isDeleting,
}: Props) {
  if (periods.length === 0) return null

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">All Planning Periods</h3>
        <span className="text-xs text-gray-500">{periods.length} period{periods.length !== 1 ? 's' : ''}</span>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {periods.map((period) => (
            <tr
              key={period.id}
              className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                selectedPeriod?.id === period.id ? 'bg-primary-50' : ''
              }`}
              onClick={() => setSelectedPeriod(period)}
            >
              <td className="px-4 py-3 text-sm font-medium text-gray-900">{period.name}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{new Date(period.start_date).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{new Date(period.end_date).toLocaleDateString()}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${
                  period.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : period.status === 'closed'
                    ? 'bg-gray-200 text-gray-500'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {period.status.charAt(0).toUpperCase() + period.status.slice(1)}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                  {period.status === 'draft' && (
                    <>
                      <button
                        onClick={() => onActivate(period.id)}
                        disabled={isActivating}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                        title="Activate period"
                      >
                        <PlayIcon className="h-3.5 w-3.5" />
                        Activate
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this draft period? This cannot be undone.')) {
                            onDelete(period.id)
                          }
                        }}
                        disabled={isDeleting}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                        title="Delete period"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </>
                  )}
                  {period.status === 'active' && (
                    <button
                      onClick={() => {
                        if (confirm('Close this active period? This will mark it as closed.')) {
                          onDeactivate(period.id)
                        }
                      }}
                      disabled={isDeactivating}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
                      title="Close period"
                    >
                      <StopIcon className="h-3.5 w-3.5" />
                      Close
                    </button>
                  )}
                  {period.status === 'closed' && (
                    <span className="text-xs text-gray-400">No actions</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
