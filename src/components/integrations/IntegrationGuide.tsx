import { BookOpenIcon } from '@heroicons/react/24/outline'

interface IntegrationGuideProps {
  integrationCount: number
}

export default function IntegrationGuide({ integrationCount }: IntegrationGuideProps) {
  return (
    <div className="card bg-gradient-to-r from-primary-50 to-primary-100 border-primary-200">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-primary-500 rounded-lg">
          <BookOpenIcon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-primary-900 mb-2">Integration Guide</h3>
          <p className="text-sm text-primary-700 mb-4">
            Connect your HR systems to automatically sync employee data, recruitment pipeline, and payroll information.
            Each integration includes a step-by-step setup wizard.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 bg-primary-200 text-primary-700 rounded-full flex items-center justify-center font-medium flex-shrink-0">1</span>
              <div>
                <p className="font-medium text-primary-900">Choose Integration</p>
                <p className="text-primary-600">Select from {integrationCount} supported providers</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 bg-primary-200 text-primary-700 rounded-full flex items-center justify-center font-medium flex-shrink-0">2</span>
              <div>
                <p className="font-medium text-primary-900">Enter Credentials</p>
                <p className="text-primary-600">API key or OAuth from your provider</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 bg-primary-200 text-primary-700 rounded-full flex items-center justify-center font-medium flex-shrink-0">3</span>
              <div>
                <p className="font-medium text-primary-900">Configure & Sync</p>
                <p className="text-primary-600">Select data types and sync frequency</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
