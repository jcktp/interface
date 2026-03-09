import { useState } from 'react'
import toast from 'react-hot-toast'
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  DocumentTextIcon,
  KeyIcon,
  CogIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { IntegrationCredentials } from '../types'

interface IntegrationWizardProps {
  provider: {
    id: string
    name: string
    type: 'hris' | 'ats' | 'payroll' | 'identity' | 'performance'
    logo: string
    color: string
  }
  onClose: () => void
  onConnect: (credentials: IntegrationCredentials) => void
}

// Integration-specific configuration
const INTEGRATION_CONFIG: Record<string, {
  authType: 'api_key' | 'oauth' | 'basic'
  fields: { name: string; key: string; type: string; required: boolean; placeholder: string; help?: string }[]
  dataTypes: string[]
  webhookSupported: boolean
  syncFrequency: string[]
  documentation: string
  setupSteps: string[]
}> = {
  workday: {
    authType: 'oauth',
    fields: [
      { name: 'Client ID', key: 'clientId', type: 'text', required: true, placeholder: 'Your Workday Client ID', help: 'Found in Workday > Integration > API Clients' },
      { name: 'Client Secret', key: 'clientSecret', type: 'password', required: true, placeholder: 'Your Client Secret' },
      { name: 'Tenant URL', key: 'subdomain', type: 'text', required: true, placeholder: 'https://wd2-impl-services1.workday.com/ccx/service/yourcompany' },
    ],
    dataTypes: ['Employees', 'Organizations', 'Positions', 'Compensation', 'Time Off', 'Performance'],
    webhookSupported: true,
    syncFrequency: ['Real-time', 'Hourly', 'Daily', 'Weekly'],
    documentation: 'https://community.workday.com/sites/default/files/file-hosting/productionapi/index.html',
    setupSteps: [
      'Create an Integration System User (ISU) in Workday',
      'Register an API Client in Workday Studio',
      'Configure Integration Security Group permissions',
      'Generate Client ID and Secret',
      'Enter credentials below to connect',
    ],
  },
  bamboohr: {
    authType: 'api_key',
    fields: [
      { name: 'API Key', key: 'apiKey', type: 'password', required: true, placeholder: 'Your BambooHR API Key', help: 'Found in Account Settings > API Keys' },
      { name: 'Company Subdomain', key: 'subdomain', type: 'text', required: true, placeholder: 'yourcompany (from yourcompany.bamboohr.com)' },
    ],
    dataTypes: ['Employees', 'Time Off', 'Benefits', 'Training', 'Documents'],
    webhookSupported: true,
    syncFrequency: ['Real-time (webhooks)', 'Hourly', 'Daily'],
    documentation: 'https://documentation.bamboohr.com/docs',
    setupSteps: [
      'Log in to BambooHR as an admin',
      'Go to Account Settings > API Keys',
      'Generate a new API key',
      'Copy your company subdomain from the URL',
      'Enter credentials below to connect',
    ],
  },
  greenhouse: {
    authType: 'api_key',
    fields: [
      { name: 'API Key', key: 'apiKey', type: 'password', required: true, placeholder: 'Your Greenhouse API Key', help: 'Found in Configure > Dev Center > API Credential Management' },
    ],
    dataTypes: ['Candidates', 'Applications', 'Jobs', 'Offers', 'Interviews', 'Scorecards'],
    webhookSupported: true,
    syncFrequency: ['Real-time (webhooks)', 'Hourly', 'Daily'],
    documentation: 'https://developers.greenhouse.io/harvest.html',
    setupSteps: [
      'Log in to Greenhouse as a Site Admin',
      'Go to Configure > Dev Center > API Credential Management',
      'Create a new API Key with Harvest permissions',
      'Select the data access level (read-only recommended)',
      'Enter the API key below to connect',
    ],
  },
  lever: {
    authType: 'api_key',
    fields: [
      { name: 'API Key', key: 'apiKey', type: 'password', required: true, placeholder: 'Your Lever API Key', help: 'Found in Settings > Integrations and API > Generate API Key' },
    ],
    dataTypes: ['Candidates', 'Opportunities', 'Postings', 'Interviews', 'Offers', 'Users'],
    webhookSupported: true,
    syncFrequency: ['Real-time (webhooks)', 'Every 15 min', 'Hourly', 'Daily'],
    documentation: 'https://hire.lever.co/developer/documentation',
    setupSteps: [
      'Log in to Lever as a Super Admin',
      'Go to Settings > Integrations and API',
      'Click "Generate New API Key"',
      'Copy the generated key (shown only once)',
      'Enter the API key below to connect',
    ],
  },
  adp: {
    authType: 'oauth',
    fields: [
      { name: 'Client ID', key: 'clientId', type: 'text', required: true, placeholder: 'Your ADP Client ID' },
      { name: 'Client Secret', key: 'clientSecret', type: 'password', required: true, placeholder: 'Your Client Secret' },
      { name: 'SSL Certificate (PEM Content)', key: 'certificate', type: 'text', required: true, placeholder: 'Paste content of .pem file' },
    ],
    dataTypes: ['Employees', 'Payroll', 'Benefits', 'Time & Attendance', 'Tax'],
    webhookSupported: false,
    syncFrequency: ['Daily', 'Weekly', 'After payroll run'],
    documentation: 'https://developers.adp.com/',
    setupSteps: [
      'Register your application in ADP Marketplace',
      'Complete the security assessment',
      'Generate SSL certificate for API authentication',
      'Receive Client ID and Secret from ADP',
      'Upload certificate and enter credentials below',
    ],
  },
  paylocity: {
    authType: 'oauth',
    fields: [
      { name: 'Client ID', key: 'clientId', type: 'text', required: true, placeholder: 'Your Paylocity Client ID' },
      { name: 'Client Secret', key: 'clientSecret', type: 'password', required: true, placeholder: 'Your Client Secret' },
      { name: 'Company ID', key: 'subdomain', type: 'text', required: true, placeholder: 'Your Paylocity Company ID' },
    ],
    dataTypes: ['Employees', 'Payroll', 'Time Off', 'Benefits', 'Deductions'],
    webhookSupported: true,
    syncFrequency: ['Real-time', 'Daily', 'After payroll'],
    documentation: 'https://developer.paylocity.com/',
    setupSteps: [
      'Contact Paylocity support to enable API access',
      'Register in the Paylocity Developer Portal',
      'Create an API application and get credentials',
      'Note your Company ID from Paylocity admin',
      'Enter credentials below to connect',
    ],
  },
  namely: {
    authType: 'oauth',
    fields: [
      { name: 'Access Token', key: 'apiKey', type: 'password', required: true, placeholder: 'Your Namely Access Token' },
      { name: 'Company Subdomain', key: 'subdomain', type: 'text', required: true, placeholder: 'yourcompany (from yourcompany.namely.com)' },
    ],
    dataTypes: ['Employees', 'Jobs', 'Performance', 'Time Off', 'Documents'],
    webhookSupported: true,
    syncFrequency: ['Hourly', 'Daily'],
    documentation: 'https://developers.namely.com/',
    setupSteps: [
      'Log in to Namely as an admin',
      'Go to Settings > API',
      'Generate a new access token',
      'Copy your company subdomain',
      'Enter credentials below to connect',
    ],
  },
  icims: {
    authType: 'oauth',
    fields: [
      { name: 'Customer ID', key: 'clientId', type: 'text', required: true, placeholder: 'Your iCIMS Customer ID' },
      { name: 'API Key', key: 'apiKey', type: 'password', required: true, placeholder: 'Your iCIMS API Key' },
      { name: 'API Username', key: 'username', type: 'text', required: true, placeholder: 'API Username' },
    ],
    dataTypes: ['Candidates', 'Jobs', 'Applications', 'Offers', 'Workflows'],
    webhookSupported: true,
    syncFrequency: ['Real-time (webhooks)', 'Hourly', 'Daily'],
    documentation: 'https://developer.icims.com/',
    setupSteps: [
      'Contact iCIMS support to enable API access for your platform',
      'Log into iCIMS as a Platform Admin',
      'Navigate to Admin > Integrations > API Keys',
      'Create an API user and generate credentials',
      'Enter the customer ID, API key, and username below',
    ],
  },
  ashby: {
    authType: 'api_key',
    fields: [
      { name: 'API Key', key: 'apiKey', type: 'password', required: true, placeholder: 'Your Ashby API Key', help: 'Found in Settings > Integrations > API Keys' },
    ],
    dataTypes: ['Candidates', 'Jobs', 'Applications', 'Interviews', 'Offers'],
    webhookSupported: true,
    syncFrequency: ['Real-time (webhooks)', 'Hourly', 'Daily'],
    documentation: 'https://developers.ashbyhq.com/',
    setupSteps: [
      'Log into Ashby as an admin',
      'Navigate to Settings > Integrations > API Keys',
      'Click "Create API Key" and provide a name for the integration',
      'Select the required permissions (Candidates, Jobs, Applications)',
      'Copy the generated API key and enter it below',
    ],
  },
  lattice: {
    authType: 'api_key',
    fields: [
      { name: 'API Key (Bearer Token)', key: 'apiKey', type: 'password', required: true, placeholder: 'Your Lattice API Key', help: 'Found in Admin > Integrations > API' },
    ],
    dataTypes: ['Users', 'Reviews', 'Goals', 'Feedback', 'OKRs'],
    webhookSupported: false,
    syncFrequency: ['Hourly', 'Daily', 'Weekly'],
    documentation: 'https://developers.latticehq.com/',
    setupSteps: [
      'Log into Lattice as an admin',
      'Navigate to Admin > Integrations > API',
      'Click "Generate API Key" to create a new token',
      'Select scopes: Users (read), Reviews (read), Goals (read)',
      'Copy the Bearer token and enter it below',
    ],
  },
  'sap-successfactors': {
    authType: 'oauth',
    fields: [
      { name: 'Company ID', key: 'clientId', type: 'text', required: true, placeholder: 'Your SAP SuccessFactors Company ID' },
      { name: 'Client ID', key: 'username', type: 'text', required: true, placeholder: 'OAuth Client ID' },
      { name: 'Client Secret / Private Key', key: 'clientSecret', type: 'password', required: true, placeholder: 'Your Client Secret or Private Key' },
      { name: 'API Endpoint URL', key: 'subdomain', type: 'text', required: true, placeholder: 'https://api.successfactors.com (data center specific)' },
    ],
    dataTypes: ['Employees', 'Organizations', 'Compensation', 'Performance', 'Time Off'],
    webhookSupported: false,
    syncFrequency: ['Daily', 'Weekly'],
    documentation: 'https://help.sap.com/docs/SAP_SUCCESSFACTORS/28bc3c8e3f214ab487ec51b1b8709adc/overview.html',
    setupSteps: [
      'Register an OAuth client in SuccessFactors Admin Center',
      'Navigate to Admin Center > Manage OAuth2 Client Applications',
      'Create a new application with the required API permissions',
      'Download the X.509 certificate and private key',
      'Enter the Company ID, Client ID, and upload the certificate below',
      'Configure the API endpoint URL for your data center region',
    ],
  },
  ukg: {
    authType: 'api_key',
    fields: [
      { name: 'API Key', key: 'apiKey', type: 'password', required: true, placeholder: 'Your UKG API Key' },
      { name: 'Tenant ID / Customer API Key', key: 'clientId', type: 'text', required: true, placeholder: 'Your UKG Tenant or Customer ID' },
      { name: 'Username', key: 'username', type: 'text', required: true, placeholder: 'Service account username' },
      { name: 'Password', key: 'clientSecret', type: 'password', required: true, placeholder: 'Service account password' },
      { name: 'API Endpoint URL', key: 'subdomain', type: 'text', required: true, placeholder: 'https://service4.ultipro.com' },
    ],
    dataTypes: ['Employees', 'Payroll', 'Time & Attendance', 'Benefits', 'Scheduling'],
    webhookSupported: true,
    syncFrequency: ['Real-time', 'Daily', 'Weekly'],
    documentation: 'https://developer.ukg.com/',
    setupSteps: [
      'Request API access through UKG Community or your account representative',
      'Log into UKG Pro as a System Admin',
      'Navigate to System Configuration > Security > Web Services',
      'Create a new Service Account with API access',
      'Generate the API key and note your tenant/customer ID',
      'Enter the API key, tenant URL, and credentials below',
    ],
  },
  'google-workspace': {
    authType: 'oauth',
    fields: [
      { name: 'Service Account JSON Key', key: 'apiKey', type: 'password', required: true, placeholder: 'Paste the contents of the JSON key file' },
      { name: 'Admin Email (for delegation)', key: 'username', type: 'text', required: true, placeholder: 'admin@yourcompany.com' },
      { name: 'Google Workspace Domain', key: 'subdomain', type: 'text', required: true, placeholder: 'yourcompany.com' },
    ],
    dataTypes: ['Users', 'Organizational Units', 'Groups', 'Group Memberships'],
    webhookSupported: false,
    syncFrequency: ['Hourly', 'Daily', 'Weekly'],
    documentation: 'https://developers.google.com/workspace/admin/directory/v1/guides',
    setupSteps: [
      'Go to the Google Cloud Console (console.cloud.google.com)',
      'Create a new project or select an existing one',
      'Enable the Admin SDK API under APIs & Services',
      'Create a Service Account under IAM & Admin > Service Accounts',
      'Generate and download a JSON key for the service account',
      'In Google Workspace Admin Console, go to Security > API Controls > Domain-wide Delegation',
      'Add the service account client ID with the required directory scopes',
      'Enter the service account JSON, admin email, and domain below',
    ],
  },
}

const STEPS = [
  { id: 'overview', name: 'Overview', icon: DocumentTextIcon },
  { id: 'credentials', name: 'Credentials', icon: KeyIcon },
  { id: 'configure', name: 'Configure', icon: CogIcon },
  { id: 'complete', name: 'Complete', icon: CheckBadgeIcon },
]

export default function IntegrationWizard({ provider, onClose, onConnect }: IntegrationWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [credentials, setCredentials] = useState<IntegrationCredentials>({})
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>([])
  const [syncFrequency, setSyncFrequency] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')

  const config = INTEGRATION_CONFIG[provider.id] || INTEGRATION_CONFIG.bamboohr

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleTestConnection = async () => {
    setConnectionStatus('testing')
    // Simulate API test
    await new Promise(resolve => setTimeout(resolve, 2000))
    setConnectionStatus('success')
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1500))
      onConnect(credentials)
      toast.success(`Successfully connected to ${provider.name}`)
      handleNext()
    } catch (error) {
      toast.error('Connection failed. Please check your credentials.')
      setConnectionStatus('error')
    } finally {
      setIsConnecting(false)
    }
  }

  const toggleDataType = (dataType: string) => {
    setSelectedDataTypes(prev =>
      prev.includes(dataType)
        ? prev.filter(d => d !== dataType)
        : [...prev, dataType]
    )
  }

  const isStepComplete = (stepIndex: number) => {
    switch (stepIndex) {
      case 0: return true // Overview is always complete after viewing
      case 1: return config.fields.filter(f => f.required).every(f => credentials[f.key as keyof IntegrationCredentials])
      case 2: return selectedDataTypes.length > 0 && syncFrequency !== ''
      case 3: return connectionStatus === 'success'
      default: return false
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={clsx('w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg', provider.color)}>
              {provider.logo}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Connect {provider.name}</h2>
              <p className="text-sm text-gray-500">{provider.type.toUpperCase()} Integration</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={clsx(
                  'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors',
                  index < currentStep ? 'bg-success-500 border-success-500 text-white' :
                  index === currentStep ? 'bg-primary-500 border-primary-500 text-white' :
                  'bg-white border-gray-300 text-gray-400'
                )}>
                  {index < currentStep ? (
                    <CheckCircleIcon className="w-6 h-6" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                <span className={clsx(
                  'ml-2 text-sm font-medium',
                  index <= currentStep ? 'text-gray-900' : 'text-gray-400'
                )}>
                  {step.name}
                </span>
                {index < STEPS.length - 1 && (
                  <div className={clsx(
                    'w-12 h-0.5 mx-4',
                    index < currentStep ? 'bg-success-500' : 'bg-gray-300'
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Overview */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Setup Instructions</h3>
                <ol className="space-y-3">
                  {config.setupSteps.map((step, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <span className="text-gray-600">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Available Data</h4>
                  <div className="flex flex-wrap gap-2">
                    {config.dataTypes.map(type => (
                      <span key={type} className="badge badge-primary">{type}</span>
                    ))}
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Sync Options</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {config.syncFrequency.map(freq => (
                      <li key={freq}>{freq}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <a
                href={config.documentation}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
              >
                <DocumentTextIcon className="w-5 h-5" />
                View {provider.name} API Documentation
              </a>
            </div>
          )}

          {/* Step 2: Credentials */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <p className="text-gray-600">
                Enter your {provider.name} API credentials. These will be encrypted and stored securely.
              </p>

              {config.fields.map(field => (
                <div key={field.key}>
                  <label className="label">
                    {field.name}
                    {field.required && <span className="text-danger-500 ml-1">*</span>}
                  </label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={credentials[field.key as keyof IntegrationCredentials] || ''}
                    onChange={(e) => setCredentials({ ...credentials, [field.key]: e.target.value })}
                    className="input"
                  />
                  {field.help && (
                    <p className="text-xs text-gray-500 mt-1">{field.help}</p>
                  )}
                </div>
              ))}

              <div className="flex items-center gap-4">
                <button
                  onClick={handleTestConnection}
                  disabled={!isStepComplete(1) || connectionStatus === 'testing'}
                  className="btn-secondary"
                >
                  {connectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                </button>
                {connectionStatus === 'success' && (
                  <span className="flex items-center gap-2 text-success-600">
                    <CheckCircleIcon className="w-5 h-5" />
                    Connection successful
                  </span>
                )}
                {connectionStatus === 'error' && (
                  <span className="flex items-center gap-2 text-danger-600">
                    <ExclamationCircleIcon className="w-5 h-5" />
                    Connection failed
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Configure */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Select Data to Sync</h3>
                <div className="grid grid-cols-2 gap-3">
                  {config.dataTypes.map(dataType => (
                    <button
                      key={dataType}
                      onClick={() => toggleDataType(dataType)}
                      className={clsx(
                        'p-3 rounded-lg border-2 text-left transition-colors',
                        selectedDataTypes.includes(dataType)
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedDataTypes.includes(dataType)}
                          readOnly
                          className="h-4 w-4 rounded border-gray-300 text-primary-600"
                        />
                        <span className="font-medium">{dataType}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Sync Frequency</h3>
                <select
                  value={syncFrequency}
                  onChange={(e) => setSyncFrequency(e.target.value)}
                  className="input"
                >
                  <option value="">Select frequency...</option>
                  {config.syncFrequency.map(freq => (
                    <option key={freq} value={freq}>{freq}</option>
                  ))}
                </select>
              </div>

              {config.webhookSupported && (
                <div className="p-4 bg-primary-50 rounded-lg">
                  <h4 className="font-medium text-primary-900 mb-2">Webhook Configuration</h4>
                  <p className="text-sm text-primary-700 mb-3">
                    Enable real-time updates by configuring webhooks in {provider.name}.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={`https://api.interface.app/webhooks/${provider.id}`}
                      readOnly
                      className="input flex-1 font-mono text-sm"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`https://api.interface.app/webhooks/${provider.id}`)
                        toast.success('Webhook URL copied')
                      }}
                      className="btn-secondary"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Complete */}
          {currentStep === 3 && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircleIcon className="w-12 h-12 text-success-500" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">Connection Successful!</h3>
              <p className="text-gray-600 mb-8">
                {provider.name} is now connected. Your data will sync according to your configuration.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 max-w-md mx-auto text-left">
                <h4 className="font-medium text-gray-900 mb-3">Connection Summary</h4>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Provider:</dt>
                    <dd className="font-medium">{provider.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Data Types:</dt>
                    <dd className="font-medium">{selectedDataTypes.length} selected</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Sync Frequency:</dt>
                    <dd className="font-medium">{syncFrequency}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Status:</dt>
                    <dd className="font-medium text-success-600">Active</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-between">
          <button
            onClick={currentStep === 0 ? onClose : handleBack}
            className="btn-secondary"
          >
            {currentStep === 0 ? 'Cancel' : (
              <>
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back
              </>
            )}
          </button>

          {currentStep < STEPS.length - 1 ? (
            <button
              onClick={currentStep === 2 ? handleConnect : handleNext}
              disabled={!isStepComplete(currentStep) || isConnecting}
              className="btn-primary"
            >
              {isConnecting ? 'Connecting...' : currentStep === 2 ? 'Connect' : (
                <>
                  Next
                  <ArrowRightIcon className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          ) : (
            <button onClick={onClose} className="btn-primary">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
