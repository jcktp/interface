import { CheckCircleIcon, ExclamationTriangleIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline'
import { useLocalization } from '../../hooks/useLocalization'

interface Props {
  currentMetrics: {
    revenuePerEmployee: number
    profitPerEmployee: number
  }
  benchmarkComparison: any
  companyMetrics: {
    annualProfit: number
  }
}

export default function ScenarioRecommendations({ currentMetrics, benchmarkComparison, companyMetrics }: Props) {
  const loc = useLocalization()

  return (
    <div className="card">
      <h3 className="card-header">Scenario Recommendations</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-100 dark:border-success-800/50">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-success-900 dark:text-success-100 mb-2">Optimal Growth Path</h4>
              <p className="text-sm text-success-700 dark:text-success-300">
                Based on your current revenue per employee ({loc.currency(currentMetrics.revenuePerEmployee)}) being
                {benchmarkComparison.revenuePerEmployee.percentDiff >= 0 ? ' above' : ' below'} industry average,
                the <strong>Moderate Growth</strong> scenario offers the best balance of expansion and profitability.
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-100 dark:border-warning-800/50">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-warning-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-warning-900 dark:text-warning-100 mb-2">Recruiting Capacity</h4>
              <p className="text-sm text-warning-700 dark:text-warning-300">
                Aggressive growth scenarios may strain your recruiting team. Ensure recruiter capacity is reviewed
                before committing to &gt;20% headcount growth targets.
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-100 dark:border-primary-800/50">
          <div className="flex items-start gap-3">
            <ArrowTrendingUpIcon className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-primary-900 dark:text-primary-100 mb-2">Productivity Opportunity</h4>
              <p className="text-sm text-primary-700 dark:text-primary-300">
                Your profit per employee is {benchmarkComparison.profitPerEmployee.percentDiff >= 0 ? 'above' : 'below'} industry
                benchmarks. A 5% productivity improvement could yield
                {loc.currency(companyMetrics.annualProfit * 0.05, true)} in additional profit.
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-3">
            <ArrowTrendingDownIcon className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Contingency Planning</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                In an economic downturn scenario, reducing hiring to 30% pace while maintaining critical roles
                extends runway significantly without requiring layoffs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
