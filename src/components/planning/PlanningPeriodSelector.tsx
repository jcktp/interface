import { Fragment } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon, PlusIcon } from '@heroicons/react/24/outline'

export interface PlanningPeriod {
  id: string
  name: string
  description?: string
  start_date: string
  end_date: string
  status: 'draft' | 'active' | 'closed'
  period_type: string
  created_at?: string
}

interface PlanningPeriodSelectorProps {
  periods: PlanningPeriod[]
  selectedPeriod: PlanningPeriod | null
  onSelect: (period: PlanningPeriod) => void
  onCreateNew: () => void
}

const statusColors = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-success-100 text-success-700',
  closed: 'bg-gray-200 text-gray-500',
}

const statusLabels = {
  draft: 'Draft',
  active: 'Active',
  closed: 'Closed',
}

export default function PlanningPeriodSelector({
  periods,
  selectedPeriod,
  onSelect,
  onCreateNew,
}: PlanningPeriodSelectorProps) {
  return (
    <div className="flex items-center gap-4">
      <Listbox value={selectedPeriod ?? undefined} onChange={onSelect}>
        <div className="relative min-w-[280px]">
          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-white py-2.5 pl-4 pr-10 text-left border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
            {selectedPeriod ? (
              <div className="flex items-center gap-3">
                <span className="block truncate font-medium">{selectedPeriod.name}</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    statusColors[selectedPeriod.status]
                  }`}
                >
                  {statusLabels[selectedPeriod.status]}
                </span>
              </div>
            ) : (
              <span className="block truncate text-gray-400">Select a planning period</span>
            )}
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
            </span>
          </Listbox.Button>

          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              {periods.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500">
                  No planning periods found
                </div>
              ) : (
                periods.map((period) => (
                  <Listbox.Option
                    key={period.id}
                    value={period}
                    className={({ active }) =>
                      `relative cursor-pointer select-none py-3 pl-10 pr-4 ${
                        active ? 'bg-primary-50 text-primary-900' : 'text-gray-900'
                      }`
                    }
                  >
                    {({ selected }) => (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <span
                              className={`block truncate ${
                                selected ? 'font-semibold' : 'font-normal'
                              }`}
                            >
                              {period.name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(period.start_date).toLocaleDateString()} -{' '}
                              {new Date(period.end_date).toLocaleDateString()}
                            </span>
                          </div>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              statusColors[period.status]
                            }`}
                          >
                            {statusLabels[period.status]}
                          </span>
                        </div>
                        {selected && (
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary-600">
                            <CheckIcon className="h-5 w-5" />
                          </span>
                        )}
                      </>
                    )}
                  </Listbox.Option>
                ))
              )}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>

      <button
        onClick={onCreateNew}
        className="btn-secondary inline-flex items-center gap-2"
      >
        <PlusIcon className="h-5 w-5" />
        New Period
      </button>
    </div>
  )
}
