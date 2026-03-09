interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { name: string; start_date: string; end_date: string; description: string }) => void
  isPending: boolean
  newPeriod: { name: string; start_date: string; end_date: string; description: string }
  setNewPeriod: React.Dispatch<React.SetStateAction<{ name: string; start_date: string; end_date: string; description: string }>>
}

export default function CreatePeriodModal({
  isOpen,
  onClose,
  onSubmit,
  isPending,
  newPeriod,
  setNewPeriod,
}: Props) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Planning Period</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              placeholder="e.g. Q2 2026 Planning"
              value={newPeriod.name}
              onChange={(e) => setNewPeriod((p) => ({ ...p, name: e.target.value }))}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input
                type="date"
                value={newPeriod.start_date}
                onChange={(e) => setNewPeriod((p) => ({ ...p, start_date: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
              <input
                type="date"
                value={newPeriod.end_date}
                onChange={(e) => setNewPeriod((p) => ({ ...p, end_date: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              placeholder="Optional description for this planning period"
              value={newPeriod.description}
              onChange={(e) => setNewPeriod((p) => ({ ...p, description: e.target.value }))}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={2}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(newPeriod)}
            disabled={!newPeriod.name || !newPeriod.start_date || !newPeriod.end_date || isPending}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPending ? 'Creating...' : 'Create Period'}
          </button>
        </div>
      </div>
    </div>
  )
}
