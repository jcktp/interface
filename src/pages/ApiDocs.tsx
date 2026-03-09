import { useState } from 'react'
import {
  DocumentTextIcon,
  KeyIcon,
  GlobeAltIcon,
  ServerIcon,
} from '@heroicons/react/24/outline'

interface EndpointGroup {
  name: string
  description: string
  endpoints: Endpoint[]
}

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  description: string
  permission?: string
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-100 text-green-700',
  POST: 'bg-accent-100 text-accent-700',
  PUT: 'bg-warning-100 text-warning-700',
  DELETE: 'bg-danger-100 text-danger-700',
}

const endpointGroups: EndpointGroup[] = [
  {
    name: 'Authentication',
    description: 'User authentication and session management',
    endpoints: [
      { method: 'POST', path: '/api/auth/login', description: 'Login with email and password' },
      { method: 'POST', path: '/api/auth/register', description: 'Register a new account (auto-login enabled)' },
      { method: 'POST', path: '/api/auth/logout', description: 'Logout and invalidate token' },
      { method: 'GET', path: '/api/auth/me', description: 'Get current user profile' },
      { method: 'POST', path: '/api/auth/verify-email', description: 'Verify email with token' },
    ],
  },
  {
    name: 'Employees',
    description: 'Employee data management and queries',
    endpoints: [
      { method: 'GET', path: '/api/employees', description: 'List employees with pagination and filters', permission: 'employees:view' },
      { method: 'GET', path: '/api/employees/:id', description: 'Get employee details', permission: 'employees:view' },
      { method: 'POST', path: '/api/employees', description: 'Create a new employee', permission: 'employees:create' },
      { method: 'PUT', path: '/api/employees/:id', description: 'Update employee data', permission: 'employees:edit' },
      { method: 'GET', path: '/api/employees/metrics', description: 'Get employee metrics summary', permission: 'analytics:view' },
    ],
  },
  {
    name: 'Candidates & Recruitment',
    description: 'Candidate pipeline and job requisitions',
    endpoints: [
      { method: 'GET', path: '/api/candidates', description: 'List candidates with filters', permission: 'candidates:view' },
      { method: 'POST', path: '/api/candidates', description: 'Create a candidate', permission: 'candidates:create' },
      { method: 'GET', path: '/api/requisitions', description: 'List job requisitions', permission: 'requisitions:view' },
      { method: 'POST', path: '/api/requisitions', description: 'Create a requisition', permission: 'requisitions:create' },
      { method: 'GET', path: '/api/requisitions/open/count', description: 'Count open requisitions', permission: 'requisitions:view' },
    ],
  },
  {
    name: 'Command Center',
    description: 'Organizational health monitoring and alerts',
    endpoints: [
      { method: 'GET', path: '/api/command-center/health', description: 'Get org health score and metrics', permission: 'command_center:view' },
      { method: 'GET', path: '/api/command-center/trends', description: 'Get health trends over time', permission: 'command_center:view' },
      { method: 'GET', path: '/api/command-center/alerts', description: 'Get active alerts', permission: 'command_center:view' },
    ],
  },
  {
    name: 'AI Assistant',
    description: 'Natural language queries powered by AI',
    endpoints: [
      { method: 'GET', path: '/api/ai/conversations', description: 'List AI conversations', permission: 'ai_qa:use' },
      { method: 'POST', path: '/api/ai/ask', description: 'Ask a question (NL to SQL)', permission: 'ai_qa:use' },
    ],
  },
  {
    name: 'KPIs & Targets',
    description: 'Key performance indicators and measurement',
    endpoints: [
      { method: 'GET', path: '/api/kpis/dashboard', description: 'Get KPI dashboard data', permission: 'kpis:view' },
      { method: 'GET', path: '/api/kpis/definitions', description: 'List KPI definitions', permission: 'kpis:view' },
      { method: 'POST', path: '/api/kpis/definitions', description: 'Create a KPI', permission: 'kpis:create' },
      { method: 'GET', path: '/api/kpis/targets', description: 'List KPI targets', permission: 'kpis:view' },
      { method: 'POST', path: '/api/kpis/calculate', description: 'Calculate KPI values', permission: 'kpis:view' },
    ],
  },
  {
    name: 'Attendance',
    description: 'Attendance tracking and compliance',
    endpoints: [
      { method: 'GET', path: '/api/attendance/summary', description: 'Get attendance summary', permission: 'attendance:view' },
      { method: 'GET', path: '/api/attendance/trends', description: 'Get attendance trends', permission: 'attendance:view' },
      { method: 'GET', path: '/api/attendance/targets', description: 'Get attendance targets', permission: 'attendance:view' },
      { method: 'GET', path: '/api/attendance/compliance', description: 'Get compliance report', permission: 'attendance:view' },
      { method: 'POST', path: '/api/attendance/import', description: 'Bulk import records', permission: 'attendance:import' },
    ],
  },
  {
    name: 'ML Models',
    description: 'Machine learning model management and training',
    endpoints: [
      { method: 'GET', path: '/api/ml/models', description: 'List all models', permission: 'ml:view' },
      { method: 'POST', path: '/api/ml/models', description: 'Create a model', permission: 'ml:create' },
      { method: 'GET', path: '/api/ml/models/:id', description: 'Get model details', permission: 'ml:view' },
      { method: 'PUT', path: '/api/ml/models/:id', description: 'Update model config', permission: 'ml:edit' },
      { method: 'POST', path: '/api/ml/models/:id/train', description: 'Start model training', permission: 'ml:train' },
      { method: 'POST', path: '/api/ml/models/:id/activate', description: 'Activate a trained model', permission: 'ml:activate' },
      { method: 'POST', path: '/api/ml/compare', description: 'Compare multiple models', permission: 'ml:view' },
      { method: 'GET', path: '/api/ml/hyperparameters/:algo', description: 'Get hyperparameter options', permission: 'ml:view' },
    ],
  },
  {
    name: 'Integrations',
    description: 'Third-party service connections',
    endpoints: [
      { method: 'GET', path: '/api/integrations/google-workspace/status', description: 'Google Workspace connection status' },
      { method: 'POST', path: '/api/integrations/google-workspace/configure', description: 'Configure Google Workspace' },
      { method: 'POST', path: '/api/integrations/google-workspace/sync', description: 'Sync users from Google Workspace' },
    ],
  },
  {
    name: 'Warehouse & Data',
    description: 'Data warehouse connections and queries',
    endpoints: [
      { method: 'GET', path: '/api/warehouse/connections', description: 'List warehouse connections', permission: 'warehouse:view' },
      { method: 'POST', path: '/api/warehouse/connections', description: 'Create a warehouse connection', permission: 'warehouse:manage' },
      { method: 'POST', path: '/api/warehouse/query', description: 'Execute a warehouse query', permission: 'warehouse:query' },
    ],
  },
  {
    name: 'Admin',
    description: 'User and organization management',
    endpoints: [
      { method: 'GET', path: '/api/admin/users', description: 'List organization users', permission: 'users:manage_roles' },
      { method: 'PUT', path: '/api/admin/users/:id/role', description: 'Update user role', permission: 'users:manage_roles' },
      { method: 'POST', path: '/api/admin/users/:id/deactivate', description: 'Deactivate a user', permission: 'users:manage_roles' },
    ],
  },
]

type TabType = 'endpoints' | 'auth' | 'overview' | 'swagger'

export default function ApiDocs() {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">API Documentation</h1>
        <p className="text-gray-600 mt-1">
          Reference guide for the Interface REST API
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {([
            { id: 'overview', label: 'Overview', icon: GlobeAltIcon },
            { id: 'auth', label: 'Authentication', icon: KeyIcon },
            { id: 'endpoints', label: 'Endpoints', icon: ServerIcon },
            { id: 'swagger', label: 'Interactive Docs', icon: DocumentTextIcon },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">API Overview</h2>
            <div className="space-y-4 text-sm text-gray-700">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="font-medium text-gray-900 mb-1">Base URL</p>
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">/api</code>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="font-medium text-gray-900 mb-1">Format</p>
                  <p>JSON request/response bodies</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="font-medium text-gray-900 mb-1">Authentication</p>
                  <p>Bearer token in Authorization header</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="font-medium text-gray-900 mb-1">Rate Limiting</p>
                  <p>100 requests per minute per token</p>
                </div>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Response Format</h3>
                <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto">
{`{
  "status": "success",
  "data": { ... },
  "message": "Optional message"
}

// Error response:
{
  "detail": "Error description"
}`}
                </pre>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-2">RBAC Permissions</h3>
                <p>
                  The API uses role-based access control with 5 roles: <strong>super_admin</strong>, <strong>admin</strong>,{' '}
                  <strong>hr_manager</strong>, <strong>analyst</strong>, and <strong>viewer</strong>. Each endpoint requires
                  specific permissions. Permissions are included in the login response.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Start</h2>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <div>
                  <p className="font-medium text-gray-900">Login to get a token</p>
                  <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs mt-1">
{`POST /api/auth/login
{ "email": "admin@interface.app", "password": "admin123" }`}
                  </pre>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <div>
                  <p className="font-medium text-gray-900">Use the token in subsequent requests</p>
                  <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs mt-1">
{`Authorization: Bearer <your-token>`}
                  </pre>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <div>
                  <p className="font-medium text-gray-900">Make API calls</p>
                  <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs mt-1">
{`GET /api/employees?limit=10&department=Engineering
Authorization: Bearer <token>`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auth Tab */}
      {activeTab === 'auth' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Authentication Flow</h2>
            <div className="space-y-4 text-sm text-gray-700">
              <p>
                The API uses token-based authentication. Obtain a token by logging in, then include it in the
                <code className="bg-gray-100 px-1 mx-1 rounded">Authorization</code> header of all requests.
              </p>

              <div>
                <h3 className="font-medium text-gray-900 mb-2">Login</h3>
                <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto">
{`POST /api/auth/login
Content-Type: application/json

{
  "email": "user@company.com",
  "password": "your-password"
}

// Response:
{
  "token": "eyJ...",
  "user": {
    "id": "uuid",
    "email": "user@company.com",
    "name": "User Name",
    "role": "admin",
    "permissions": ["employees:view", "analytics:view", ...]
  },
  "expires_at": "2026-02-17T12:00:00"
}`}
                </pre>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-2">Using the Token</h3>
                <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto">
{`GET /api/employees
Authorization: Bearer <your-token>
Content-Type: application/json`}
                </pre>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-2">Token Expiry</h3>
                <p>
                  Tokens expire after 24 hours. When a token expires, the API returns a <code className="bg-gray-100 px-1 rounded">401</code> status.
                  Re-authenticate to get a new token.
                </p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-2">Demo Credentials</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="text-left border-b border-gray-200">
                        <th className="pb-2 font-medium">Email</th>
                        <th className="pb-2 font-medium">Password</th>
                        <th className="pb-2 font-medium">Role</th>
                        <th className="pb-2 font-medium">Permissions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td className="py-2"><code>admin@interface.app</code></td>
                        <td className="py-2"><code>admin123</code></td>
                        <td className="py-2">Admin</td>
                        <td className="py-2">77 permissions (full access)</td>
                      </tr>
                      <tr>
                        <td className="py-2"><code>hr@interface.app</code></td>
                        <td className="py-2"><code>hr1234</code></td>
                        <td className="py-2">HR Manager</td>
                        <td className="py-2">46 permissions</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Endpoints Tab */}
      {activeTab === 'endpoints' && (
        <div className="space-y-3">
          {endpointGroups.map((group) => (
            <div key={group.name} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedGroup(expandedGroup === group.name ? null : group.name)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{group.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{group.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{group.endpoints.length} endpoints</span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${expandedGroup === group.name ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expandedGroup === group.name && (
                <div className="border-t border-gray-100">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500">
                        <th className="text-left px-4 py-2 w-20">Method</th>
                        <th className="text-left px-4 py-2">Path</th>
                        <th className="text-left px-4 py-2">Description</th>
                        <th className="text-left px-4 py-2 w-40">Permission</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {group.endpoints.map((endpoint, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5">
                            <span className={`inline-block text-xs font-mono font-semibold px-2 py-0.5 rounded ${METHOD_COLORS[endpoint.method]}`}>
                              {endpoint.method}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <code className="text-xs text-gray-800">{endpoint.path}</code>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-600">{endpoint.description}</td>
                          <td className="px-4 py-2.5">
                            {endpoint.permission ? (
                              <code className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{endpoint.permission}</code>
                            ) : (
                              <span className="text-xs text-gray-400">Public</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Swagger Tab */}
      {activeTab === 'swagger' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <p className="text-sm text-gray-600">
              Interactive API documentation powered by FastAPI/Swagger. You can test endpoints directly here.
            </p>
          </div>
          <iframe
            src="/docs"
            className="w-full border-0"
            style={{ height: 'calc(100vh - 280px)' }}
            title="Swagger API Docs"
          />
        </div>
      )}
    </div>
  )
}
