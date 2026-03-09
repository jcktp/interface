import type { OnboardingData } from '../../pages/Onboarding'
import { CheckCircleIcon, RocketLaunchIcon } from '@heroicons/react/24/outline'
import confetti from 'canvas-confetti'
import { useEffect } from 'react'

interface Props {
  data: OnboardingData
  onComplete: () => void
}

export default function Complete({ data, onComplete }: Props) {
  useEffect(() => {
    // Trigger confetti animation
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    })
  }, [])

  const importMethodLabel = {
    csv: 'Upload CSV/Excel files',
    api: 'Connect your HRIS/ATS',
    empty: 'Add data manually',
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircleIcon className="h-12 w-12 text-success-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">You're all set!</h2>
        <p className="mt-2 text-gray-600">
          Your organization is ready to go. Here's a summary of your setup:
        </p>
      </div>

      <div className="space-y-4 mb-8">
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Organization</h4>
          <p className="text-lg font-semibold text-gray-900">{data.organizationName}</p>
          <p className="text-sm text-gray-600">
            {data.industry} • {data.companySize}
          </p>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Data Import</h4>
          <p className="text-gray-900">
            {data.dataImportMethod ? importMethodLabel[data.dataImportMethod] : 'Not configured'}
          </p>
        </div>

        {data.teamEmails.length > 0 && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-500 mb-1">Team Invitations</h4>
            <p className="text-gray-900">
              {data.teamEmails.length} invitation{data.teamEmails.length > 1 ? 's' : ''} will be sent
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-primary-50 rounded-lg">
          <h4 className="text-sm font-medium text-primary-900 flex items-center gap-2">
            <RocketLaunchIcon className="h-5 w-5" />
            Next Steps
          </h4>
          <ul className="mt-3 space-y-2 text-sm text-primary-700">
            {data.dataImportMethod === 'csv' && (
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary-200 text-primary-700 text-xs flex items-center justify-center font-medium">1</span>
                Go to Data Management to upload your employee file
              </li>
            )}
            {data.dataImportMethod === 'api' && (
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary-200 text-primary-700 text-xs flex items-center justify-center font-medium">1</span>
                Go to API Connections to set up your integrations
              </li>
            )}
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary-200 text-primary-700 text-xs flex items-center justify-center font-medium">
                {data.dataImportMethod === 'empty' ? '1' : '2'}
              </span>
              Explore your dashboard to see analytics
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary-200 text-primary-700 text-xs flex items-center justify-center font-medium">
                {data.dataImportMethod === 'empty' ? '2' : '3'}
              </span>
              Set up workforce planning for headcount tracking
            </li>
          </ul>
        </div>

        <button
          onClick={onComplete}
          className="btn-primary w-full py-3 text-lg"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}
