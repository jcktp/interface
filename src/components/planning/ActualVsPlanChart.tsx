import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
} from 'recharts'
import { formatChartLabel } from '../../utils/chartColors'
import type { WorkforcePlan } from '../../types'

interface ActualVsPlanChartProps {
  plans: WorkforcePlan[]
}

export default function ActualVsPlanChart({ plans }: ActualVsPlanChartProps) {
  const data = plans
    .filter((p) => p.actualHeadcount !== null && p.actualHeadcount !== undefined)
    .map((plan) => ({
      department: plan.department,
      planned: plan.plannedEndingHeadcount || 0,
      actual: plan.actualHeadcount || 0,
      variance: (plan.actualHeadcount || 0) - (plan.plannedEndingHeadcount || 0),
    }))

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No actual data available yet. Sync actuals to see the comparison.</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 35, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="department"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
          formatter={(value: number, name: string) => [
            value,
            name === 'planned' ? 'Planned' : name === 'actual' ? 'Actual' : 'Variance',
          ]}
        />
        <Legend
          wrapperStyle={{ paddingTop: '10px' }}
          formatter={(value) =>
            value === 'planned' ? 'Planned Headcount' : 'Actual Headcount'
          }
        />
        <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
        <Bar
          dataKey="planned"
          name="planned"
          fill="#93c5fd"
          radius={[4, 4, 0, 0]}
        >
          {data.length <= 12 && (
            <LabelList dataKey="planned" position="top" fontSize={11} fill="#64748b" formatter={formatChartLabel} />
          )}
        </Bar>
        <Bar
          dataKey="actual"
          name="actual"
          fill="#3b82f6"
          radius={[4, 4, 0, 0]}
        >
          {data.length <= 12 && (
            <LabelList dataKey="actual" position="top" fontSize={11} fill="#64748b" formatter={formatChartLabel} />
          )}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
