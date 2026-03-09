import { useState, useEffect, useMemo } from 'react'
import { useStore } from '../store'
import api from '../api'
import { useGlobalFilters } from '../hooks/useGlobalFilters'
import toast from 'react-hot-toast'
import { CHART_COLORS } from '../utils/chartColors'

// Components
import CompanyFinancialMetrics from '../components/scenario/CompanyFinancialMetrics'
import ScenarioModeling from '../components/scenario/ScenarioModeling'
import FinancialImpactAnalysis from '../components/scenario/FinancialImpactAnalysis'
import IndustryBenchmarkComparison from '../components/scenario/IndustryBenchmarkComparison'
import MonteCarloResults from '../components/scenario/MonteCarloResults'
import ScenarioRecommendations from '../components/scenario/ScenarioRecommendations'

// Types & Utils
import { Scenario, defaultScenarios, industryBenchmarks, MonteCarloResult } from '../components/scenario/types'
import { generateHistoricalHeadcount } from '../components/scenario/utils'

export default function ScenarioPlanning() {
  const { employees } = useStore()
  const { filterObj } = useGlobalFilters()
  const [scenarios, setScenarios] = useState<Scenario[]>(defaultScenarios)
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>(['baseline', 'aggressive-growth'])
  const [forecastMonths, setForecastMonths] = useState(24)
  const [selectedIndustry, setSelectedIndustry] = useState<keyof typeof industryBenchmarks>('tech')
  const [editingScenario, setEditingScenario] = useState<string | null>(null)
  const [scenarioParamInputs, setScenarioParamInputs] = useState<Record<string, string>>({})
  const [monteCarloResults, setMonteCarloResults] = useState<Record<string, MonteCarloResult>>({})
  const [isRunningMonteCarlo, setIsRunningMonteCarlo] = useState(false)
  const [financialsLoading, setFinancialsLoading] = useState(true)
  const [companyMetrics, setCompanyMetrics] = useState({
    annualRevenue: 0,
    annualProfit: 0,
    currentHeadcount: 0,
    avgSalary: 0,
    revenuePerEmployee: 0,
    profitPerEmployee: 0,
  })

  useEffect(() => {
    let cancelled = false
    setFinancialsLoading(true)
    api.get('/organization/financials', { params: filterObj })
      .then((res) => {
        if (cancelled) return
        const d = res.data
        setCompanyMetrics({
          annualRevenue: d.annual_revenue ?? 0,
          annualProfit: d.annual_profit ?? 0,
          currentHeadcount: d.current_headcount ?? 0,
          avgSalary: d.avg_salary ?? 0,
          revenuePerEmployee: d.revenue_per_employee ?? 0,
          profitPerEmployee: d.profit_per_employee ?? 0,
        })
      })
      .catch(() => {
        setCompanyMetrics({
          annualRevenue: 0,
          annualProfit: 0,
          currentHeadcount: employees.length || 0,
          avgSalary: 0,
          revenuePerEmployee: 0,
          profitPerEmployee: 0,
        })
      })
      .finally(() => {
        if (!cancelled) setFinancialsLoading(false)
      })
    return () => { cancelled = true }
  }, [filterObj, employees.length])

  const currentHeadcount = companyMetrics.currentHeadcount || employees.length || 745

  const currentMetrics = useMemo(() => {
    const headcount = companyMetrics.currentHeadcount || currentHeadcount
    return {
      revenuePerEmployee: headcount > 0 ? Math.round(companyMetrics.annualRevenue / headcount) : 0,
      profitPerEmployee: headcount > 0 ? Math.round(companyMetrics.annualProfit / headcount) : 0,
      laborCostRatio: 35,
      productivityIndex: 100,
    }
  }, [companyMetrics, currentHeadcount])

  const scenarioProjections = useMemo(() => {
    const historicalData = generateHistoricalHeadcount(12, companyMetrics.currentHeadcount || currentHeadcount)
    const lastHeadcount = historicalData[historicalData.length - 1].headcount
    const projections: any[] = []

    historicalData.forEach((point) => {
      const dataPoint: any = { date: point.date }
      scenarios.forEach((scenario) => {
        if (selectedScenarios.includes(scenario.id)) {
          dataPoint[scenario.id] = scenario.id === 'baseline' ? point.headcount : null
        }
      })
      projections.push(dataPoint)
    })

    for (let month = 1; month <= forecastMonths; month++) {
      const date = new Date()
      date.setMonth(date.getMonth() + month)
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      const dataPoint: any = { date: dateStr }
      scenarios.forEach((scenario) => {
        if (selectedScenarios.includes(scenario.id)) {
          const monthlyGrowth = scenario.parameters.growthRate / 100 / 12
          const monthlyAttrition = scenario.parameters.attritionRate / 100 / 12
          const netGrowth = monthlyGrowth - monthlyAttrition
          const projected = Math.round(lastHeadcount * Math.pow(1 + netGrowth, month))
          dataPoint[scenario.id] = projected
        }
      })
      projections.push(dataPoint)
    }
    return projections
  }, [scenarios, selectedScenarios, forecastMonths, companyMetrics.currentHeadcount, currentHeadcount])

  const financialImpact = useMemo(() => {
    return scenarios
      .filter((s) => selectedScenarios.includes(s.id))
      .map((scenario) => {
        const yearEndHeadcount = Math.round(currentHeadcount * (1 + (scenario.parameters.growthRate - scenario.parameters.attritionRate) / 100))
        const revenueChange = scenario.parameters.revenueGrowth / 100
        const productivityChange = scenario.parameters.productivityChange / 100
        const projectedRevenue = companyMetrics.annualRevenue * (1 + revenueChange)
        const projectedProfit = companyMetrics.annualProfit * (1 + revenueChange * 0.8)
        const projectedRevenuePerEmployee = yearEndHeadcount > 0 ? projectedRevenue / yearEndHeadcount : 0
        const projectedProfitPerEmployee = yearEndHeadcount > 0 ? projectedProfit / yearEndHeadcount : 0
        const netNewHires = yearEndHeadcount - currentHeadcount
        const grossHires = netNewHires + Math.round(currentHeadcount * (scenario.parameters.attritionRate / 100))
        const hiringCost = grossHires * 4500
        const productivityImpact = companyMetrics.annualRevenue * productivityChange
        return {
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          color: scenario.color,
          yearEndHeadcount,
          headcountChange: yearEndHeadcount - currentHeadcount,
          projectedRevenue,
          projectedProfit,
          projectedRevenuePerEmployee,
          projectedProfitPerEmployee,
          hiringCost,
          grossHires,
          productivityImpact,
          totalImpact: projectedProfit - companyMetrics.annualProfit - hiringCost + productivityImpact,
        }
      })
  }, [scenarios, selectedScenarios, currentHeadcount, companyMetrics])

  const benchmarkComparison = useMemo(() => {
    const benchmark = industryBenchmarks[selectedIndustry]
    return {
      revenuePerEmployee: {
        company: currentMetrics.revenuePerEmployee,
        industry: benchmark.avgRevenuePerEmployee,
        difference: currentMetrics.revenuePerEmployee - benchmark.avgRevenuePerEmployee,
        percentDiff: ((currentMetrics.revenuePerEmployee - benchmark.avgRevenuePerEmployee) / benchmark.avgRevenuePerEmployee) * 100,
      },
      profitPerEmployee: {
        company: currentMetrics.profitPerEmployee,
        industry: benchmark.avgProfitPerEmployee,
        difference: currentMetrics.profitPerEmployee - benchmark.avgProfitPerEmployee,
        percentDiff: ((currentMetrics.profitPerEmployee - benchmark.avgProfitPerEmployee) / benchmark.avgProfitPerEmployee) * 100,
      },
      turnover: {
        company: 12,
        industry: benchmark.avgTurnover,
        difference: 12 - benchmark.avgTurnover,
        percentDiff: ((12 - benchmark.avgTurnover) / benchmark.avgTurnover) * 100,
      },
      engagement: {
        company: 4.1,
        industry: benchmark.avgEngagement,
        difference: 4.1 - benchmark.avgEngagement,
        percentDiff: ((4.1 - benchmark.avgEngagement) / benchmark.avgEngagement) * 100,
      },
    }
  }, [currentMetrics, selectedIndustry])

  const toggleScenario = (id: string) => {
    setSelectedScenarios((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id])
  }

  const addCustomScenario = () => {
    const newScenario: Scenario = {
      id: `custom-${Date.now()}`,
      name: 'Custom Scenario',
      type: 'custom',
      color: CHART_COLORS[1],
      parameters: {
        growthRate: 10,
        attritionRate: 12,
        hiringPace: 100,
        revenueGrowth: 10,
        productivityChange: 0,
      },
    }
    setScenarios([...scenarios, newScenario])
    setSelectedScenarios([...selectedScenarios, newScenario.id])
    setScenarioParamInputs({
      growthRate: String(newScenario.parameters.growthRate),
      attritionRate: String(newScenario.parameters.attritionRate),
      revenueGrowth: String(newScenario.parameters.revenueGrowth),
      hiringPace: String(newScenario.parameters.hiringPace),
    })
    setEditingScenario(newScenario.id)
  }

  const updateScenarioParamInput = (param: keyof Scenario['parameters'], value: string) => {
    setScenarioParamInputs(prev => ({ ...prev, [param]: value }))
  }

  const commitScenarioParams = (scenarioId: string) => {
    setScenarios(scenarios.map(s => {
      if (s.id !== scenarioId) return s
      const updated = { ...s.parameters }
      for (const [key, val] of Object.entries(scenarioParamInputs)) {
        updated[key as keyof Scenario['parameters']] = Number(val) || 0
      }
      return { ...s, parameters: updated }
    }))
  }

  const startEditingScenario = (scenarioId: string | null) => {
    if (scenarioId) {
      const scenario = scenarios.find(s => s.id === scenarioId)
      if (scenario) {
        setScenarioParamInputs({
          growthRate: String(scenario.parameters.growthRate),
          attritionRate: String(scenario.parameters.attritionRate),
          revenueGrowth: String(scenario.parameters.revenueGrowth),
          hiringPace: String(scenario.parameters.hiringPace),
        })
      }
    } else if (editingScenario) {
      commitScenarioParams(editingScenario)
    }
    setEditingScenario(scenarioId)
  }

  const deleteScenario = (scenarioId: string) => {
    setScenarios(scenarios.filter(s => s.id !== scenarioId))
    setSelectedScenarios(selectedScenarios.filter(id => id !== scenarioId))
    if (editingScenario === scenarioId) startEditingScenario(null)
  }

  const runMonteCarloSimulation = async (scenarioId: string) => {
    const scenario = scenarios.find(s => s.id === scenarioId)
    if (!scenario) return
    setIsRunningMonteCarlo(true)
    try {
      const response = await fetch('/api/scenarios/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custom_params: { ...scenario.parameters, name: scenario.name, type: scenario.type, durationMonths: forecastMonths },
          financial_metrics: companyMetrics,
          run_monte_carlo: true,
          monte_carlo_simulations: 1000,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        if (data.monte_carlo) {
          setMonteCarloResults(prev => ({ ...prev, [scenarioId]: data.monte_carlo }))
          toast.success('Monte Carlo simulation complete')
          return
        }
      }
      runFrontendMonteCarlo(scenario)
    } catch (error) {
      runFrontendMonteCarlo(scenario)
    } finally {
      setIsRunningMonteCarlo(false)
    }
  }

  const runFrontendMonteCarlo = (scenario: Scenario) => {
    const simulations = 1000
    const profits: number[] = []
    const headcounts: number[] = []
    const rois: number[] = []
    for (let i = 0; i < simulations; i++) {
      const growthVar = scenario.parameters.growthRate + (Math.random() - 0.5) * 6
      const attritionVar = Math.max(0, scenario.parameters.attritionRate + (Math.random() - 0.5) * 4)
      const revenueVar = scenario.parameters.revenueGrowth + (Math.random() - 0.5) * 10
      const netGrowth = (growthVar - attritionVar) / 100
      const endHeadcount = Math.round(companyMetrics.currentHeadcount * Math.pow(1 + netGrowth / 12, forecastMonths))
      const projectedProfit = companyMetrics.annualProfit * (1 + revenueVar / 100 * 0.8 * forecastMonths / 12)
      const hiringCost = Math.max(0, endHeadcount - companyMetrics.currentHeadcount) * 4500
      const roi = hiringCost > 0 ? ((projectedProfit - companyMetrics.annualProfit) / hiringCost * 100) : 0
      profits.push(projectedProfit)
      headcounts.push(endHeadcount)
      rois.push(roi)
    }
    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
    const std = (arr: number[]) => {
      const m = mean(arr)
      return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length)
    }
    const percentile = (arr: number[], p: number) => {
      const sorted = [...arr].sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length * p / 100)]
    }
    setMonteCarloResults(prev => ({
      ...prev,
      [scenario.id]: {
        profit: { mean: mean(profits), std: std(profits), p10: percentile(profits, 10), p50: percentile(profits, 50), p90: percentile(profits, 90), probability_positive: profits.filter(p => p > companyMetrics.annualProfit).length / profits.length },
        headcount: { mean: mean(headcounts), std: std(headcounts), p10: percentile(headcounts, 10), p50: percentile(headcounts, 50), p90: percentile(headcounts, 90) },
        roi: { mean: mean(rois), std: std(rois), p10: percentile(rois, 10), p50: percentile(rois, 50), p90: percentile(rois, 90) },
      },
    }))
    toast.success('Monte Carlo simulation complete')
  }

  return (
    <div className="space-y-6">
      <CompanyFinancialMetrics
        financialsLoading={financialsLoading}
        companyMetrics={companyMetrics}
        currentMetrics={currentMetrics}
      />
      <ScenarioModeling
        scenarios={scenarios}
        selectedScenarios={selectedScenarios}
        forecastMonths={forecastMonths}
        setForecastMonths={setForecastMonths}
        addCustomScenario={addCustomScenario}
        toggleScenario={toggleScenario}
        editingScenario={editingScenario}
        startEditingScenario={startEditingScenario}
        deleteScenario={deleteScenario}
        scenarioParamInputs={scenarioParamInputs}
        updateScenarioParamInput={updateScenarioParamInput}
        commitScenarioParams={commitScenarioParams}
        runMonteCarloSimulation={runMonteCarloSimulation}
        isRunningMonteCarlo={isRunningMonteCarlo}
        scenarioProjections={scenarioProjections}
      />
      <FinancialImpactAnalysis financialImpact={financialImpact} />
      <IndustryBenchmarkComparison
        selectedIndustry={selectedIndustry}
        setSelectedIndustry={setSelectedIndustry}
        benchmarkComparison={benchmarkComparison}
      />
      <MonteCarloResults
        monteCarloResults={monteCarloResults}
        selectedScenarios={selectedScenarios}
        scenarios={scenarios}
      />
      <ScenarioRecommendations
        currentMetrics={currentMetrics}
        benchmarkComparison={benchmarkComparison}
        companyMetrics={companyMetrics}
      />
    </div>
  )
}
