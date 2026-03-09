import type { OnboardingData } from '../../pages/Onboarding'
import {
  DocumentArrowUpIcon,
  CloudArrowUpIcon,
  CursorArrowRaysIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'

interface Props {
  data: OnboardingData
  updateData: (updates: Partial<OnboardingData>) => void
  onNext: () => void
  onBack: () => void
}

const importOptions = [
  {
    id: 'csv',
    name: 'Upload CSV/Excel',
    description: 'Import your employee data from a spreadsheet',
    icon: DocumentArrowUpIcon,
    recommended: true,
  },
  {
    id: 'api',
    name: 'Connect HRIS/ATS',
    description: 'Sync data from Workday, BambooHR, Greenhouse, etc.',
    icon: CloudArrowUpIcon,
    recommended: false,
  },
  {
    id: 'empty',
    name: 'Start Empty',
    description: "I'll add data manually or connect later",
    icon: CursorArrowRaysIcon,
    recommended: false,
  },
] as const

export default function DataImportChoice({ data, updateData, onNext, onBack }: Props) {
  const handleSelect = (method: 'csv' | 'api' | 'empty') => {
    updateData({ dataImportMethod: method })
  }

  const handleContinue = () => {
    if (data.dataImportMethod) {
      onNext()
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">How would you like to import data?</h2>
        <p className="mt-2 text-gray-600">
          Choose how to get your employee data into Interface
        </p>
      </div>

      <div className="space-y-4">
        {importOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => handleSelect(option.id)}
            className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
              data.dataImportMethod === option.id
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`p-2 rounded-lg ${
                data.dataImportMethod === option.id ? 'bg-primary-100' : 'bg-gray-100'
              }`}>
                <option.icon className={`h-6 w-6 ${
                  data.dataImportMethod === option.id ? 'text-primary-600' : 'text-gray-600'
                }`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{option.name}</h3>
                  {option.recommended && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-600">{option.description}</p>
              </div>
              {data.dataImportMethod === option.id && (
                <div className="flex-shrink-0">
                  <CheckIcon className="h-5 w-5 text-primary-600" />
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {data.dataImportMethod === 'api' && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Supported Integrations</h4>
          <div className="flex flex-wrap gap-2">
            {['Workday', 'BambooHR', 'Greenhouse', 'Lever', 'ADP', 'SAP SuccessFactors'].map((integration) => (
              <span key={integration} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-white border border-gray-200 text-gray-700">
                {integration}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex gap-4">
        <button
          onClick={onBack}
          className="btn-secondary flex-1 py-3"
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!data.dataImportMethod}
          className="btn-primary flex-1 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
