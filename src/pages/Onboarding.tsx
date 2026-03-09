import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import OrganizationSetup from '../components/onboarding/OrganizationSetup'
import DataImportChoice from '../components/onboarding/DataImportChoice'
import TeamInvite from '../components/onboarding/TeamInvite'
import Complete from '../components/onboarding/Complete'
import { CheckIcon } from '@heroicons/react/24/solid'

const steps = [
  { id: 1, name: 'Organization' },
  { id: 2, name: 'Data Import' },
  { id: 3, name: 'Team' },
  { id: 4, name: 'Complete' },
]

export interface OnboardingData {
  organizationName: string
  industry: string
  companySize: string
  country: string
  dataImportMethod: 'csv' | 'api' | 'empty' | null
  teamEmails: string[]
}

export default function Onboarding() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [data, setData] = useState<OnboardingData>({
    organizationName: '',
    industry: '',
    companySize: '',
    country: '',
    dataImportMethod: null,
    teamEmails: [],
  })

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const skipStep = () => {
    nextStep()
  }

  const completeOnboarding = () => {
    // Navigate to dashboard
    navigate('/app/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <button
            onClick={() => navigate('/app/dashboard')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Skip setup
          </button>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <nav aria-label="Progress">
          <ol className="flex items-center">
            {steps.map((step, stepIdx) => (
              <li key={step.name} className={`relative ${stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20 flex-1' : ''}`}>
                {step.id < currentStep ? (
                  <>
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="h-0.5 w-full bg-primary-600" />
                    </div>
                    <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary-600">
                      <CheckIcon className="h-5 w-5 text-white" aria-hidden="true" />
                    </div>
                  </>
                ) : step.id === currentStep ? (
                  <>
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="h-0.5 w-full bg-gray-200" />
                    </div>
                    <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary-600 bg-white">
                      <span className="text-sm font-medium text-primary-600">{step.id}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="h-0.5 w-full bg-gray-200" />
                    </div>
                    <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 bg-white">
                      <span className="text-sm font-medium text-gray-500">{step.id}</span>
                    </div>
                  </>
                )}
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-medium text-gray-500 whitespace-nowrap">
                  {step.name}
                </span>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Step Content */}
      <div className="max-w-2xl mx-auto px-4 py-8 mt-8">
        {currentStep === 1 && (
          <OrganizationSetup
            data={data}
            updateData={updateData}
            onNext={nextStep}
          />
        )}
        {currentStep === 2 && (
          <DataImportChoice
            data={data}
            updateData={updateData}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}
        {currentStep === 3 && (
          <TeamInvite
            data={data}
            updateData={updateData}
            onNext={nextStep}
            onBack={prevStep}
            onSkip={skipStep}
          />
        )}
        {currentStep === 4 && (
          <Complete
            data={data}
            onComplete={completeOnboarding}
          />
        )}
      </div>
    </div>
  )
}
