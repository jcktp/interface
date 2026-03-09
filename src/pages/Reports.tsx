import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../api'
import { exportTableToPdf } from '../utils/exportPdf'

// Modular Components
import ReportList from '../components/reports/ReportList'
import ReportBuilder from '../components/reports/ReportBuilder'
import ReportShareDialog from '../components/reports/ReportShareDialog'

export default function Reports() {
  const queryClient = useQueryClient()
  const [view, setView] = useState<'list' | 'builder'>('list')
  const [editingReport, setEditingReport] = useState<any>(null)
  
  // Builder state
  const [reportName, setReportName] = useState('Untitled Report')
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [filters, setFilters] = useState({ departments: [], locations: [], statuses: [], start_date: null, end_date: null })
  const [datePreset, setDatePreset] = useState('all_time')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  
  // Share state
  const [showShareDialog, setShowShareDialog] = useState<any>(null)
  const [shareExpiry, setShareExpiry] = useState('never')

  // Queries
  const { data: reportsData } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => (await api.get('/reports')).data.reports
  })

  const { data: columnGroups } = useQuery({
    queryKey: ['report-columns'],
    queryFn: async () => (await api.get('/reports/columns')).data
  })

  const { data: reportData, isLoading: dataLoading } = useQuery({
    queryKey: ['report-data', selectedColumns, filters, sortBy, sortDirection],
    queryFn: async () => (await api.post('/reports/data', { columns: selectedColumns, filters, sort_by: sortBy, sort_direction: sortDirection, limit: 50 })).data,
    enabled: view === 'builder' && selectedColumns.length > 0
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/reports', payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['reports'] }); toast.success('Report created') }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: any) => api.put(`/reports/${id}`, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['reports'] }); toast.success('Report updated') }
  })

  const shareMutation = useMutation({
    mutationFn: ({ reportId, expiresHours }: any) => api.post(`/reports/${reportId}/share`, { expires_hours: expiresHours }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      setShowShareDialog({ ...showShareDialog, ...res.data })
      toast.success('Link generated')
    }
  })

  // Handlers
  const handleOpenBuilder = (report?: any) => {
    if (report) {
      setEditingReport(report); setReportName(report.name)
      if (report.config) {
        setSelectedColumns(report.config.columns || [])
        setFilters(report.config.filters || { departments: [], locations: [], statuses: [], start_date: null, end_date: null })
      }
    } else {
      setEditingReport(null); setReportName('Untitled Report'); setSelectedColumns([]); setFilters({ departments: [], locations: [], statuses: [], start_date: null, end_date: null })
    }
    setView('builder')
  }

  const handleSave = () => {
    const payload = { name: reportName, config: { columns: selectedColumns, filters, sort_by: sortBy, sort_direction: sortDirection } }
    if (editingReport) updateMutation.mutate({ id: editingReport.id, ...payload })
    else createMutation.mutate(payload)
  }

  const handleGenerateShareLink = (expiry: string) => {
    if (!showShareDialog) return
    const hours = expiry === '24h' ? 24 : expiry === '7d' ? 168 : null
    shareMutation.mutate({ reportId: showShareDialog.id, expiresHours: hours })
  }

  if (view === 'builder') {
    return (
      <ReportBuilder 
        reportName={reportName} setReportName={setReportName}
        onBack={() => setView('list')} onSave={handleSave}
        onExportCsv={() => {}} onExportPdf={() => exportTableToPdf(reportName, selectedColumns, reportData?.rows.map((r: any) => selectedColumns.map(c => r[c])) || [])}
        columnGroups={columnGroups} selectedColumns={selectedColumns}
        toggleColumn={key => setSelectedColumns(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])}
        toggleCategoryAll={() => {}}
        reportData={reportData} dataLoading={dataLoading}
        _filters={filters} _setFilters={setFilters}
        _datePreset={datePreset} _setDatePreset={setDatePreset}
        sortBy={sortBy} onSort={k => { setSortBy(k); setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc') }}
        sortDirection={sortDirection}
      />
    )
  }

  return (
    <div className="w-full">
      <ReportList 
        reports={reportsData || []}
        onOpenBuilder={handleOpenBuilder}
        onShare={setShowShareDialog}
        onDownload={() => {}}
        onDelete={() => {}}
        getShareStatus={(r) => r.is_public ? { label: 'Active', color: 'green' } : { label: 'Private', color: 'gray' }}
      />
      {showShareDialog && (
        <ReportShareDialog 
          report={showShareDialog} onClose={() => setShowShareDialog(null)}
          onGenerate={handleGenerateShareLink}
          shareExpiry={shareExpiry} setShareExpiry={setShareExpiry}
          loading={shareMutation.isPending}
        />
      )}
    </div>
  )
}
