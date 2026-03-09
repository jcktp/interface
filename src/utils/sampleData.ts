import type { Employee, Candidate, JobRequisition } from '../types'
import { format, subDays, subMonths, addMonths, addDays, differenceInYears } from 'date-fns'

// ─── Seed randomness for reproducibility ─────────────────────────────────────
let seed = 42
function seededRandom() {
  seed = (seed * 9301 + 49297) % 233280
  return seed / 233280
}
function r() { return seededRandom() }
function randomInt(min: number, max: number) { return Math.floor(r() * (max - min + 1)) + min }
function randomFloat(min: number, max: number) { return r() * (max - min) + min }
function randomItem<T>(arr: T[]): T { return arr[Math.floor(r() * arr.length)] }
function weightedRandom<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0)
  let threshold = r() * total
  for (let i = 0; i < items.length; i++) {
    threshold -= weights[i]
    if (threshold <= 0) return items[i]
  }
  return items[items.length - 1]
}

// ─── Master data ──────────────────────────────────────────────────────────────

export const RECRUITER_NAMES = [
  'Sarah Johnson',
  'Mike Chen',
  'Emily Davis',
  'James Wilson',
  'Lisa Brown',
  'Rachel Torres',
  'David Kim',
  'Amanda Foster',
]

const LOCATIONS = ['New York', 'San Francisco', 'London', 'Berlin', 'Singapore', 'Austin', 'Chicago', 'Remote']
const LOCATION_WEIGHTS = [20, 18, 15, 10, 8, 8, 7, 14]

const DEPARTMENTS: Record<string, { weight: number; salaryBase: number; salarySpread: number }> = {
  Engineering:        { weight: 24, salaryBase: 110000, salarySpread: 80000 },
  Sales:              { weight: 20, salaryBase: 80000,  salarySpread: 70000 },
  'Customer Success': { weight: 14, salaryBase: 72000,  salarySpread: 45000 },
  Marketing:          { weight: 10, salaryBase: 82000,  salarySpread: 55000 },
  Product:            { weight: 9,  salaryBase: 115000, salarySpread: 70000 },
  Finance:            { weight: 7,  salaryBase: 90000,  salarySpread: 55000 },
  Operations:         { weight: 6,  salaryBase: 78000,  salarySpread: 45000 },
  HR:                 { weight: 5,  salaryBase: 76000,  salarySpread: 40000 },
  Design:             { weight: 5,  salaryBase: 88000,  salarySpread: 50000 },
}

const DEPT_ROLES: Record<string, { title: string; level: number; weight: number }[]> = {
  Engineering: [
    { title: 'Software Engineer I',          level: 1, weight: 15 },
    { title: 'Software Engineer II',         level: 2, weight: 20 },
    { title: 'Software Engineer III',        level: 3, weight: 18 },
    { title: 'Senior Software Engineer',     level: 4, weight: 17 },
    { title: 'Staff Software Engineer',      level: 5, weight: 8  },
    { title: 'Principal Engineer',           level: 6, weight: 4  },
    { title: 'Engineering Manager',          level: 5, weight: 10 },
    { title: 'Senior Engineering Manager',   level: 6, weight: 5  },
    { title: 'Director of Engineering',      level: 7, weight: 2  },
    { title: 'VP of Engineering',            level: 8, weight: 1  },
  ],
  Product: [
    { title: 'Associate Product Manager',    level: 1, weight: 12 },
    { title: 'Product Manager',              level: 3, weight: 28 },
    { title: 'Senior Product Manager',       level: 4, weight: 25 },
    { title: 'Group Product Manager',        level: 5, weight: 15 },
    { title: 'Director of Product',          level: 6, weight: 12 },
    { title: 'VP of Product',                level: 8, weight: 5  },
    { title: 'Chief Product Officer',        level: 9, weight: 3  },
  ],
  Design: [
    { title: 'Product Designer',             level: 2, weight: 25 },
    { title: 'Senior Product Designer',      level: 4, weight: 30 },
    { title: 'Lead Designer',                level: 5, weight: 20 },
    { title: 'UX Researcher',                level: 3, weight: 10 },
    { title: 'Design Manager',               level: 5, weight: 10 },
    { title: 'Director of Design',           level: 7, weight: 5  },
  ],
  Marketing: [
    { title: 'Marketing Coordinator',        level: 1, weight: 12 },
    { title: 'Marketing Manager',            level: 3, weight: 22 },
    { title: 'Senior Marketing Manager',     level: 4, weight: 18 },
    { title: 'Content Strategist',           level: 3, weight: 12 },
    { title: 'Growth Manager',               level: 4, weight: 12 },
    { title: 'Director of Marketing',        level: 6, weight: 12 },
    { title: 'VP of Marketing',              level: 8, weight: 8  },
    { title: 'CMO',                          level: 9, weight: 4  },
  ],
  Sales: [
    { title: 'Sales Development Rep',        level: 1, weight: 18 },
    { title: 'Account Executive',            level: 2, weight: 25 },
    { title: 'Senior Account Executive',     level: 3, weight: 20 },
    { title: 'Enterprise Account Executive', level: 4, weight: 12 },
    { title: 'Sales Manager',                level: 5, weight: 10 },
    { title: 'Director of Sales',            level: 6, weight: 8  },
    { title: 'VP of Sales',                  level: 8, weight: 5  },
    { title: 'Chief Revenue Officer',        level: 9, weight: 2  },
  ],
  'Customer Success': [
    { title: 'Customer Success Associate',   level: 1, weight: 20 },
    { title: 'Customer Success Manager',     level: 3, weight: 35 },
    { title: 'Senior CSM',                   level: 4, weight: 22 },
    { title: 'CS Team Lead',                 level: 5, weight: 12 },
    { title: 'Director of Customer Success', level: 6, weight: 8  },
    { title: 'VP of Customer Success',       level: 8, weight: 3  },
  ],
  HR: [
    { title: 'HR Coordinator',               level: 1, weight: 20 },
    { title: 'HR Business Partner',          level: 3, weight: 30 },
    { title: 'Senior HRBP',                  level: 4, weight: 20 },
    { title: 'Talent Acquisition Specialist',level: 3, weight: 15 },
    { title: 'HR Manager',                   level: 5, weight: 10 },
    { title: 'VP of People',                 level: 8, weight: 5  },
  ],
  Finance: [
    { title: 'Financial Analyst',            level: 2, weight: 25 },
    { title: 'Senior Financial Analyst',     level: 3, weight: 22 },
    { title: 'FP&A Manager',                 level: 5, weight: 15 },
    { title: 'Controller',                   level: 5, weight: 12 },
    { title: 'Finance Manager',              level: 5, weight: 12 },
    { title: 'Director of Finance',          level: 6, weight: 9  },
    { title: 'CFO',                          level: 9, weight: 5  },
  ],
  Operations: [
    { title: 'Operations Analyst',           level: 2, weight: 22 },
    { title: 'Operations Manager',           level: 4, weight: 30 },
    { title: 'Senior Operations Manager',    level: 5, weight: 20 },
    { title: 'Program Manager',              level: 4, weight: 15 },
    { title: 'Director of Operations',       level: 6, weight: 10 },
    { title: 'VP of Operations',             level: 8, weight: 3  },
  ],
}

const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Aisha', 'Wei', 'Priya', 'Mohammed', 'Yuki',
  'Carlos', 'Fatima', 'Andrei', 'Sofia', 'Raj', 'Emily', 'Daniel', 'Emma', 'Liam',
  'Olivia', 'Noah', 'Ava', 'Lucas', 'Isabella', 'Mason', 'Sophia', 'Ethan', 'Mia',
  'Alexander', 'Charlotte', 'Henry', 'Amelia', 'Owen', 'Harper', 'Sebastian', 'Evelyn',
  'Jack', 'Abigail', 'Carter', 'Madison', 'Leo', 'Victoria', 'Julian', 'Grace',
  'Lena', 'Marcus', 'Nina', 'Felix', 'Zara', 'Kieran', 'Nadia', 'Omar', 'Yuna',
  'Dmitri', 'Ines', 'Bruno', 'Fatou', 'Javier', 'Mei', 'Kwame', 'Hana',
  'Tariq', 'Valentina', 'Soren', 'Amara', 'Ivan', 'Leila', 'Tobias', 'Aigerim',
]
const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Patel', 'Kim', 'Chen',
  'Singh', 'Kumar', 'Yamamoto', 'Petrov', 'Muller', 'Santos', 'Nguyen', 'Tanaka',
  'Ibrahim', 'Okonkwo', 'Ivanova', 'Schmidt', 'Dubois', 'Rossi', 'Svensson', 'Park',
  'Okeke', 'Fernandez', 'Kaur', 'Hassan', 'Zhang', 'Kowalski', 'Osei', 'Eriksson',
  'Almeida', 'Nakamura', 'Popescu', 'Johansson', 'Ramirez', 'Abubakar', 'Lindgren',
]

const SOURCES = ['LinkedIn', 'Indeed', 'Employee Referral', 'Company Website', 'Glassdoor', 'Recruiting Agency', 'Job Fair', 'University Recruiting']
const SOURCE_WEIGHTS = [28, 20, 22, 10, 8, 7, 3, 2]

const ETHNICITIES = ['White', 'Asian', 'Hispanic/Latino', 'Black/African American', 'Two or more races', 'Prefer not to say', 'Other']
const ETHNICITY_WEIGHTS = [45, 20, 15, 10, 4, 4, 2]

// ─── Employee generator ────────────────────────────────────────────────────────

const managerIds: string[] = []
const NOW = new Date()

export function generateEmployees(count: number): Employee[] {
  seed = 42 // reset seed for deterministic output
  const employees: Employee[] = []
  const deptNames = Object.keys(DEPARTMENTS)
  const deptWeights = deptNames.map(d => DEPARTMENTS[d].weight)

  // Pre-generate a manager pool (first ~8% of records will be managers)
  const managerCount = Math.ceil(count * 0.08)

  for (let i = 0; i < count; i++) {
    const dept = weightedRandom(deptNames, deptWeights)
    const deptConfig = DEPARTMENTS[dept]
    const roles = DEPT_ROLES[dept] ?? DEPT_ROLES['Operations']
    const role = weightedRandom(roles, roles.map(r => r.weight))

    // Hire date: spread over 6 years
    const hireDaysAgo = randomInt(14, 2190)
    const hireDate = subDays(NOW, hireDaysAgo)

    // Termination: ~11% of workforce
    const isTerminated = r() < 0.11
    const terminationDate = isTerminated
      ? subDays(NOW, randomInt(7, Math.min(hireDaysAgo - 30, 730)))
      : undefined

    const isOnLeave = !isTerminated && r() < 0.03
    const status: Employee['status'] = isTerminated ? 'terminated' : isOnLeave ? 'on_leave' : 'active'

    const tenure = differenceInYears(terminationDate ?? NOW, hireDate)

    // Salary: level-based with spread
    const levelFactor = role.level / 9
    const salary = Math.round(
      deptConfig.salaryBase + levelFactor * deptConfig.salarySpread + (r() - 0.5) * 15000
    )

    // Performance: normally distributed, correlated with level
    const basePerfRating = 3.0 + levelFactor * 1.2 + (r() - 0.5) * 1.5
    const performanceRating = Math.max(1, Math.min(5, Math.round(basePerfRating * 10) / 10))

    // Engagement: correlated with performance but noisier
    const engagementScore = Math.max(1, Math.min(5, Math.round((performanceRating * 0.7 + r() * 2 + 0.5) * 10) / 10))

    // Flight risk
    let riskScore = 0
    if (tenure < 1) riskScore += 20
    if (tenure > 3 && tenure < 5) riskScore += 10
    if (performanceRating < 2.8) riskScore += 30
    if (performanceRating > 4.5 && engagementScore < 3.5) riskScore += 15 // High performer but disengaged
    if (engagementScore < 3) riskScore += 20
    riskScore += randomInt(0, 25)
    const flightRisk: Employee['flightRisk'] = riskScore > 60 ? 'high' : riskScore > 35 ? 'medium' : 'low'

    // Demographics
    const age = randomInt(22, 58)
    const gender = weightedRandom(
      ['male', 'female', 'non_binary', 'prefer_not_to_say'] as const,
      [46, 46, 4, 4]
    )
    const ethnicity = weightedRandom(ETHNICITIES, ETHNICITY_WEIGHTS)
    const location = weightedRandom(LOCATIONS, LOCATION_WEIGHTS)

    // Manager assignment
    let manager: string | undefined = undefined
    if (i >= managerCount && managerIds.length > 0) {
      manager = randomItem(managerIds)
    }

    const empId = `EMP${String(i + 1).padStart(6, '0')}`

    // Store first batch as managers
    if (i < managerCount) {
      managerIds.push(empId)
    }

    employees.push({
      id: `emp-${i + 1}`,
      employeeId: empId,
      firstName: randomItem(FIRST_NAMES),
      lastName: randomItem(LAST_NAMES),
      email: `${empId.toLowerCase()}@acme-corp.com`,
      department: dept,
      jobTitle: role.title,
      hireDate: format(hireDate, 'yyyy-MM-dd'),
      terminationDate: terminationDate ? format(terminationDate, 'yyyy-MM-dd') : undefined,
      status,
      manager,
      location,
      salary,
      performanceRating,
      engagementScore,
      age,
      gender,
      ethnicity,
      tenure,
      flightRisk,
      lastPromotionDate: r() > 0.4 ? format(subDays(NOW, randomInt(90, 900)), 'yyyy-MM-dd') : undefined,
      trainingHours: randomInt(0, 120),
    })
  }

  return employees
}

// ─── Candidate generator ───────────────────────────────────────────────────────

export function generateCandidates(count: number): Candidate[] {
  seed = 137 // different seed
  const candidates: Candidate[] = []
  const deptNames = Object.keys(DEPARTMENTS)
  const deptWeights = deptNames.map(d => DEPARTMENTS[d].weight)

  const FUNNEL_STAGES: Array<{ status: Candidate['status']; stage: string; weight: number }> = [
    { status: 'new',       stage: 'Applied',              weight: 20 },
    { status: 'screening', stage: 'Recruiter Screen',     weight: 18 },
    { status: 'interview', stage: 'Hiring Manager Screen',weight: 16 },
    { status: 'interview', stage: 'Technical Round',      weight: 14 },
    { status: 'interview', stage: 'Panel Interview',      weight: 10 },
    { status: 'interview', stage: 'Final Round',          weight: 8  },
    { status: 'offer',     stage: 'Offer Extended',       weight: 5  },
    { status: 'hired',     stage: 'Hired',                weight: 4  },
    { status: 'rejected',  stage: 'Rejected',             weight: 5  },
  ]

  const REJECTION_REASONS = [
    'Skills mismatch',
    'Failed technical assessment',
    'Candidate withdrew',
    'Better internal candidate',
    'Salary expectations too high',
    'Culture fit concerns',
    'Offer declined',
    'Background check failed',
  ]

  for (let i = 0; i < count; i++) {
    const dept = weightedRandom(deptNames, deptWeights)
    const roles = DEPT_ROLES[dept] ?? DEPT_ROLES['Operations']
    const role = weightedRandom(roles, roles.map(r => r.weight))
    const funnelEntry = weightedRandom(FUNNEL_STAGES, FUNNEL_STAGES.map(s => s.weight))
    const appDaysAgo = randomInt(1, 120)
    const applicationDate = subDays(NOW, appDaysAgo)
    const source = weightedRandom(SOURCES, SOURCE_WEIGHTS)
    const recruiter = randomItem(RECRUITER_NAMES)
    const deptConfig = DEPARTMENTS[dept]
    const levelFactor = role.level / 9
    const expectedSalary = Math.round(deptConfig.salaryBase + levelFactor * deptConfig.salarySpread)

    candidates.push({
      id: `cand-${i + 1}`,
      firstName: randomItem(FIRST_NAMES),
      lastName: randomItem(LAST_NAMES),
      email: `candidate${i + 1}@jobseeker.com`,
      phone: `+1-${randomInt(200, 999)}-${randomInt(100, 999)}-${randomInt(1000, 9999)}`,
      appliedPosition: role.title,
      department: dept,
      applicationDate: format(applicationDate, 'yyyy-MM-dd'),
      source,
      status: funnelEntry.status,
      stage: funnelEntry.stage,
      recruiter,
      hiringManager: `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`,
      expectedSalary,
      offeredSalary: (funnelEntry.status === 'offer' || funnelEntry.status === 'hired')
        ? Math.round(expectedSalary * (0.95 + r() * 0.15))
        : undefined,
      offerDate: (funnelEntry.status === 'offer' || funnelEntry.status === 'hired')
        ? format(subDays(NOW, randomInt(1, appDaysAgo - 1)), 'yyyy-MM-dd')
        : undefined,
      startDate: funnelEntry.status === 'hired'
        ? format(addDays(NOW, randomInt(7, 45)), 'yyyy-MM-dd')
        : undefined,
      rejectionReason: funnelEntry.status === 'rejected'
        ? randomItem(REJECTION_REASONS)
        : undefined,
    })
  }

  return candidates
}

// ─── Requisition generator ─────────────────────────────────────────────────────

export function generateRequisitions(count: number): JobRequisition[] {
  seed = 256 // different seed
  const requisitions: JobRequisition[] = []
  const deptNames = Object.keys(DEPARTMENTS)
  const deptWeights = deptNames.map(d => DEPARTMENTS[d].weight)

  const STATUS_WEIGHTS: Array<{ status: JobRequisition['status']; weight: number }> = [
    { status: 'open',    weight: 45 },
    { status: 'filled',  weight: 30 },
    { status: 'on_hold', weight: 15 },
    { status: 'closed',  weight: 10 },
  ]

  for (let i = 0; i < count; i++) {
    const dept = weightedRandom(deptNames, deptWeights)
    const roles = DEPT_ROLES[dept] ?? DEPT_ROLES['Operations']
    const role = weightedRandom(roles, roles.map(r => r.weight))
    const deptConfig = DEPARTMENTS[dept]
    const levelFactor = role.level / 9
    const minSalary = Math.round(deptConfig.salaryBase + levelFactor * deptConfig.salarySpread * 0.8)
    const maxSalary = Math.round(minSalary * (1.15 + r() * 0.2))
    const statusEntry = weightedRandom(STATUS_WEIGHTS, STATUS_WEIGHTS.map(s => s.weight))
    const openDaysAgo = randomInt(5, 150)
    const openDate = subDays(NOW, openDaysAgo)
    const location = weightedRandom(LOCATIONS, LOCATION_WEIGHTS)

    requisitions.push({
      id: `req-${i + 1}`,
      title: role.title,
      department: dept,
      location,
      status: statusEntry.status,
      openDate: format(openDate, 'yyyy-MM-dd'),
      targetFillDate: format(addDays(openDate, randomInt(30, 75)), 'yyyy-MM-dd'),
      filledDate: statusEntry.status === 'filled'
        ? format(subDays(NOW, randomInt(1, openDaysAgo - 5)), 'yyyy-MM-dd')
        : undefined,
      hiringManager: `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`,
      recruiter: randomItem(RECRUITER_NAMES),
      salary: { min: minSalary, max: maxSalary },
      applicants: randomInt(3, 180),
      urgency: weightedRandom(
        ['low', 'medium', 'high', 'critical'] as const,
        [20, 40, 30, 10]
      ),
    })
  }

  return requisitions
}

// ─── Time series helpers ───────────────────────────────────────────────────────

export function generateHeadcountTimeSeries(months: number = 24) {
  seed = 512
  const data = []
  let headcount = 4200
  const now = new Date()

  for (let i = months - 1; i >= 0; i--) {
    const date = subMonths(now, i)
    const hires = randomInt(30, 90)
    const terminations = randomInt(15, 55)
    headcount = headcount + hires - terminations

    data.push({
      date: format(date, 'MMM yyyy'),
      month: format(date, 'yyyy-MM'),
      headcount,
      hires,
      terminations,
      netChange: hires - terminations,
    })
  }

  return data
}

export function generateHeadcountForecast(historicalData: ReturnType<typeof generateHeadcountTimeSeries>) {
  seed = 613
  const lastHeadcount = historicalData[historicalData.length - 1].headcount
  const avgGrowthRate = 0.015
  const forecast = []
  let projected = lastHeadcount

  for (let i = 1; i <= 12; i++) {
    const date = addMonths(new Date(), i)
    projected = Math.round(projected * (1 + avgGrowthRate + (r() - 0.5) * 0.008))

    forecast.push({
      date: format(date, 'MMM yyyy'),
      month: format(date, 'yyyy-MM'),
      headcount: null,
      forecast: projected,
      upperBound: Math.round(projected * 1.08),
      lowerBound: Math.round(projected * 0.92),
    })
  }

  return [
    ...historicalData.map(d => ({ ...d, forecast: null, upperBound: null, lowerBound: null })),
    ...forecast,
  ]
}

export function generateTurnoverTimeSeries(months: number = 24) {
  seed = 714
  const data = []
  const now = new Date()

  for (let i = months - 1; i >= 0; i--) {
    const date = subMonths(now, i)
    const voluntary = randomFloat(0.9, 2.0)
    const involuntary = randomFloat(0.2, 0.7)

    data.push({
      date: format(date, 'MMM yyyy'),
      month: format(date, 'yyyy-MM'),
      voluntary: Math.round(voluntary * 10) / 10,
      involuntary: Math.round(involuntary * 10) / 10,
      total: Math.round((voluntary + involuntary) * 10) / 10,
    })
  }

  return data
}

export function generateAttritionForecast(historicalData: ReturnType<typeof generateTurnoverTimeSeries>) {
  seed = 815
  const forecast = []
  const recentAvg = historicalData.slice(-6).reduce((sum, d) => sum + d.total, 0) / 6

  for (let i = 1; i <= 12; i++) {
    const date = addMonths(new Date(), i)
    const seasonalFactor = Math.sin((i / 12) * Math.PI) * 0.25
    const predicted = recentAvg + seasonalFactor + (r() - 0.5) * 0.35

    forecast.push({
      date: format(date, 'MMM yyyy'),
      month: format(date, 'yyyy-MM'),
      actual: null,
      forecast: Math.max(0.5, Math.round(predicted * 10) / 10),
      upperBound: Math.round((predicted + 0.7) * 10) / 10,
      lowerBound: Math.max(0, Math.round((predicted - 0.7) * 10) / 10),
    })
  }

  return [
    ...historicalData.map(d => ({
      date: d.date,
      month: d.month,
      actual: d.total,
      forecast: null,
      upperBound: null,
      lowerBound: null,
    })),
    ...forecast,
  ]
}

export function generateRecruiterCapacity() {
  return RECRUITER_NAMES.slice(0, 5).map((name) => ({
    recruiter: name,
    openReqs: randomInt(6, 16),
    avgTimeToFill: randomInt(22, 38),
    hiredThisMonth: randomInt(2, 7),
    capacity: randomInt(10, 16),
    utilization: randomInt(60, 100),
  }))
}

export function generateSourceEffectiveness() {
  return [
    { source: 'LinkedIn',         applications: 820,  interviewed: 210, hired: 52, costPerHire: 4200,  qualityScore: 4.2 },
    { source: 'Employee Referral',applications: 340,  interviewed: 160, hired: 68, costPerHire: 2100,  qualityScore: 4.7 },
    { source: 'Indeed',           applications: 1150, interviewed: 180, hired: 38, costPerHire: 3500,  qualityScore: 3.8 },
    { source: 'Company Website',  applications: 520,  interviewed: 130, hired: 30, costPerHire: 1500,  qualityScore: 4.0 },
    { source: 'Glassdoor',        applications: 380,  interviewed: 85,  hired: 22, costPerHire: 4800,  qualityScore: 3.6 },
    { source: 'Recruiting Agency',applications: 160,  interviewed: 75,  hired: 24, costPerHire: 14000, qualityScore: 4.4 },
    { source: 'University',       applications: 240,  interviewed: 60,  hired: 18, costPerHire: 3200,  qualityScore: 4.1 },
  ]
}

export function generateDepartmentMetrics() {
  seed = 912
  return Object.entries(DEPARTMENTS).map(([dept, cfg]) => ({
    department: dept,
    headcount: Math.round(cfg.weight * 50 + randomInt(-20, 20)),
    openPositions: randomInt(2, 18),
    turnoverRate: Math.round(randomFloat(5, 17) * 10) / 10,
    avgTenure: Math.round(randomFloat(1.5, 4.5) * 10) / 10,
    engagementScore: Math.round(randomFloat(3.2, 4.8) * 10) / 10,
    avgSalary: Math.round(cfg.salaryBase + cfg.salarySpread * 0.45 + randomInt(-5000, 5000)),
  }))
}

export function generateFlightRiskEmployees() {
  seed = 1024
  return generateEmployees(40)
    .filter(e => e.status === 'active')
    .map(e => ({
      ...e,
      riskScore: e.flightRisk === 'high' ? randomInt(70, 95) : e.flightRisk === 'medium' ? randomInt(40, 69) : randomInt(10, 39),
      riskFactors: [
        e.tenure !== undefined && e.tenure < 1 ? 'Short tenure' : null,
        e.performanceRating !== undefined && e.performanceRating > 4.5 && (e.engagementScore ?? 5) < 3.5 ? 'High performer — disengaged' : null,
        e.performanceRating !== undefined && e.performanceRating < 2.8 ? 'Below target performance' : null,
        e.engagementScore !== undefined && e.engagementScore < 3 ? 'Low engagement score' : null,
        r() > 0.65 ? 'No recent promotion' : null,
        r() > 0.80 ? 'Recent manager change' : null,
        r() > 0.85 ? 'Below-market compensation' : null,
      ].filter(Boolean) as string[],
    }))
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 20)
}

// ─── Attendance simulation ─────────────────────────────────────────────────────

export interface AttendanceWeekData {
  week: string
  compliancePct: number
  avgDays: number
  inOffice: number
  remote: number
  absent: number
}

export function generateAttendanceTrends(weeks: number = 26): AttendanceWeekData[] {
  seed = 2048
  const data: AttendanceWeekData[] = []
  const now = new Date()

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = subDays(now, i * 7 + 3)
    const compliancePct = Math.max(55, Math.min(96, 76 + (r() - 0.5) * 22 + (weeks - i) * 0.3))
    const avgDays = Math.max(1.8, Math.min(4.8, compliancePct / 100 * 3.5 + (r() - 0.5) * 0.5))

    data.push({
      week: format(weekStart, 'MMM d'),
      compliancePct: Math.round(compliancePct * 10) / 10,
      avgDays: Math.round(avgDays * 10) / 10,
      inOffice: Math.round(compliancePct * 0.7 + r() * 5),
      remote: Math.round((100 - compliancePct) * 0.6 + r() * 5),
      absent: Math.round((100 - compliancePct) * 0.4 + r() * 3),
    })
  }
  return data
}

export interface PerformanceSnapshot {
  year: number
  q: 1 | 2 | 3 | 4
  avgRating: number
  distribution: { rating: number; count: number; pct: number }[]
}

export function generatePerformanceHistory(years: number = 3): PerformanceSnapshot[] {
  seed = 4096
  const snapshots: PerformanceSnapshot[] = []
  const currentYear = new Date().getFullYear()

  for (let y = currentYear - years + 1; y <= currentYear; y++) {
    for (let q = 1; q <= 4; q++) {
      if (y === currentYear && q > Math.ceil((new Date().getMonth() + 1) / 3)) break

      const avgRating = 3.3 + (r() - 0.5) * 0.4 + (y - (currentYear - years + 1)) * 0.05
      const buckets = [1, 2, 3, 4, 5]
      const rawCounts = buckets.map(b => {
        const diff = Math.abs(b - avgRating)
        return Math.max(1, Math.round(100 * Math.exp(-diff * 1.5) + r() * 10))
      })
      const total = rawCounts.reduce((a, b) => a + b, 0)

      snapshots.push({
        year: y,
        q: q as 1 | 2 | 3 | 4,
        avgRating: Math.round(avgRating * 100) / 100,
        distribution: buckets.map((b, i) => ({
          rating: b,
          count: rawCounts[i],
          pct: Math.round((rawCounts[i] / total) * 100),
        })),
      })
    }
  }
  return snapshots
}
