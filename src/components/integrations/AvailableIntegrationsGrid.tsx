import { LinkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useState } from 'react'

export interface Integration {
  id: string
  name: string
  icon: string
  category: string
  description: string
  docsUrl: string
  setupSteps: string[]
  credentials: string[]
  connected?: boolean
  logo: string
  color: string
  type: 'hris' | 'ats' | 'payroll' | 'identity' | 'performance'
}

export const availableIntegrations: Integration[] = [
  {
    id: 'workday',
    name: 'Workday',
    type: 'hris',
    logo: 'W',
    color: 'bg-orange-500',
    icon: 'W',
    category: 'HRIS',
    description: 'Sync employee records, org charts, and compensation data from Workday HCM. Supports real-time webhooks and scheduled batch imports.',
    docsUrl: 'https://developer.workday.com/docs',
    setupSteps: [
      'Log into Workday as an Integration System User (ISU)',
      'Navigate to Integration > Create Integration System User',
      'Generate API credentials under Security > API Client',
      'Grant the ISU access to the required domains (Worker Data, Organization Data)',
      'Enter the Workday tenant URL, client ID, and client secret in the form below',
    ],
    credentials: ['Tenant URL (e.g., https://wd5-impl-services1.workday.com)', 'Client ID', 'Client Secret', 'Refresh Token'],
  },
  {
    id: 'greenhouse',
    name: 'Greenhouse',
    type: 'ats',
    logo: 'G',
    color: 'bg-emerald-500',
    icon: 'G',
    category: 'ATS',
    description: 'Sync candidates, job postings, scorecards, and hiring pipeline data from Greenhouse. Supports webhook events for real-time updates.',
    docsUrl: 'https://developers.greenhouse.io/harvest.html',
    setupSteps: [
      'Log into Greenhouse as a Site Admin',
      'Navigate to Configure > Dev Center > API Credential Management',
      'Click "Create New API Key" and select Harvest API',
      'Grant permissions for Candidates, Jobs, and Applications',
      'Copy the API key and enter it below',
    ],
    credentials: ['Harvest API Key'],
  },
  {
    id: 'ashby',
    name: 'Ashby',
    type: 'ats',
    logo: 'As',
    color: 'bg-sky-500',
    icon: 'As',
    category: 'ATS',
    description: 'Sync candidates, job postings, and applications from Ashby. Uses cursor-based pagination for efficient data retrieval. Supports webhook events for real-time hiring pipeline updates.',
    docsUrl: 'https://developers.ashbyhq.com/',
    setupSteps: [
      'Log into Ashby as an admin',
      'Navigate to Settings > Integrations > API Keys',
      'Click "Create API Key" and provide a name for the integration',
      'Select the required permissions (Candidates, Jobs, Applications)',
      'Copy the generated API key and enter it below',
    ],
    credentials: ['API Key'],
  },
  {
    id: 'lattice',
    name: 'Lattice',
    type: 'performance',
    logo: 'Lt',
    color: 'bg-violet-500',
    icon: 'Lt',
    category: 'Performance',
    description: 'Sync employee performance reviews, goals, and feedback from Lattice. Uses Bearer token authentication and cursor-based pagination. Import review cycles, ratings, and OKRs to enrich your people analytics.',
    docsUrl: 'https://developers.latticehq.com/',
    setupSteps: [
      'Log into Lattice as an admin',
      'Navigate to Admin > Integrations > API',
      'Click "Generate API Key" to create a new token',
      'Select scopes: Users (read), Reviews (read), Goals (read)',
      'Copy the Bearer token and enter it below',
    ],
    credentials: ['API Key (Bearer Token)'],
  },
]

interface AvailableIntegrationsGridProps {
  onShowDetail: (integration: Integration) => void
  connectedProviderIds: string[]
}

export default function AvailableIntegrationsGrid({ onShowDetail, connectedProviderIds }: AvailableIntegrationsGridProps) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const allCategories = Array.from(new Set(availableIntegrations.map((i) => i.category)))

  const filteredIntegrations = categoryFilter
    ? availableIntegrations.filter((i) => i.category === categoryFilter)
    : availableIntegrations

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'HRIS': return 'badge badge-primary'
      case 'ATS': return 'badge badge-success'
      case 'Payroll': return 'badge badge-warning'
      case 'Identity': return 'badge bg-amber-100 text-amber-700'
      case 'Performance': return 'badge bg-violet-100 text-violet-700'
      default: return 'badge bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="card-header mb-0">Available Integrations</h3>
        <div className="flex gap-2">
          <button onClick={() => setCategoryFilter(null)} className={clsx('badge cursor-pointer transition-colors', !categoryFilter ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>All</button>
          {allCategories.map((cat) => (
            <button key={cat} onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)} className={clsx('cursor-pointer transition-colors', categoryFilter === cat ? 'bg-gray-800 text-white badge' : getCategoryBadgeClass(cat))}>{cat}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredIntegrations
          .filter((i) => !connectedProviderIds.includes(i.id))
          .map((integration) => (
            <div key={integration.id} className="flex flex-col p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group">
              <div className="flex items-center gap-3 mb-2">
                <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs group-hover:scale-110 transition-transform', integration.color)}>{integration.logo}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{integration.name}</p>
                  <span className={clsx('text-xs', getCategoryBadgeClass(integration.category))}>{integration.category}</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-3 line-clamp-2">{integration.description}</p>
              <button onClick={() => onShowDetail(integration)} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 mt-auto w-fit">
                <LinkIcon className="w-3.5 h-3.5" />
                Connect
              </button>
            </div>
          ))}
      </div>
    </div>
  )
}
