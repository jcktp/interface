import { useState } from 'react'
import type { OnboardingData } from '../../pages/Onboarding'
import { BuildingOfficeIcon } from '@heroicons/react/24/outline'

interface Props {
  data: OnboardingData
  updateData: (updates: Partial<OnboardingData>) => void
  onNext: () => void
}

const industries = [
  'Technology',
  'Healthcare',
  'Finance & Banking',
  'Retail',
  'Manufacturing',
  'Education',
  'Professional Services',
  'Media & Entertainment',
  'Real Estate',
  'Non-profit',
  'Other',
]

const companySizes = [
  '1-10 employees',
  '11-50 employees',
  '51-200 employees',
  '201-500 employees',
  '501-1000 employees',
  '1001-5000 employees',
  '5000+ employees',
]

const countries = [
  'United States',
  'United Kingdom',
  'Canada',
  'Germany',
  'France',
  'Australia',
  'Singapore',
  'India',
  'Japan',
  'Other',
]

export default function OrganizationSetup({ data, updateData, onNext }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}

    if (!data.organizationName.trim()) {
      newErrors.organizationName = 'Organization name is required'
    }
    if (!data.industry) {
      newErrors.industry = 'Please select your industry'
    }
    if (!data.companySize) {
      newErrors.companySize = 'Please select your company size'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    onNext()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <BuildingOfficeIcon className="h-8 w-8 text-primary-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Set up your organization</h2>
        <p className="mt-2 text-gray-600">
          Tell us about your company to personalize your experience
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700">
            Organization name *
          </label>
          <input
            type="text"
            id="organizationName"
            value={data.organizationName}
            onChange={(e) => updateData({ organizationName: e.target.value })}
            className={`mt-1 input ${errors.organizationName ? 'border-danger-500' : ''}`}
            placeholder="Acme Inc."
          />
          {errors.organizationName && (
            <p className="mt-1 text-sm text-danger-600">{errors.organizationName}</p>
          )}
        </div>

        <div>
          <label htmlFor="industry" className="block text-sm font-medium text-gray-700">
            Industry *
          </label>
          <select
            id="industry"
            value={data.industry}
            onChange={(e) => updateData({ industry: e.target.value })}
            className={`mt-1 input ${errors.industry ? 'border-danger-500' : ''}`}
          >
            <option value="">Select your industry</option>
            {industries.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
          {errors.industry && (
            <p className="mt-1 text-sm text-danger-600">{errors.industry}</p>
          )}
        </div>

        <div>
          <label htmlFor="companySize" className="block text-sm font-medium text-gray-700">
            Company size *
          </label>
          <select
            id="companySize"
            value={data.companySize}
            onChange={(e) => updateData({ companySize: e.target.value })}
            className={`mt-1 input ${errors.companySize ? 'border-danger-500' : ''}`}
          >
            <option value="">Select company size</option>
            {companySizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          {errors.companySize && (
            <p className="mt-1 text-sm text-danger-600">{errors.companySize}</p>
          )}
        </div>

        <div>
          <label htmlFor="country" className="block text-sm font-medium text-gray-700">
            Country
          </label>
          <select
            id="country"
            value={data.country}
            onChange={(e) => updateData({ country: e.target.value })}
            className="mt-1 input"
          >
            <option value="">Select country (optional)</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>

        <div className="pt-4">
          <button type="submit" className="btn-primary w-full py-3">
            Continue
          </button>
        </div>
      </form>
    </div>
  )
}
