import { useLocalization } from '../../hooks/useLocalization'

interface Props {
  financialsLoading: boolean
  companyMetrics: {
    annualRevenue: number
    annualProfit: number
    currentHeadcount: number
    avgSalary: number
    revenuePerEmployee: number
    profitPerEmployee: number
  }
  currentMetrics: {
    revenuePerEmployee: number
    profitPerEmployee: number
    laborCostRatio: number
    productivityIndex: number
  }
}

export default function CompanyFinancialMetrics({ financialsLoading, companyMetrics, currentMetrics }: Props) {
  const loc = useLocalization()

  return (
    <div className="card">
      <h3 className="card-header">Company Financial Metrics</h3>
      {financialsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-full" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Annual Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{loc.currency(companyMetrics.annualRevenue, true)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Annual Profit</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{loc.currency(companyMetrics.annualProfit, true)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Current Headcount</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{loc.number(companyMetrics.currentHeadcount)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="p-3 bg-primary-50 rounded-lg">
              <p className="text-xs text-primary-600">Revenue per Employee</p>
              <p className="text-xl font-bold text-primary-900 mt-0.5">{loc.currency(currentMetrics.revenuePerEmployee)}</p>
            </div>
            <div className="p-3 bg-success-50 rounded-lg">
              <p className="text-xs text-success-600">Profit per Employee</p>
              <p className="text-xl font-bold text-success-900 mt-0.5">{loc.currency(currentMetrics.profitPerEmployee)}</p>
            </div>
            <div className="p-3 bg-warning-50 rounded-lg">
              <p className="text-xs text-warning-600">Labor Cost Ratio</p>
              <p className="text-xl font-bold text-warning-900 mt-0.5">{currentMetrics.laborCostRatio}%</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">Productivity Index</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{currentMetrics.productivityIndex}</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
