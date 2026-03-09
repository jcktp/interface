import { CHART_COLORS } from '../../utils/chartColors'

export interface Scenario {
  id: string
  name: string
  type: 'growth' | 'decline' | 'stable' | 'custom'
  color: string
  parameters: {
    growthRate: number
    attritionRate: number
    hiringPace: number
    revenueGrowth: number
    productivityChange: number
  }
}

export const defaultScenarios: Scenario[] = [
  {
    id: 'baseline',
    name: 'Baseline (Current Trend)',
    type: 'stable',
    color: CHART_COLORS[2],
    parameters: {
      growthRate: 5,
      attritionRate: 12,
      hiringPace: 100,
      revenueGrowth: 8,
      productivityChange: 0,
    },
  },
  {
    id: 'aggressive-growth',
    name: 'Aggressive Growth',
    type: 'growth',
    color: CHART_COLORS[0],
    parameters: {
      growthRate: 25,
      attritionRate: 10,
      hiringPace: 150,
      revenueGrowth: 30,
      productivityChange: 5,
    },
  },
  {
    id: 'moderate-growth',
    name: 'Moderate Growth',
    type: 'growth',
    color: CHART_COLORS[4],
    parameters: {
      growthRate: 12,
      attritionRate: 11,
      hiringPace: 120,
      revenueGrowth: 15,
      productivityChange: 2,
    },
  },
  {
    id: 'downturn',
    name: 'Economic Downturn',
    type: 'decline',
    color: CHART_COLORS[3],
    parameters: {
      growthRate: -10,
      attritionRate: 8,
      hiringPace: 30,
      revenueGrowth: -5,
      productivityChange: -3,
    },
  },
]

// Industry benchmark data (simulated public data)
export const industryBenchmarks = {
  tech: {
    name: 'Technology',
    avgRevenuePerEmployee: 450000,
    avgProfitPerEmployee: 85000,
    avgTurnover: 13.2,
    avgTimeToHire: 35,
    avgEngagement: 3.8,
    source: 'Bureau of Labor Statistics, 2024',
  },
  finance: {
    name: 'Financial Services',
    avgRevenuePerEmployee: 520000,
    avgProfitPerEmployee: 120000,
    avgTurnover: 10.5,
    avgTimeToHire: 42,
    avgEngagement: 3.6,
    source: 'SHRM Industry Report, 2024',
  },
  healthcare: {
    name: 'Healthcare',
    avgRevenuePerEmployee: 280000,
    avgProfitPerEmployee: 35000,
    avgTurnover: 19.5,
    avgTimeToHire: 49,
    avgEngagement: 3.5,
    source: 'Healthcare HR Association, 2024',
  },
  retail: {
    name: 'Retail',
    avgRevenuePerEmployee: 180000,
    avgProfitPerEmployee: 12000,
    avgTurnover: 60.5,
    avgTimeToHire: 21,
    avgEngagement: 3.2,
    source: 'NRF Retail Industry Report, 2024',
  },
  manufacturing: {
    name: 'Manufacturing',
    avgRevenuePerEmployee: 320000,
    avgProfitPerEmployee: 45000,
    avgTurnover: 8.2,
    avgTimeToHire: 38,
    avgEngagement: 3.7,
    source: 'NAM Industry Benchmarks, 2024',
  },
}

export interface MonteCarloResult {
  profit: { mean: number; std: number; p10: number; p50: number; p90: number; probability_positive: number }
  headcount: { mean: number; std: number; p10: number; p50: number; p90: number }
  roi: { mean: number; std: number; p10: number; p50: number; p90: number }
}
