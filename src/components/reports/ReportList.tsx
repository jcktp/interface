import { DocumentTextIcon, PencilSquareIcon, ShareIcon, ArrowDownTrayIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'

interface Report {
  id: string
  name: string
  description: string | null
  config: any
  updated_at: string | null
  created_at: string | null
  creator_name: string | null
  is_public: boolean
  share_token: string | null
  expires_at: string | null
}

interface ReportListProps {
  reports: Report[]
  onOpenBuilder: (report?: Report) => void
  onShare: (report: Report) => void
  onDownload: (report: Report) => void
  onDelete: (id: string) => void
  getShareStatus: (report: Report) => { label: string; color: string }
}

export default function ReportList({ reports, onOpenBuilder, onShare, onDownload, onDelete, getShareStatus }: ReportListProps) {
  return (
    <div className="p-6 w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Create, customize, and export reports</p>
        </div>
        <button onClick={() => onOpenBuilder()} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          Create Report
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No reports yet</h3>
          <button onClick={() => onOpenBuilder()} className="btn-primary mt-4">Create Report</button>
        </div>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => {
            const shareStatus = getShareStatus(report)
            return (
              <div key={report.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <DocumentTextIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <h3 className="text-base font-semibold text-gray-900 truncate">{report.name}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        shareStatus.color === 'green' ? 'bg-green-50 text-green-700' : shareStatus.color === 'red' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>{shareStatus.label}</span>
                    </div>
                    {report.description && <p className="text-sm text-gray-500 ml-8 mb-2">{report.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <button onClick={() => onOpenBuilder(report)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"><PencilSquareIcon className="w-4 h-4" /></button>
                    <button onClick={() => onShare(report)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"><ShareIcon className="w-4 h-4" /></button>
                    <button onClick={() => onDownload(report)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"><ArrowDownTrayIcon className="w-4 h-4" /></button>
                    <button onClick={() => onDelete(report.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><TrashIcon className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
