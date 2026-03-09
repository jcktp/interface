import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStore } from '../store'
import { useGlobalFilters } from './useGlobalFilters'
import api from '../api'

export function useDataSync() {
  const { 
    setPlanningPeriods, 
    setActivePeriodId, 
    setWorkforcePlans, 
    setRecruiterGoals,
    activePeriodId,
    setEmployees,
    setCandidates,
    setRequisitions
  } = useStore()
  
  const { filterObj, effectiveDateRange } = useGlobalFilters()
  const currentYear = effectiveDateRange.start ? new Date(effectiveDateRange.start).getFullYear() : new Date().getFullYear()

  // 1. Fetch Planning Periods
  const { data: periodsData } = useQuery({
    queryKey: ['planning-periods'],
    queryFn: async () => {
      const response = await api.get('/planning/periods')
      return response.data.periods
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (periodsData) {
      setPlanningPeriods(periodsData)
      // Auto-select active period if none selected
      if (!activePeriodId && periodsData.length > 0) {
        const active = periodsData.find((p: any) => p.status === 'active') || periodsData[0]
        setActivePeriodId(active.id)
      }
    }
  }, [periodsData, activePeriodId, setPlanningPeriods, setActivePeriodId])

  // 2. Fetch Workforce Plans for Active Period
  const { data: plansData } = useQuery({
    queryKey: ['workforce-plans', activePeriodId],
    queryFn: async () => {
      if (!activePeriodId) return null
      const response = await api.get(`/planning/periods/${activePeriodId}`)
      // Transform snake_case API response to camelCase store format
      return (response.data.plans || []).map((p: any) => ({
        id: p.id,
        periodId: p.period_id,
        department: p.department,
        jobFamily: p.job_family,
        location: p.location,
        startingHeadcount: p.starting_headcount,
        plannedHires: p.planned_hires,
        plannedAttrition: p.planned_attrition,
        plannedTransfersIn: p.planned_transfers_in,
        plannedTransfersOut: p.planned_transfers_out,
        plannedEndingHeadcount: p.planned_ending_headcount,
        actualHeadcount: p.actual_headcount,
        actualHires: p.actual_hires,
        actualAttrition: p.actual_attrition,
        headcountVariance: p.headcount_variance,
        hiresVariance: p.hires_variance,
        attritionVariance: p.attrition_variance,
        avgSalary: p.avg_salary,
        totalCompensationBudget: p.total_compensation_budget,
        notes: p.notes,
        lastSyncedAt: p.last_synced_at,
      }))
    },
    enabled: !!activePeriodId,
  })

  useEffect(() => {
    if (plansData) {
      setWorkforcePlans(plansData)
    }
  }, [plansData, setWorkforcePlans])

  // 3. Fetch Recruiter Goals for Current Year (linked to global filter)
  const { data: goalsData } = useQuery({
    queryKey: ['recruiter-goals', currentYear, filterObj],
    queryFn: async () => {
      const response = await api.get('/recruiter-goals', {
        params: { year: currentYear, ...filterObj }
      })
      return response.data.data
    },
  })

  useEffect(() => {
    if (goalsData) {
      setRecruiterGoals(goalsData)
    }
  }, [goalsData, setRecruiterGoals])

  // 4. Global Data Sync (Employees, Candidates, Requisitions)
  // Only syncs if the API is available; store data is preserved on failure.
  const { data: employeesData } = useQuery({
    queryKey: ['employees', filterObj],
    queryFn: async () => {
      const res = await api.get('/employees', { params: filterObj })
      return res.data.data ?? res.data.employees ?? res.data
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (employeesData) setEmployees(employeesData)
  }, [employeesData, setEmployees])

  const { data: candidatesData } = useQuery({
    queryKey: ['candidates', filterObj],
    queryFn: async () => {
      const res = await api.get('/candidates', { params: filterObj })
      return res.data.data ?? res.data.candidates ?? res.data
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (candidatesData) setCandidates(candidatesData)
  }, [candidatesData, setCandidates])

  const { data: requisitionsData } = useQuery({
    queryKey: ['requisitions', filterObj],
    queryFn: async () => {
      const res = await api.get('/requisitions', { params: filterObj })
      return res.data.data ?? res.data.requisitions ?? res.data
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (requisitionsData) setRequisitions(requisitionsData)
  }, [requisitionsData, setRequisitions])

  return { isLoading: !periodsData && !!activePeriodId }
}
