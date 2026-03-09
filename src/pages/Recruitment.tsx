import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api'
import { useGlobalFilters } from '../hooks/useGlobalFilters'
import MetricCard from '../components/MetricCard'
import BarChart from '../components/charts/BarChart'
import _PieChart from '../components/charts/PieChart'
import DataTable from '../components/DataTable'
import { CHART_COLORS } from '../utils/chartColors'
import { useLocalization } from '../hooks/useLocalization'
import { ColumnDef } from '@tanstack/react-table'
import {
  BarChart as RechartsBarChart,
  LineChart as RechartsLineChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  LabelList,
  ResponsiveContainer,
} from 'recharts'
import {
  BriefcaseIcon,
  CurrencyDollarIcon,
  UserPlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  CalculatorIcon,
  TrashIcon,
  PlusIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { exportTableToPdf } from '../utils/exportPdf'
import Papa from 'papaparse'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface RecruiterGoal {
  id: string
  name: string
  seniority: string
  location: string
  manager: string
  employment_type: string
  q1_seniority: string | null
  q2_seniority: string | null
  q3_seniority: string | null
  q4_seniority: string | null
  q1_goal: number
  q2_goal: number
  q3_goal: number
  q4_goal: number
  q1_actual: number
  q2_actual: number
  q3_actual: number
  q4_actual: number
  eligible_for_bonus: boolean
  bonus_notes: string | null
  monthly_capacity: number
  utilization_pct: number
  specializations: string | null
  overhead_pct: number
  max_concurrent_reqs: number
  year: number
  is_active: boolean
  created_at: string | null
  updated_at: string | null
  // Derived fields
  annualGoal?: number
  annualActual?: number
  attainment?: number
  // Index signature for dynamic access
  [key: string]: any
}

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-20 mb-2"></div>
          <div className="h-3 bg-gray-100 rounded w-32"></div>
        </div>
        <div className="p-3 rounded-lg bg-gray-100 w-12 h-12"></div>
      </div>
    </div>
  )
}

function SkeletonChart() {
  return (
    <div className="card animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-40 mb-4"></div>
      <div className="h-[280px] bg-gray-100 rounded"></div>
    </div>
  )
}

export default function Recruitment() {
  const loc = useLocalization()
  const queryClient = useQueryClient()
  const { filterObj } = useGlobalFilters()
  const [activeTab, setActiveTab] = useState<'overview' | 'pipeline' | 'capacity' | 'goaling' | 'quality' | 'cost'>('overview')

  // Goaling calculator state
  const [hiringTarget, setHiringTarget] = useState<string>('50')
  const [acceptanceRate, setAcceptanceRate] = useState<string>('85')
  const [interviewsPerOffer, setInterviewsPerOffer] = useState<string>('4')
  const [screensPerInterview, setScreensPerInterview] = useState<string>('3')

  // Year and Quarter selector (year derived from global filter; quarter kept for internal filtering)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedQuarter] = useState<'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4'>('all')

  // Goals table pagination
  const [goalsPage, setGoalsPage] = useState(1)
  const [showArchivedGoals, setShowArchivedGoals] = useState(false)

  // Add recruiter form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newRecruiter, setNewRecruiter] = useState({
    name: '',
    seniority: 'Mid',
    location: '',
    manager: '',
    employment_type: 'Full-time',
    monthly_capacity: 4,
    utilization_pct: 85,
    overhead_pct: 15,
    max_concurrent_reqs: 8,
    specializations: '',
  })

  // Goaling sub-tab
  const [goalingSubTab, setGoalingSubTab] = useState<'summary' | 'trends' | 'goals' | 'capacity' | 'history'>('summary')
  const [histPage, setHistPage] = useState(0)
  const pageSize = 20

  // Capacity sub-tab
  const [capacitySubTab, setCapacitySubTab] = useState<'overview' | 'planning' | 'per-recruiter'>('overview')

  // Per-recruiter pagination
  const [recruiterPage, setRecruiterPage] = useState(1)
  const [showAllRecruiters, setShowAllRecruiters] = useState(false)
  const RECRUITERS_PER_PAGE = 20

  // Capacity chart team filter
  const [capacityTeamFilter, setCapacityTeamFilter] = useState<string>('all')

  // CSV import state
  const [showCsvImport, setShowCsvImport] = useState(false)
  const [csvPreview, setCsvPreview] = useState<Record<string, unknown>[] | null>(null)
  const [csvImportMode, setCsvImportMode] = useState<'upsert' | 'replace'>('upsert')

  // Year-over-year comparison state
  const [compareYears, setCompareYears] = useState<number[]>([2025, 2026])

  const toggleCompareYear = (year: number) => {
    setCompareYears(prev =>
      prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year].sort()
    )
  }

  // Capacity Planning state
  const [cpNewReqsPerMonth, setCpNewReqsPerMonth] = useState<number>(10)
  const [cpAttritionRate, setCpAttritionRate] = useState<number>(12)
  const [cpPlanningHorizon, setCpPlanningHorizon] = useState<3 | 6 | 12>(6)
  const [cpRoleReqs, setCpRoleReqs] = useState<Record<string, number>>({
    'Junior': 10,
    'Mid': 15,
    'Senior': 8,
    'Staff': 5,
    'Principal': 3,
    'Manager': 6,
    'Director': 3,
    'Executive': 2,
  })
  const [cpSourcingHours, setCpSourcingHours] = useState<number>(6)
  const [cpScreeningHours, setCpScreeningHours] = useState<number>(3)
  const [cpInterviewCoordHours, setCpInterviewCoordHours] = useState<number>(4)
  const [cpOfferCloseHours, setCpOfferCloseHours] = useState<number>(2)

  // Debounce timers
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Automatically set planning horizon to 3 months when a quarter is selected
  useEffect(() => {
    if (selectedQuarter !== 'all') {
      setCpPlanningHorizon(3)
    }
  }, [selectedQuarter])

  // ---- Recruiter Goals API ----
  const { data: goalsRes, isLoading: goalsLoading } = useQuery({
    queryKey: ['recruiter-goals', selectedYear, filterObj],
    queryFn: async () => {
      const res = await api.get('/recruiter-goals', {
        params: { year: selectedYear, ...filterObj }
      })
      return res.data
    },
  })

  const recruiterGoals: RecruiterGoal[] = goalsRes?.data || []

  const createGoalMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post('/recruiter-goals', data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruiter-goals', selectedYear] })
    },
  })

  const updateGoalMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await api.put(`/recruiter-goals/${id}`, data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruiter-goals', selectedYear] })
    },
  })


  const csvImportMutation = useMutation({
    mutationFn: async (data: { goals: Record<string, unknown>[]; year: number; mode: string }) => {
      const res = await api.post('/recruiter-goals/bulk', data)
      return res.data
    },
    onSuccess: (data: any) => {
      toast.success(`Imported ${data.total} recruiter goals (${data.created} created, ${data.updated} updated)`)
      queryClient.invalidateQueries({ queryKey: ['recruiter-goals', selectedYear] })
      setShowCsvImport(false)
      setCsvPreview(null)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to import recruiter goals')
    },
  })

  const syncHiresMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get(`/recruiter-goals/auto-populate?year=${selectedYear}`)
      return res.data
    },
    onSuccess: (data: any) => {
      const updated = data.updated_count || 0
      toast.success(`Synced hires from employee records (${updated} goal${updated !== 1 ? 's' : ''} updated)`)
      queryClient.invalidateQueries({ queryKey: ['recruiter-goals', selectedYear] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to sync hires')
    },
  })

  const handleCsvFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim().toLowerCase().replace(/\s+/g, '_'),
      })
      setCsvPreview(result.data as Record<string, unknown>[])
    }
    reader.readAsText(file)
  }, [])

  const handleCsvImport = useCallback(() => {
    if (!csvPreview || csvPreview.length === 0) return
    const goals = csvPreview.map(row => ({
      name: String(row.name || ''),
      seniority: String(row.seniority || 'Mid'),
      location: String(row.location || ''),
      manager: String(row.manager || ''),
      employment_type: String(row.employment_type || 'Full-time'),
      q1_goal: parseInt(String(row.q1_goal || 0)) || 0,
      q2_goal: parseInt(String(row.q2_goal || 0)) || 0,
      q3_goal: parseInt(String(row.q3_goal || 0)) || 0,
      q4_goal: parseInt(String(row.q4_goal || 0)) || 0,
      q1_actual: parseInt(String(row.q1_actual || 0)) || 0,
      q2_actual: parseInt(String(row.q2_actual || 0)) || 0,
      q3_actual: parseInt(String(row.q3_actual || 0)) || 0,
      q4_actual: parseInt(String(row.q4_actual || 0)) || 0,
      // Capacity fields
      monthly_capacity: parseInt(String(row.monthly_capacity || row.hires_per_month || row.capacity || 4)) || 4,
      utilization_pct: parseInt(String(row.utilization_pct || row.utilization || 85)) || 85,
      overhead_pct: parseInt(String(row.overhead_pct || row.overhead || 15)) || 15,
      max_concurrent_reqs: parseInt(String(row.max_concurrent_reqs || row.max_reqs || 8)) || 8,
      specializations: String(row.specializations || ''),
    })).filter(g => g.name.trim())
    csvImportMutation.mutate({ goals, year: selectedYear, mode: csvImportMode })
  }, [csvPreview, selectedYear, csvImportMode, csvImportMutation])

  // Fetch goals for all compare years (year-over-year comparison)
  const { data: compareData } = useQuery({
    queryKey: ['recruiter-goals-compare', compareYears],
    queryFn: async () => {
      const results = await Promise.all(
        compareYears.map(year =>
          api.get(`/recruiter-goals?year=${year}`).then(r => ({ year, goals: (r.data.data || []) as RecruiterGoal[] }))
        )
      )
      return results
    },
    enabled: compareYears.length > 0,
  })

  // Pipeline, requisitions, and candidates queries (moved up for dependency ordering)
  const { data: pipelineRes, isLoading: pipelineLoading } = useQuery({
    queryKey: ['pipeline-stats', filterObj],
    queryFn: async () => {
      const res = await api.get('/candidates/pipeline/stats', { params: filterObj })
      return res.data
    },
  })

  const { data: reqsRes, isLoading: reqsLoading } = useQuery({
    queryKey: ['requisitions-list', filterObj],
    queryFn: async () => {
      const res = await api.get('/requisitions', { params: filterObj })
      return res.data
    },
  })

  const { data: candidatesRes, isLoading: candidatesLoading } = useQuery({
    queryKey: ['candidates-list', filterObj],
    queryFn: async () => {
      const res = await api.get('/candidates', { params: filterObj })
      return res.data
    },
  })

  // Quality of Hire data
  const { data: qohRes, isLoading: qohLoading } = useQuery({
    queryKey: ['quality-of-hire', filterObj],
    queryFn: async () => {
      const res = await api.get('/recruitment/quality-of-hire', { params: filterObj })
      return res.data
    },
    enabled: activeTab === 'quality',
  })

  // Cost Per Hire data
  const { data: cphRes, isLoading: cphLoading } = useQuery({
    queryKey: ['cost-per-hire', filterObj],
    queryFn: async () => {
      const res = await api.get('/recruitment/cost-per-hire', { params: filterObj })
      return res.data
    },
    enabled: activeTab === 'cost',
  })

  // Source analysis data
  const { data: sourceRes } = useQuery({
    queryKey: ['source-analysis', filterObj],
    queryFn: async () => {
      const res = await api.get('/recruitment/source-analysis', { params: filterObj })
      return res.data
    },
    enabled: activeTab === 'quality',
  })

  // Quality of Hire Analytics (recruiter/team/manager rankings + time-to-hire correlation)
  const { data: qohAnalyticsRes, isLoading: qohAnalyticsLoading } = useQuery({
    queryKey: ['quality-of-hire-analytics', filterObj],
    queryFn: async () => {
      const res = await api.get('/recruitment/quality-of-hire/analytics', { params: filterObj })
      return res.data
    },
    enabled: activeTab === 'quality',
  })

  const isLoading = pipelineLoading || reqsLoading || candidatesLoading

  const pipelineStats = pipelineRes?.data?.pipeline || {}
  const sourceEffectiveness = pipelineRes?.data?.source_effectiveness || {}
  const requisitions = Array.isArray(reqsRes?.data) ? reqsRes.data : reqsRes?.data?.requisitions || []
  const totalRequisitions: number = reqsRes?.total ?? requisitions.length
  const candidates = Array.isArray(candidatesRes?.data) ? candidatesRes.data : candidatesRes?.data?.candidates || []
  const totalCandidatesCount: number = candidatesRes?.total ?? candidates.length

  const handleAddRecruiter = useCallback(() => {
    if (!newRecruiter.name.trim()) return
    createGoalMutation.mutate({
      ...newRecruiter,
      year: selectedYear,
      q1_goal: 0,
      q2_goal: 0,
      q3_goal: 0,
      q4_goal: 0,
      q1_actual: 0,
      q2_actual: 0,
      q3_actual: 0,
      q4_actual: 0,
      eligible_for_bonus: false,
    })
    setNewRecruiter({ name: '', seniority: 'Mid', location: '', manager: '', employment_type: 'Full-time', monthly_capacity: 4, utilization_pct: 85, overhead_pct: 15, max_concurrent_reqs: 8, specializations: '' })
    setShowAddForm(false)
  }, [newRecruiter, selectedYear, createGoalMutation])

  const handleDeleteRecruiter = useCallback((id: string, name: string) => {
    if (window.confirm(`Archive recruiter "${name}"? They will be hidden from calculations but their data will be preserved.`)) {
      updateGoalMutation.mutate({ id, data: { is_active: false } })
    }
  }, [updateGoalMutation])

  const debouncedUpdate = useCallback((id: string, field: string, value: number | boolean | string) => {
    const key = `${id}-${field}`
    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key])
    }
    debounceTimers.current[key] = setTimeout(() => {
      updateGoalMutation.mutate({ id, data: { [field]: value } })
      delete debounceTimers.current[key]
    }, 600)
  }, [updateGoalMutation])

  // Goaling calculations
  const goalingCalcs = useMemo(() => {
    const target = parseFloat(hiringTarget) || 0
    const acceptance = (parseFloat(acceptanceRate) || 0) / 100
    const intPerOffer = parseFloat(interviewsPerOffer) || 0
    const scrPerInt = parseFloat(screensPerInterview) || 0

    const requiredPipeline = acceptance > 0 ? Math.ceil(target / acceptance) : 0
    const requiredInterviews = requiredPipeline * intPerOffer
    const requiredScreens = requiredInterviews * scrPerInt

    return { requiredPipeline, requiredInterviews, requiredScreens }
  }, [hiringTarget, acceptanceRate, interviewsPerOffer, screensPerInterview])

  const recruiterTotals = useMemo(() => {
    return recruiterGoals.filter(r => r.is_active !== false).map(r => {
      let goal = (r.q1_goal || 0) + (r.q2_goal || 0) + (r.q3_goal || 0) + (r.q4_goal || 0)
      let actual = (r.q1_actual || 0) + (r.q2_actual || 0) + (r.q3_actual || 0) + (r.q4_actual || 0)
      
      if (selectedQuarter !== 'all') {
        const qKey = selectedQuarter.toLowerCase();
        goal = (r as any)[`${qKey}_goal`] || 0
        actual = (r as any)[`${qKey}_actual`] || 0
      }

      const attainment = goal > 0 ? Math.round((actual / goal) * 100) : 0
      return { ...r, annualGoal: goal, annualActual: actual, attainment }
    })
  }, [recruiterGoals, selectedQuarter])

  const quarterSums = useMemo(() => {
    const activeGoals = recruiterGoals.filter(r => r.is_active !== false)
    
    const q1Goal = activeGoals.reduce((sum, r) => sum + (r.q1_goal || 0), 0)
    const q2Goal = activeGoals.reduce((sum, r) => sum + (r.q2_goal || 0), 0)
    const q3Goal = activeGoals.reduce((sum, r) => sum + (r.q3_goal || 0), 0)
    const q4Goal = activeGoals.reduce((sum, r) => sum + (r.q4_goal || 0), 0)
    const q1Actual = activeGoals.reduce((sum, r) => sum + (r.q1_actual || 0), 0)
    const q2Actual = activeGoals.reduce((sum, r) => sum + (r.q2_actual || 0), 0)
    const q3Actual = activeGoals.reduce((sum, r) => sum + (r.q3_actual || 0), 0)
    const q4Actual = activeGoals.reduce((sum, r) => sum + (r.q4_actual || 0), 0)
    
    let currentGoal = q1Goal + q2Goal + q3Goal + q4Goal
    let currentActual = q1Actual + q2Actual + q3Actual + q4Actual
    
    if (selectedQuarter !== 'all') {
      if (selectedQuarter === 'Q1') { currentGoal = q1Goal; currentActual = q1Actual; }
      if (selectedQuarter === 'Q2') { currentGoal = q2Goal; currentActual = q2Actual; }
      if (selectedQuarter === 'Q3') { currentGoal = q3Goal; currentActual = q3Actual; }
      if (selectedQuarter === 'Q4') { currentGoal = q4Goal; currentActual = q4Actual; }
    }

    const attainment = currentGoal > 0 ? Math.round((currentActual / currentGoal) * 100) : 0
    return { q1Goal, q2Goal, q3Goal, q4Goal, q1Actual, q2Actual, q3Actual, q4Actual, annualGoal: currentGoal, annualActual: currentActual, attainment }
  }, [recruiterGoals, selectedQuarter])

  // Team summary for goaling dashboard
  const teamSummary = useMemo(() => {
    const totalGoal = quarterSums.annualGoal
    const totalActual = quarterSums.annualActual
    const teamAttainment = quarterSums.attainment
    const avgPerRecruiter = recruiterTotals.length > 0
      ? Math.round(totalActual / recruiterTotals.length)
      : 0

    // Best performer
    const best = recruiterTotals.length > 0
      ? recruiterTotals.reduce((top, r) => r.attainment > top.attainment ? r : top, recruiterTotals[0])
      : null

    // Underperformers (<75%)
    const underperformers = recruiterTotals.filter(r => r.annualGoal > 0 && r.attainment < 75).length

    // Performance distribution
    const exceeded = recruiterTotals.filter(r => r.annualGoal > 0 && r.attainment > 100).length
    const met = recruiterTotals.filter(r => r.annualGoal > 0 && r.attainment === 100).length
    const close = recruiterTotals.filter(r => r.annualGoal > 0 && r.attainment >= 75 && r.attainment < 100).length
    const missed = recruiterTotals.filter(r => r.annualGoal > 0 && r.attainment < 75).length
    const noGoal = recruiterTotals.filter(r => r.annualGoal === 0).length

    return { totalGoal, totalActual, teamAttainment, avgPerRecruiter, best, underperformers, exceeded, met, close, missed, noGoal }
  }, [quarterSums, recruiterTotals])

  const capacityChartData = useMemo(() => {
    return recruiterTotals.map(r => ({
      name: r.name,
      goal: r.annualGoal,
      actual: r.annualActual,
      manager: r.manager || '',
    }))
  }, [recruiterTotals])

  const capacityTeams = useMemo(() => {
    const teams = new Set<string>()
    recruiterTotals.forEach(r => { if (r.manager) teams.add(r.manager) })
    return Array.from(teams).sort()
  }, [recruiterTotals])

  const filteredCapacityData = useMemo(() => {
    const data = capacityTeamFilter === 'all'
      ? capacityChartData
      : capacityChartData.filter(r => r.manager === capacityTeamFilter)
    return data.sort((a, b) => (b.goal || 0) - (a.goal || 0))
  }, [capacityChartData, capacityTeamFilter])

  // Table display: includes archived when toggle is on
  const tableRecruiters = useMemo(() => {
    const all = recruiterGoals.map(r => {
      let goal = (r.q1_goal || 0) + (r.q2_goal || 0) + (r.q3_goal || 0) + (r.q4_goal || 0)
      let actual = (r.q1_actual || 0) + (r.q2_actual || 0) + (r.q3_actual || 0) + (r.q4_actual || 0)
      if (selectedQuarter !== 'all') {
        const qKey = selectedQuarter.toLowerCase()
        goal = (r as any)[`${qKey}_goal`] || 0
        actual = (r as any)[`${qKey}_actual`] || 0
      }
      const attainment = goal > 0 ? Math.round((actual / goal) * 100) : 0
      return { ...r, annualGoal: goal, annualActual: actual, attainment }
    })
    return showArchivedGoals ? all : all.filter(r => r.is_active !== false)
  }, [recruiterGoals, selectedQuarter, showArchivedGoals])

  // Role complexity definitions
  const [roleComplexity, setRoleComplexity] = useState([
    { role: 'Junior', multiplier: 1.0, avgTimeToFill: 20 },
    { role: 'Mid', multiplier: 1.3, avgTimeToFill: 30 },
    { role: 'Senior', multiplier: 1.8, avgTimeToFill: 45 },
    { role: 'Staff', multiplier: 2.0, avgTimeToFill: 55 },
    { role: 'Principal', multiplier: 2.3, avgTimeToFill: 65 },
    { role: 'Manager', multiplier: 2.5, avgTimeToFill: 50 },
    { role: 'Director', multiplier: 2.8, avgTimeToFill: 70 },
    { role: 'Executive', multiplier: 3.5, avgTimeToFill: 90 },
  ])

  // Per-recruiter effective capacity breakdown
  const perRecruiterCapacity = useMemo(() => {
    return recruiterGoals.map((r) => {
      const cap = r.monthly_capacity || 4
      const util = r.utilization_pct || 85
      const overhead = r.overhead_pct || 15
      const maxReqs = r.max_concurrent_reqs || 8
      const effective = cap * (util / 100) * (1 - overhead / 100)
      return {
        id: r.id,
        name: r.name,
        seniority: r.seniority,
        specializations: r.specializations,
        monthly_capacity: cap,
        utilization_pct: util,
        overhead_pct: overhead,
        max_concurrent_reqs: maxReqs,
        effective,
        is_active: r.is_active !== false,
      }
    })
  }, [recruiterGoals])

  // Capacity planning calculations (now uses per-recruiter data)
  const capacityPlanningCalcs = useMemo(() => {
    const activeRecruiters = recruiterGoals.filter(r => r.is_active !== false)
    const currentTeamSize = activeRecruiters.length
    const openReqs = requisitions.filter((r: any) => r.status === 'open').length

    // --- Demand Forecasting ---
    const totalFromNewReqs = cpNewReqsPerMonth * cpPlanningHorizon
    const totalFromAttrition = Math.ceil(openReqs * (cpAttritionRate / 100) * (cpPlanningHorizon / 12))
    const totalHiresNeeded = openReqs + totalFromNewReqs + totalFromAttrition

    // --- Per-Recruiter Bandwidth (summed from individual capacities) ---
    const activeCapacities = perRecruiterCapacity.filter(r => r.is_active)
    const monthlyTeamCapacity = activeCapacities.reduce((sum, r) => sum + r.effective, 0)
    const avgEffectivePerRecruiter = currentTeamSize > 0 ? monthlyTeamCapacity / currentTeamSize : 0
    const periodTeamCapacity = monthlyTeamCapacity * cpPlanningHorizon

    // --- Role Complexity Weighted Demand ---
    let totalWeightedReqs = 0
    let totalRoleReqs = 0
    roleComplexity.forEach(rc => {
      const count = cpRoleReqs[rc.role] || 0
      totalWeightedReqs += count * rc.multiplier
      totalRoleReqs += count
    })
    const weightedAvgComplexity = totalRoleReqs > 0 ? totalWeightedReqs / totalRoleReqs : 1
    const complexityAdjustedDemand = totalHiresNeeded * weightedAvgComplexity

    // --- Funnel Velocity ---
    const totalHoursPerHire = cpSourcingHours + cpScreeningHours + cpInterviewCoordHours + cpOfferCloseHours

    // --- Capacity Gap ---
    const requiredMonthlyCapacity = cpPlanningHorizon > 0 ? complexityAdjustedDemand / cpPlanningHorizon : 0
    const gap = requiredMonthlyCapacity - monthlyTeamCapacity
    const utilizationPct = monthlyTeamCapacity > 0 ? (requiredMonthlyCapacity / monthlyTeamCapacity) * 100 : 0
    const additionalRecruitersNeeded = avgEffectivePerRecruiter > 0
      ? Math.ceil(Math.max(0, gap) / avgEffectivePerRecruiter)
      : 0
    const slackPct = monthlyTeamCapacity > 0
      ? Math.round(((monthlyTeamCapacity - requiredMonthlyCapacity) / monthlyTeamCapacity) * 100)
      : 0

    let status: 'green' | 'yellow' | 'red' = 'green'
    if (utilizationPct > 100) status = 'red'
    else if (utilizationPct >= 80) status = 'yellow'

    // Per-recruiter load allocation (proportional share of demand)
    const perRecruiterLoad = perRecruiterCapacity.map((r) => {
      const share = monthlyTeamCapacity > 0 ? r.effective / monthlyTeamCapacity : 0
      const allocatedDemand = requiredMonthlyCapacity * share
      const loadPct = r.effective > 0 ? (allocatedDemand / r.effective) * 100 : 0
      let loadStatus: 'green' | 'yellow' | 'red' = 'green'
      if (loadPct > 100) loadStatus = 'red'
      else if (loadPct >= 80) loadStatus = 'yellow'
      return { ...r, allocatedDemand: Math.round(allocatedDemand * 10) / 10, loadPct: Math.round(loadPct), loadStatus }
    })

    return {
      currentTeamSize,
      openReqs,
      totalFromNewReqs,
      totalFromAttrition,
      totalHiresNeeded,
      effectiveCapacityPerRecruiter: avgEffectivePerRecruiter,
      monthlyTeamCapacity,
      periodTeamCapacity,
      weightedAvgComplexity,
      complexityAdjustedDemand,
      totalHoursPerHire,
      requiredMonthlyCapacity,
      gap,
      utilizationPct,
      additionalRecruitersNeeded,
      slackPct,
      status,
      perRecruiterLoad,
    }
  }, [
    recruiterGoals, requisitions, cpNewReqsPerMonth, cpAttritionRate,
    cpPlanningHorizon, perRecruiterCapacity,
    cpRoleReqs, roleComplexity, cpSourcingHours, cpScreeningHours,
    cpInterviewCoordHours, cpOfferCloseHours,
  ])

  // Demand vs Capacity chart data for the gap analysis
  const gapChartData = useMemo(() => [
    {
      name: 'Monthly Capacity',
      demand: Math.round(capacityPlanningCalcs.requiredMonthlyCapacity * 10) / 10,
      capacity: Math.round(capacityPlanningCalcs.monthlyTeamCapacity * 10) / 10,
    },
  ], [capacityPlanningCalcs])

  // Funnel velocity breakdown data
  const funnelVelocityData = useMemo(() => [
    { stage: 'Sourcing', hours: cpSourcingHours, color: CHART_COLORS[0] },
    { stage: 'Screening', hours: cpScreeningHours, color: CHART_COLORS[1] },
    { stage: 'Interview Coord.', hours: cpInterviewCoordHours, color: CHART_COLORS[2] },
    { stage: 'Offer/Close', hours: cpOfferCloseHours, color: CHART_COLORS[3] },
  ], [cpSourcingHours, cpScreeningHours, cpInterviewCoordHours, cpOfferCloseHours])

  const getAttainmentBadge = (pct: number) => {
    if (pct >= 100) return 'bg-green-100 text-green-700'
    if (pct >= 80) return 'bg-yellow-100 text-yellow-700'
    return 'bg-red-100 text-red-700'
  }

  const getGoalMetStatus = (goal: number, actual: number): { met: boolean; label: string; className: string } => {
    if (goal === 0) return { met: false, label: 'No Goal', className: 'text-gray-400' }
    const attainment = (actual / goal) * 100
    if (attainment > 100) return { met: true, label: 'Exceeded', className: 'text-green-600 font-semibold' }
    if (attainment === 100) return { met: true, label: 'Met', className: 'text-green-600 font-semibold' }
    if (attainment >= 75) return { met: false, label: 'Close', className: 'text-yellow-600' }
    return { met: false, label: 'Missed', className: 'text-red-600' }
  }

  const getPerformanceTrend = (yearlyData: { year: number; attainment: number }[]) => {
    if (yearlyData.length < 2) return null
    const sorted = [...yearlyData].sort((a, b) => a.year - b.year)
    const latest = sorted[sorted.length - 1].attainment
    const previous = sorted[sorted.length - 2].attainment
    const diff = latest - previous
    if (diff > 5) return { direction: 'up' as const, color: 'text-green-600', label: `+${Math.round(diff)}%` }
    if (diff < -5) return { direction: 'down' as const, color: 'text-red-600', label: `${Math.round(diff)}%` }
    return { direction: 'stable' as const, color: 'text-gray-500', label: 'Stable' }
  }

  // Unique recruiter names across all comparison years
  const uniqueRecruiterNames = useMemo(() => {
    if (!compareData) return []
    const names = new Set<string>()
    compareData.forEach(yearData => {
      yearData.goals.forEach(g => names.add(g.name))
    })
    return Array.from(names).sort()
  }, [compareData])

  // Build comparison rows for the historical table
  const comparisonRows = useMemo(() => {
    if (!compareData) return []
    return uniqueRecruiterNames.map(name => {
      const yearlyEntries = compareYears.map(year => {
        const yearData = compareData.find(d => d.year === year)
        const goal = yearData?.goals.find(g => g.name === name)
        const annualGoal = goal ? (goal.q1_goal + goal.q2_goal + goal.q3_goal + goal.q4_goal) : 0
        const annualActual = goal ? (goal.q1_actual + goal.q2_actual + goal.q3_actual + goal.q4_actual) : 0
        const attainment = annualGoal > 0 ? Math.round((annualActual / annualGoal) * 100) : 0
        return { year, annualGoal, annualActual, attainment }
      })
      const trend = getPerformanceTrend(yearlyEntries.filter(e => e.annualGoal > 0))
      return { name, yearlyEntries, trend }
    })
  }, [compareData, compareYears, uniqueRecruiterNames])

  const pipelineData = useMemo(() => {
    const stages = [
      { stage: 'New', key: 'new', color: CHART_COLORS[5] },
      { stage: 'Screening', key: 'screening', color: CHART_COLORS[2] },
      { stage: 'Interview', key: 'interview', color: CHART_COLORS[1] },
      { stage: 'Final Round', key: 'final_round', color: CHART_COLORS[3] },
      { stage: 'Offer', key: 'offer', color: CHART_COLORS[0] },
      { stage: 'Hired', key: 'hired', color: CHART_COLORS[4] },
    ]
    return stages.map(s => ({
      ...s,
      count: pipelineStats[s.key] || 0,
    }))
  }, [pipelineStats])

  const sourceData = useMemo(() => {
    return Object.entries(sourceEffectiveness).map(([source, data]: [string, any]) => ({
      source: source.replace('_', ' ').replace(/^\w/, (c: string) => c.toUpperCase()),
      applications: data.total || 0,
      hired: data.hired || 0,
      conversionRate: data.conversion_rate || 0,
    }))
  }, [sourceEffectiveness])

  const metrics = useMemo(() => {
    // Use pipelineStats total as the source of truth for all candidates in the system
    const totalPipeline = Object.values(pipelineStats).reduce((a: number, b: any) => a + (Number(b) || 0), 0) as number
    const totalCandidates = totalPipeline > 0 ? totalPipeline : totalCandidatesCount
    const hiredCount = pipelineStats['hired'] || 0
    const offerCount = pipelineStats['offer'] || 0
    const offerAcceptance = offerCount + hiredCount > 0 ? Math.round((hiredCount / (offerCount + hiredCount)) * 100) : 0
    // Open reqs: use API total if available, otherwise filter the loaded page
    const openReqsFromPage = requisitions.filter((r: any) => r.status === 'open').length
    const openReqRatio = requisitions.length > 0 ? openReqsFromPage / requisitions.length : 0
    const openReqs = requisitions.length > 0 ? Math.round(totalRequisitions * openReqRatio) : 0

    return {
      openReqs,
      totalCandidates,
      hiredCount,
      totalPipeline,
      offerAcceptance,
    }
  }, [requisitions, totalRequisitions, totalCandidatesCount, pipelineStats])

  const reqsByDept = useMemo(() => {
    const depts: Record<string, number> = {}
    requisitions.forEach((r: any) => {
      const dept = r.department || 'Unknown'
      depts[dept] = (depts[dept] || 0) + 1
    })
    return Object.entries(depts).map(([department, count]) => ({ department, count }))
  }, [requisitions])

  const sourceColumns: ColumnDef<any>[] = [
    { accessorKey: 'source', header: 'Source' },
    { accessorKey: 'applications', header: 'Applications' },
    { accessorKey: 'hired', header: 'Hired' },
    {
      accessorKey: 'conversionRate',
      header: 'Conversion %',
      cell: ({ row }) => `${row.original.conversionRate}%`,
    },
  ]

  const exportGoalingCSV = useCallback(() => {
    let data: Record<string, string | number>[] = []
    let filename = 'recruiter-goaling'

    switch (goalingSubTab) {
      case 'summary':
        data = recruiterTotals.map(r => ({
          Name: r.name,
          'Annual Goal': r.annualGoal,
          'Annual Actual': r.annualActual,
          'Attainment (%)': r.attainment,
        }))
        data.push({
          Name: 'TEAM TOTAL',
          'Annual Goal': teamSummary.totalGoal,
          'Annual Actual': teamSummary.totalActual,
          'Attainment (%)': teamSummary.teamAttainment,
        })
        filename = 'recruiter-goaling-summary'
        break
      case 'goals':
        data = recruiterTotals.map(r => ({
          Name: r.name,
          Seniority: r.seniority,
          Location: r.location,
          Manager: r.manager,
          'Q1 Goal': r.q1_goal,
          'Q1 Actual': r.q1_actual,
          'Q2 Goal': r.q2_goal,
          'Q2 Actual': r.q2_actual,
          'Q3 Goal': r.q3_goal,
          'Q3 Actual': r.q3_actual,
          'Q4 Goal': r.q4_goal,
          'Q4 Actual': r.q4_actual,
          'Annual Goal': r.annualGoal,
          'Annual Actual': r.annualActual,
          'Attainment (%)': r.attainment,
        }))
        filename = 'recruiter-goals-table'
        break
      case 'capacity':
        data = capacityChartData.map(r => ({
          Name: r.name,
          Goal: r.goal,
          Actual: r.actual,
        }))
        filename = 'recruiter-capacity'
        break
      case 'history':
        data = comparisonRows.flatMap(row =>
          row.yearlyEntries.map(entry => ({
            Name: row.name,
            Year: entry.year,
            'Annual Goal': entry.annualGoal,
            'Annual Actual': entry.annualActual,
            'Attainment (%)': entry.attainment,
          }))
        )
        filename = 'recruiter-goaling-history'
        break
    }

    const csv = Papa.unparse(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported successfully')
  }, [goalingSubTab, recruiterTotals, teamSummary, capacityChartData, comparisonRows])

  const exportGoalingPDF = useCallback(() => {
    let title = 'Recruiter Goaling'
    let headers: string[] = []
    let dataRows: (string | number)[][] = []

    switch (goalingSubTab) {
      case 'summary':
        title = 'Recruiter Goaling - Summary'
        headers = ['Name', 'Annual Goal', 'Annual Actual', 'Attainment (%)']
        dataRows = recruiterTotals.map(r => [r.name, r.annualGoal, r.annualActual, `${r.attainment}%`])
        dataRows.push(['TEAM TOTAL', teamSummary.totalGoal, teamSummary.totalActual, `${teamSummary.teamAttainment}%`])
        break
      case 'goals':
        title = 'Recruiter Goals Table'
        headers = ['Name', 'Seniority', 'Location', 'Manager', 'Q1 Goal', 'Q1 Actual', 'Q2 Goal', 'Q2 Actual', 'Q3 Goal', 'Q3 Actual', 'Q4 Goal', 'Q4 Actual', 'Annual Goal', 'Annual Actual', 'Attainment (%)']
        dataRows = recruiterTotals.map(r => [
          r.name, r.seniority, r.location, r.manager,
          r.q1_goal, r.q1_actual, r.q2_goal, r.q2_actual,
          r.q3_goal, r.q3_actual, r.q4_goal, r.q4_actual,
          r.annualGoal, r.annualActual, `${r.attainment}%`,
        ])
        break
      case 'capacity':
        title = 'Recruiter Capacity'
        headers = ['Name', 'Goal', 'Actual']
        dataRows = capacityChartData.map(r => [r.name, r.goal, r.actual])
        break
      case 'history':
        title = 'Recruiter Goaling History'
        headers = ['Name', 'Year', 'Annual Goal', 'Annual Actual', 'Attainment (%)']
        dataRows = comparisonRows.flatMap(row =>
          row.yearlyEntries.map(entry => [
            row.name, entry.year, entry.annualGoal, entry.annualActual, `${entry.attainment}%`,
          ])
        )
        break
    }

    exportTableToPdf(title, headers, dataRows, { companyName: 'Interface' })
    toast.success('PDF exported successfully')
  }, [goalingSubTab, recruiterTotals, teamSummary, capacityChartData, comparisonRows])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recruitment</h1>
          <p className="text-sm text-gray-500 mt-1">Manage hiring pipeline and recruiter performance</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['overview', 'pipeline', 'goaling', 'capacity', 'quality', 'cost'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize flex items-center gap-1.5',
              activeTab === tab
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab === 'goaling' && <CalculatorIcon className="w-4 h-4" />}
            {tab === 'goaling' ? 'Recruiter Goals' : tab === 'capacity' ? 'Recruiter Capacity' : tab === 'quality' ? 'Quality of Hire' : tab === 'cost' ? 'Cost Per Hire' : tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Open Positions"
              value={metrics.openReqs}
              trend="up"
              icon={<BriefcaseIcon className="w-6 h-6" />}
            />
            <MetricCard
              title="Total Candidates"
              value={metrics.totalPipeline}
              trend="up"
              icon={<UserPlusIcon className="w-6 h-6" />}
            />
            <MetricCard
              title="Total Hired"
              value={metrics.hiredCount}
              trend="up"
              icon={<CheckCircleIcon className="w-6 h-6" />}
            />
            <MetricCard
              title="Offer Acceptance"
              value={`${metrics.offerAcceptance}%`}
              trend="up"
              icon={<CurrencyDollarIcon className="w-6 h-6" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="card-header">Hiring Pipeline</h3>
              {pipelineData.some(d => d.count > 0) ? (
                <BarChart
                  data={pipelineData}
                  xKey="stage"
                  bars={[{ key: 'count', name: 'Candidates', color: CHART_COLORS[2] }]}
                  colorByValue
                  height={280}
                />
              ) : (
                <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">
                  No pipeline data available. Load mock database from Data Management.
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="card-header">Requisitions by Department</h3>
              {reqsByDept.length > 0 ? (
                <BarChart
                  data={reqsByDept}
                  xKey="department"
                  bars={[{ key: 'count', name: 'Requisitions', color: CHART_COLORS[1] }]}
                  height={280}
                />
              ) : (
                <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">
                  No requisition data available
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="card-header">Source Effectiveness</h3>
            {sourceData.length > 0 ? (
              <DataTable data={sourceData} columns={sourceColumns} searchable={false} pageSize={6} />
            ) : (
              <div className="py-8 text-center text-gray-400 text-sm">No source data available</div>
            )}
          </div>
        </>
      )}

      {activeTab === 'pipeline' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card lg:col-span-2">
              <h3 className="card-header">Pipeline Funnel</h3>
              <div className="space-y-3">
                {pipelineData.map((stage, index) => {
                  const maxCount = pipelineData[0]?.count || 1
                  const prevCount = index > 0 ? pipelineData[index - 1].count : stage.count
                  const conversionRate = index > 0 && prevCount > 0
                    ? ((stage.count / prevCount) * 100).toFixed(1)
                    : '100'

                  return (
                    <div key={stage.stage} className="relative">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{stage.stage}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-500">{stage.count} candidates</span>
                          {index > 0 && (
                            <span className="text-xs text-gray-400">{conversionRate}% conversion</span>
                          )}
                        </div>
                      </div>
                      <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                        <div
                          className="h-full rounded-lg transition-all"
                          style={{
                            width: `${maxCount > 0 ? (stage.count / maxCount) * 100 : 0}%`,
                            backgroundColor: stage.color,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card">
              <h3 className="card-header">Pipeline Health</h3>
              <div className="space-y-4">
                {metrics.totalPipeline > 0 ? (
                  <>
                    <div className="flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-100 dark:border-primary-800/50">
                      <div className="flex items-center gap-2">
                        <UserPlusIcon className="w-5 h-5 text-primary-500 dark:text-primary-400" />
                        <span className="text-sm font-medium text-primary-900 dark:text-primary-100">Total in Pipeline</span>
                      </div>
                      <span className="text-sm font-bold text-primary-700 dark:text-primary-300">{metrics.totalPipeline}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-100 dark:border-success-800/50">
                      <div className="flex items-center gap-2">
                        <CheckCircleIcon className="w-5 h-5 text-success-500 dark:text-success-400" />
                        <span className="text-sm font-medium text-success-900 dark:text-success-100">Hired</span>
                      </div>
                      <span className="text-sm font-bold text-success-700 dark:text-success-300">{pipelineStats['hired'] || 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-100 dark:border-warning-800/50">
                      <div className="flex items-center gap-2">
                        <XCircleIcon className="w-5 h-5 text-warning-500 dark:text-warning-400" />
                        <span className="text-sm font-medium text-warning-900 dark:text-warning-100">Rejected</span>
                      </div>
                      <span className="text-sm font-bold text-warning-700 dark:text-warning-300">{pipelineStats['rejected'] || 0}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-400 text-center py-4">No pipeline data</div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Key Ratios</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Offer Acceptance</span>
                    <span className="font-medium">{metrics.offerAcceptance}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Open Positions</span>
                    <span className="font-medium">{metrics.openReqs}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'capacity' && (
        <>
          {/* Capacity Sub-tabs */}
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              {([
                { key: 'overview', label: 'Overview' },
                { key: 'planning', label: 'Capacity Planning' },
                { key: 'per-recruiter', label: 'Per-Recruiter' },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setCapacitySubTab(tab.key)}
                  className={clsx(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                    capacitySubTab === tab.key
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ===== OVERVIEW SUB-TAB ===== */}
          {capacitySubTab === 'overview' && (
          <>
          {/* Summary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Current Team Size"
              value={capacityPlanningCalcs.currentTeamSize}
              subtitle={`${capacityPlanningCalcs.currentTeamSize} active recruiter${capacityPlanningCalcs.currentTeamSize !== 1 ? 's' : ''}`}
              icon={<UserPlusIcon className="w-6 h-6" />}
            />
            <MetricCard
              title="Effective Monthly Capacity"
              value={loc.number(Math.round(capacityPlanningCalcs.monthlyTeamCapacity * 10) / 10)}
              subtitle={`${loc.number(Math.round(capacityPlanningCalcs.effectiveCapacityPerRecruiter * 100) / 100)} hires/recruiter/mo`}
              icon={<CheckCircleIcon className="w-6 h-6" />}
            />
            <MetricCard
              title="Required Monthly Capacity"
              value={loc.number(Math.round(capacityPlanningCalcs.requiredMonthlyCapacity * 10) / 10)}
              subtitle={`${loc.number(Math.round(capacityPlanningCalcs.complexityAdjustedDemand))} total over ${cpPlanningHorizon}mo`}
              icon={<BriefcaseIcon className="w-6 h-6" />}
            />
            <div
              className={clsx(
                'card hover:shadow-md transition-shadow',
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500">Capacity Gap</p>
                  <p
                    className={clsx(
                      'text-xl font-bold mt-0.5',
                      capacityPlanningCalcs.gap > 0 ? 'text-red-600' : capacityPlanningCalcs.gap > -1 ? 'text-yellow-600' : 'text-green-600'
                    )}
                  >
                    {capacityPlanningCalcs.gap > 0 ? '+' : ''}{loc.number(Math.round(capacityPlanningCalcs.gap * 10) / 10)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {capacityPlanningCalcs.gap > 0
                      ? `Need ${capacityPlanningCalcs.additionalRecruitersNeeded} more recruiter${capacityPlanningCalcs.additionalRecruitersNeeded !== 1 ? 's' : ''}`
                      : `${Math.abs(capacityPlanningCalcs.slackPct)}% slack capacity`}
                  </p>
                </div>
                <div
                  className={clsx(
                    'p-2 rounded-lg',
                    capacityPlanningCalcs.status === 'red' && 'bg-red-50 text-red-600',
                    capacityPlanningCalcs.status === 'yellow' && 'bg-yellow-50 text-yellow-600',
                    capacityPlanningCalcs.status === 'green' && 'bg-green-50 text-green-600',
                  )}
                >
                  <CalculatorIcon className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>

          {/* Team Capacity Summary (aggregated from per-recruiter settings) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="card-header">Team Capacity Summary</h3>
              <p className="text-xs text-gray-400 -mt-3 mb-4">Capacity is calculated per-recruiter. Edit individual settings in the Per-Recruiter tab.</p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Avg Capacity / Recruiter</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {recruiterGoals.length > 0
                        ? loc.number(Math.round(recruiterGoals.reduce((s, r) => s + (r.monthly_capacity || 4), 0) / recruiterGoals.length * 10) / 10)
                        : '0'} hires/mo
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Avg Utilization</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {recruiterGoals.length > 0
                        ? Math.round(recruiterGoals.reduce((s, r) => s + (r.utilization_pct || 85), 0) / recruiterGoals.length)
                        : 0}%
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Avg Overhead</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {recruiterGoals.length > 0
                        ? Math.round(recruiterGoals.reduce((s, r) => s + (r.overhead_pct || 15), 0) / recruiterGoals.length)
                        : 0}%
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Avg Max Concurrent Reqs</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {recruiterGoals.length > 0
                        ? Math.round(recruiterGoals.reduce((s, r) => s + (r.max_concurrent_reqs || 8), 0) / recruiterGoals.length)
                        : 0}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-primary-50 rounded-lg">
                  <div className="text-xs font-medium text-primary-600 mb-0.5">Avg Effective Capacity / Recruiter / Month</div>
                  <div className="text-2xl font-bold text-primary-900 dark:text-primary-100">
                    {loc.number(Math.round(capacityPlanningCalcs.effectiveCapacityPerRecruiter * 100) / 100)}
                  </div>
                  <div className="text-xs text-primary-500 mt-1.5">
                    Based on individual capacity x utilization% x (100% - overhead%)
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs font-medium text-gray-600 mb-0.5">Team Monthly Capacity ({capacityPlanningCalcs.currentTeamSize} recruiters)</div>
                  <div className="text-xl font-bold text-gray-900">
                    {loc.number(Math.round(capacityPlanningCalcs.monthlyTeamCapacity * 10) / 10)} hires/month
                  </div>
                </div>
              </div>
            </div>

            {/* Demand Forecasting Summary (read-only) */}
            <div className="card">
              <h3 className="card-header">Demand Forecast Summary</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Open Requisitions</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">{loc.number(capacityPlanningCalcs.openReqs)}</div>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">New Reqs / Month</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">{loc.number(cpNewReqsPerMonth)}</div>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Attrition Backfill Rate</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">{cpAttritionRate}%</div>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Planning Horizon</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">{cpPlanningHorizon} months</div>
                  </div>
                </div>
                <div className="p-3 bg-primary-50 rounded-lg">
                  <div className="text-xs font-medium text-primary-600 mb-0.5">Total Hires Needed Over {cpPlanningHorizon} Months</div>
                  <div className="text-2xl font-bold text-primary-900 dark:text-primary-100">{loc.number(capacityPlanningCalcs.totalHiresNeeded)}</div>
                  <div className="text-xs text-primary-500 mt-1.5 space-y-0.5">
                    <div>{loc.number(capacityPlanningCalcs.openReqs)} open reqs + {loc.number(capacityPlanningCalcs.totalFromNewReqs)} new reqs + {loc.number(capacityPlanningCalcs.totalFromAttrition)} attrition backfills</div>
                  </div>
                </div>
                <p className="text-xs text-gray-400">Adjust forecast parameters in the Capacity Planning tab.</p>
              </div>
            </div>
          </div>

          {/* Capacity Gap Analysis (Overview) */}
          <div className="card">
            <h3 className="card-header">Capacity Gap Analysis</h3>
            <div className="space-y-4">
              {/* Calculated summary values */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs font-medium text-gray-500 mb-0.5">Total Demand (weighted)</div>
                  <div className="text-xl font-bold text-gray-900">
                    {loc.number(Math.round(capacityPlanningCalcs.complexityAdjustedDemand))}
                  </div>
                  <div className="text-xs text-gray-400">over {cpPlanningHorizon} months</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs font-medium text-gray-500 mb-0.5">Team Capacity</div>
                  <div className="text-xl font-bold text-gray-900">
                    {loc.number(Math.round(capacityPlanningCalcs.periodTeamCapacity * 10) / 10)}
                  </div>
                  <div className="text-xs text-gray-400">{capacityPlanningCalcs.currentTeamSize} recruiters x {cpPlanningHorizon}mo</div>
                </div>
              </div>

              {/* Recommendation banner */}
              <div
                className={clsx(
                  'p-4 rounded-lg border',
                  capacityPlanningCalcs.status === 'red' && 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50',
                  capacityPlanningCalcs.status === 'yellow' && 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800/50',
                  capacityPlanningCalcs.status === 'green' && 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800/50',
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={clsx(
                      'mt-0.5 w-3 h-3 rounded-full flex-shrink-0',
                      capacityPlanningCalcs.status === 'red' && 'bg-red-500',
                      capacityPlanningCalcs.status === 'yellow' && 'bg-yellow-500',
                      capacityPlanningCalcs.status === 'green' && 'bg-green-500',
                    )}
                  />
                  <div>
                    <p
                      className={clsx(
                        'text-sm font-semibold',
                        capacityPlanningCalcs.status === 'red' && 'text-red-800 dark:text-red-200',
                        capacityPlanningCalcs.status === 'yellow' && 'text-yellow-800 dark:text-yellow-200',
                        capacityPlanningCalcs.status === 'green' && 'text-green-800 dark:text-green-200',
                      )}
                    >
                      {capacityPlanningCalcs.status === 'red' && `Over Capacity -- Need ${capacityPlanningCalcs.additionalRecruitersNeeded} additional recruiter${capacityPlanningCalcs.additionalRecruitersNeeded !== 1 ? 's' : ''}`}
                      {capacityPlanningCalcs.status === 'yellow' && `Nearing Capacity -- Team is at ${Math.round(capacityPlanningCalcs.utilizationPct)}% utilization`}
                      {capacityPlanningCalcs.status === 'green' && `Under Capacity -- Team has ${Math.abs(capacityPlanningCalcs.slackPct)}% slack capacity`}
                    </p>
                    <p
                      className={clsx(
                        'text-xs mt-1',
                        capacityPlanningCalcs.status === 'red' && 'text-red-600 dark:text-red-400',
                        capacityPlanningCalcs.status === 'yellow' && 'text-yellow-600 dark:text-yellow-400',
                        capacityPlanningCalcs.status === 'green' && 'text-green-600 dark:text-green-400',
                      )}
                    >
                      {capacityPlanningCalcs.status === 'red'
                        ? `Monthly demand of ${loc.number(Math.round(capacityPlanningCalcs.requiredMonthlyCapacity * 10) / 10)} exceeds team capacity of ${loc.number(Math.round(capacityPlanningCalcs.monthlyTeamCapacity * 10) / 10)} hires/month`
                        : capacityPlanningCalcs.status === 'yellow'
                        ? `Consider ramping up recruiting pipeline or hiring additional capacity soon`
                        : `Monthly demand of ${loc.number(Math.round(capacityPlanningCalcs.requiredMonthlyCapacity * 10) / 10)} is well within team capacity of ${loc.number(Math.round(capacityPlanningCalcs.monthlyTeamCapacity * 10) / 10)} hires/month`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Demand vs Capacity bar chart */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-3">Demand vs Capacity (Monthly)</div>
                <BarChart
                  data={gapChartData}
                  xKey="name"
                  bars={[
                    { key: 'demand', name: 'Required Demand', color: capacityPlanningCalcs.status === 'red' ? '#dc2626' : capacityPlanningCalcs.status === 'yellow' ? '#eab308' : CHART_COLORS[2] },
                    { key: 'capacity', name: 'Team Capacity', color: CHART_COLORS[0] },
                  ]}
                  showLegend
                  height={200}
                />
              </div>

              {/* Utilization meter */}
              <div className="pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Team Utilization</span>
                  <span
                    className={clsx(
                      'text-sm font-bold',
                      capacityPlanningCalcs.status === 'red' && 'text-red-600',
                      capacityPlanningCalcs.status === 'yellow' && 'text-yellow-600',
                      capacityPlanningCalcs.status === 'green' && 'text-green-600',
                    )}
                  >
                    {Math.round(capacityPlanningCalcs.utilizationPct)}%
                  </span>
                </div>
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden relative">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all',
                      capacityPlanningCalcs.status === 'red' && 'bg-red-500',
                      capacityPlanningCalcs.status === 'yellow' && 'bg-yellow-500',
                      capacityPlanningCalcs.status === 'green' && 'bg-green-500',
                    )}
                    style={{ width: `${Math.min(100, capacityPlanningCalcs.utilizationPct)}%` }}
                  />
                  {/* 80% marker */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-gray-400"
                    style={{ left: '80%' }}
                    title="80% threshold"
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0%</span>
                  <span className="text-gray-500">80%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </div>
          </>
          )}

          {/* ===== CAPACITY PLANNING SUB-TAB ===== */}
          {capacitySubTab === 'planning' && (
          <>
          {/* Demand Forecasting + Role Complexity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Demand Forecasting */}
            <div className="card">
              <h3 className="card-header">Demand Forecasting</h3>
              <div className="space-y-4">
                <div>
                  <label className="label">Total Open Requisitions</label>
                  <input
                    type="number"
                    className="input bg-gray-50"
                    value={capacityPlanningCalcs.openReqs}
                    readOnly
                  />
                  <p className="text-xs text-gray-400 mt-1">Auto-populated from requisitions API</p>
                </div>
                <div>
                  <label className="label">Expected New Reqs / Month</label>
                  <input
                    type="number"
                    className="input"
                    value={cpNewReqsPerMonth}
                    onChange={(e) => setCpNewReqsPerMonth(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    min={0}
                  />
                </div>
                <div>
                  <label className="label">Attrition Backfill Rate (%)</label>
                  <input
                    type="number"
                    className="input"
                    value={cpAttritionRate}
                    onChange={(e) => setCpAttritionRate(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                    min={0}
                    max={100}
                  />
                </div>
                <div>
                  <label className="label">Planning Horizon</label>
                  <select
                    className="input"
                    value={cpPlanningHorizon}
                    onChange={(e) => setCpPlanningHorizon(parseInt(e.target.value, 10) as 3 | 6 | 12)}
                  >
                    <option value={3}>3 months</option>
                    <option value={6}>6 months</option>
                    <option value={12}>12 months</option>
                  </select>
                </div>
                <div className="p-3 bg-primary-50 rounded-lg">
                  <div className="text-xs font-medium text-primary-600 mb-0.5">Total Hires Needed Over {cpPlanningHorizon} Months</div>
                  <div className="text-2xl font-bold text-primary-900 dark:text-primary-100">{loc.number(capacityPlanningCalcs.totalHiresNeeded)}</div>
                  <div className="text-xs text-primary-500 mt-1.5 space-y-0.5">
                    <div>{loc.number(capacityPlanningCalcs.openReqs)} open reqs + {loc.number(capacityPlanningCalcs.totalFromNewReqs)} new reqs + {loc.number(capacityPlanningCalcs.totalFromAttrition)} attrition backfills</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Funnel Velocity Metrics */}
            <div className="card">
              <h3 className="card-header">Time Allocation (Hours per Hire)</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Sourcing Hours</label>
                    <span className="text-sm font-semibold text-gray-700">{cpSourcingHours}h</span>
                  </div>
                  <input
                    type="number"
                    className="input"
                    value={cpSourcingHours}
                    onChange={(e) => setCpSourcingHours(Math.max(0, parseFloat(e.target.value) || 0))}
                    min={0}
                    step={0.5}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Screening Hours / Candidate</label>
                    <span className="text-sm font-semibold text-gray-700">{cpScreeningHours}h</span>
                  </div>
                  <input
                    type="number"
                    className="input"
                    value={cpScreeningHours}
                    onChange={(e) => setCpScreeningHours(Math.max(0, parseFloat(e.target.value) || 0))}
                    min={0}
                    step={0.5}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Interview Coordination Hours</label>
                    <span className="text-sm font-semibold text-gray-700">{cpInterviewCoordHours}h</span>
                  </div>
                  <input
                    type="number"
                    className="input"
                    value={cpInterviewCoordHours}
                    onChange={(e) => setCpInterviewCoordHours(Math.max(0, parseFloat(e.target.value) || 0))}
                    min={0}
                    step={0.5}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Offer/Close Hours</label>
                    <span className="text-sm font-semibold text-gray-700">{cpOfferCloseHours}h</span>
                  </div>
                  <input
                    type="number"
                    className="input"
                    value={cpOfferCloseHours}
                    onChange={(e) => setCpOfferCloseHours(Math.max(0, parseFloat(e.target.value) || 0))}
                    min={0}
                    step={0.5}
                  />
                </div>

                {/* Visual breakdown as progress bars */}
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Total Hours per Hire</span>
                    <span className="text-lg font-bold text-gray-900">{capacityPlanningCalcs.totalHoursPerHire}h</span>
                  </div>
                  <div className="space-y-2">
                    {funnelVelocityData.map((item) => {
                      const pct = capacityPlanningCalcs.totalHoursPerHire > 0
                        ? (item.hours / capacityPlanningCalcs.totalHoursPerHire) * 100
                        : 0
                      return (
                        <div key={item.stage}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs text-gray-500">{item.stage}</span>
                            <span className="text-xs font-medium text-gray-600">{item.hours}h ({Math.round(pct)}%)</span>
                          </div>
                          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: item.color }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Stacked bar summary */}
                  <div className="mt-3">
                    <div className="h-6 bg-gray-100 rounded-full overflow-hidden flex">
                      {funnelVelocityData.map((item) => {
                        const pct = capacityPlanningCalcs.totalHoursPerHire > 0
                          ? (item.hours / capacityPlanningCalcs.totalHoursPerHire) * 100
                          : 0
                        return (
                          <div
                            key={item.stage}
                            className="h-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: item.color }}
                            title={`${item.stage}: ${item.hours}h`}
                          />
                        )
                      })}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {funnelVelocityData.map((item) => (
                        <span key={item.stage} className="flex items-center gap-1 text-xs text-gray-500">
                          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                          {item.stage}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Role Complexity Mapping */}
          <div className="card overflow-x-auto">
            <h3 className="card-header">Role Complexity Mapping</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-3 font-medium text-gray-700">Role Type</th>
                  <th className="text-center py-3 px-3 font-medium text-gray-700">Effort Multiplier</th>
                  <th className="text-center py-3 px-3 font-medium text-gray-700">Avg Time-to-Fill (days)</th>
                  <th className="text-center py-3 px-3 font-medium text-gray-700">Open Reqs</th>
                  <th className="text-center py-3 px-3 font-medium text-gray-700">Weighted Demand</th>
                </tr>
              </thead>
              <tbody>
                {roleComplexity.map((rc) => {
                  const openCount = cpRoleReqs[rc.role] || 0
                  return (
                    <tr key={rc.role} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-2 px-3 font-medium text-gray-900">{rc.role}</td>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          className="input w-16 text-center text-xs"
                          value={rc.multiplier}
                          step={0.1}
                          min={0.5}
                          max={10}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value) || 1
                            setRoleComplexity(prev => prev.map(x => x.role === rc.role ? { ...x, multiplier: Math.max(0.1, Math.round(v * 10) / 10) } : x))
                          }}
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          className="input w-16 text-center text-xs"
                          value={rc.avgTimeToFill}
                          min={1}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10) || 1
                            setRoleComplexity(prev => prev.map(x => x.role === rc.role ? { ...x, avgTimeToFill: Math.max(1, v) } : x))
                          }}
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          className="input w-20 text-center text-sm"
                          value={openCount}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                            setCpRoleReqs(prev => ({ ...prev, [rc.role]: val }))
                          }}
                          min={0}
                        />
                      </td>
                      <td className="py-2 px-3 text-center font-medium text-gray-700">
                        {loc.number(Math.round(openCount * rc.multiplier * 10) / 10)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                  <td className="py-3 px-3 text-gray-900">Weighted Average</td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex items-center justify-center font-semibold min-w-[3rem] px-2 py-1 rounded-md text-xs bg-primary-100 text-primary-700">
                      {loc.number(Math.round(capacityPlanningCalcs.weightedAvgComplexity * 100) / 100)}x
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center text-gray-500">--</td>
                  <td className="py-3 px-3 text-center text-gray-900">
                    {loc.number(Object.values(cpRoleReqs).reduce((s, v) => s + v, 0))}
                  </td>
                  <td className="py-3 px-3 text-center text-gray-900">
                    {loc.number(Math.round(roleComplexity.reduce((s, rc) => s + (cpRoleReqs[rc.role] || 0) * rc.multiplier, 0) * 10) / 10)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          </>
          )}

          {/* ===== PER-RECRUITER SUB-TAB ===== */}
          {capacitySubTab === 'per-recruiter' && (
          <>
          {/* Team Capacity Breakdown - Per Recruiter */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="card-header mb-0">Per-Recruiter Capacity</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddForm((v) => !v)}
                  className="btn-primary text-xs flex items-center gap-1"
                >
                  <UserPlusIcon className="w-3.5 h-3.5" />
                  Add Recruiter
                </button>
                <button
                  onClick={() => setShowCsvImport(!showCsvImport)}
                  className="btn-secondary text-xs flex items-center gap-1"
                >
                  <ArrowUpTrayIcon className="w-3.5 h-3.5" />
                  Import CSV
                </button>
              </div>
            </div>

            {/* CSV Import Panel */}
            {showCsvImport && (
              <div className="card border-2 border-blue-200 mb-4">
                <h3 className="card-header">Import Recruiter Capacity from CSV</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Expected columns: <code className="bg-gray-100 px-1 rounded">name, seniority, monthly_capacity, utilization_pct, overhead_pct, max_concurrent_reqs, specializations</code>
                </p>
                <div className="flex items-center gap-4 mb-4">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvFile}
                    className="text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                  />
                  <select
                    className="input w-40"
                    value={csvImportMode}
                    onChange={(e) => setCsvImportMode(e.target.value as 'upsert' | 'replace')}
                  >
                    <option value="upsert">Update existing</option>
                    <option value="replace">Replace all</option>
                  </select>
                </div>
                {csvPreview && csvPreview.length > 0 && (
                  <>
                    <div className="overflow-x-auto max-h-48 border border-gray-200 rounded mb-3">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            {Object.keys(csvPreview[0]).slice(0, 8).map(col => (
                              <th key={col} className="px-2 py-1 text-left font-medium text-gray-500">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {csvPreview.slice(0, 5).map((row, i) => (
                            <tr key={i}>
                              {Object.keys(csvPreview[0]).slice(0, 8).map(col => (
                                <td key={col} className="px-2 py-1 text-gray-700">{String(row[col] ?? '')}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">Showing first 5 of {csvPreview.length} rows</p>
                    <div className="flex gap-2">
                      <button
                        className="btn-primary"
                        onClick={handleCsvImport}
                        disabled={csvImportMutation.isPending}
                      >
                        {csvImportMutation.isPending ? 'Importing...' : `Import ${csvPreview.length} Recruiters`}
                      </button>
                      <button
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                        onClick={() => { setShowCsvImport(false); setCsvPreview(null) }}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Inline Add Recruiter Form */}
            {showAddForm && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-3">
                  <div>
                    <label className="label text-xs">Name *</label>
                    <input
                      type="text"
                      className="input text-sm"
                      placeholder="Name"
                      value={newRecruiter.name}
                      onChange={(e) => setNewRecruiter((p) => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Seniority</label>
                    <select
                      className="input text-sm"
                      value={newRecruiter.seniority}
                      onChange={(e) => setNewRecruiter((p) => ({ ...p, seniority: e.target.value }))}
                    >
                      <option value="Junior">Junior</option>
                      <option value="Mid">Mid</option>
                      <option value="Senior">Senior</option>
                      <option value="Lead">Lead</option>
                    </select>
                  </div>
                  <div>
                    <label className="label text-xs">Location</label>
                    <input
                      type="text"
                      className="input text-sm"
                      placeholder="Location"
                      value={newRecruiter.location}
                      onChange={(e) => setNewRecruiter((p) => ({ ...p, location: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Manager</label>
                    <input
                      type="text"
                      className="input text-sm"
                      placeholder="Manager"
                      value={newRecruiter.manager}
                      onChange={(e) => setNewRecruiter((p) => ({ ...p, manager: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Specializations</label>
                    <input
                      type="text"
                      className="input text-sm"
                      placeholder="e.g. Engineering, Sales"
                      value={newRecruiter.specializations}
                      onChange={(e) => setNewRecruiter((p) => ({ ...p, specializations: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="label text-xs">Hires/mo</label>
                    <input
                      type="number"
                      className="input text-sm no-spinner"
                      min={1}
                      max={20}
                      value={newRecruiter.monthly_capacity}
                      onChange={(e) => setNewRecruiter((p) => ({ ...p, monthly_capacity: parseInt(e.target.value) || 4 }))}
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Utilization %</label>
                    <input
                      type="number"
                      className="input text-sm no-spinner"
                      min={10}
                      max={100}
                      value={newRecruiter.utilization_pct}
                      onChange={(e) => setNewRecruiter((p) => ({ ...p, utilization_pct: parseInt(e.target.value) || 85 }))}
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Overhead %</label>
                    <input
                      type="number"
                      className="input text-sm no-spinner"
                      min={0}
                      max={50}
                      value={newRecruiter.overhead_pct}
                      onChange={(e) => setNewRecruiter((p) => ({ ...p, overhead_pct: parseInt(e.target.value) || 15 }))}
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Max Concurrent Reqs</label>
                    <input
                      type="number"
                      className="input text-sm no-spinner"
                      min={1}
                      max={30}
                      value={newRecruiter.max_concurrent_reqs}
                      onChange={(e) => setNewRecruiter((p) => ({ ...p, max_concurrent_reqs: parseInt(e.target.value) || 8 }))}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleAddRecruiter}
                      disabled={!newRecruiter.name.trim()}
                      className="btn-primary text-sm w-full disabled:opacity-50"
                    >
                      Add Recruiter
                    </button>
                  </div>
                </div>
              </div>
            )}

            {recruiterGoals.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                No recruiters added yet. Add team members to see per-recruiter capacity breakdown.
              </div>
            ) : (
              <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-2 font-medium text-gray-700">Recruiter</th>
                      <th className="text-center py-3 px-2 font-medium text-gray-700">Seniority</th>
                      <th className="text-center py-3 px-2 font-medium text-gray-700">Hires/mo</th>
                      <th className="text-center py-3 px-2 font-medium text-gray-700">Util %</th>
                      <th className="text-center py-3 px-2 font-medium text-gray-700">Overhead %</th>
                      <th className="text-center py-3 px-2 font-medium text-gray-700">Max Reqs</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-700">Specializations</th>
                      <th className="text-center py-3 px-2 font-medium text-gray-700">Eff. Cap</th>
                      <th className="text-center py-3 px-2 font-medium text-gray-700">Load</th>
                      <th className="text-center py-3 px-2 font-medium text-gray-700">Status</th>
                      <th className="text-center py-3 px-2 font-medium text-gray-700">Annual Goal</th>
                      <th className="text-center py-3 px-2 font-medium text-gray-700">Annual Actual</th>
                      <th className="text-center py-3 px-2 font-medium text-gray-700">Attainment %</th>
                      <th className="text-center py-3 px-2 font-medium text-gray-700"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showAllRecruiters
                      ? capacityPlanningCalcs.perRecruiterLoad
                      : capacityPlanningCalcs.perRecruiterLoad.slice(
                          (recruiterPage - 1) * RECRUITERS_PER_PAGE,
                          recruiterPage * RECRUITERS_PER_PAGE
                        )
                    ).map((r) => (
                      <tr
                        key={r.id}
                        className={clsx(
                          "border-b border-gray-100 transition-colors",
                          r.is_active === false ? "bg-gray-50/50 grayscale opacity-60" : "hover:bg-gray-50"
                        )}
                      >
                        <td className="py-2 px-2 font-medium text-gray-900">
                          {r.name}
                          {r.is_active === false && <span className="ml-2 text-[10px] uppercase tracking-wider text-gray-400 font-bold">(Archived)</span>}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className={clsx(
                            'badge text-xs',
                            r.seniority === 'Lead' && 'bg-purple-100 text-purple-700',
                            r.seniority === 'Senior' && 'bg-indigo-100 text-indigo-700',
                            r.seniority === 'Mid' && 'bg-blue-100 text-blue-700',
                            r.seniority === 'Junior' && 'bg-gray-100 text-gray-700',
                          )}>{r.seniority}</span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            className="input text-sm text-center w-16 mx-auto no-spinner"
                            min={1}
                            max={20}
                            defaultValue={r.monthly_capacity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 4
                              debouncedUpdate(r.id, 'monthly_capacity', val)
                            }}
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            className="input text-sm text-center w-16 mx-auto no-spinner"
                            min={10}
                            max={100}
                            defaultValue={r.utilization_pct}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 85
                              debouncedUpdate(r.id, 'utilization_pct', val)
                            }}
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            className="input text-sm text-center w-16 mx-auto no-spinner"
                            min={0}
                            max={50}
                            defaultValue={r.overhead_pct}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 15
                              debouncedUpdate(r.id, 'overhead_pct', val)
                            }}
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            className="input text-sm text-center w-16 mx-auto no-spinner"
                            min={1}
                            max={30}
                            defaultValue={r.max_concurrent_reqs}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 8
                              debouncedUpdate(r.id, 'max_concurrent_reqs', val)
                            }}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            className="input text-sm w-32"
                            defaultValue={r.specializations || ''}
                            placeholder="e.g. Eng, Sales"
                            onChange={(e) => {
                              debouncedUpdate(r.id, 'specializations', e.target.value)
                            }}
                          />
                        </td>
                        <td className="py-2 px-2 text-center font-semibold text-gray-700">
                          {Math.round(r.effective * 10) / 10}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center gap-1.5 justify-center">
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={clsx(
                                  'h-full rounded-full transition-all',
                                  r.loadStatus === 'green' && 'bg-green-500',
                                  r.loadStatus === 'yellow' && 'bg-yellow-500',
                                  r.loadStatus === 'red' && 'bg-red-500',
                                )}
                                style={{ width: `${Math.min(100, r.loadPct)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{r.loadPct}%</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className={clsx(
                            'badge text-xs',
                            r.loadStatus === 'green' && 'bg-green-100 text-green-700',
                            r.loadStatus === 'yellow' && 'bg-yellow-100 text-yellow-700',
                            r.loadStatus === 'red' && 'bg-red-100 text-red-700',
                          )}>
                            {r.loadStatus === 'green' ? 'Available' : r.loadStatus === 'yellow' ? 'Near Cap' : 'Overloaded'}
                          </span>
                        </td>
                        {(() => {
                          const match = recruiterTotals.find(rt => rt.id === r.id)
                          return (
                            <>
                              <td className="py-2 px-2 text-center text-gray-700 text-xs">{match ? match.annualGoal : '--'}</td>
                              <td className="py-2 px-2 text-center text-gray-700 text-xs">{match ? match.annualActual : '--'}</td>
                              <td className="py-2 px-2 text-center">
                                {match && match.annualGoal > 0 ? (
                                  <span className={clsx(
                                    'badge text-xs',
                                    match.attainment >= 100 && 'bg-green-100 text-green-700',
                                    match.attainment >= 75 && match.attainment < 100 && 'bg-yellow-100 text-yellow-700',
                                    match.attainment < 75 && 'bg-red-100 text-red-700',
                                  )}>
                                    {match.attainment}%
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">--</span>
                                )}
                              </td>
                            </>
                          )
                        })()}
                        <td className="py-2 px-2 text-center">
                          <button
                            className={clsx(
                              "p-1 transition-colors",
                              r.is_active === false ? "text-indigo-400 hover:text-indigo-600" : "text-gray-400 hover:text-red-600"
                            )}
                            onClick={() => {
                              if (r.is_active === false) {
                                updateGoalMutation.mutate({ id: r.id, data: { is_active: true } })
                              } else {
                                handleDeleteRecruiter(r.id, r.name)
                              }
                            }}
                            title={r.is_active === false ? "Restore recruiter" : "Archive recruiter"}
                          >
                            {r.is_active === false ? (
                              <ArrowPathIcon className="w-4 h-4" />
                            ) : (
                              <TrashIcon className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                      <td className="py-3 px-2 text-gray-700">Team ({recruiterGoals.length})</td>
                      <td></td>
                      <td className="py-3 px-2 text-center text-gray-700">
                        {recruiterGoals.reduce((s, r) => s + (r.monthly_capacity || 4), 0)}
                      </td>
                      <td className="py-3 px-2 text-center text-gray-500 text-xs">
                        {recruiterGoals.length > 0
                          ? Math.round(recruiterGoals.reduce((s, r) => s + (r.utilization_pct || 85), 0) / recruiterGoals.length)
                          : 0}% avg
                      </td>
                      <td className="py-3 px-2 text-center text-gray-500 text-xs">
                        {recruiterGoals.length > 0
                          ? Math.round(recruiterGoals.reduce((s, r) => s + (r.overhead_pct || 15), 0) / recruiterGoals.length)
                          : 0}% avg
                      </td>
                      <td className="py-3 px-2 text-center text-gray-500 text-xs">
                        {recruiterGoals.length > 0
                          ? Math.round(recruiterGoals.reduce((s, r) => s + (r.max_concurrent_reqs || 8), 0) / recruiterGoals.length)
                          : 0} avg
                      </td>
                      <td></td>
                      <td className="py-3 px-2 text-center text-gray-700">
                        {Math.round(capacityPlanningCalcs.monthlyTeamCapacity * 10) / 10}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <div className="flex items-center gap-1.5 justify-center">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={clsx(
                                'h-full rounded-full transition-all',
                                capacityPlanningCalcs.status === 'green' && 'bg-green-500',
                                capacityPlanningCalcs.status === 'yellow' && 'bg-yellow-500',
                                capacityPlanningCalcs.status === 'red' && 'bg-red-500',
                              )}
                              style={{ width: `${Math.min(100, Math.round(capacityPlanningCalcs.utilizationPct))}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{Math.round(capacityPlanningCalcs.utilizationPct)}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={clsx(
                          'badge text-xs',
                          capacityPlanningCalcs.status === 'green' && 'bg-green-100 text-green-700',
                          capacityPlanningCalcs.status === 'yellow' && 'bg-yellow-100 text-yellow-700',
                          capacityPlanningCalcs.status === 'red' && 'bg-red-100 text-red-700',
                        )}>
                          {capacityPlanningCalcs.status === 'green' ? 'Healthy' : capacityPlanningCalcs.status === 'yellow' ? 'Tight' : 'Over Cap'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center text-gray-700 text-xs">
                        {recruiterTotals.reduce((s, r) => s + r.annualGoal, 0)}
                      </td>
                      <td className="py-3 px-2 text-center text-gray-700 text-xs">
                        {recruiterTotals.reduce((s, r) => s + r.annualActual, 0)}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {(() => {
                          const totalGoal = recruiterTotals.reduce((s, r) => s + r.annualGoal, 0)
                          const totalActual = recruiterTotals.reduce((s, r) => s + r.annualActual, 0)
                          const att = totalGoal > 0 ? Math.round((totalActual / totalGoal) * 100) : 0
                          return totalGoal > 0 ? (
                            <span className={clsx(
                              'badge text-xs',
                              att >= 100 && 'bg-green-100 text-green-700',
                              att >= 75 && att < 100 && 'bg-yellow-100 text-yellow-700',
                              att < 75 && 'bg-red-100 text-red-700',
                            )}>
                              {att}%
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">--</span>
                          )
                        })()}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Pagination Controls */}
              {capacityPlanningCalcs.perRecruiterLoad.length > RECRUITERS_PER_PAGE && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                  <div className="text-xs text-gray-500">
                    {showAllRecruiters
                      ? `Showing all ${capacityPlanningCalcs.perRecruiterLoad.length} recruiters`
                      : `Showing ${Math.min((recruiterPage - 1) * RECRUITERS_PER_PAGE + 1, capacityPlanningCalcs.perRecruiterLoad.length)}--${Math.min(recruiterPage * RECRUITERS_PER_PAGE, capacityPlanningCalcs.perRecruiterLoad.length)} of ${capacityPlanningCalcs.perRecruiterLoad.length} recruiters`}
                  </div>
                  <div className="flex items-center gap-2">
                    {!showAllRecruiters && (
                      <>
                        <button
                          onClick={() => setRecruiterPage(p => Math.max(1, p - 1))}
                          disabled={recruiterPage <= 1}
                          className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Previous
                        </button>
                        {Array.from({ length: Math.ceil(capacityPlanningCalcs.perRecruiterLoad.length / RECRUITERS_PER_PAGE) }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => setRecruiterPage(page)}
                            className={clsx(
                              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                              recruiterPage === page
                                ? 'bg-primary-600 text-white'
                                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                            )}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          onClick={() => setRecruiterPage(p => Math.min(Math.ceil(capacityPlanningCalcs.perRecruiterLoad.length / RECRUITERS_PER_PAGE), p + 1))}
                          disabled={recruiterPage >= Math.ceil(capacityPlanningCalcs.perRecruiterLoad.length / RECRUITERS_PER_PAGE)}
                          className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Next
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setShowAllRecruiters(prev => !prev)
                        setRecruiterPage(1)
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {showAllRecruiters ? 'Paginate' : 'Show All'}
                    </button>
                  </div>
                </div>
              )}

              </>
            )}
          </div>
          </>
          )}
        </>
      )}

      {activeTab === 'goaling' && (
        <>
          {/* Controls Header: Sub-tabs + Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-4">
              {/* Sub-tabs aligned to left */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">

                {([
                  { key: 'summary', label: 'Summary' },
                  { key: 'goals', label: 'Goals Table' },
                  { key: 'capacity', label: 'Capacity' },
                  { key: 'trends', label: 'Trends' },
                  { key: 'history', label: 'History' },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setGoalingSubTab(tab.key)}
                    className={clsx(
                      'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                      goalingSubTab === tab.key
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Year selector — shown on all sub-tabs except History (which has its own multi-year toggle) */}
            {goalingSubTab !== 'history' && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 font-medium">Year:</span>
                <div className="flex gap-1">
                  {[2024, 2025, 2026].map(year => (
                    <button
                      key={year}
                      onClick={() => setSelectedYear(year)}
                      className={clsx(
                        'px-3 py-1 text-xs font-medium rounded-lg border transition-colors',
                        selectedYear === year
                          ? 'bg-primary-50 border-primary-500 text-primary-700'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      )}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {goalingSubTab === 'goals' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="btn-primary text-xs flex items-center gap-1.5 py-1.5"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  Add Recruiter
                </button>
                <button
                  onClick={() => setShowCsvImport(!showCsvImport)}
                  className="btn-secondary text-xs flex items-center gap-1.5 py-1.5"
                >
                  <ArrowUpTrayIcon className="w-3.5 h-3.5" />
                  Import CSV
                </button>
                <button
                  onClick={() => syncHiresMutation.mutate()}
                  disabled={syncHiresMutation.isPending}
                  className="btn-secondary inline-flex items-center gap-1.5 text-xs px-3 py-1.5"
                >
                  <ArrowPathIcon className={clsx('w-4 h-4', syncHiresMutation.isPending && 'animate-spin')} />
                  {syncHiresMutation.isPending ? 'Syncing...' : 'Sync Hires'}
                </button>
                <Menu as="div" className="relative">
                  <MenuButton className="btn-secondary inline-flex items-center gap-1.5 text-xs px-3 py-1.5">
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    Export
                  </MenuButton>
                  <MenuItems className="absolute right-0 z-10 mt-1 w-44 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none">
                    <div className="py-1">
                      <MenuItem>
                        {({ focus }) => (
                          <button
                            onClick={exportGoalingCSV}
                            className={clsx('flex w-full items-center gap-2 px-4 py-2 text-sm', focus ? 'bg-gray-100 text-gray-900' : 'text-gray-700')}
                          >
                            <TableCellsIcon className="w-4 h-4" />
                            Export as CSV
                          </button>
                        )}
                      </MenuItem>
                      <MenuItem>
                        {({ focus }) => (
                          <button
                            onClick={exportGoalingPDF}
                            className={clsx('flex w-full items-center gap-2 px-4 py-2 text-sm', focus ? 'bg-gray-100 text-gray-900' : 'text-gray-700')}
                          >
                            <DocumentTextIcon className="w-4 h-4" />
                            Export as PDF
                          </button>
                        )}
                      </MenuItem>
                    </div>
                  </MenuItems>
                </Menu>
              </div>
            )}
          </div>

          {/* ===== SUMMARY SUB-TAB ===== */}
          {goalingSubTab === 'summary' && recruiterGoals.length > 0 && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Annual Goal"
                  value={loc.number(teamSummary.totalGoal)}
                  icon={<BriefcaseIcon className="w-5 h-5" />}
                  subtitle={`${recruiterTotals.length} recruiters`}
                />
                <MetricCard
                  title="Total Annual Actual"
                  value={loc.number(teamSummary.totalActual)}
                  icon={<CheckCircleIcon className="w-5 h-5" />}
                  subtitle={`${loc.number(teamSummary.avgPerRecruiter)} avg per recruiter`}
                />
                <MetricCard
                  title="Team Attainment"
                  value={`${teamSummary.teamAttainment}%`}
                  icon={<ArrowTrendingUpIcon className="w-5 h-5" />}
                  trend={teamSummary.teamAttainment >= 90 ? 'up' : 'down'}
                  subtitle={teamSummary.teamAttainment > 100 ? 'Exceeded' : teamSummary.teamAttainment === 100 ? 'Met' : teamSummary.teamAttainment >= 75 ? 'Close' : 'Below Target'}
                />
                <MetricCard
                  title="Underperformers"
                  value={String(teamSummary.underperformers)}
                  icon={<XCircleIcon className="w-5 h-5" />}
                  subtitle={`< 75% attainment`}
                />
              </div>

              {/* Quarterly Attainment Bar Chart */}
              <div className="card">
                <h3 className="card-header">Team Attainment by Quarter</h3>
                <BarChart
                  data={[
                    { quarter: 'Q1', Goal: quarterSums.q1Goal, Actual: quarterSums.q1Actual },
                    { quarter: 'Q2', Goal: quarterSums.q2Goal, Actual: quarterSums.q2Actual },
                    { quarter: 'Q3', Goal: quarterSums.q3Goal, Actual: quarterSums.q3Actual },
                    { quarter: 'Q4', Goal: quarterSums.q4Goal, Actual: quarterSums.q4Actual },
                  ]}
                  xKey="quarter"
                  bars={[
                    { key: 'Goal', name: 'Goal', color: CHART_COLORS[2] },
                    { key: 'Actual', name: 'Actual', color: CHART_COLORS[0] },
                  ]}
                  height={240}
                />
              </div>

              {/* Per-Recruiter Attainment Table */}
              <div className="card">
                <h3 className="card-header">Attainment per Recruiter</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead>
                      <tr className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                        <th className="py-2 pr-4 text-left">Recruiter</th>
                        <th className="py-2 px-3 text-left">Manager</th>
                        <th className="py-2 px-3 text-right">Q1</th>
                        <th className="py-2 px-3 text-right">Q2</th>
                        <th className="py-2 px-3 text-right">Q3</th>
                        <th className="py-2 px-3 text-right">Q4</th>
                        <th className="py-2 px-3 text-right">Goal</th>
                        <th className="py-2 px-3 text-right">Actual</th>
                        <th className="py-2 pl-3 text-right">Attainment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {recruiterTotals
                        .sort((a, b) => b.attainment - a.attainment)
                        .map(r => (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="py-2.5 pr-4">
                              <div>
                                <span className="text-sm font-medium text-gray-900">{r.name}</span>
                                <span className="text-xs text-gray-400 ml-1.5">{r.seniority}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-xs text-gray-500">
                              {(r as any).manager || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-xs text-gray-600">
                              {(r as any).q1_actual ?? 0}/{(r as any).q1_goal ?? 0}
                            </td>
                            <td className="py-2.5 px-3 text-right text-xs text-gray-600">
                              {(r as any).q2_actual ?? 0}/{(r as any).q2_goal ?? 0}
                            </td>
                            <td className="py-2.5 px-3 text-right text-xs text-gray-600">
                              {(r as any).q3_actual ?? 0}/{(r as any).q3_goal ?? 0}
                            </td>
                            <td className="py-2.5 px-3 text-right text-xs text-gray-600">
                              {(r as any).q4_actual ?? 0}/{(r as any).q4_goal ?? 0}
                            </td>
                            <td className="py-2.5 px-3 text-right text-sm font-medium text-gray-700">
                              {loc.number(r.annualGoal)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-sm font-medium text-gray-700">
                              {loc.number(r.annualActual)}
                            </td>
                            <td className="py-2.5 pl-3 text-right">
                              {r.annualGoal > 0 ? (
                                <span className={clsx('inline-flex items-center justify-center font-semibold px-2 py-0.5 rounded text-xs', getAttainmentBadge(r.attainment))}>
                                  {r.attainment}%
                                </span>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      }
                      {/* Team Total Row */}
                      {recruiterTotals.length > 0 && (
                        <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                          <td className="py-2.5 pr-4 text-sm text-gray-900">Team Total</td>
                          <td className="py-2.5 px-3 text-xs text-gray-500"></td>
                          <td className="py-2.5 px-3 text-right text-xs text-gray-700">
                            {quarterSums.q1Actual}/{quarterSums.q1Goal}
                          </td>
                          <td className="py-2.5 px-3 text-right text-xs text-gray-700">
                            {quarterSums.q2Actual}/{quarterSums.q2Goal}
                          </td>
                          <td className="py-2.5 px-3 text-right text-xs text-gray-700">
                            {quarterSums.q3Actual}/{quarterSums.q3Goal}
                          </td>
                          <td className="py-2.5 px-3 text-right text-xs text-gray-700">
                            {quarterSums.q4Actual}/{quarterSums.q4Goal}
                          </td>
                          <td className="py-2.5 px-3 text-right text-sm text-gray-900">
                            {loc.number(teamSummary.totalGoal)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-sm text-gray-900">
                            {loc.number(teamSummary.totalActual)}
                          </td>
                          <td className="py-2.5 pl-3 text-right">
                            <span className={clsx('inline-flex items-center justify-center font-semibold px-2 py-0.5 rounded text-xs', getAttainmentBadge(teamSummary.teamAttainment))}>
                              {teamSummary.teamAttainment}%
                            </span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {recruiterTotals.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-8">No recruiter data available</p>
                  )}
                </div>
              </div>
            </>
          )}

          {goalingSubTab === 'summary' && recruiterGoals.length === 0 && (
            <div className="card py-12 text-center text-gray-400 text-sm">
              No recruiter goals for {selectedYear}. Switch to "Goals Table" to add recruiters.
            </div>
          )}

          {/* ===== GOALS TABLE SUB-TAB ===== */}
          {goalingSubTab === 'goals' && (
            <>
          {/* CSV Import Panel */}

          {showCsvImport && (
            <div className="card border-2 border-blue-200">
              <h3 className="card-header">Import Recruiter Goals from CSV</h3>
              <p className="text-xs text-gray-500 mb-3">
                Expected columns: <code className="bg-gray-100 px-1 rounded">name, seniority, location, manager, employment_type, q1_goal, q2_goal, q3_goal, q4_goal, q1_actual, q2_actual, q3_actual, q4_actual</code>
              </p>
              <div className="flex items-center gap-4 mb-4">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFile}
                  className="text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                <select
                  className="input w-40"
                  value={csvImportMode}
                  onChange={(e) => setCsvImportMode(e.target.value as 'upsert' | 'replace')}
                >
                  <option value="upsert">Update existing</option>
                  <option value="replace">Replace all</option>
                </select>
              </div>
              {csvPreview && csvPreview.length > 0 && (
                <>
                  <div className="overflow-x-auto max-h-48 border border-gray-200 rounded mb-3">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {Object.keys(csvPreview[0]).slice(0, 8).map(col => (
                            <th key={col} className="px-2 py-1 text-left font-medium text-gray-500">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {csvPreview.slice(0, 5).map((row, i) => (
                          <tr key={i}>
                            {Object.keys(csvPreview[0]).slice(0, 8).map(col => (
                              <td key={col} className="px-2 py-1 text-gray-700">{String(row[col] ?? '')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Showing first 5 of {csvPreview.length} rows</p>
                  <div className="flex gap-2">
                    <button
                      className="btn-primary"
                      onClick={handleCsvImport}
                      disabled={csvImportMutation.isPending}
                    >
                      {csvImportMutation.isPending ? 'Importing...' : `Import ${csvPreview.length} Goals for ${selectedYear}`}
                    </button>
                    <button
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                      onClick={() => { setShowCsvImport(false); setCsvPreview(null) }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Add Recruiter Form */}
          {showAddForm && (
            <div className="card border-2 border-primary-200">
              <h3 className="card-header">New Recruiter</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="label">Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Full name"
                    value={newRecruiter.name}
                    onChange={(e) => setNewRecruiter(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Seniority</label>
                  <select
                    className="input"
                    value={newRecruiter.seniority}
                    onChange={(e) => setNewRecruiter(prev => ({ ...prev, seniority: e.target.value }))}
                  >
                    <option value="Junior">Junior</option>
                    <option value="Mid">Mid</option>
                    <option value="Senior">Senior</option>
                    <option value="Lead">Lead</option>
                  </select>
                </div>
                <div>
                  <label className="label">Location</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="City or Remote"
                    value={newRecruiter.location}
                    onChange={(e) => setNewRecruiter(prev => ({ ...prev, location: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Manager</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Manager name"
                    value={newRecruiter.manager}
                    onChange={(e) => setNewRecruiter(prev => ({ ...prev, manager: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Employment Type</label>
                  <select
                    className="input"
                    value={newRecruiter.employment_type}
                    onChange={(e) => setNewRecruiter(prev => ({ ...prev, employment_type: e.target.value }))}
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  className="btn-primary"
                  onClick={handleAddRecruiter}
                  disabled={!newRecruiter.name.trim() || createGoalMutation.isPending}
                >
                  {createGoalMutation.isPending ? 'Adding...' : 'Add Recruiter'}
                </button>
                <button
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Recruiter Table */}
          <div className="card overflow-x-auto">
            <h3 className="card-header">Recruiter Goals - {selectedYear}</h3>
            {goalsLoading ? (
              <div className="py-12 text-center text-gray-400 text-sm">Loading recruiter goals...</div>
            ) : recruiterGoals.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">
                No recruiter goals for {selectedYear}. Click "Add Recruiter" to get started.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-medium text-gray-700">Recruiter Name</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700">
                      {selectedQuarter === 'all' ? 'Seniority' : `${selectedQuarter} Seniority`}
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700">Location</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700">Manager</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700">Type</th>
                    {(selectedQuarter === 'all' || selectedQuarter === 'Q1') && (
                      <th className="text-center py-3 px-1 font-medium text-gray-700" colSpan={2}>Q1</th>
                    )}
                    {(selectedQuarter === 'all' || selectedQuarter === 'Q2') && (
                      <th className="text-center py-3 px-1 font-medium text-gray-700" colSpan={2}>Q2</th>
                    )}
                    {(selectedQuarter === 'all' || selectedQuarter === 'Q3') && (
                      <th className="text-center py-3 px-1 font-medium text-gray-700" colSpan={2}>Q3</th>
                    )}
                    {(selectedQuarter === 'all' || selectedQuarter === 'Q4') && (
                      <th className="text-center py-3 px-1 font-medium text-gray-700" colSpan={2}>Q4</th>
                    )}
                    <th className="text-center py-3 px-1 font-medium text-gray-700" colSpan={2}>
                      {selectedQuarter === 'all' ? 'Annual' : 'Quarterly'}
                    </th>
                    <th className="text-center py-3 px-2 font-medium text-gray-700">Attain %</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-700">Status</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-700">Bonus</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-700">Actions</th>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                    <th colSpan={5}></th>
                    {(selectedQuarter === 'all' || selectedQuarter === 'Q1') && (
                      <>
                        <th className="py-1 px-1 text-center">Goal</th>
                        <th className="py-1 px-1 text-center">Actual</th>
                      </>
                    )}
                    {(selectedQuarter === 'all' || selectedQuarter === 'Q2') && (
                      <>
                        <th className="py-1 px-1 text-center">Goal</th>
                        <th className="py-1 px-1 text-center">Actual</th>
                      </>
                    )}
                    {(selectedQuarter === 'all' || selectedQuarter === 'Q3') && (
                      <>
                        <th className="py-1 px-1 text-center">Goal</th>
                        <th className="py-1 px-1 text-center">Actual</th>
                      </>
                    )}
                    {(selectedQuarter === 'all' || selectedQuarter === 'Q4') && (
                      <>
                        <th className="py-1 px-1 text-center">Goal</th>
                        <th className="py-1 px-1 text-center">Actual</th>
                      </>
                    )}
                    <th className="py-1 px-1 text-center">Goal</th>
                    <th className="py-1 px-1 text-center">Actual</th>
                    <th colSpan={4}></th>
                  </tr>
                </thead>
                <tbody>
                  {tableRecruiters.slice((goalsPage - 1) * RECRUITERS_PER_PAGE, goalsPage * RECRUITERS_PER_PAGE).map((r) => (
                    <tr
                      key={r.id}
                      className={clsx(
                        "border-b border-gray-100 transition-colors",
                        r.is_active === false ? "bg-gray-50/50 grayscale opacity-60" : "hover:bg-gray-50"
                      )}
                    >
                      <td className="py-2 px-2 font-medium text-gray-900">
                        {r.name}
                        {r.is_active === false && <span className="ml-2 text-[10px] uppercase tracking-wider text-gray-400 font-bold">(Archived)</span>}
                      </td>
                      <td className="py-2 px-2">
                        {selectedQuarter === 'all' ? (
                          <select
                            className="input text-xs py-1 px-1.5 w-20"
                            defaultValue={r.seniority}
                            onChange={(e) => debouncedUpdate(r.id, 'seniority', e.target.value)}
                          >
                            <option value="Junior">Junior</option>
                            <option value="Mid">Mid</option>
                            <option value="Senior">Senior</option>
                            <option value="Lead">Lead</option>
                          </select>
                        ) : (
                          <select
                            className="input text-xs py-1 px-1.5 w-20"
                            defaultValue={(r as any)[`${selectedQuarter.toLowerCase()}_seniority`] || r.seniority}
                            onChange={(e) => debouncedUpdate(r.id, `${selectedQuarter.toLowerCase()}_seniority`, e.target.value)}
                          >
                            <option value="Junior">Junior</option>
                            <option value="Mid">Mid</option>
                            <option value="Senior">Senior</option>
                            <option value="Lead">Lead</option>
                          </select>
                        )}
                      </td>
                      <td className="py-2 px-2 text-gray-600">{r.location}</td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          className="input text-xs py-1 px-1.5 w-24"
                          defaultValue={r.manager}
                          onChange={(e) => debouncedUpdate(r.id, 'manager', e.target.value)}
                          placeholder="Manager"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <span
                          className={clsx(
                            'badge',
                            r.employment_type === 'Full-time' && 'badge-success',
                            r.employment_type === 'Part-time' && 'badge-warning',
                            r.employment_type === 'Contract' && 'badge-danger'
                          )}
                        >
                          {r.employment_type}
                        </span>
                      </td>
                      {/* Q1 */}
                      {(selectedQuarter === 'all' || selectedQuarter === 'Q1') && (
                        <>
                          <td className="py-2 px-1 text-center">
                            <input
                              type="number"
                              className="input w-14 text-center text-xs no-spinner"
                              defaultValue={r.q1_goal}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10)
                                if (!isNaN(v)) debouncedUpdate(r.id, 'q1_goal', v)
                              }}
                              min={0}
                            />
                          </td>
                          <td className="py-2 px-1 text-center">
                            <input
                              type="number"
                              className="input w-14 text-center text-xs no-spinner"
                              defaultValue={r.q1_actual}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10)
                                if (!isNaN(v)) debouncedUpdate(r.id, 'q1_actual', v)
                              }}
                              min={0}
                            />
                          </td>
                        </>
                      )}
                      {/* Q2 */}
                      {(selectedQuarter === 'all' || selectedQuarter === 'Q2') && (
                        <>
                          <td className="py-2 px-1 text-center">
                            <input
                              type="number"
                              className="input w-14 text-center text-xs no-spinner"
                              defaultValue={r.q2_goal}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10)
                                if (!isNaN(v)) debouncedUpdate(r.id, 'q2_goal', v)
                              }}
                              min={0}
                            />
                          </td>
                          <td className="py-2 px-1 text-center">
                            <input
                              type="number"
                              className="input w-14 text-center text-xs no-spinner"
                              defaultValue={r.q2_actual}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10)
                                if (!isNaN(v)) debouncedUpdate(r.id, 'q2_actual', v)
                              }}
                              min={0}
                            />
                          </td>
                        </>
                      )}
                      {/* Q3 */}
                      {(selectedQuarter === 'all' || selectedQuarter === 'Q3') && (
                        <>
                          <td className="py-2 px-1 text-center">
                            <input
                              type="number"
                              className="input w-14 text-center text-xs no-spinner"
                              defaultValue={r.q3_goal}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10)
                                if (!isNaN(v)) debouncedUpdate(r.id, 'q3_goal', v)
                              }}
                              min={0}
                            />
                          </td>
                          <td className="py-2 px-1 text-center">
                            <input
                              type="number"
                              className="input w-14 text-center text-xs no-spinner"
                              defaultValue={r.q3_actual}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10)
                                if (!isNaN(v)) debouncedUpdate(r.id, 'q3_actual', v)
                              }}
                              min={0}
                            />
                          </td>
                        </>
                      )}
                      {/* Q4 */}
                      {(selectedQuarter === 'all' || selectedQuarter === 'Q4') && (
                        <>
                          <td className="py-2 px-1 text-center">
                            <input
                              type="number"
                              className="input w-14 text-center text-xs no-spinner"
                              defaultValue={r.q4_goal}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10)
                                if (!isNaN(v)) debouncedUpdate(r.id, 'q4_goal', v)
                              }}
                              min={0}
                            />
                          </td>
                          <td className="py-2 px-1 text-center">
                            <input
                              type="number"
                              className="input w-14 text-center text-xs no-spinner"
                              defaultValue={r.q4_actual}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10)
                                if (!isNaN(v)) debouncedUpdate(r.id, 'q4_actual', v)
                              }}
                              min={0}
                            />
                          </td>
                        </>
                      )}
                      {/* Annual / Summary */}
                      <td className="py-2 px-1 text-center font-medium text-gray-700">
                        {loc.number(selectedQuarter === 'all' ? r.annualGoal : (r as any)[`${selectedQuarter.toLowerCase()}_goal`])}
                      </td>
                      <td className="py-2 px-1 text-center font-medium text-gray-700">
                        {loc.number(selectedQuarter === 'all' ? r.annualActual : (r as any)[`${selectedQuarter.toLowerCase()}_actual`])}
                      </td>
                      {/* Attainment */}
                      <td className="py-2 px-2 text-center">
                        <span
                          className={clsx(
                            'inline-flex items-center justify-center font-semibold min-w-[3rem] px-2 py-1 rounded-md text-xs',
                            getAttainmentBadge(r.attainment)
                          )}
                        >
                          {r.attainment}%
                        </span>
                      </td>
                      {/* Status */}
                      <td className="py-2 px-2 text-center">
                        <span className={clsx('text-xs font-medium', getGoalMetStatus(r.annualGoal, r.annualActual).className)}>
                          {getGoalMetStatus(r.annualGoal, r.annualActual).label}
                        </span>
                      </td>
                      {/* Bonus */}
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          defaultChecked={r.eligible_for_bonus}
                          onChange={(e) => debouncedUpdate(r.id, 'eligible_for_bonus', e.target.checked)}
                        />
                      </td>
                      {/* Actions */}
                      <td className="py-2 px-2 text-center">
                        <button
                          className={clsx(
                            "p-1 transition-colors",
                            r.is_active === false ? "text-indigo-400 hover:text-indigo-600" : "text-gray-400 hover:text-red-600"
                          )}
                          onClick={() => {
                            if (r.is_active === false) {
                              updateGoalMutation.mutate({ id: r.id, data: { is_active: true } })
                            } else {
                              handleDeleteRecruiter(r.id, r.name)
                            }
                          }}
                          title={r.is_active === false ? "Restore recruiter" : "Archive recruiter"}
                        >
                          {r.is_active === false ? (
                            <ArrowPathIcon className="w-4 h-4" />
                          ) : (
                            <TrashIcon className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                    <td className="py-3 px-2 text-gray-900" colSpan={5}>
                      Team Totals
                    </td>
                    {(selectedQuarter === 'all' || selectedQuarter === 'Q1') && (
                      <>
                        <td className="py-3 px-1 text-center text-gray-900">{loc.number(quarterSums.q1Goal)}</td>
                        <td className="py-3 px-1 text-center text-gray-900">{loc.number(quarterSums.q1Actual)}</td>
                      </>
                    )}
                    {(selectedQuarter === 'all' || selectedQuarter === 'Q2') && (
                      <>
                        <td className="py-3 px-1 text-center text-gray-900">{loc.number(quarterSums.q2Goal)}</td>
                        <td className="py-3 px-1 text-center text-gray-900">{loc.number(quarterSums.q2Actual)}</td>
                      </>
                    )}
                    {(selectedQuarter === 'all' || selectedQuarter === 'Q3') && (
                      <>
                        <td className="py-3 px-1 text-center text-gray-900">{loc.number(quarterSums.q3Goal)}</td>
                        <td className="py-3 px-1 text-center text-gray-900">{loc.number(quarterSums.q3Actual)}</td>
                      </>
                    )}
                    {(selectedQuarter === 'all' || selectedQuarter === 'Q4') && (
                      <>
                        <td className="py-3 px-1 text-center text-gray-900">{loc.number(quarterSums.q4Goal)}</td>
                        <td className="py-3 px-1 text-center text-gray-900">{loc.number(quarterSums.q4Actual)}</td>
                      </>
                    )}
                    <td className="py-3 px-1 text-center text-gray-900">{loc.number(quarterSums.annualGoal)}</td>
                    <td className="py-3 px-1 text-center text-gray-900">{loc.number(quarterSums.annualActual)}</td>
                    <td className="py-3 px-2 text-center">
                      <span className={clsx(
                        'inline-flex items-center justify-center font-semibold min-w-[3rem] px-2 py-1 rounded-md text-xs',
                        getAttainmentBadge(quarterSums.attainment)
                      )}>
                        {quarterSums.attainment}%
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className={clsx('text-xs font-medium', getGoalMetStatus(quarterSums.annualGoal, quarterSums.annualActual).className)}>
                        {getGoalMetStatus(quarterSums.annualGoal, quarterSums.annualActual).label}
                      </span>
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* Goals Table Footer Controls */}
            <div className="flex items-center justify-between mt-3">
              <button
                onClick={() => setShowArchivedGoals(v => !v)}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1.5 transition-colors"
              >
                <span className={clsx('w-3.5 h-3.5 rounded border flex items-center justify-center', showArchivedGoals ? 'bg-gray-700 border-gray-700 text-white' : 'border-gray-400')}>
                  {showArchivedGoals && <span className="text-[8px] font-bold">✓</span>}
                </span>
                Show archived recruiters ({recruiterGoals.filter(r => r.is_active === false).length})
              </button>
            </div>

            {/* Goals Table Pagination */}
            {tableRecruiters.length > RECRUITERS_PER_PAGE && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <div className="text-xs text-gray-500">
                  Showing {Math.min((goalsPage - 1) * RECRUITERS_PER_PAGE + 1, tableRecruiters.length)}–{Math.min(goalsPage * RECRUITERS_PER_PAGE, tableRecruiters.length)} of {tableRecruiters.length} recruiters
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setGoalsPage(p => Math.max(1, p - 1))}
                    disabled={goalsPage === 1}
                    className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.ceil(tableRecruiters.length / RECRUITERS_PER_PAGE) }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === Math.ceil(tableRecruiters.length / RECRUITERS_PER_PAGE) || Math.abs(p - goalsPage) <= 1)
                    .map((p, idx, arr) => (
                      <React.Fragment key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-gray-400">…</span>}
                        <button
                          onClick={() => setGoalsPage(p)}
                          className={clsx(
                            'px-2.5 py-1 text-xs rounded border transition-colors',
                            p === goalsPage
                              ? 'bg-primary-500 border-primary-500 text-white'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          )}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    ))}
                  <button
                    onClick={() => setGoalsPage(p => Math.min(Math.ceil(recruiterTotals.length / RECRUITERS_PER_PAGE), p + 1))}
                    disabled={goalsPage === Math.ceil(recruiterTotals.length / RECRUITERS_PER_PAGE)}
                    className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
            </>
          )}

          {/* ===== CAPACITY SUB-TAB ===== */}
          {goalingSubTab === 'capacity' && (
            <>
          {/* Input Parameters Panel */}
          <div className="card">
            <h3 className="card-header">Recruiter Goaling Calculator</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="label">Quarterly Hiring Target</label>
                <input
                  type="number"
                  className="input no-spinner"
                  value={hiringTarget}
                  onChange={(e) => setHiringTarget(e.target.value)}
                  min={0}
                  placeholder="50"
                />
              </div>
              <div>
                <label className="label">Avg. Offer Acceptance Rate (%)</label>
                <input
                  type="number"
                  className="input no-spinner"
                  value={acceptanceRate}
                  onChange={(e) => setAcceptanceRate(e.target.value)}
                  min={0}
                  max={100}
                  placeholder="85"
                />
              </div>
              <div>
                <label className="label">Avg. Interviews per Offer</label>
                <input
                  type="number"
                  className="input no-spinner"
                  value={interviewsPerOffer}
                  onChange={(e) => setInterviewsPerOffer(e.target.value)}
                  min={0}
                  placeholder="4"
                />
              </div>
              <div>
                <label className="label">Avg. Screens per Interview</label>
                <input
                  type="number"
                  className="input no-spinner"
                  value={screensPerInterview}
                  onChange={(e) => setScreensPerInterview(e.target.value)}
                  min={0}
                  placeholder="3"
                />
              </div>
            </div>
          </div>

          {/* Calculations Panel */}
          <div className="card">
            <h3 className="card-header">Pipeline Requirements</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-primary-50 rounded-lg text-center">
                <div className="text-xs font-medium text-primary-600 mb-0.5">Required Pipeline (Offers)</div>
                <div className="text-2xl font-bold text-primary-900 dark:text-primary-100">
                  {loc.number(goalingCalcs.requiredPipeline)}
                </div>
                <div className="text-xs text-primary-500 mt-1">
                  {hiringTarget || 0} hires / {acceptanceRate || 0}% acceptance
                </div>
              </div>
              <div className="p-3 bg-primary-50 rounded-lg text-center">
                <div className="text-xs font-medium text-primary-600 mb-0.5">Required Interviews</div>
                <div className="text-2xl font-bold text-primary-900 dark:text-primary-100">
                  {loc.number(goalingCalcs.requiredInterviews)}
                </div>
                <div className="text-xs text-primary-500 mt-1">
                  {loc.number(goalingCalcs.requiredPipeline)} pipeline x {interviewsPerOffer || 0} per offer
                </div>
              </div>
              <div className="p-3 bg-primary-50 rounded-lg text-center">
                <div className="text-xs font-medium text-primary-600 mb-0.5">Required Screens</div>
                <div className="text-2xl font-bold text-primary-900 dark:text-primary-100">
                  {loc.number(goalingCalcs.requiredScreens)}
                </div>
                <div className="text-xs text-primary-500 mt-1">
                  {loc.number(goalingCalcs.requiredInterviews)} interviews x {screensPerInterview || 0} per interview
                </div>
              </div>
            </div>
          </div>

          {/* Per-Recruiter Capacity Visual */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="card-header mb-0">Per-Recruiter Annual Capacity</h3>
                <p className="text-xs text-gray-400 mt-0.5">Goal vs. actual hires for {selectedYear}</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Team:</label>
                <select
                  value={capacityTeamFilter}
                  onChange={e => setCapacityTeamFilter(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-800 dark:border-gray-600 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="all">All Teams</option>
                  {capacityTeams.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            {filteredCapacityData.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {filteredCapacityData.map((entry) => {
                  const pct = entry.goal > 0 ? Math.round((entry.actual / entry.goal) * 100) : 0
                  const barColor = pct >= 100 ? 'bg-green-500' : pct >= 75 ? 'bg-blue-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400'
                  const textColor = pct >= 100 ? 'text-green-600' : pct >= 75 ? 'text-blue-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-500'
                  const initials = entry.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                  return (
                    <div key={entry.name} className="p-3 rounded-lg border border-slate-200/80 bg-white hover:border-slate-300 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">{initials}</div>
                        <span className="text-xs font-medium text-slate-800 truncate leading-tight">{entry.name}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                        <div className={clsx('h-full rounded-full transition-all', barColor)} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">{entry.actual} / {entry.goal}</span>
                        <span className={clsx('text-[11px] font-bold', textColor)}>{pct}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
                No recruiter data available for {selectedYear}
              </div>
            )}
          </div>
            </>
          )}

          {/* ===== TRENDS SUB-TAB ===== */}
          {goalingSubTab === 'trends' && (() => {
            // Build chart data: per-recruiter attainment grouped by year
            const YEAR_COLORS: Record<number, string> = { 2023: '#94a3b8', 2024: '#60a5fa', 2025: '#6366f1', 2026: '#10b981', 2027: '#f59e0b', 2028: '#ec4899' }
            const topRecruiters = uniqueRecruiterNames
              .map(name => {
                const entries = compareYears.map(year => {
                  const yearData = compareData?.find(d => d.year === year)
                  const goal = yearData?.goals.find(g => g.name === name)
                  const annualGoal = goal ? (goal.q1_goal + goal.q2_goal + goal.q3_goal + goal.q4_goal) : 0
                  const annualActual = goal ? (goal.q1_actual + goal.q2_actual + goal.q3_actual + goal.q4_actual) : 0
                  return { year, attainment: annualGoal > 0 ? Math.round((annualActual / annualGoal) * 100) : 0 }
                })
                const latest = entries[entries.length - 1]?.attainment || 0
                return { name, entries, latest }
              })
              .sort((a, b) => b.latest - a.latest)

            // Team-level year-over-year attainment
            const teamByYear = compareYears.map(year => {
              const yearData = compareData?.find(d => d.year === year)
              const goals = yearData?.goals.filter(g => g.is_active !== false) || []
              const totalGoal = goals.reduce((s, g) => s + g.q1_goal + g.q2_goal + g.q3_goal + g.q4_goal, 0)
              const totalActual = goals.reduce((s, g) => s + g.q1_actual + g.q2_actual + g.q3_actual + g.q4_actual, 0)
              const attainment = totalGoal > 0 ? Math.round((totalActual / totalGoal) * 100) : 0
              const exceeded = goals.filter(g => { const goal = g.q1_goal+g.q2_goal+g.q3_goal+g.q4_goal; return goal > 0 && (g.q1_actual+g.q2_actual+g.q3_actual+g.q4_actual)/goal > 1 }).length
              const met = goals.filter(g => { const goal = g.q1_goal+g.q2_goal+g.q3_goal+g.q4_goal; const actual = g.q1_actual+g.q2_actual+g.q3_actual+g.q4_actual; return goal > 0 && actual/goal === 1 }).length
              return { year: String(year), attainment, totalGoal, totalActual, exceeded, met }
            })

            // Grouped bar chart data: one entry per recruiter, one bar per year
            const groupedData = topRecruiters.slice(0, 25).map(r => {
              const entry: Record<string, string | number> = { name: r.name.split(' ')[0] + ' ' + (r.name.split(' ')[1]?.[0] || '') + '.' }
              r.entries.forEach(e => { entry[String(e.year)] = e.attainment })
              return entry
            })

            return (
              <div className="space-y-6">
                {/* Year selector */}
                <div className="card">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Team Attainment by Year</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Total team hiring goal vs. actual across planning periods</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400 mr-1">Years:</span>
                      {[2024, 2025, 2026, 2027].map(year => (
                        <button key={year} onClick={() => toggleCompareYear(year)}
                          className={clsx('px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors',
                            compareYears.includes(year) ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                          )}
                          style={compareYears.includes(year) ? { backgroundColor: YEAR_COLORS[year] || '#6366f1', borderColor: YEAR_COLORS[year] } : {}}
                        >{year}</button>
                      ))}
                    </div>
                  </div>

                  {/* Year-level stat cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    {teamByYear.map(yd => (
                      <div key={yd.year} className="p-3 rounded-xl border border-gray-100 bg-gray-50/60 dark:bg-gray-800/40 dark:border-gray-700">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{yd.year}</div>
                        <div className={clsx('text-2xl font-bold', yd.attainment >= 100 ? 'text-green-600' : yd.attainment >= 75 ? 'text-blue-600' : 'text-red-500')}>
                          {yd.attainment}%
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{yd.totalActual}/{yd.totalGoal} hires</div>
                        <div className="text-[10px] text-gray-400 mt-1">{yd.exceeded} exceeded · {yd.met} met</div>
                      </div>
                    ))}
                  </div>

                  {/* Team attainment bar chart by year */}
                  {teamByYear.length > 0 && (
                    <ResponsiveContainer width="100%" height={140}>
                      <RechartsBarChart data={teamByYear} barCategoryGap="40%" margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                        <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} domain={[0, 130]} tickFormatter={v => `${v}%`} />
                        <Tooltip formatter={(v: number) => [`${v}%`, 'Attainment']} contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <Bar dataKey="attainment" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                          {teamByYear.map((entry, i) => {
                            const yr = parseInt(entry.year)
                            return <Cell key={i} fill={YEAR_COLORS[yr] || '#6366f1'} />
                          })}
                          <LabelList dataKey="attainment" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 10, fill: '#374151', fontWeight: 600 }} />
                        </Bar>
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Per-recruiter grouped attainment chart */}
                {compareYears.length >= 1 && groupedData.length > 0 && (
                  <div className="card">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Individual Attainment by Year</h3>
                    <p className="text-xs text-gray-500 mb-4">Top 25 recruiters — attainment % per year (sorted by most recent)</p>
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      {compareYears.map(yr => (
                        <span key={yr} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: YEAR_COLORS[yr] || '#6366f1' }} />{yr}
                        </span>
                      ))}
                      <span className="flex items-center gap-1.5 text-xs text-gray-400 ml-2">
                        <span className="w-8 border-t-2 border-dashed border-gray-300 inline-block" />100% target
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={Math.max(260, groupedData.length * 28)}>
                      <RechartsBarChart layout="vertical" data={groupedData} margin={{ top: 4, right: 50, left: 8, bottom: 4 }} barCategoryGap="25%" barGap={1}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} domain={[0, 130]} tickFormatter={v => `${v}%`} />
                        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: '#374151' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v: number, name: string) => [`${v}%`, name]} contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }} />
                        {compareYears.map(yr => (
                          <Bar key={yr} dataKey={String(yr)} fill={YEAR_COLORS[yr] || '#6366f1'} radius={[0, 3, 3, 0]} isAnimationActive={false} maxBarSize={14} />
                        ))}
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Recruiter trend cards grid */}
                {uniqueRecruiterNames.length > 0 && compareYears.length >= 2 && (
                  <div className="card">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Recruiter Trajectories</h3>
                    <p className="text-xs text-gray-500 mb-4">Attainment trend direction per recruiter</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {topRecruiters.slice(0, 30).map(r => {
                        const trend = getPerformanceTrend(r.entries.filter(e => e.attainment > 0).map(e => ({ year: e.year, attainment: e.attainment })))
                        return (
                          <div key={r.name} className="p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-200 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{r.name.split(' ')[0]}</span>
                              {trend && (
                                <span className={clsx('text-xs font-bold', trend.color)}>
                                  {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}{trend.label}
                                </span>
                              )}
                            </div>
                            <div className="flex items-end gap-1 h-10">
                              {r.entries.map((e, i) => {
                                const h = e.attainment > 0 ? Math.min(100, e.attainment) : 8
                                const color = e.attainment > 100 ? '#16a34a' : e.attainment >= 75 ? '#3b82f6' : e.attainment > 0 ? '#f59e0b' : '#e5e7eb'
                                return (
                                  <div key={i} className="flex-1 rounded-t-sm transition-all" style={{ height: `${h}%`, backgroundColor: color }} title={`${compareYears[i]}: ${e.attainment}%`} />
                                )
                              })}
                            </div>
                            <div className="flex justify-between mt-1">
                              {r.entries.map((e, i) => (
                                <span key={i} className="text-[9px] text-gray-400">{e.attainment > 0 ? `${e.attainment}%` : '–'}</span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {uniqueRecruiterNames.length === 0 && (
                  <div className="card py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
                    No recruiter data found. Add recruiter goals to see trends.
                  </div>
                )}
              </div>
            )
          })()}

          {/* ===== HISTORY SUB-TAB ===== */}
          {goalingSubTab === 'history' && (
          <>
          {/* Historical Performance Comparison */}
          <div className="card overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Historical Performance (Year-over-Year)</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Showing recruiters across multiple planning periods</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="label mb-0 text-sm">Years:</label>
                  <div className="flex gap-1">
                    {[2024, 2025, 2026, 2027, 2028].map(year => (
                      <button
                        key={year}
                        onClick={() => toggleCompareYear(year)}
                        className={clsx(
                          'px-3 py-1 text-xs font-medium rounded-lg border transition-colors',
                          compareYears.includes(year)
                            ? 'bg-primary-50 border-primary-500 text-primary-700'
                            : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                        )}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {compareYears.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">
                  Select at least one year above to view comparison data.
                </div>
              ) : comparisonRows.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">
                  No recruiter data found for the selected years.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-2 font-medium text-gray-700">Recruiter</th>
                        {compareYears.map(year => (
                          <th key={`header-group-${year}`} className="text-center py-3 px-1 font-medium text-gray-700" colSpan={4}>
                            {year}
                          </th>
                        ))}
                        <th className="text-center py-3 px-2 font-medium text-gray-700">Trend</th>
                      </tr>
                      <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                        <th></th>
                        {compareYears.map(year => (
                          <React.Fragment key={`subheader-${year}`}>
                            <th className="py-1 px-1 text-center">Goal</th>
                            <th className="py-1 px-1 text-center">Actual</th>
                            <th className="py-1 px-1 text-center">Attain%</th>
                            <th className="py-1 px-1 text-center">Met?</th>
                          </React.Fragment>
                        ))}
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.slice(histPage * pageSize, (histPage + 1) * pageSize).map(row => (
                        <tr key={row.name} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-2 px-2 font-medium text-gray-900">{row.name}</td>
                          {row.yearlyEntries.map(entry => {
                            const status = getGoalMetStatus(entry.annualGoal, entry.annualActual)
                            return (
                              <React.Fragment key={`${row.name}-${entry.year}`}>
                                <td className="py-2 px-1 text-center text-gray-700">{loc.number(entry.annualGoal)}</td>
                                <td className="py-2 px-1 text-center text-gray-700">{loc.number(entry.annualActual)}</td>
                                <td className="py-2 px-1 text-center">
                                  <span
                                    className={clsx(
                                      'inline-flex items-center justify-center font-semibold min-w-[3rem] px-2 py-1 rounded-md text-xs',
                                      getAttainmentBadge(entry.attainment)
                                    )}
                                  >
                                    {entry.attainment}%
                                  </span>
                                </td>
                                <td className="py-2 px-1 text-center">
                                  <span className={clsx('text-xs font-medium', status.className)}>
                                    {status.label}
                                  </span>
                                </td>
                              </React.Fragment>
                            )
                          })}
                          <td className="py-2 px-2 text-center text-xs">
                            {getPerformanceTrend(row.yearlyEntries.filter(e => e.annualGoal > 0).map(e => ({ year: e.year, attainment: e.attainment })))?.label || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            {/* History Pagination */}
            {comparisonRows.length > pageSize && (
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  Showing {histPage * pageSize + 1} to {Math.min((histPage + 1) * pageSize, comparisonRows.length)} of {comparisonRows.length} results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setHistPage(p => Math.max(0, p - 1))}
                    disabled={histPage === 0}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setHistPage(p => Math.min(Math.ceil(comparisonRows.length / pageSize) - 1, p + 1))}
                    disabled={histPage >= Math.ceil(comparisonRows.length / pageSize) - 1}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
          </>
          )}
        </>
      )}

      {/* Quality of Hire Tab */}
      {activeTab === 'quality' && (
        <>
          {qohLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <>
              {/* Summary metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Average Quality Score"
                  value={qohRes?.data?.overall_avg?.toFixed(1) ?? '--'}
                  subtitle={`${qohRes?.data?.total_scored ?? 0} employees scored`}
                  icon={<CheckCircleIcon className="w-6 h-6" />}
                />
                <MetricCard
                  title="Top Source Company"
                  value={qohRes?.data?.top_source_companies?.[0]?.company ?? '--'}
                  subtitle={`Score: ${qohRes?.data?.top_source_companies?.[0]?.avg_score ?? '--'}`}
                  icon={<ArrowTrendingUpIcon className="w-6 h-6" />}
                />
                <MetricCard
                  title="Score 80+"
                  value={qohRes?.data?.score_distribution?.['80-100'] ?? 0}
                  subtitle="High quality hires"
                  icon={<CheckCircleIcon className="w-6 h-6" />}
                />
                <MetricCard
                  title="Score < 40"
                  value={(qohRes?.data?.score_distribution?.['0-20'] ?? 0) + (qohRes?.data?.score_distribution?.['20-40'] ?? 0)}
                  subtitle="Below average hires"
                  icon={<XCircleIcon className="w-6 h-6" />}
                />
              </div>

              {/* Quality by Department */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card">
                  <h3 className="card-header">Quality Score by Department</h3>
                  {(qohRes?.data?.by_department?.length ?? 0) > 0 ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart data={qohRes?.data?.by_department} layout="vertical" margin={{ left: 20, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }} domain={[0, 100]} />
                          <YAxis type="category" dataKey="department" tick={{ fontSize: 10, fill: '#6b7280' }} width={100} />
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '11px' }} />
                          <Bar dataKey="avg_score" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]}>
                            <LabelList dataKey="avg_score" position="right" style={{ fontSize: 10, fill: '#374151' }} formatter={(v: number) => v?.toFixed(1)} />
                          </Bar>
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">No data available</div>
                  )}
                </div>

                {/* Score Distribution */}
                <div className="card">
                  <h3 className="card-header">Quality Score Distribution</h3>
                  {qohRes?.data?.score_distribution ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart data={Object.entries(qohRes.data.score_distribution).map(([range, count]) => ({ range, count }))} margin={{ left: 10, right: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#6b7280' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '11px' }} />
                          <Bar dataKey="count" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]}>
                            {Object.entries(qohRes.data.score_distribution).map((_, idx) => (
                              <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">No data available</div>
                  )}
                </div>
              </div>

              {/* Source Company Tables — Most Hired & Highest Quality */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Most Hired From */}
                <div className="card">
                  <h3 className="card-header">Most Hired From</h3>
                  <p className="text-xs text-gray-400 mb-3">Companies with the highest hiring volume (previous employer)</p>
                  {(sourceRes?.data?.sources?.length ?? 0) > 0 ? (
                    <div className="overflow-auto max-h-[350px]">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">#</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Company</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-500">Hired</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-500">Avg Quality</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-500">Retention</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {sourceRes.data.sources.slice(0, 15).map((s: any, i: number) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                              <td className="px-3 py-2 font-medium text-gray-900">{s.company}</td>
                              <td className="px-3 py-2 text-right font-semibold text-gray-800">{s.total_hired}</td>
                              <td className="px-3 py-2 text-right">
                                <span className={clsx('font-medium text-xs', (s.avg_quality_score ?? 0) >= 70 ? 'text-green-600' : (s.avg_quality_score ?? 0) >= 50 ? 'text-yellow-600' : 'text-gray-500')}>
                                  {s.avg_quality_score?.toFixed(1) ?? '--'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right text-gray-600 text-xs">{s.retention_rate?.toFixed(0) ?? '--'}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">No source data available</div>
                  )}
                </div>

                {/* Highest Quality From */}
                <div className="card">
                  <h3 className="card-header">Highest Quality Hires By Previous Employer</h3>
                  <p className="text-xs text-gray-400 mb-3">Companies whose alumni perform best after joining</p>
                  {(sourceRes?.data?.top_sources?.length ?? 0) > 0 ? (
                    <div className="overflow-auto max-h-[350px]">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">#</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Company</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-500">Avg Quality</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-500">Hired</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-500">Retention</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {sourceRes.data.top_sources.map((s: any, i: number) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                              <td className="px-3 py-2 font-medium text-gray-900">{s.company}</td>
                              <td className="px-3 py-2 text-right">
                                <span className={clsx('font-semibold', (s.avg_quality_score ?? 0) >= 70 ? 'text-green-600' : (s.avg_quality_score ?? 0) >= 50 ? 'text-yellow-600' : 'text-red-600')}>
                                  {s.avg_quality_score?.toFixed(1) ?? '--'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right text-gray-600 text-xs">{s.total_hired}</td>
                              <td className="px-3 py-2 text-right text-gray-600 text-xs">{s.retention_rate?.toFixed(0) ?? '--'}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">No source data available</div>
                  )}
                </div>
              </div>

              {/* Quality Trend */}
              <div className="card">
                <h3 className="card-header">Quality Score Trend (by Cohort)</h3>
                  {(qohRes?.data?.trend?.length ?? 0) > 0 ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsLineChart data={qohRes.data.trend} margin={{ left: 10, right: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="period" tick={{ fontSize: 9, fill: '#6b7280' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} domain={[0, 100]} />
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '11px' }} />
                          <Line type="monotone" dataKey="avg_score" name="Avg Quality Score" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
                        </RechartsLineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">No trend data available</div>
                  )}
              </div>

              {/* ---- Enhanced Quality Analytics ---- */}
              {qohAnalyticsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : (
                <>
                  {/* Best/Worst Recruiters */}
                  <div className="card">
                    <h3 className="card-header">Recruiter Quality Rankings</h3>
                    {(qohAnalyticsRes?.data?.by_recruiter?.length ?? 0) > 0 ? (
                      <div className="overflow-auto max-h-[420px]">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-gray-500">#</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-500">Recruiter</th>
                              <th className="px-3 py-2 text-right font-medium text-gray-500">Avg Quality Score</th>
                              <th className="px-3 py-2 text-right font-medium text-gray-500">Total Hires</th>
                              <th className="px-3 py-2 text-right font-medium text-gray-500">Avg Time to Hire</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(() => {
                              const recruiters = qohAnalyticsRes.data.by_recruiter
                              const topThreshold = recruiters.length >= 4 ? recruiters[Math.floor(recruiters.length * 0.25)]?.avg_quality : null
                              const bottomThreshold = recruiters.length >= 4 ? recruiters[Math.floor(recruiters.length * 0.75)]?.avg_quality : null
                              return recruiters.map((r: any, i: number) => {
                                let rowColor = ''
                                if (topThreshold !== null && r.avg_quality >= topThreshold) rowColor = 'bg-green-50'
                                else if (bottomThreshold !== null && r.avg_quality <= bottomThreshold) rowColor = 'bg-red-50'
                                return (
                                  <tr key={i} className={clsx('hover:bg-gray-50', rowColor)}>
                                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                                    <td className="px-3 py-2 font-medium text-gray-900">{r.recruiter}</td>
                                    <td className="px-3 py-2 text-right">
                                      <span className={clsx('font-semibold', topThreshold !== null && r.avg_quality >= topThreshold ? 'text-green-600' : bottomThreshold !== null && r.avg_quality <= bottomThreshold ? 'text-red-600' : 'text-gray-700')}>
                                        {r.avg_quality?.toFixed(1)}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-right text-gray-600">{r.hire_count}</td>
                                    <td className="px-3 py-2 text-right text-gray-600">{r.avg_time_to_hire != null ? `${r.avg_time_to_hire} days` : '--'}</td>
                                  </tr>
                                )
                              })
                            })()}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">No recruiter data available</div>
                    )}
                  </div>

                  {/* Quality by Team / Manager side by side */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* By Team */}
                    <div className="card">
                      <h3 className="card-header">Quality by Team</h3>
                      {(qohAnalyticsRes?.data?.by_team?.length ?? 0) > 0 ? (
                        <div className="overflow-auto max-h-[380px]">
                          <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium text-gray-500">Team</th>
                                <th className="px-3 py-2 text-right font-medium text-gray-500">Avg Quality</th>
                                <th className="px-3 py-2 text-right font-medium text-gray-500">Hire Count</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {(() => {
                                const teams = qohAnalyticsRes.data.by_team
                                const t25 = teams.length >= 4 ? teams[Math.floor(teams.length * 0.25)]?.avg_quality : null
                                const b25 = teams.length >= 4 ? teams[Math.floor(teams.length * 0.75)]?.avg_quality : null
                                return teams.map((t: any, i: number) => {
                                  let rowColor = ''
                                  if (t25 !== null && t.avg_quality >= t25) rowColor = 'bg-green-50'
                                  else if (b25 !== null && t.avg_quality <= b25) rowColor = 'bg-red-50'
                                  return (
                                    <tr key={i} className={clsx('hover:bg-gray-50', rowColor)}>
                                      <td className="px-3 py-2 font-medium text-gray-900">{t.team}</td>
                                      <td className="px-3 py-2 text-right">
                                        <span className={clsx('font-semibold', t25 !== null && t.avg_quality >= t25 ? 'text-green-600' : b25 !== null && t.avg_quality <= b25 ? 'text-red-600' : 'text-gray-700')}>
                                          {t.avg_quality?.toFixed(1)}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-right text-gray-600">{t.hire_count}</td>
                                    </tr>
                                  )
                                })
                              })()}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">No team data available</div>
                      )}
                    </div>

                    {/* By Manager */}
                    <div className="card">
                      <h3 className="card-header">Quality by Manager</h3>
                      {(qohAnalyticsRes?.data?.by_manager?.length ?? 0) > 0 ? (
                        <div className="overflow-auto max-h-[380px]">
                          <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium text-gray-500">Manager</th>
                                <th className="px-3 py-2 text-right font-medium text-gray-500">Avg Quality</th>
                                <th className="px-3 py-2 text-right font-medium text-gray-500">Hire Count</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {(() => {
                                const managers = qohAnalyticsRes.data.by_manager
                                const m25 = managers.length >= 4 ? managers[Math.floor(managers.length * 0.25)]?.avg_quality : null
                                const mb25 = managers.length >= 4 ? managers[Math.floor(managers.length * 0.75)]?.avg_quality : null
                                return managers.map((m: any, i: number) => {
                                  let rowColor = ''
                                  if (m25 !== null && m.avg_quality >= m25) rowColor = 'bg-green-50'
                                  else if (mb25 !== null && m.avg_quality <= mb25) rowColor = 'bg-red-50'
                                  return (
                                    <tr key={i} className={clsx('hover:bg-gray-50', rowColor)}>
                                      <td className="px-3 py-2 font-medium text-gray-900">{m.manager}</td>
                                      <td className="px-3 py-2 text-right">
                                        <span className={clsx('font-semibold', m25 !== null && m.avg_quality >= m25 ? 'text-green-600' : mb25 !== null && m.avg_quality <= mb25 ? 'text-red-600' : 'text-gray-700')}>
                                          {m.avg_quality?.toFixed(1)}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-right text-gray-600">{m.hire_count}</td>
                                    </tr>
                                  )
                                })
                              })()}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">No manager data available</div>
                      )}
                    </div>
                  </div>

                  {/* Source Company Analysis (worst first) */}
                  <div className="card">
                    <h3 className="card-header">Source Company Analysis (Sorted by Lowest Quality)</h3>
                    {(qohAnalyticsRes?.data?.by_source_company?.length ?? 0) > 0 ? (
                      <div className="overflow-auto max-h-[400px]">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-gray-500">#</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-500">Previous Company</th>
                              <th className="px-3 py-2 text-right font-medium text-gray-500">Avg Quality Score</th>
                              <th className="px-3 py-2 text-right font-medium text-gray-500">Hire Count</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {qohAnalyticsRes.data.by_source_company.map((s: any, i: number) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                                <td className="px-3 py-2 font-medium text-gray-900">{s.company}</td>
                                <td className="px-3 py-2 text-right">
                                  <span className={clsx('font-semibold', s.avg_quality >= 70 ? 'text-green-600' : s.avg_quality >= 50 ? 'text-yellow-600' : 'text-red-600')}>
                                    {s.avg_quality?.toFixed(1)}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right text-gray-600">{s.hire_count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">No source company data available</div>
                    )}
                  </div>

                  {/* Time-to-Hire vs Quality Correlation */}
                  <div className="card">
                    <h3 className="card-header">Time-to-Hire vs Quality Correlation</h3>
                    {(qohAnalyticsRes?.data?.time_to_hire_correlation?.length ?? 0) > 0 ? (
                      <>
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsBarChart data={qohAnalyticsRes.data.time_to_hire_correlation} margin={{ left: 10, right: 20, top: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="time_bucket" tick={{ fontSize: 10, fill: '#6b7280' }} />
                              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} domain={[0, 100]} label={{ value: 'Avg Quality Score', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#6b7280' } }} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '11px' }}
                                formatter={(value: number, name: string) => [value?.toFixed(1), name === 'avg_quality' ? 'Avg Quality' : name]}
                                labelFormatter={(label: string) => `Time to Hire: ${label}`}
                              />
                              <Bar dataKey="avg_quality" name="Avg Quality" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]}>
                                <LabelList dataKey="avg_quality" position="top" style={{ fontSize: 10, fill: '#374151' }} formatter={(v: number) => v?.toFixed(1)} />
                                {qohAnalyticsRes.data.time_to_hire_correlation.map((_: any, idx: number) => (
                                  <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                ))}
                              </Bar>
                            </RechartsBarChart>
                          </ResponsiveContainer>
                        </div>
                        {/* Insight text */}
                        {(() => {
                          const buckets = qohAnalyticsRes.data.time_to_hire_correlation.filter((b: any) => b.count > 0)
                          if (buckets.length === 0) return null
                          const best = buckets.reduce((a: any, b: any) => a.avg_quality > b.avg_quality ? a : b)
                          return (
                            <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-2">
                              Hires made within <span className="font-semibold text-gray-900">{best.time_bucket}</span> tend to have the highest quality scores
                              (<span className="font-semibold text-green-600">{best.avg_quality?.toFixed(1)} avg</span> across {best.count} hires).
                            </p>
                          )
                        })()}
                      </>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">No time-to-hire correlation data available</div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* Cost Per Hire Tab */}
      {activeTab === 'cost' && (
        <>
          {cphLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <>
              {/* Summary metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Avg Cost Per Hire"
                  value={loc.currency(cphRes?.data?.overall_avg_cost ?? 0)}
                  icon={<CurrencyDollarIcon className="w-6 h-6" />}
                />
                <MetricCard
                  title="Total Recruitment Spend"
                  value={loc.currency(cphRes?.data?.overall_total_spend ?? 0, true)}
                  icon={<CurrencyDollarIcon className="w-6 h-6" />}
                />
                <MetricCard
                  title="Most Efficient Dept"
                  value={cphRes?.data?.cost_efficiency?.[0]?.department ?? '--'}
                  subtitle={`Ratio: ${cphRes?.data?.cost_efficiency?.[0]?.efficiency_ratio?.toFixed(1) ?? '--'}`}
                  icon={<ArrowTrendingUpIcon className="w-6 h-6" />}
                />
                <MetricCard
                  title="Highest Avg Cost"
                  value={cphRes?.data?.by_level?.[0]?.level ?? '--'}
                  subtitle={loc.currency(cphRes?.data?.by_level?.[0]?.avg_cost ?? 0)}
                  icon={<ArrowTrendingDownIcon className="w-6 h-6" />}
                />
              </div>

              {/* Cost by Department and Level */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card">
                  <h3 className="card-header">Cost Per Hire by Department</h3>
                  {(cphRes?.data?.by_department?.length ?? 0) > 0 ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart data={cphRes.data.by_department} layout="vertical" margin={{ left: 20, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v: number) => loc.currency(v, true)} />
                          <YAxis type="category" dataKey="department" tick={{ fontSize: 10, fill: '#6b7280' }} width={100} />
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '11px' }} formatter={(v: number) => [loc.currency(v), 'Avg Cost']} />
                          <Bar dataKey="avg_cost" fill={CHART_COLORS[2]} radius={[0, 4, 4, 0]} />
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">No data available</div>
                  )}
                </div>

                <div className="card">
                  <h3 className="card-header">Cost Per Hire by Level</h3>
                  {(cphRes?.data?.by_level?.length ?? 0) > 0 ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart data={cphRes.data.by_level} margin={{ left: 10, right: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="level" tick={{ fontSize: 10, fill: '#6b7280' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v: number) => loc.currency(v, true)} />
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '11px' }} formatter={(v: number) => [loc.currency(v), 'Avg Cost']} />
                          <Bar dataKey="avg_cost" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]}>
                            {cphRes.data.by_level.map((_: any, idx: number) => (
                              <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">No data available</div>
                  )}
                </div>
              </div>

              {/* Cost Efficiency + Spend Trend */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card">
                  <h3 className="card-header">Cost Efficiency by Department</h3>
                  <p className="text-xs text-gray-500 mb-3">Quality score per {loc.currency(1000)} spent on hiring</p>
                  {(cphRes?.data?.cost_efficiency?.length ?? 0) > 0 ? (
                    <div className="overflow-auto max-h-[300px]">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Department</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-500">Avg Quality</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-500">Avg Cost</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-500">Efficiency</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {cphRes.data.cost_efficiency.map((r: any, i: number) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium text-gray-900">{r.department}</td>
                              <td className="px-3 py-2 text-right text-gray-600">{r.avg_quality?.toFixed(1)}</td>
                              <td className="px-3 py-2 text-right text-gray-600">{loc.currency(r.avg_cost ?? 0)}</td>
                              <td className="px-3 py-2 text-right">
                                <span className={clsx('font-medium', r.efficiency_ratio >= 4 ? 'text-green-600' : r.efficiency_ratio >= 2 ? 'text-yellow-600' : 'text-red-600')}>
                                  {r.efficiency_ratio?.toFixed(1)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">No data available</div>
                  )}
                </div>

                <div className="card">
                  <h3 className="card-header">Recruitment Spend Trend</h3>
                  {(cphRes?.data?.spend_trend?.length ?? 0) > 0 ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsLineChart data={cphRes.data.spend_trend} margin={{ left: 10, right: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="period" tick={{ fontSize: 9, fill: '#6b7280' }} />
                          <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v: number) => loc.currency(v, true)} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#6b7280' }} />
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '11px' }} />
                          <Legend />
                          <Line yAxisId="left" type="monotone" dataKey="total_spend" name="Total Spend" stroke={CHART_COLORS[2]} strokeWidth={2} dot={{ r: 3 }} />
                          <Line yAxisId="right" type="monotone" dataKey="hires" name="Hires" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
                        </RechartsLineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">No trend data available</div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
