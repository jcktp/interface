import clsx from 'clsx'
import { useLocalization } from '../../hooks/useLocalization'
import BarChart from '../charts/BarChart'
import { industryBenchmarks } from './types'
import { CHART_COLORS } from '../../utils/chartColors'

interface Props {
  selectedIndustry: keyof typeof industryBenchmarks
  setSelectedIndustry: (industry: keyof typeof industryBenchmarks) => void
  benchmarkComparison: any
}

export default function IndustryBenchmarkComparison({
  selectedIndustry,
  setSelectedIndustry,
  benchmarkComparison,
}: Props) {
  const loc = useLocalization()

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="card-header mb-0">Industry Benchmark Comparison</h3>
        <select
          value={selectedIndustry}
          onChange={(e) => setSelectedIndustry(e.target.value as keyof typeof industryBenchmarks)}
          className="input py-1 px-3 w-auto"
        >
          {Object.entries(industryBenchmarks).map(([key, value]) => (
            <option key={key} value={key}>{value.name}</option>
          ))}
        </select>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Source: {industryBenchmarks[selectedIndustry].source}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue per Employee */}
        <div className="p-4 border border-gray-200 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Revenue per Employee</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Your Company</span>
              <span className="font-semibold">{loc.currency(benchmarkComparison.revenuePerEmployee.company)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Industry Avg</span>
              <span className="font-semibold">{loc.currency(benchmarkComparison.revenuePerEmployee.industry)}</span>
            </div>
            <div className="pt-2 border-t border-gray-100">
              <span className={clsx(
                'text-sm font-medium',
                benchmarkComparison.revenuePerEmployee.percentDiff >= 0 ? 'text-success-600' : 'text-danger-600'
              )}>
                {benchmarkComparison.revenuePerEmployee.percentDiff >= 0 ? '+' : ''}
                {benchmarkComparison.revenuePerEmployee.percentDiff.toFixed(1)}% vs industry
              </span>
            </div>
          </div>
        </div>

        {/* Profit per Employee */}
        <div className="p-4 border border-gray-200 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Profit per Employee</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Your Company</span>
              <span className="font-semibold">{loc.currency(benchmarkComparison.profitPerEmployee.company)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Industry Avg</span>
              <span className="font-semibold">{loc.currency(benchmarkComparison.profitPerEmployee.industry)}</span>
            </div>
            <div className="pt-2 border-t border-gray-100">
              <span className={clsx(
                'text-sm font-medium',
                benchmarkComparison.profitPerEmployee.percentDiff >= 0 ? 'text-success-600' : 'text-danger-600'
              )}>
                {benchmarkComparison.profitPerEmployee.percentDiff >= 0 ? '+' : ''}
                {benchmarkComparison.profitPerEmployee.percentDiff.toFixed(1)}% vs industry
              </span>
            </div>
          </div>
        </div>

        {/* Turnover Rate */}
        <div className="p-4 border border-gray-200 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Turnover Rate</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Your Company</span>
              <span className="font-semibold">{benchmarkComparison.turnover.company}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Industry Avg</span>
              <span className="font-semibold">{benchmarkComparison.turnover.industry}%</span>
            </div>
            <div className="pt-2 border-t border-gray-100">
              <span className={clsx(
                'text-sm font-medium',
                benchmarkComparison.turnover.percentDiff <= 0 ? 'text-success-600' : 'text-danger-600'
              )}>
                {benchmarkComparison.turnover.difference >= 0 ? '+' : ''}
                {benchmarkComparison.turnover.difference.toFixed(1)}pp vs industry
              </span>
            </div>
          </div>
        </div>

        {/* Engagement */}
        <div className="p-4 border border-gray-200 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Engagement Score</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Your Company</span>
              <span className="font-semibold">{benchmarkComparison.engagement.company}/5</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Industry Avg</span>
              <span className="font-semibold">{benchmarkComparison.engagement.industry}/5</span>
            </div>
            <div className="pt-2 border-t border-gray-100">
              <span className={clsx(
                'text-sm font-medium',
                benchmarkComparison.engagement.percentDiff >= 0 ? 'text-success-600' : 'text-danger-600'
              )}>
                {benchmarkComparison.engagement.percentDiff >= 0 ? '+' : ''}
                {benchmarkComparison.engagement.percentDiff.toFixed(1)}% vs industry
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Comparison */}
      <div className="mt-6">
        <h4 className="font-medium text-gray-900 mb-3">Visual Comparison</h4>
        <BarChart
          data={[
            {
              metric: 'Rev/Employee ($K)',
              company: benchmarkComparison.revenuePerEmployee.company / 1000,
              industry: benchmarkComparison.revenuePerEmployee.industry / 1000,
            },
            {
              metric: 'Profit/Employee ($K)',
              company: benchmarkComparison.profitPerEmployee.company / 1000,
              industry: benchmarkComparison.profitPerEmployee.industry / 1000,
            },
            {
              metric: 'Turnover (%)',
              company: benchmarkComparison.turnover.company,
              industry: benchmarkComparison.turnover.industry,
            },
            {
              metric: 'Engagement (x20)',
              company: benchmarkComparison.engagement.company * 20,
              industry: benchmarkComparison.engagement.industry * 20,
            },
          ]}
          xKey="metric"
          bars={[
            { key: 'company', name: 'Your Company', color: CHART_COLORS[0] },
            { key: 'industry', name: 'Industry Average', color: CHART_COLORS[5] },
          ]}
          showLegend
          height={280}
        />
      </div>
    </div>
  )
}
