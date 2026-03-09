import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store'
import api from '../api'
import Logo from '../components/Logo'

export default function SSOCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setUser } = useStore()
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(true)

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const errorParam = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      // Handle OAuth error
      if (errorParam) {
        setError(errorDescription || errorParam)
        setIsProcessing(false)
        return
      }

      if (!code || !state) {
        setError('Missing authorization code or state')
        setIsProcessing(false)
        return
      }

      try {
        // Extract provider from URL path
        const pathParts = window.location.pathname.split('/')
        const providerIndex = pathParts.indexOf('oauth') + 1
        const provider = pathParts[providerIndex] || 'unknown'

        // Exchange code for tokens
        const response = await api.get(`/auth/oauth/${provider}/callback`, {
          params: { code, state },
        })

        const { access_token, refresh_token, user, redirect_to } = response.data

        // Update store with auth data
        const storage = localStorage.getItem('hr-analytics-storage')
        if (storage) {
          const storeState = JSON.parse(storage)
          storeState.state = {
            ...storeState.state,
            token: access_token,
            refreshToken: refresh_token,
            isAuthenticated: true,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              lastLogin: new Date().toISOString(),
            },
          }
          localStorage.setItem('hr-analytics-storage', JSON.stringify(storeState))
        }

        // Navigate to the redirect URL or dashboard
        navigate(redirect_to || '/app/dashboard', { replace: true })
      } catch (err: any) {
        console.error('SSO callback error:', err)
        const message = err.response?.data?.detail || 'Authentication failed'
        setError(message)
        setIsProcessing(false)
      }
    }

    handleCallback()
  }, [searchParams, navigate, setUser])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <Logo />
          </div>
          <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-danger-100">
                <svg className="h-6 w-6 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="mt-4 text-lg font-medium text-gray-900">Authentication Failed</h2>
              <p className="mt-2 text-sm text-gray-500">{error}</p>
              <div className="mt-6">
                <button
                  onClick={() => navigate('/login')}
                  className="btn-primary w-full"
                >
                  Back to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Logo />
        </div>
        <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="animate-spin mx-auto h-12 w-12 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            <h2 className="mt-4 text-lg font-medium text-gray-900">
              {isProcessing ? 'Completing sign in...' : 'Redirecting...'}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Please wait while we authenticate your account.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
