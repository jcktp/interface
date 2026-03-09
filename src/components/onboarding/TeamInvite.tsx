import { useState } from 'react'
import type { OnboardingData } from '../../pages/Onboarding'
import { UserPlusIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface Props {
  data: OnboardingData
  updateData: (updates: Partial<OnboardingData>) => void
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

export default function TeamInvite({ data, updateData, onNext, onBack, onSkip }: Props) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const addEmail = () => {
    const trimmedEmail = email.trim().toLowerCase()

    if (!trimmedEmail) return

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address')
      return
    }

    if (data.teamEmails.includes(trimmedEmail)) {
      setError('This email has already been added')
      return
    }

    updateData({ teamEmails: [...data.teamEmails, trimmedEmail] })
    setEmail('')
    setError('')
  }

  const removeEmail = (emailToRemove: string) => {
    updateData({ teamEmails: data.teamEmails.filter(e => e !== emailToRemove) })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addEmail()
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <UserPlusIcon className="h-8 w-8 text-primary-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Invite your team</h2>
        <p className="mt-2 text-gray-600">
          Collaborate with your HR team members. You can always add more later.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email address
          </label>
          <div className="mt-1 flex gap-2">
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
              }}
              onKeyPress={handleKeyPress}
              className={`flex-1 input ${error ? 'border-danger-500' : ''}`}
              placeholder="colleague@company.com"
            />
            <button
              type="button"
              onClick={addEmail}
              className="btn-secondary px-4"
            >
              Add
            </button>
          </div>
          {error && (
            <p className="mt-1 text-sm text-danger-600">{error}</p>
          )}
        </div>

        {data.teamEmails.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Team members to invite ({data.teamEmails.length})
            </h4>
            <div className="space-y-2">
              {data.teamEmails.map((inviteEmail) => (
                <div
                  key={inviteEmail}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-sm text-gray-900">{inviteEmail}</span>
                  <button
                    onClick={() => removeEmail(inviteEmail)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 bg-primary-50 rounded-lg mt-6">
          <h4 className="text-sm font-medium text-primary-900">What happens next?</h4>
          <ul className="mt-2 text-sm text-primary-700 space-y-1">
            <li>Team members will receive an email invitation</li>
            <li>They can create their account and join your organization</li>
            <li>You can manage roles and permissions in Settings</li>
          </ul>
        </div>
      </div>

      <div className="mt-8 flex gap-4">
        <button
          onClick={onBack}
          className="btn-secondary flex-1 py-3"
        >
          Back
        </button>
        {data.teamEmails.length === 0 ? (
          <button
            onClick={onSkip}
            className="btn-primary flex-1 py-3"
          >
            Skip for Now
          </button>
        ) : (
          <button
            onClick={onNext}
            className="btn-primary flex-1 py-3"
          >
            Send Invites & Continue
          </button>
        )}
      </div>
    </div>
  )
}
