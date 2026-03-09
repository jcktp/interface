import clsx from 'clsx'
import { useLocalization } from '../../hooks/useLocalization'

interface Impact {
  scenarioId: string
  scenarioName: string
  color: string
  yearEndHeadcount: number
  headcountChange: number
  hiringCost: number
  projectedRevenuePerEmployee: number
  projectedProfitPerEmployee: number
  totalImpact: number
}

interface Props {
  financialImpact: Impact[]
}

export default function FinancialImpactAnalysis({ financialImpact }: Props) {
  const loc = useLocalization()

  return (
    <div className="card">
      <h3 className="card-header">Financial Impact Analysis</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="table-header">Scenario</th>
              <th className="table-header text-right">Year-End Headcount</th>
              <th className="table-header text-right">Net Change</th>
              <th className="table-header text-right">Hiring Cost</th>
              <th className="table-header text-right">Rev/Employee</th>
              <th className="table-header text-right">Profit/Employee</th>
              <th className="table-header text-right">Total Impact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {financialImpact.map((impact) => (
              <tr key={impact.scenarioId} className="hover:bg-gray-50">
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: impact.color }} />
                    <span className="font-medium">{impact.scenarioName}</span>
                  </div>
                </td>
                <td className="table-cell text-right">{loc.number(impact.yearEndHeadcount)}</td>
                <td className="table-cell text-right">
                  <span className={impact.headcountChange >= 0 ? 'text-success-600' : 'text-danger-600'}>
                    {impact.headcountChange >= 0 ? '+' : ''}{impact.headcountChange}
                  </span>
                </td>
                <td className="table-cell text-right">{loc.currency(impact.hiringCost, true)}</td>
                <td className="table-cell text-right">{loc.currency(impact.projectedRevenuePerEmployee)}</td>
                <td className="table-cell text-right">{loc.currency(impact.projectedProfitPerEmployee)}</td>
                <td className="table-cell text-right">
                  <span className={clsx(
                    'font-semibold',
                    impact.totalImpact >= 0 ? 'text-success-600' : 'text-danger-600'
                  )}>
                    {impact.totalImpact >= 0 ? '+' : ''}{loc.currency(impact.totalImpact, true)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
