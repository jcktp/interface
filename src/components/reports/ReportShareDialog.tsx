import { XMarkIcon, LinkIcon, ClipboardIcon, ShareIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface ReportShareDialogProps {
  report: any
  onClose: () => void
  onGenerate: (expiry: string) => void
  shareExpiry: string
  setShareExpiry: (expiry: string) => void
  loading: boolean
}

export default function ReportShareDialog({ report, onClose, onGenerate, shareExpiry, setShareExpiry, loading }: ReportShareDialogProps) {
  const handleCopy = () => {
    const url = `${window.location.origin}/report/${report.share_token}`
    navigator.clipboard.writeText(url).then(() => toast.success('Copied!'))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-lg font-bold">Share Report</h2>
          <button onClick={onClose}><XMarkIcon className="w-6 h-6 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          {report.share_token && (
            <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-gray-400" />
              <span className="text-xs truncate flex-1">{window.location.origin}/report/{report.share_token}</span>
              <button onClick={handleCopy} className="p-1.5 bg-white border rounded"><ClipboardIcon className="w-4 h-4" /></button>
            </div>
          )}
          <div>
            <label className="label">Link Expiry</label>
            <select value={shareExpiry} onChange={e => setShareExpiry(e.target.value)} className="input">
              <option value="never">Never</option><option value="24h">24 Hours</option><option value="7d">7 Days</option>
            </select>
          </div>
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Close</button>
          <button onClick={() => onGenerate(shareExpiry)} disabled={loading} className="btn-primary">
            <ShareIcon className="w-4 h-4 mr-1.5" />
            {loading ? 'Generating...' : 'Generate Link'}
          </button>
        </div>
      </div>
    </div>
  )
}
