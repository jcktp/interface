export interface BudgetSummary {
  period_id: string
  total_current_salary: number
  total_planned_budget: number
  total_actual_spend: number | null
  total_equity_budget: number
  equity_pool_total: number
  equity_pool_remaining: number
  budget_variance: number | null
  budget_variance_pct: number | null
  plans_count: number
  by_department: {
    department: string
    currency: string
    current_salary: number
    planned_budget: number
    actual_spend: number | null
    equity_budget: number
    variance: number | null
  }[]
}

export interface SalaryDistribution {
  group: string
  count: number
  min_salary: number | null
  max_salary: number | null
  avg_salary: number | null
  total_salary: number | null
}

export interface CompensationChangeData {
  employee_id: string
  change_type: string
  new_salary: number
  effective_date: string
  reason?: string
  plan_id?: string
}

export const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'Customer Success', 'HR', 'Finance', 'Operations']
export const LOCATIONS = ['New York', 'San Francisco', 'London', 'Berlin', 'Tokyo', 'Singapore', 'Sydney', 'Toronto', 'Remote']
export const TEAMS = ['Frontend', 'Backend', 'DevOps', 'Data Science', 'Mobile', 'QA', 'Security', 'Platform']
export const CHANGE_TYPES = [
  { value: 'merit', label: 'Merit' },
  { value: 'market_adjustment', label: 'Market Adjustment' },
  { value: 'equity_adjustment', label: 'Equity Adjustment' },
]
