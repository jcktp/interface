import { LinkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useState } from 'react'

export interface Integration {
  id: string
  name: string
  icon: string
  category: string
  categoryGroup: string  // top-level category for sections
  description: string
  docsUrl: string
  setupSteps: string[]
  credentials: string[]
  connected?: boolean
  logo: string
  color: string
  type: 'hris' | 'ats' | 'payroll' | 'identity' | 'performance' | 'communication' | 'analytics' | 'lms' | 'benefits'
  popular?: boolean
}

export const availableIntegrations: Integration[] = [
  // ─── HRIS ──────────────────────────────────────────────────────────────────
  {
    id: 'workday',
    name: 'Workday',
    type: 'hris',
    logo: 'W',
    color: 'bg-orange-500',
    icon: 'W',
    category: 'HRIS',
    categoryGroup: 'HR Systems',
    popular: true,
    description: 'Sync employee records, org charts, and compensation data from Workday HCM. Supports real-time webhooks and scheduled batch imports.',
    docsUrl: 'https://developer.workday.com/docs',
    setupSteps: [
      'Log into Workday as an Integration System User (ISU)',
      'Navigate to Integration > Create Integration System User',
      'Generate API credentials under Security > API Client',
      'Grant the ISU access to the required domains (Worker Data, Organization Data)',
      'Enter the Workday tenant URL, client ID, and client secret',
    ],
    credentials: ['Tenant URL', 'Client ID', 'Client Secret', 'Refresh Token'],
  },
  {
    id: 'bamboohr',
    name: 'BambooHR',
    type: 'hris',
    logo: 'B',
    color: 'bg-green-600',
    icon: 'B',
    category: 'HRIS',
    categoryGroup: 'HR Systems',
    popular: true,
    description: 'Sync employee data, org structure, time-off records, and custom fields from BambooHR. REST API with webhooks for change events.',
    docsUrl: 'https://documentation.bamboohr.com/docs',
    setupSteps: [
      'Log into BambooHR as an admin',
      'Go to Account > API Keys',
      'Click "Add New Key" and name it "Interface"',
      'Copy the generated API key',
      'Enter your BambooHR subdomain and API key',
    ],
    credentials: ['Subdomain', 'API Key'],
  },
  {
    id: 'rippling',
    name: 'Rippling',
    type: 'hris',
    logo: 'R',
    color: 'bg-yellow-500',
    icon: 'R',
    category: 'HRIS',
    categoryGroup: 'HR Systems',
    description: 'Connect Rippling to sync employees, departments, compensation, and device data. OAuth 2.0 authentication with granular permission scopes.',
    docsUrl: 'https://developer.rippling.com/docs',
    setupSteps: [
      'Log into Rippling as a Super Admin',
      'Navigate to Apps > App Shop > Developer Tools',
      'Create a new API app and select required scopes',
      'Copy the client ID and client secret',
      'Complete the OAuth flow by authorising Interface',
    ],
    credentials: ['Client ID', 'Client Secret'],
  },
  {
    id: 'personio',
    name: 'Personio',
    type: 'hris',
    logo: 'Pe',
    color: 'bg-teal-600',
    icon: 'Pe',
    category: 'HRIS',
    categoryGroup: 'HR Systems',
    description: 'Sync employee profiles, absences, and org chart data from Personio. EU-focused HRIS popular among European companies.',
    docsUrl: 'https://developer.personio.de',
    setupSteps: [
      'Log into Personio as an Administrator',
      'Go to Settings > Integrations > API Credentials',
      'Create a new API credential set with read permissions',
      'Copy the Client ID and Client Secret',
      'Enter your Personio subdomain and credentials',
    ],
    credentials: ['Client ID', 'Client Secret'],
  },
  {
    id: 'hibob',
    name: 'HiBob',
    type: 'hris',
    logo: 'Hb',
    color: 'bg-purple-600',
    icon: 'Hb',
    category: 'HRIS',
    categoryGroup: 'HR Systems',
    description: 'Sync employee data, org structure, equity, and time management records from HiBob (Bob). Modern HRIS popular with fast-growing companies.',
    docsUrl: 'https://apidocs.hibob.com',
    setupSteps: [
      'Log into HiBob as an Admin',
      'Go to Settings > Integrations > Service Users',
      'Create a new Service User with read permissions',
      'Generate an access token for the service user',
      'Enter the service user ID and access token',
    ],
    credentials: ['Service User ID', 'Access Token'],
  },
  {
    id: 'successfactors',
    name: 'SAP SuccessFactors',
    type: 'hris',
    logo: 'SF',
    color: 'bg-blue-700',
    icon: 'SF',
    category: 'HRIS',
    categoryGroup: 'HR Systems',
    description: 'Sync core HR, talent management, and workforce analytics data from SAP SuccessFactors. OData API with support for all modules.',
    docsUrl: 'https://api.sap.com/products/SAPSuccessFactors/overview',
    setupSteps: [
      'Log into SAP SuccessFactors Admin Center',
      'Navigate to Manage OAuth2 Client Applications',
      'Create a new OAuth application with required API scopes',
      'Note the API server URL for your data center',
      'Enter server URL, company ID, client ID, and private key',
    ],
    credentials: ['API Server URL', 'Company ID', 'Client ID', 'X.509 Certificate / Private Key'],
  },

  // ─── ATS ───────────────────────────────────────────────────────────────────
  {
    id: 'greenhouse',
    name: 'Greenhouse',
    type: 'ats',
    logo: 'G',
    color: 'bg-emerald-500',
    icon: 'G',
    category: 'ATS',
    categoryGroup: 'Recruiting',
    popular: true,
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
    categoryGroup: 'Recruiting',
    description: 'Sync candidates, job postings, and applications from Ashby. Uses cursor-based pagination for efficient data retrieval.',
    docsUrl: 'https://developers.ashbyhq.com/',
    setupSteps: [
      'Log into Ashby as an admin',
      'Navigate to Settings > Integrations > API Keys',
      'Click "Create API Key" and provide a name',
      'Select required permissions (Candidates, Jobs, Applications)',
      'Copy the generated API key',
    ],
    credentials: ['API Key'],
  },
  {
    id: 'lever',
    name: 'Lever',
    type: 'ats',
    logo: 'Lv',
    color: 'bg-indigo-500',
    icon: 'Lv',
    category: 'ATS',
    categoryGroup: 'Recruiting',
    description: 'Sync candidates, opportunities, feedback, and offer data from Lever. Supports webhooks and bulk data export via the Lever Data API.',
    docsUrl: 'https://hire.lever.co/developer/documentation',
    setupSteps: [
      'Log into Lever as a Super Admin',
      'Navigate to Settings > Integrations > API Credentials',
      'Create a new API credential with Data Access scopes',
      'Copy the client ID and secret',
      'Complete the OAuth 2.0 authorisation flow',
    ],
    credentials: ['Client ID', 'Client Secret'],
  },
  {
    id: 'workable',
    name: 'Workable',
    type: 'ats',
    logo: 'Wk',
    color: 'bg-cyan-600',
    icon: 'Wk',
    category: 'ATS',
    categoryGroup: 'Recruiting',
    description: 'Import candidates, jobs, and pipeline stages from Workable. Includes support for scorecards, tags, and offer data.',
    docsUrl: 'https://workable.readme.io/docs',
    setupSteps: [
      'Log into Workable as an Admin',
      'Go to Settings > Integrations > Access Token',
      'Generate a new access token',
      'Note your Workable subdomain',
      'Enter the subdomain and access token',
    ],
    credentials: ['Subdomain', 'Access Token'],
  },
  {
    id: 'smartrecruiters',
    name: 'SmartRecruiters',
    type: 'ats',
    logo: 'SR',
    color: 'bg-blue-500',
    icon: 'SR',
    category: 'ATS',
    categoryGroup: 'Recruiting',
    description: 'Sync jobs, candidates, applications, and offer management data from SmartRecruiters. Enterprise ATS used by large organisations.',
    docsUrl: 'https://dev.smartrecruiters.com',
    setupSteps: [
      'Log into SmartRecruiters as a Super Admin',
      'Navigate to Admin > Apps & Integrations > API',
      'Create a new API access key',
      'Assign read permissions for Jobs, Candidates, Applications',
      'Copy the API key',
    ],
    credentials: ['API Key'],
  },

  // ─── Payroll ───────────────────────────────────────────────────────────────
  {
    id: 'adp',
    name: 'ADP Workforce Now',
    type: 'payroll',
    logo: 'ADP',
    color: 'bg-red-600',
    icon: 'ADP',
    category: 'Payroll',
    categoryGroup: 'Payroll & Benefits',
    popular: true,
    description: 'Sync payroll runs, salary records, deductions, and YTD earnings from ADP. Enterprise-grade payroll provider used by thousands of companies.',
    docsUrl: 'https://developers.adp.com',
    setupSteps: [
      'Contact your ADP account manager to enable API access',
      'Register in the ADP Marketplace as a developer',
      'Create an application and request the Payroll product',
      'Complete ADP\'s authentication onboarding',
      'Enter the client ID, client secret, and SSL certificate',
    ],
    credentials: ['Client ID', 'Client Secret', 'SSL Certificate'],
  },
  {
    id: 'gusto',
    name: 'Gusto',
    type: 'payroll',
    logo: 'Gu',
    color: 'bg-green-500',
    icon: 'Gu',
    category: 'Payroll',
    categoryGroup: 'Payroll & Benefits',
    description: 'Connect Gusto to sync payroll, benefits, contractors, and tax data. Popular with US SMBs. OAuth 2.0 with partner-level access.',
    docsUrl: 'https://docs.gusto.com',
    setupSteps: [
      'Apply for Gusto\'s Embedded Payroll Partner Program',
      'Receive OAuth client credentials from Gusto',
      'Build the OAuth flow to authorise access',
      'Sync employees, pay stubs, and benefits data',
      'Enter client ID and secret to connect',
    ],
    credentials: ['Client ID', 'Client Secret'],
  },
  {
    id: 'deel',
    name: 'Deel',
    type: 'payroll',
    logo: 'De',
    color: 'bg-slate-700',
    icon: 'De',
    category: 'Payroll',
    categoryGroup: 'Payroll & Benefits',
    description: 'Sync global contractor and EOR employee records, payroll, and compliance data from Deel. Ideal for distributed/remote-first companies.',
    docsUrl: 'https://developer.deel.com',
    setupSteps: [
      'Log into Deel as an Organisation Admin',
      'Navigate to Settings > API & Webhooks',
      'Generate a new API token with read permissions',
      'Enter the API token to connect',
    ],
    credentials: ['API Token'],
  },
  {
    id: 'paychex',
    name: 'Paychex Flex',
    type: 'payroll',
    logo: 'Px',
    color: 'bg-blue-600',
    icon: 'Px',
    category: 'Payroll',
    categoryGroup: 'Payroll & Benefits',
    description: 'Import payroll, employee demographics, and benefits data from Paychex Flex. Commonly used by US mid-market companies.',
    docsUrl: 'https://developer.paychex.com',
    setupSteps: [
      'Register on the Paychex Developer Portal',
      'Create a new application and select HR & Payroll scopes',
      'Complete the OAuth 2.0 application process',
      'Receive approval from Paychex partner team',
      'Enter your client ID and secret',
    ],
    credentials: ['Client ID', 'Client Secret'],
  },

  // ─── Performance ───────────────────────────────────────────────────────────
  {
    id: 'lattice',
    name: 'Lattice',
    type: 'performance',
    logo: 'Lt',
    color: 'bg-violet-500',
    icon: 'Lt',
    category: 'Performance',
    categoryGroup: 'Performance & Engagement',
    popular: true,
    description: 'Sync employee performance reviews, goals, and feedback from Lattice. Import review cycles, ratings, and OKRs to enrich analytics.',
    docsUrl: 'https://developers.latticehq.com/',
    setupSteps: [
      'Log into Lattice as an admin',
      'Navigate to Admin > Integrations > API',
      'Click "Generate API Key" to create a new token',
      'Select scopes: Users (read), Reviews (read), Goals (read)',
      'Copy the Bearer token',
    ],
    credentials: ['API Key (Bearer Token)'],
  },
  {
    id: 'cultureamp',
    name: 'Culture Amp',
    type: 'performance',
    logo: 'CA',
    color: 'bg-orange-400',
    icon: 'CA',
    category: 'Performance',
    categoryGroup: 'Performance & Engagement',
    description: 'Sync engagement survey results, performance reviews, and 1-on-1 data from Culture Amp. Market leader for employee engagement analytics.',
    docsUrl: 'https://developer.cultureamp.com',
    setupSteps: [
      'Contact Culture Amp support to enable API access',
      'Receive OAuth application credentials',
      'Authorise Interface via OAuth 2.0 flow',
      'Select the data scopes to sync (surveys, performance)',
      'Enter the client credentials',
    ],
    credentials: ['Client ID', 'Client Secret'],
  },
  {
    id: 'leapsome',
    name: 'Leapsome',
    type: 'performance',
    logo: 'Ls',
    color: 'bg-teal-500',
    icon: 'Ls',
    category: 'Performance',
    categoryGroup: 'Performance & Engagement',
    description: 'Sync reviews, goals, learning tracks, and engagement pulse data from Leapsome. EU-based performance management platform.',
    docsUrl: 'https://developers.leapsome.com',
    setupSteps: [
      'Log into Leapsome as a Company Admin',
      'Navigate to Settings > Integrations > API',
      'Generate an API token with read access',
      'Enter the API token to connect',
    ],
    credentials: ['API Token'],
  },
  {
    id: '15five',
    name: '15Five',
    type: 'performance',
    logo: '15',
    color: 'bg-yellow-600',
    icon: '15',
    category: 'Performance',
    categoryGroup: 'Performance & Engagement',
    description: 'Sync check-ins, OKRs, engagement surveys, and performance review data from 15Five. Popular with mid-market and growth companies.',
    docsUrl: 'https://my.15five.com/api/public',
    setupSteps: [
      'Log into 15Five as an Admin',
      'Navigate to Settings > Integrations > API',
      'Create an API token with the required scopes',
      'Enter your company domain and API token',
    ],
    credentials: ['Company Domain', 'API Token'],
  },

  // ─── Identity ──────────────────────────────────────────────────────────────
  {
    id: 'okta',
    name: 'Okta',
    type: 'identity',
    logo: 'Ok',
    color: 'bg-blue-800',
    icon: 'Ok',
    category: 'Identity / SSO',
    categoryGroup: 'Identity & SSO',
    popular: true,
    description: 'Sync user lifecycle events, group memberships, and app assignments from Okta. SAML/OIDC SSO plus SCIM provisioning for automatic user sync.',
    docsUrl: 'https://developer.okta.com/docs',
    setupSteps: [
      'Log into Okta Admin Console',
      'Navigate to Applications > API Services > Create App Integration',
      'Select OIDC or SAML as the sign-on method',
      'Add Interface as a trusted application',
      'Configure SCIM endpoint for user provisioning',
      'Copy the client ID, secret, and Okta domain',
    ],
    credentials: ['Okta Domain', 'Client ID', 'Client Secret'],
  },
  {
    id: 'azure-ad',
    name: 'Microsoft Entra ID',
    type: 'identity',
    logo: 'Az',
    color: 'bg-blue-600',
    icon: 'Az',
    category: 'Identity / SSO',
    categoryGroup: 'Identity & SSO',
    description: 'Sync users, groups, and licenses from Microsoft Entra ID (formerly Azure AD). SAML/OIDC SSO plus SCIM provisioning via Microsoft Graph API.',
    docsUrl: 'https://learn.microsoft.com/en-us/graph',
    setupSteps: [
      'Open the Azure Portal and navigate to Azure Active Directory',
      'Register a new application in App registrations',
      'Add Microsoft Graph API permissions (User.Read.All, Group.Read.All)',
      'Grant admin consent for the permissions',
      'Create a client secret and copy the values',
    ],
    credentials: ['Tenant ID', 'Client ID', 'Client Secret'],
  },
  {
    id: 'google-workspace',
    name: 'Google Workspace',
    type: 'identity',
    logo: 'GW',
    color: 'bg-red-500',
    icon: 'GW',
    category: 'Identity / SSO',
    categoryGroup: 'Identity & SSO',
    description: 'Sync directory, groups, and user profiles from Google Workspace. Supports Google Sign-In (OIDC) and Admin SDK Directory API.',
    docsUrl: 'https://developers.google.com/admin-sdk',
    setupSteps: [
      'Open Google Admin Console',
      'Navigate to Security > API Controls',
      'Create a service account in Google Cloud Console',
      'Enable domain-wide delegation for the service account',
      'Download the service account JSON key file',
      'Enter the service account email and upload the key',
    ],
    credentials: ['Service Account Email', 'Private Key JSON'],
  },

  // ─── Communication ─────────────────────────────────────────────────────────
  {
    id: 'slack',
    name: 'Slack',
    type: 'communication',
    logo: 'Sl',
    color: 'bg-purple-500',
    icon: 'Sl',
    category: 'Communication',
    categoryGroup: 'Communication',
    popular: true,
    description: 'Send alert notifications, AI-generated summaries, and workforce reports to Slack channels. Bi-directional: also pull org structure data.',
    docsUrl: 'https://api.slack.com',
    setupSteps: [
      'Go to api.slack.com and create a new app',
      'Add the Bot Token Scopes: chat:write, channels:read, users:read',
      'Install the app to your workspace',
      'Copy the Bot User OAuth Token',
      'Enter the token and select the default channel',
    ],
    credentials: ['Bot Token', 'Default Channel'],
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    type: 'communication',
    logo: 'MT',
    color: 'bg-indigo-600',
    icon: 'MT',
    category: 'Communication',
    categoryGroup: 'Communication',
    description: 'Send Interface reports and alerts to Microsoft Teams channels. Uses Adaptive Cards for rich notification formatting.',
    docsUrl: 'https://learn.microsoft.com/en-us/microsoftteams/platform',
    setupSteps: [
      'Go to the Teams App Studio or Developer Portal',
      'Create a new bot application in Azure AD',
      'Generate an incoming webhook URL for your channel',
      'Or register a full bot with Microsoft Bot Framework',
      'Enter the webhook URL',
    ],
    credentials: ['Webhook URL'],
  },

  // ─── Analytics ─────────────────────────────────────────────────────────────
  {
    id: 'tableau',
    name: 'Tableau',
    type: 'analytics',
    logo: 'Tb',
    color: 'bg-blue-500',
    icon: 'Tb',
    category: 'Analytics',
    categoryGroup: 'Analytics & BI',
    description: 'Push Interface metrics to Tableau Online or Tableau Server for advanced dashboards. Supports Hyper data extracts and live connections.',
    docsUrl: 'https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api.htm',
    setupSteps: [
      'Obtain a Personal Access Token from Tableau Online/Server',
      'Note your site name and server URL',
      'Configure a data source connection in Tableau',
      'Set up automated extract refresh or live query',
      'Enter the server URL, site name, and access token',
    ],
    credentials: ['Server URL', 'Site Name', 'Personal Access Token'],
  },
  {
    id: 'power-bi',
    name: 'Microsoft Power BI',
    type: 'analytics',
    logo: 'BI',
    color: 'bg-yellow-500',
    icon: 'BI',
    category: 'Analytics',
    categoryGroup: 'Analytics & BI',
    description: 'Push HR metrics and datasets to Power BI workspaces for advanced reports. Supports streaming datasets and scheduled refreshes.',
    docsUrl: 'https://learn.microsoft.com/en-us/power-bi/developer',
    setupSteps: [
      'Register an application in Azure AD',
      'Grant Power BI API permissions (Dataset.ReadWrite.All)',
      'Note your workspace/group ID',
      'Create a streaming dataset in Power BI',
      'Enter the client credentials and workspace ID',
    ],
    credentials: ['Tenant ID', 'Client ID', 'Client Secret', 'Workspace ID'],
  },
  {
    id: 'looker',
    name: 'Looker',
    type: 'analytics',
    logo: 'Lk',
    color: 'bg-purple-600',
    icon: 'Lk',
    category: 'Analytics',
    categoryGroup: 'Analytics & BI',
    description: 'Connect Interface data to Looker for custom HR explores and dashboards. Supports the Looker API for embedding and data delivery.',
    docsUrl: 'https://cloud.google.com/looker/docs/reference/looker-api',
    setupSteps: [
      'Log into Looker as an Admin',
      'Navigate to Admin > Users > API Keys',
      'Create a new API3 key for a service user',
      'Note your Looker instance URL',
      'Enter the instance URL, client ID, and client secret',
    ],
    credentials: ['Instance URL', 'Client ID', 'Client Secret'],
  },
]

const CATEGORY_GROUPS = [
  { id: 'HR Systems', label: 'HR Systems (HRIS)', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
  { id: 'Recruiting', label: 'Recruiting (ATS)', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' },
  { id: 'Payroll & Benefits', label: 'Payroll & Benefits', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
  { id: 'Performance & Engagement', label: 'Performance & Engagement', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800' },
  { id: 'Identity & SSO', label: 'Identity & SSO', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-700' },
  { id: 'Communication', label: 'Communication', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
  { id: 'Analytics & BI', label: 'Analytics & BI', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' },
]

interface AvailableIntegrationsGridProps {
  onShowDetail: (integration: Integration) => void
  connectedProviderIds: string[]
}

export default function AvailableIntegrationsGrid({ onShowDetail, connectedProviderIds }: AvailableIntegrationsGridProps) {
  const [search, setSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(CATEGORY_GROUPS.map(g => g.id))
  )

  const toggleGroup = (id: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = availableIntegrations.filter(i => {
    const connected = connectedProviderIds.includes(i.id)
    const matchesSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase())
    return !connected && matchesSearch
  })

  const groupedByCategory = CATEGORY_GROUPS.map(group => ({
    ...group,
    integrations: filtered.filter(i => i.categoryGroup === group.id),
  })).filter(g => g.integrations.length > 0)

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'HRIS': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
      case 'ATS': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      case 'Payroll': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      case 'Performance': return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
      case 'Identity / SSO': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
      case 'Communication': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
      case 'Analytics': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  return (
    <div className="space-y-4">
      {/* Header + Search */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="card-header mb-0">Available Integrations</h3>
          <p className="text-xs text-gray-500 mt-0.5">{availableIntegrations.length} integrations across 7 categories</p>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search integrations…"
          className="input w-56 text-sm"
        />
      </div>

      {groupedByCategory.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          No integrations match your search.
        </div>
      )}

      {/* Category sections */}
      {groupedByCategory.map(group => {
        const isCollapsed = collapsedGroups.has(group.id)
        return (
          <div key={group.id} className={clsx('rounded-xl border overflow-hidden', group.bg)}>
            {/* Section header */}
            <button
              onClick={() => toggleGroup(group.id)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className={clsx('text-xs font-bold uppercase tracking-widest', group.color)}>{group.label}</span>
                <span className="text-xs text-gray-400">({group.integrations.length})</span>
              </div>
              {isCollapsed ? <ChevronDownIcon className="h-4 w-4 text-gray-400" /> : <ChevronUpIcon className="h-4 w-4 text-gray-400" />}
            </button>

            {/* Integration cards */}
            {!isCollapsed && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-4 pb-4 bg-white dark:bg-gray-800/60">
                {group.integrations.map((integration) => (
                  <div
                    key={integration.id}
                    className="flex flex-col p-4 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0', integration.color)}>
                        {integration.logo}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">{integration.name}</p>
                          {integration.popular && (
                            <span className="text-[9px] font-bold uppercase tracking-wide bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">Popular</span>
                          )}
                        </div>
                        <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded', getCategoryBadgeClass(integration.category))}>{integration.category}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2 leading-relaxed">{integration.description}</p>
                    <button
                      onClick={() => onShowDetail(integration)}
                      className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 mt-auto w-fit group-hover:gap-2 transition-all"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
