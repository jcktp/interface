import { useState, useMemo } from 'react'
import { useStore } from '../store'
import { useLocalization } from '../hooks/useLocalization'
import toast from 'react-hot-toast'
import {
  UserGroupIcon,
  ArrowTrendingUpIcon,
  CalculatorIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  BriefcaseIcon,
  HeartIcon,
  BoltIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { ActualVsPlanChart } from '../components/planning'

type Objective = 'hyper_growth' | 'sustainable_scaling' | 'operational_efficiency' | 'cost_transformation'
type Horizon = 'quarterly' | 'semi_annual' | 'annual'

const OBJECTIVES: { value: Objective; label: string; desc: string }[] = [
  { value: 'hyper_growth', label: 'Hyper Growth', desc: '20%+ headcount increase' },
  { value: 'sustainable_scaling', label: 'Sustainable Scaling', desc: '10–15% controlled growth' },
  { value: 'operational_efficiency', label: 'Operational Efficiency', desc: 'Flat / attrition replacement' },
  { value: 'cost_transformation', label: 'Cost Transformation', desc: 'Consolidation & optimization' },
]

const HORIZONS: { value: Horizon; label: string; months: number }[] = [
  { value: 'quarterly', label: 'Quarterly (Q2 2026)', months: 3 },
  { value: 'semi_annual', label: 'Semi-Annual (H1 2026)', months: 6 },
  { value: 'annual', label: 'Annual (FY 2026)', months: 12 },
]

const STRATEGY_PRESETS: Record<Objective, { buyMult: number; build: number; borrow: number; bound: number; bot: number; bounce: number }> = {
  hyper_growth:           { buyMult: 1.3, build: 60, borrow: 18, bound: 6,  bot: 2,  bounce: 4  },
  sustainable_scaling:    { buyMult: 1.0, build: 45, borrow: 12, bound: 8,  bot: 4,  bounce: 6  },
  operational_efficiency: { buyMult: 0.7, build: 35, borrow: 8,  bound: 12, bot: 8,  bounce: 10 },
  cost_transformation:    { buyMult: 0.4, build: 20, borrow: 5,  bound: 4,  bot: 14, bounce: 16 },
}

const STEPS = [
  { id: 'alignment',  name: 'Strategic Alignment', icon: SparklesIcon },
  { id: 'demand',     name: 'Demand Forecast',      icon: ArrowTrendingUpIcon },
  { id: 'supply',     name: 'Supply Audit',          icon: UserGroupIcon },
  { id: 'gap',        name: 'Gap Analysis',          icon: ExclamationTriangleIcon },
  { id: 'execution',  name: 'Execution Strategy',    icon: CalculatorIcon },
  { id: 'financial',  name: 'Financial Review',      icon: CurrencyDollarIcon },
]

function NumInput({ label, value, onChange, note }: { label: string; value: number; onChange: (v: number) => void; note?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number" min={0} value={value}
        onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        className="input w-full"
      />
      {note && <p className="text-[10px] text-gray-400 mt-1">{note}</p>}
    </div>
  )
}

export default function StrategicPlanner() {
  const [currentStep, setCurrentStep] = useState(0)
  const { workforcePlans: plans, employees, requisitions } = useStore()
  const loc = useLocalization()

  // Step 1
  const [objective, setObjective] = useState<Objective>('sustainable_scaling')
  const [horizon, setHorizon] = useState<Horizon>('annual')
  const horizonMonths = HORIZONS.find(h => h.value === horizon)?.months ?? 12
  const preset = STRATEGY_PRESETS[objective]

  // Step 2 — demand inputs (null = use derived default)
  const mlAttrition = useMemo(() => {
    const hr = employees.filter(e => e.flightRisk === 'high' && e.status === 'active').length
    return Math.max(hr, 30)
  }, [employees])

  const defaultGrowth = useMemo(() => Math.max(plans.reduce((s, p) => s + (p.plannedHires || 0), 0), 80), [plans])

  const [demandAttrition, setDemandAttrition] = useState<number | null>(null)
  const [demandGrowth, setDemandGrowth] = useState<number | null>(null)
  const [demandCritical, setDemandCritical] = useState<number | null>(null)

  const rAttrition = demandAttrition ?? mlAttrition
  const rGrowth    = demandGrowth    ?? defaultGrowth
  const rCritical  = demandCritical  ?? 12
  const totalDemand = rAttrition + rGrowth + rCritical

  // Step 3 — derived from store
  const active = useMemo(() => employees.filter(e => e.status === 'active'), [employees])
  const highRiskCount    = useMemo(() => employees.filter(e => e.flightRisk === 'high' && e.status === 'active').length, [employees])
  const readyNow         = useMemo(() => active.filter(e => (e.performanceRating || 0) >= 4.0).length, [active])
  const internalXfers    = useMemo(() => plans.reduce((s, p) => s + (p.plannedTransfersIn || 0), 0), [plans])
  const mobilityRate     = active.length > 0 ? ((internalXfers / active.length) * 100).toFixed(1) : '14.2'
  const avgSalary        = useMemo(() => {
    const sals = active.filter(e => (e.salary || 0) > 0).map(e => e.salary)
    return sals.length > 0 ? sals.reduce((s, v) => s + v, 0) / sals.length : 85000
  }, [active])

  // Step 4 — gap analysis from live data
  const gapsByDept = useMemo(() => {
    const depts = Array.from(new Set([...employees.map(e => e.department), ...requisitions.map(r => r.department)]))
    return depts
      .map(dept => {
        const openReqs    = requisitions.filter(r => r.department === dept && r.status === 'open').length
        const plan        = plans.find(p => p.department === dept)
        const plannedHires = plan?.plannedHires ?? 0
        return { dept, openReqs, plannedHires, gap: openReqs - plannedHires }
      })
      .filter(g => g.openReqs > 0)
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 7)
  }, [employees, requisitions, plans])

  const totalPlanned = plans.reduce((s, p) => s + (p.plannedHires || 0), 0)
  const netGap = totalDemand - totalPlanned

  // Step 5 — execution targets (null = use preset)
  const [buyT, setBuyT]     = useState<number | null>(null)
  const [buildT, setBuildT] = useState<number | null>(null)
  const [borrowT, setBorrowT] = useState<number | null>(null)
  const [boundT, setBoundT] = useState<number | null>(null)
  const [botT, setBotT]     = useState<number | null>(null)
  const [bounceT, setBounceT] = useState<number | null>(null)

  const rBuy    = buyT    ?? Math.round(rGrowth * preset.buyMult)
  const rBuild  = buildT  ?? preset.build
  const rBorrow = borrowT ?? preset.borrow
  const rBound  = boundT  ?? preset.bound
  const rBot    = botT    ?? preset.bot
  const rBounce = bounceT ?? preset.bounce

  // Step 6 — financials derived from step 5
  const hiringSpend     = rBuy    * (avgSalary * 0.18)
  const trainingBudget  = rBuild  * 4500
  const contractorSpend = rBorrow * (avgSalary / 12) * Math.round(horizonMonths / 2) * 1.4
  const retentionPool   = rBound  * (avgSalary * 0.10)
  const automationCost  = rBot    * 28000
  const totalBudget     = hiringSpend + trainingBudget + contractorSpend + retentionPool + automationCost
  const coverage        = Math.min(100, Math.round(((rBuy + rBuild + rBounce + rBorrow) / Math.max(totalDemand, 1)) * 100))

  const handleObjectiveChange = (obj: Objective) => {
    setObjective(obj)
    setBuyT(null); setBuildT(null); setBorrowT(null)
    setBoundT(null); setBotT(null); setBounceT(null)
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Strategic Planner</h1>
          <p className="text-sm text-gray-500 mt-1">Holistic workforce planning — inputs at each step flow through to execution and budget.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentStep(s => Math.max(0, s - 1))} disabled={currentStep === 0} className="btn-secondary">
            <ChevronLeftIcon className="w-4 h-4 mr-1" /> Back
          </button>
          <button onClick={() => setCurrentStep(s => Math.min(STEPS.length - 1, s + 1))} disabled={currentStep === STEPS.length - 1} className="btn-primary">
            Next <ChevronRightIcon className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>

      {/* Stepper */}
      <nav>
        <ol className="flex items-center w-full">
          {STEPS.map((step, idx) => (
            <li key={step.id} className={clsx('relative flex-1', idx !== STEPS.length - 1 && 'pr-8 sm:pr-16')}>
              <button onClick={() => setCurrentStep(idx)} className="flex items-center gap-2">
                <div className={clsx(
                  'flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all',
                  idx < currentStep  ? 'bg-success-500 text-white'
                  : idx === currentStep ? 'bg-primary-600 text-white shadow-lg scale-110'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                )}>
                  {idx < currentStep ? <CheckCircleIcon className="w-5 h-5" /> : idx + 1}
                </div>
                <span className={clsx('hidden sm:block text-xs font-bold uppercase tracking-wider',
                  idx === currentStep ? 'text-primary-700 dark:text-primary-400' : 'text-gray-400')}>
                  {step.name}
                </span>
              </button>
              {idx !== STEPS.length - 1 && (
                <div className={clsx('absolute top-4 left-8 w-full h-0.5', idx < currentStep ? 'bg-success-500' : 'bg-gray-200 dark:bg-gray-700')} />
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* ── STEP 1: Strategic Alignment ── */}
      {currentStep === 0 && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="card-header">Step 1: Strategic Alignment</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Your selections here set default targets across all subsequent steps — you can override any of them later.
            </p>
            <div className="space-y-6">
              <div>
                <label className="label">Primary Business Objective</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  {OBJECTIVES.map(obj => (
                    <button
                      key={obj.value}
                      onClick={() => handleObjectiveChange(obj.value)}
                      className={clsx(
                        'p-4 rounded-lg border text-left transition-all',
                        objective === obj.value
                          ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-600'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      )}
                    >
                      <p className={clsx('font-semibold text-sm', objective === obj.value ? 'text-primary-700 dark:text-primary-300' : 'text-gray-800 dark:text-gray-100')}>{obj.label}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{obj.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="max-w-xs">
                <label className="label">Planning Horizon</label>
                <select className="input mt-1" value={horizon} onChange={e => setHorizon(e.target.value as Horizon)}>
                  {HORIZONS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Downstream Preset Preview</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {[
                  ['Buy', `~${Math.round(rGrowth * preset.buyMult)} hires`],
                  ['Build', `${preset.build} internal`],
                  ['Borrow', `${preset.borrow} contractors`],
                  ['Bound', `${preset.bound} retention`],
                  ['Bot', `${preset.bot} FTE saved`],
                  ['Bounce', `${preset.bounce} transfers`],
                ].map(([k, v]) => (
                  <span key={k} className="text-xs text-gray-600 dark:text-gray-300">{k}: <strong>{v}</strong></span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Demand Forecasting ── */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="card-header">Step 2: Demand Forecasting</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              ML defaults are pre-filled from your workforce data. Override any value — changes flow directly into Gap Analysis and the Financial Review.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { label: 'ML Predicted Attrition', value: rAttrition, defaultVal: mlAttrition, setter: setDemandAttrition, override: demandAttrition, note: 'High-confidence departure signals', desc: 'Adjust if you expect more/fewer departures' },
                { label: 'Organic Growth Demand',  value: rGrowth,    defaultVal: defaultGrowth,  setter: setDemandGrowth,    override: demandGrowth,    note: 'Based on current workforce plans',  desc: 'Net new hires needed for business growth' },
                { label: 'Critical Replacements',  value: rCritical,  defaultVal: 12,             setter: setDemandCritical,  override: demandCritical,  note: 'Pivotal role backfills',           desc: 'Key leadership / hard-to-fill roles' },
              ].map(item => (
                <div key={item.label} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{item.label}</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{item.value}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{item.note}</p>
                  </div>
                  <NumInput label="Override" value={item.value} onChange={item.setter} note={item.desc} />
                  {item.override !== null && (
                    <button onClick={() => item.setter(null)} className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline">
                      ↩ Reset to default ({item.defaultVal})
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-100 dark:border-primary-800/50 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-primary-800 dark:text-primary-200">Total Demand Signal</p>
                <p className="text-[11px] text-primary-600 dark:text-primary-400 mt-0.5">
                  {rAttrition} departures + {rGrowth} growth + {rCritical} critical backfills
                </p>
              </div>
              <p className="text-3xl font-bold text-primary-700 dark:text-primary-300">{totalDemand} FTE</p>
            </div>
          </div>
          <div className="card">
            <h4 className="font-bold text-sm mb-4 text-gray-900 dark:text-white">Demand Drivers by Department</h4>
            <ActualVsPlanChart plans={plans} />
          </div>
        </div>
      )}

      {/* ── STEP 3: Supply Audit ── */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="card-header">Step 3: Supply Audit — The Talent Bench</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Live metrics derived from your workforce data. These feed into the gap analysis on the next step.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Internal Mobility Rate', value: `${mobilityRate}%`,             color: 'text-blue-600 dark:text-blue-400',  note: 'Planned transfers / active headcount' },
                { label: 'Ready-Now Successors',   value: readyNow.toLocaleString(),       color: 'text-green-600 dark:text-green-400', note: 'Employees with performance rating ≥ 4.0' },
                { label: 'Active Workforce',        value: active.length.toLocaleString(), color: 'text-gray-900 dark:text-white',      note: 'Total currently active employees' },
                { label: 'Flight Risk (High)',      value: highRiskCount,                  color: 'text-red-600 dark:text-red-400',     note: 'High-risk flagged active employees' },
              ].map(item => (
                <div key={item.label} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">{item.label}</span>
                  <p className={clsx('text-2xl font-bold mt-1', item.color)}>{item.value}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{item.note}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-100 dark:border-yellow-800/50">
              <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-200">Supply Coverage Estimate</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Internal supply (upskilling + transfers) can cover approximately{' '}
                <strong>{Math.min(100, Math.round(((readyNow + internalXfers) / Math.max(totalDemand, 1)) * 100))}%</strong>{' '}
                of projected demand. External sourcing needed for the remainder.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 4: Gap Analysis ── */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center gap-3 mb-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
              <h3 className="card-header !mb-0">Step 4: Gap Analysis</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Computed from live requisitions and workforce plans. Total demand of <strong>{totalDemand} FTE</strong> mapped against your current plans.
            </p>

            {gapsByDept.length === 0 ? (
              <p className="text-sm text-green-600 dark:text-green-400 py-6 text-center">No gaps detected — plans appear aligned with open requisitions.</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 px-3 mb-1">
                  <span>Department</span>
                  <span className="text-center">Open Reqs</span>
                  <span className="text-center">Planned</span>
                  <span className="text-right">Gap</span>
                </div>
                {gapsByDept.map(g => (
                  <div key={g.dept} className={clsx(
                    'grid grid-cols-4 gap-2 items-center p-3 rounded-lg border',
                    g.gap < -3 ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/50'
                    : g.gap < 0  ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800/50'
                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700'
                  )}>
                    <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">{g.dept}</span>
                    <span className="text-center text-sm text-gray-700 dark:text-gray-300">{g.openReqs}</span>
                    <span className="text-center text-sm text-gray-700 dark:text-gray-300">{g.plannedHires}</span>
                    <span className={clsx('text-right font-bold text-sm', g.gap < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400')}>
                      {g.gap > 0 ? `+${g.gap}` : g.gap} FTE
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                { label: 'Total Demand',  value: totalDemand,  color: 'text-gray-900 dark:text-white',      bg: '' },
                { label: 'Total Planned', value: totalPlanned, color: 'text-gray-900 dark:text-white',      bg: '' },
                { label: 'Net Gap',       value: netGap,       color: netGap > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400', bg: netGap > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20' },
              ].map(item => (
                <div key={item.label} className={clsx('text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50', item.bg)}>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">{item.label}</p>
                  <p className={clsx('text-2xl font-bold', item.color)}>{item.value > 0 ? `+${item.value}` : item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 5: Execution Strategy ── */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="card-header">Step 5: Execution Strategy — The 6 Bs</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Defaults come from your <strong>{OBJECTIVES.find(o => o.value === objective)?.label}</strong> objective. Adjust any target — values flow directly into the Financial Review.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { title: 'Buy',    sub: 'External Hiring',       icon: BriefcaseIcon,     color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/20',    value: rBuy,    setter: setBuyT,    note: 'Direct hires from market' },
                { title: 'Build',  sub: 'L&D / Upskilling',      icon: SparklesIcon,      color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/20',  value: rBuild,  setter: setBuildT,  note: 'Internal employees to upskill' },
                { title: 'Borrow', sub: 'Contractors / Vendors',  icon: UserGroupIcon,     color: 'text-yellow-600 dark:text-yellow-400',bg: 'bg-yellow-50 dark:bg-yellow-900/20',value: rBorrow, setter: setBorrowT, note: 'Contingent workforce slots' },
                { title: 'Bound',  sub: 'Retention Actions',      icon: HeartIcon,         color: 'text-red-600 dark:text-red-400',      bg: 'bg-red-50 dark:bg-red-900/20',      value: rBound,  setter: setBoundT,  note: 'High-risk employees to retain' },
                { title: 'Bot',    sub: 'Process Automation',     icon: BoltIcon,          color: 'text-purple-600 dark:text-purple-400',bg: 'bg-purple-50 dark:bg-purple-900/20',value: rBot,    setter: setBotT,    note: 'FTE equivalents to automate away' },
                { title: 'Bounce', sub: 'Internal Redeployment',  icon: ArrowTrendingUpIcon,color: 'text-indigo-600 dark:text-indigo-400',bg: 'bg-indigo-50 dark:bg-indigo-900/20',value: rBounce, setter: setBounceT, note: 'Transfers between departments' },
              ].map(b => (
                <div key={b.title} className="card !p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={clsx('p-2 rounded-lg', b.bg)}>
                      <b.icon className={clsx('w-4 h-4', b.color)} />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-900 dark:text-white">{b.title}</p>
                      <p className="text-[10px] text-gray-400">{b.sub}</p>
                    </div>
                  </div>
                  <input
                    type="number" min={0} value={b.value}
                    onChange={e => b.setter(Math.max(0, parseInt(e.target.value) || 0))}
                    className="input w-full text-center text-xl font-bold"
                  />
                  <p className="text-[10px] text-gray-400">{b.note}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Demand Coverage</p>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{rBuy + rBuild + rBounce + rBorrow} / {totalDemand} FTE ({coverage}%)</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className={clsx('h-full transition-all duration-500', coverage >= 90 ? 'bg-success-500' : coverage >= 70 ? 'bg-yellow-500' : 'bg-red-500')}
                  style={{ width: `${coverage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 6: Financial Review ── */}
      {currentStep === 5 && (
        <div className="space-y-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Step 6: Financial Review</h3>
          <div className="card bg-gray-900 dark:bg-gray-950 text-white border-none overflow-hidden relative">
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Period Commitment</span>
                  <p className="text-4xl font-bold mt-1">{loc.currency(totalBudget)}</p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {HORIZONS.find(h => h.value === horizon)?.label} · {OBJECTIVES.find(o => o.value === objective)?.label}
                  </p>
                </div>
                <div className="sm:text-right">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Avg Cost / Hire</span>
                  <p className="text-xl font-bold text-primary-400">{loc.currency(totalBudget / Math.max(rBuy + rBorrow, 1))}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 border-t border-white/10 pt-6">
                {[
                  { label: 'Hiring Spend',       value: hiringSpend,     note: `${rBuy} hires` },
                  { label: 'Training Budget',    value: trainingBudget,  note: `${rBuild} employees` },
                  { label: 'Contractor Spend',   value: contractorSpend, note: `${rBorrow} slots` },
                  { label: 'Retention Pool',     value: retentionPool,   note: `${rBound} at-risk` },
                  { label: 'Automation Invest',  value: automationCost,  note: `${rBot} FTE saved` },
                ].map(item => (
                  <div key={item.label}>
                    <span className="text-[10px] text-gray-400 uppercase">{item.label}</span>
                    <p className="text-lg font-bold">{loc.currency(item.value)}</p>
                    <p className="text-[10px] text-gray-500">{item.note}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <CurrencyDollarIcon className="w-48 h-48" />
            </div>
          </div>

          <div className="card">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Budget Assumptions</h4>
            <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
              <p>· Hiring cost per FTE: 18% of avg salary ({loc.currency(avgSalary * 0.18)})</p>
              <p>· Training cost per employee: {loc.currency(4500)}</p>
              <p>· Contractor rate: 1.4× equivalent salary, prorated over {Math.round(horizonMonths / 2)} months avg engagement</p>
              <p>· Retention bonus: 10% of avg salary ({loc.currency(avgSalary * 0.10)}) per high-risk employee</p>
              <p>· Automation tooling: {loc.currency(28000)} per FTE equivalent saved</p>
            </div>
          </div>

          <div className="flex justify-center pt-4">
            <button
              onClick={() => toast.success('Plan submitted for Board approval!')}
              className="btn-primary px-12 py-4 text-lg shadow-xl shadow-primary-500/20"
            >
              Submit Strategy & Lock Budget
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
