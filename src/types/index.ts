// Authentication Types

export interface User {
  id: string
  email: string
  name: string
  role: 'super_admin' | 'admin' | 'hr_manager' | 'analyst' | 'viewer'
  permissions?: string[]
  department?: string
  avatar?: string
  lastLogin?: string
  status?: 'active' | 'inactive' | 'pending'
  organizationId?: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

// Core HR Data Types

export interface Employee {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  department: string
  jobTitle: string
  hireDate: string
  terminationDate?: string
  status: 'active' | 'terminated' | 'on_leave'
  manager?: string
  location: string
  salary: number
  performanceRating?: number
  engagementScore?: number
  age?: number
  gender?: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say'
  ethnicity?: string
  tenure?: number
  flightRisk?: 'low' | 'medium' | 'high'
  lastPromotionDate?: string
  trainingHours?: number
}

export interface Candidate {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  appliedPosition: string
  department: string
  applicationDate: string
  source: string
  status: 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'
  stage: string
  recruiter?: string
  hiringManager?: string
  expectedSalary?: number
  offeredSalary?: number
  offerDate?: string
  startDate?: string
  rejectionReason?: string
}

export interface JobRequisition {
  id: string
  title: string
  department: string
  location: string
  status: 'open' | 'filled' | 'closed' | 'on_hold'
  openDate: string
  targetFillDate?: string
  filledDate?: string
  hiringManager: string
  recruiter?: string
  salary: { min: number; max: number }
  applicants: number
  urgency: 'low' | 'medium' | 'high' | 'critical'
}

// Metrics & Analytics Types

export interface HRMetrics {
  totalHeadcount: number
  activeEmployees: number
  terminatedEmployees: number
  newHires: number
  turnoverRate: number
  retentionRate: number
  avgTenure: number
  avgSalary: number
  avgAge: number
  engagementScore: number
  performanceAvg: number
  absenteeismRate: number
  trainingHoursAvg: number
  revenuePerEmployee: number
  hrToEmployeeRatio: number
}

export interface RecruitmentMetrics {
  openPositions: number
  totalApplications: number
  timeToHire: number
  timeToFill: number
  costPerHire: number
  qualityOfHire: number
  offerAcceptanceRate: number
  applicationCompletionRate: number
  sourceEffectiveness: Record<string, number>
  pipelineByStage: Record<string, number>
  interviewToOfferRatio: number
}

export interface RetentionMetrics {
  voluntaryTurnover: number
  involuntaryTurnover: number
  totalTurnover: number
  retentionRate: number
  avgTenure: number
  highPerformerTurnover: number
  firstYearTurnover: number
  turnoverByDepartment: Record<string, number>
  turnoverByTenure: Record<string, number>
  exitReasons: Record<string, number>
  flightRiskDistribution: { low: number; medium: number; high: number }
}

export interface DiversityMetrics {
  genderDistribution: Record<string, number>
  ethnicityDistribution: Record<string, number>
  ageDistribution: Record<string, number>
  genderPayGap: number
  leadershipDiversity: Record<string, number>
  hiringDiversity: Record<string, number>
  promotionDiversity: Record<string, number>
}

export interface WorkforceMetrics {
  currentHeadcount: number
  projectedHeadcount: number
  plannedHires: number
  plannedAttrition: number
  headcountByDepartment: Record<string, number>
  headcountByLocation: Record<string, number>
  skillsGap: SkillGap[]
  successionCoverage: number
  capacityUtilization: number
}

export interface SkillGap {
  skill: string
  required: number
  available: number
  gap: number
  criticality: 'low' | 'medium' | 'high'
}

// Chart Data Types

export interface TimeSeriesData {
  date: string
  value: number
  [key: string]: string | number
}

export interface PieChartData {
  name: string
  value: number
  color?: string
}

export interface BarChartData {
  name: string
  value: number
  [key: string]: string | number
}

// API & Data Management Types

export interface IntegrationCredentials {
  apiKey?: string
  clientId?: string
  clientSecret?: string
  subdomain?: string
  webhookUrl?: string
  username?: string
  certificate?: string
  [key: string]: string | undefined
}

export interface ApiConnection {
  id: string
  name: string
  type: 'hris' | 'ats' | 'payroll' | 'identity' | 'performance' | 'communication' | 'analytics' | 'lms' | 'benefits' | 'custom'
  provider: string
  status: 'connected' | 'disconnected' | 'error'
  lastSync?: string
  endpoint?: string
  apiKey?: string
}

export interface DataUpload {
  id: string
  filename: string
  type: 'csv' | 'xlsx'
  uploadDate: string
  status: 'processing' | 'completed' | 'error'
  recordCount?: number
  dataType: 'employees' | 'candidates' | 'requisitions' | 'custom'
  errors?: string[]
}

export interface DataCleaningRule {
  id: string
  name: string
  field: string
  rule: 'trim' | 'lowercase' | 'uppercase' | 'remove_nulls' | 'fill_nulls' | 'remove_duplicates' | 'format_date' | 'custom'
  params?: Record<string, unknown>
  enabled: boolean
}

// Dashboard & UI Types

export interface DashboardWidget {
  id: string
  type: 'metric' | 'chart' | 'table' | 'list'
  title: string
  size: 'small' | 'medium' | 'large'
  position: { x: number; y: number }
  config: Record<string, unknown>
}

export interface FilterState {
  dateRange: { start: string; end: string }
  datePreset: string
  departments: string[]
  locations: string[]
  jobTitles: string[]
  status: string[]
}

export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: string
  read: boolean
}

// ML Prediction Types

export interface AttritionPrediction {
  employeeId: string
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high'
  factors: AttritionFactor[]
  recommendations: string[]
}

export interface AttritionFactor {
  name: string
  impact: number
  direction: 'positive' | 'negative'
}

// 2Model Types

export interface OrgHealthAlert {
  id: string
  alertType: string
  severity: 'critical' | 'warning' | 'info'
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed'
  title: string
  description: string
  affectedOrgUnit: string
  affectedOrgUnitType: string
  metricName: string
  metricValue: number
  thresholdValue: number
  trendDirection: 'rising' | 'falling' | 'stable'
  trendPeriodDays: number
  contributingFactors: Array<{ factor: string; impact: number; direction: string }>
  recommendations: string[]
  createdAt: string
  acknowledgedBy?: string
  acknowledgedAt?: string
  resolvedBy?: string
  resolvedAt?: string
  resolutionNotes?: string
}

export interface HealthSummary {
  attrition: { current: number; previousPeriod: number; trend: string; benchmark: number }
  engagement: { current: number; previousPeriod: number; trend: string; benchmark: number }
  headcount: { current: number; hires: number; departures: number; transfers: number; netChange: number }
  hiringProgress: { openReqs: number; filled: number; onTrackPct: number; behindCount: number }
  capacityVsDemand: { capacity: number; demand: number; gap: number; gapPct: number }
  attendance: { avgDays: number; targetDays: number; compliancePct: number; byLocation: Record<string, number> }
  activeAlerts: OrgHealthAlert[]
}

export interface HealthTrend {
  date: string
  attritionRate: number
  engagementScore: number
  headcount: number
  hiringRate: number
  attendanceRate: number
}

export interface AIConversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount?: number
}

export interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sql?: string
  queryResult?: { columns: string[]; rows: Record<string, unknown>[]; rowCount: number }
  chartConfig?: ChartConfig
  context?: { benchmarks?: Record<string, unknown>; metricDefinition?: string; dataFreshness?: string }
  processingTimeMs?: number
  createdAt: string
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'area' | 'pie' | 'gauge'
  title?: string
  xKey?: string
  yKey?: string
  series?: Array<{ key: string; name: string; color: string }>
  data?: Record<string, unknown>[]
}

export interface KPIDefinition {
  id: string
  name: string
  description: string
  category: string
  metricKey: string
  unit: string
  calculationMethod: string
  displayFormat: string
  higherIsBetter: boolean
  isActive: boolean
  isSystem: boolean
  createdAt: string
}

export interface KPITarget {
  id: string
  kpiDefinitionId: string
  kpiName?: string
  orgUnit: string
  orgUnitType: string
  targetValue: number
  warningThreshold: number
  criticalThreshold: number
  effectiveFrom: string
  effectiveTo?: string
  status: 'draft' | 'pending_approval' | 'active' | 'expired' | 'superseded'
  version: number
  changeReason?: string
  proposedBy?: string
  approvedBy?: string
  approvedAt?: string
  createdAt: string
}

export interface KPIMeasurement {
  id: string
  kpiDefinitionId: string
  orgUnit: string
  orgUnitType: string
  measuredValue: number
  measurementDate: string
  periodType: string
  targetValue: number
  variance: number
  variancePct: number
  dataSource: string
}

export interface KPIDashboardItem {
  definition: KPIDefinition
  latestMeasurement?: KPIMeasurement
  target?: KPITarget
  trend: Array<{ date: string; value: number }>
  status: 'on_track' | 'warning' | 'critical' | 'no_target'
}

export interface AttendanceRecord {
  id: string
  employeeId: string
  recordDate: string
  status: 'in_office' | 'remote' | 'absent' | 'leave' | 'holiday'
  location?: string
  checkInTime?: string
  checkOutTime?: string
}

export interface AttendanceTarget {
  id: string
  orgUnit: string
  orgUnitType: string
  targetDaysPerWeek: number
  targetPct: number
  effectiveFrom: string
  effectiveTo?: string
}

export interface AttendanceSummary {
  overallCompliancePct: number
  avgDaysInOffice: number
  targetDaysPerWeek: number
  byDepartment: Array<{ name: string; compliancePct: number; avgDays: number; target: number }>
  byLocation: Array<{ name: string; compliancePct: number; avgDays: number; target: number }>
  trend: Array<{ week: string; compliancePct: number; avgDays: number }>
  nonCompliantUnits: Array<{ name: string; type: string; compliancePct: number; gap: number }>
}

export interface WarehouseConnection {
  id: string
  connectionType: 'redshift' | 'dbt' | 'fivetran'
  name: string
  status: 'connected' | 'disconnected' | 'error' | 'syncing'
  config: Record<string, unknown>
  lastTestedAt?: string
  lastSyncAt?: string
  lastError?: string
  createdAt: string
}

export interface DeepDiveAnalysis {
  alert?: OrgHealthAlert
  metric: string
  orgUnit?: string
  breakdowns: Record<string, Array<{ name: string; value: number; count: number }>>
  trend: Array<{ date: string; value: number }>
  contributingFactors: Array<{ factor: string; impact: number; direction: string; description: string }>
}

export interface ManagedUser {
  id: string
  email: string
  name: string
  role: 'super_admin' | 'admin' | 'hr_manager' | 'analyst' | 'viewer'
  department?: string
  status: 'active' | 'inactive' | 'pending'
  lastLogin?: string
  createdAt: string
}

export interface WorkforcePlan {
  id: string
  periodId: string
  department: string
  jobFamily?: string
  location?: string
  startingHeadcount: number
  plannedHires: number
  plannedAttrition: number
  plannedTransfersIn: number
  plannedTransfersOut: number
  plannedEndingHeadcount: number
  actualHeadcount?: number
  actualHires?: number
  actualAttrition?: number
  headcountVariance?: number
  hiresVariance?: number
  attritionVariance?: number
  avgSalary?: number
  totalCompensationBudget?: number
  notes?: string
  lastSyncedAt?: string
}

export interface RecruiterGoal {
  id: string
  name: string
  year: number
  q1_goal: number
  q2_goal: number
  q3_goal: number
  q4_goal: number
  monthly_capacity: number
  seniority?: string
  location?: string
  manager?: string
  q1_actual?: number
  q2_actual?: number
  q3_actual?: number
  q4_actual?: number
  is_active?: boolean
  employment_type?: string
  eligible_for_bonus?: boolean
  utilization_pct?: number
  overhead_pct?: number
  max_concurrent_reqs?: number
  specializations?: string
  annualGoal?: number
  annualActual?: number
  attainment?: number
}
