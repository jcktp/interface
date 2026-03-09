import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheckIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import api from '../../api'

interface SSOConfig {
  id: string
  provider: string
  name: string
  is_enabled: boolean
  is_primary: boolean
  auto_provision_users: boolean
  default_role: string
  created_at: string
}

interface SSOFormData {
  provider: string
  name: string
  client_id: string
  client_secret: string
  redirect_uri: string
  scopes: string
  okta_domain: string
  azure_tenant_id: string
  google_hosted_domain: string
  auto_provision_users: boolean
  default_role: string
  allowed_email_domains: string
}

const PROVIDERS = [
  { id: 'google', name: 'Google', icon: GoogleIcon },
  { id: 'azure', name: 'Microsoft Azure AD', icon: MicrosoftIcon },
  { id: 'okta', name: 'Okta', icon: OktaIcon },
  { id: 'saml', name: 'SAML 2.0', icon: SAMLIcon },
]

function GoogleIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 23 23">
      <path fill="#f35325" d="M1 1h10v10H1z"/>
      <path fill="#81bc06" d="M12 1h10v10H12z"/>
      <path fill="#05a6f0" d="M1 12h10v10H1z"/>
      <path fill="#ffba08" d="M12 12h10v10H12z"/>
    </svg>
  )
}

function OktaIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#007DC1"/>
      <circle cx="12" cy="12" r="4" fill="white"/>
    </svg>
  )
}

function SAMLIcon() {
  return (
    <ShieldCheckIcon className="w-6 h-6 text-purple-600" />
  )
}

const defaultFormData: SSOFormData = {
  provider: '',
  name: '',
  client_id: '',
  client_secret: '',
  redirect_uri: '',
  scopes: '',
  okta_domain: '',
  azure_tenant_id: '',
  google_hosted_domain: '',
  auto_provision_users: true,
  default_role: 'viewer',
  allowed_email_domains: '',
}

export default function SSOSettings() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<SSOFormData>(defaultFormData)

  const { data: configs, isLoading } = useQuery({
    queryKey: ['sso-configs'],
    queryFn: async () => {
      const response = await api.get('/admin/sso/configs')
      return response.data.configs as SSOConfig[]
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: SSOFormData) => {
      const response = await api.post('/admin/sso/configs', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-configs'] })
      toast.success('SSO configuration created')
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create configuration')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SSOFormData> }) => {
      const response = await api.put(`/admin/sso/configs/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-configs'] })
      toast.success('SSO configuration updated')
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update configuration')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/sso/configs/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-configs'] })
      toast.success('SSO configuration deleted')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete configuration')
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const response = await api.put(`/admin/sso/configs/${id}`, { is_enabled })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-configs'] })
      toast.success('SSO configuration updated')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update configuration')
    },
  })

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData(defaultFormData)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleEdit = (config: SSOConfig) => {
    setEditingId(config.id)
    setFormData({
      ...defaultFormData,
      provider: config.provider,
      name: config.name,
      auto_provision_users: config.auto_provision_users,
      default_role: config.default_role,
    })
    setShowForm(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this SSO configuration?')) {
      deleteMutation.mutate(id)
    }
  }

  const getProviderInfo = (providerId: string) => {
    return PROVIDERS.find(p => p.id === providerId)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SSO Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure single sign-on authentication for your organization
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary inline-flex items-center gap-2"
        >
          <PlusIcon className="h-5 w-5" />
          Add SSO Provider
        </button>
      </div>

      {/* Configured Providers */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Configured Providers</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : configs && configs.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {configs.map((config) => {
              const provider = getProviderInfo(config.provider)
              const Icon = provider?.icon || ShieldCheckIcon

              return (
                <div key={config.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Icon />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{config.name}</h3>
                      <p className="text-sm text-gray-500">
                        {provider?.name || config.provider}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Status */}
                    <button
                      onClick={() => toggleMutation.mutate({
                        id: config.id,
                        is_enabled: !config.is_enabled,
                      })}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                        config.is_enabled
                          ? 'bg-success-100 text-success-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {config.is_enabled ? (
                        <>
                          <CheckCircleIcon className="h-4 w-4" />
                          Enabled
                        </>
                      ) : (
                        <>
                          <XCircleIcon className="h-4 w-4" />
                          Disabled
                        </>
                      )}
                    </button>

                    {/* Actions */}
                    <button
                      onClick={() => handleEdit(config)}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(config.id)}
                      className="p-2 text-gray-400 hover:text-danger-600 rounded-lg hover:bg-gray-100"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <ShieldCheckIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No SSO providers configured yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
            >
              Add your first provider
            </button>
          </div>
        )}
      </div>

      {/* Available Providers */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Providers</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {PROVIDERS.map((provider) => {
            const isConfigured = configs?.some(c => c.provider === provider.id)
            const Icon = provider.icon

            return (
              <button
                key={provider.id}
                onClick={() => {
                  if (!isConfigured) {
                    setFormData({ ...defaultFormData, provider: provider.id, name: provider.name })
                    setShowForm(true)
                  }
                }}
                disabled={isConfigured}
                className={`p-4 rounded-lg border-2 text-center transition-colors ${
                  isConfigured
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                    : 'border-gray-200 hover:border-primary-500 hover:bg-primary-50 cursor-pointer'
                }`}
              >
                <div className="flex justify-center mb-2">
                  <Icon />
                </div>
                <p className="font-medium text-gray-900">{provider.name}</p>
                {isConfigured && (
                  <p className="text-xs text-success-600 mt-1">Configured</p>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Configuration Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingId ? 'Edit SSO Provider' : 'Add SSO Provider'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Provider Selection */}
              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Provider
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {PROVIDERS.map((provider) => {
                      const Icon = provider.icon
                      return (
                        <button
                          key={provider.id}
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            provider: provider.id,
                            name: provider.name,
                          }))}
                          className={`p-3 rounded-lg border-2 flex items-center gap-3 ${
                            formData.provider === provider.id
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Icon />
                          <span className="font-medium">{provider.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Basic Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="input mt-1"
                  placeholder="e.g., Company SSO"
                  required
                />
              </div>

              {/* OAuth Credentials */}
              {formData.provider !== 'saml' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Client ID
                      </label>
                      <input
                        type="text"
                        value={formData.client_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, client_id: e.target.value }))}
                        className="input mt-1"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Client Secret
                      </label>
                      <input
                        type="password"
                        value={formData.client_secret}
                        onChange={(e) => setFormData(prev => ({ ...prev, client_secret: e.target.value }))}
                        className="input mt-1"
                        required={!editingId}
                        placeholder={editingId ? '••••••••' : ''}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Redirect URI
                    </label>
                    <input
                      type="url"
                      value={formData.redirect_uri}
                      onChange={(e) => setFormData(prev => ({ ...prev, redirect_uri: e.target.value }))}
                      className="input mt-1"
                      placeholder={`${window.location.origin}/auth/oauth/${formData.provider}/callback`}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Leave blank to use default: {window.location.origin}/auth/oauth/{formData.provider}/callback
                    </p>
                  </div>
                </>
              )}

              {/* Provider-specific fields */}
              {formData.provider === 'okta' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Okta Domain
                  </label>
                  <input
                    type="text"
                    value={formData.okta_domain}
                    onChange={(e) => setFormData(prev => ({ ...prev, okta_domain: e.target.value }))}
                    className="input mt-1"
                    placeholder="your-company.okta.com"
                    required
                  />
                </div>
              )}

              {formData.provider === 'azure' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Tenant ID
                  </label>
                  <input
                    type="text"
                    value={formData.azure_tenant_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, azure_tenant_id: e.target.value }))}
                    className="input mt-1"
                    placeholder="common (for multi-tenant) or your tenant ID"
                  />
                </div>
              )}

              {formData.provider === 'google' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Hosted Domain (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.google_hosted_domain}
                    onChange={(e) => setFormData(prev => ({ ...prev, google_hosted_domain: e.target.value }))}
                    className="input mt-1"
                    placeholder="yourcompany.com"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Restrict to Google Workspace domain
                  </p>
                </div>
              )}

              {/* Provisioning Settings */}
              <div className="border-t pt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-4">User Provisioning</h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-700">Auto-provision users</p>
                      <p className="text-sm text-gray-500">
                        Automatically create accounts for new SSO users
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        auto_provision_users: !prev.auto_provision_users,
                      }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        formData.auto_provision_users ? 'bg-primary-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.auto_provision_users ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Default Role
                    </label>
                    <select
                      value={formData.default_role}
                      onChange={(e) => setFormData(prev => ({ ...prev, default_role: e.target.value }))}
                      className="input mt-1"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="analyst">Analyst</option>
                      <option value="hr_manager">HR Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Allowed Email Domains
                    </label>
                    <input
                      type="text"
                      value={formData.allowed_email_domains}
                      onChange={(e) => setFormData(prev => ({ ...prev, allowed_email_domains: e.target.value }))}
                      className="input mt-1"
                      placeholder="company.com, corp.company.com"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Comma-separated list. Leave blank to allow all domains.
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn-primary"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingId
                    ? 'Update Provider'
                    : 'Add Provider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
