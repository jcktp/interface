import { useEffect, useState } from 'react'
import { Link, useSearchParams, useLocation } from 'react-router-dom'
import Logo from '../components/Logo'
import { CheckCircleIcon, ExclamationCircleIcon, EnvelopeIcon } from '@heroicons/react/24/outline'
import api from '../api'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const token = searchParams.get('token')
  const emailFromState = (location.state as { email?: string })?.email

  const [status, setStatus] = useState<'pending' | 'verifying' | 'success' | 'error'>('pending')
  const [message, setMessage] = useState('')
  const [email] = useState(emailFromState || '')

  useEffect(() => {
    if (token) {
      verifyToken()
    }
  }, [token])

  const verifyToken = async () => {
    setStatus('verifying')
    try {
      const response = await api.post('/auth/verify-email', { token })
      if (response.data.status === 'success') {
        setStatus('success')
        setMessage('Your email has been verified successfully!')
      }
    } catch (err: any) {
      setStatus('error')
      setMessage(err.response?.data?.detail || 'Verification failed')
    }
  }

  const resendVerification = async () => {
    if (!email) return

    try {
      await api.post('/auth/resend-verification', { email })
      setMessage('Verification email sent! Please check your inbox.')
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Failed to send email')
    }
  }

  // Show verification result if token provided
  if (token) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Link to="/" className="flex justify-center">
            <Logo />
          </Link>

          <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            {status === 'verifying' && (
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Verifying your email...</p>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center">
                <CheckCircleIcon className="h-16 w-16 text-success-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h2>
                <p className="text-gray-600 mb-6">{message}</p>
                <Link to="/login" className="btn-primary inline-block">
                  Sign in to your account
                </Link>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center">
                <ExclamationCircleIcon className="h-16 w-16 text-danger-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h2>
                <p className="text-gray-600 mb-6">{message}</p>
                <p className="text-sm text-gray-500 mb-4">
                  The link may have expired or already been used.
                </p>
                <Link to="/login" className="btn-secondary inline-block">
                  Back to login
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Show "check your email" message
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex justify-center">
          <Logo />
        </Link>

        <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <EnvelopeIcon className="h-8 w-8 text-primary-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
            <p className="text-gray-600 mb-6">
              We've sent a verification link to{' '}
              <strong>{email || 'your email address'}</strong>
            </p>

            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 mb-6">
              <p>Click the link in the email to verify your account. If you don't see it, check your spam folder.</p>
            </div>

            {message && (
              <div className="mb-4 p-3 bg-success-50 text-success-700 rounded-lg text-sm">
                {message}
              </div>
            )}

            <div className="space-y-4">
              {email && (
                <button
                  onClick={resendVerification}
                  className="text-primary-600 hover:text-primary-500 text-sm font-medium"
                >
                  Didn't receive the email? Click to resend
                </button>
              )}

              <div className="pt-4 border-t border-gray-200">
                <Link to="/login" className="text-gray-600 hover:text-gray-900 text-sm">
                  Back to login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
