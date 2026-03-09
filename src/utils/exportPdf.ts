/**
 * PDF Export Utility for Interface
 * Uses jsPDF with autotable plugin for professional PDF generation
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Employee, Candidate, HRMetrics, RecruitmentMetrics, RetentionMetrics } from '../types'
import { formatCurrency, formatDate, type CurrencyCode, type DateFormat } from './localization'

interface ExportOptions {
  title?: string
  subtitle?: string
  currency?: CurrencyCode
  dateFormat?: DateFormat
  includeTimestamp?: boolean
  companyName?: string
}

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable
    lastAutoTable: { finalY: number }
  }
}

/**
 * Add header to PDF document
 */
function addHeader(doc: jsPDF, title: string, subtitle?: string, companyName?: string) {
  const pageWidth = doc.internal.pageSize.getWidth()

  // Logo placeholder (black square with HR text)
  doc.setFillColor(0, 0, 0)
  doc.rect(14, 10, 20, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('IF', 19, 22)

  // Title
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 40, 18)

  // Subtitle
  if (subtitle) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(subtitle, 40, 26)
  }

  // Company name and date on right
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  if (companyName) {
    doc.text(companyName, pageWidth - 14, 15, { align: 'right' })
  }
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 22, { align: 'right' })

  // Divider line
  doc.setDrawColor(200, 200, 200)
  doc.line(14, 35, pageWidth - 14, 35)

  return 40 // Return Y position after header
}

/**
 * Add footer to PDF document
 */
function addFooter(doc: jsPDF, pageNumber: number, totalPages: number) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text('Interface', 14, pageHeight - 10)
  doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - 14, pageHeight - 10, { align: 'right' })
}

/**
 * Export employee list to PDF
 */
export function exportEmployeesToPdf(
  employees: Employee[],
  options: ExportOptions = {}
): void {
  const doc = new jsPDF()
  const { title = 'Employee Report', subtitle, currency = 'EUR', companyName } = options

  let yPos = addHeader(doc, title, subtitle || `${employees.length} employees`, companyName)

  // Summary stats
  const activeCount = employees.filter(e => e.status === 'active').length
  const avgSalary = employees.reduce((sum, e) => sum + (e.salary || 0), 0) / employees.length
  const departments = [...new Set(employees.map(e => e.department))].length

  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.text('Summary', 14, yPos)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  yPos += 6
  doc.text(`Active Employees: ${activeCount}`, 14, yPos)
  doc.text(`Departments: ${departments}`, 70, yPos)
  doc.text(`Avg Salary: ${formatCurrency(avgSalary, currency)}`, 120, yPos)

  yPos += 10

  // Employee table
  const tableData = employees.map(emp => [
    emp.employeeId || emp.id,
    `${emp.firstName} ${emp.lastName}`,
    emp.department,
    emp.jobTitle,
    emp.status,
    formatCurrency(emp.salary, currency),
    emp.hireDate ? formatDate(emp.hireDate) : 'N/A',
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['ID', 'Name', 'Department', 'Job Title', 'Status', 'Salary', 'Hire Date']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [0, 0, 0],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { left: 14, right: 14 },
  })

  // Add page numbers
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    addFooter(doc, i, totalPages)
  }

  doc.save(`employees-${new Date().toISOString().split('T')[0]}.pdf`)
}

/**
 * Export dashboard metrics to PDF
 */
export function exportDashboardToPdf(
  metrics: {
    hr?: Partial<HRMetrics>
    recruitment?: Partial<RecruitmentMetrics>
    retention?: Partial<RetentionMetrics>
  },
  options: ExportOptions = {}
): void {
  const doc = new jsPDF()
  const { title = 'HR Dashboard Report', companyName, currency = 'EUR' } = options

  let yPos = addHeader(doc, title, 'Executive Summary', companyName)

  // Workforce Metrics Section
  if (metrics.hr) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('Workforce Metrics', 14, yPos)
    yPos += 8

    const hrData = [
      ['Total Headcount', metrics.hr.totalHeadcount?.toLocaleString() || 'N/A'],
      ['Active Employees', metrics.hr.activeEmployees?.toLocaleString() || 'N/A'],
      ['New Hires (90 days)', metrics.hr.newHires?.toLocaleString() || 'N/A'],
      ['Average Tenure', metrics.hr.avgTenure ? `${metrics.hr.avgTenure.toFixed(1)} years` : 'N/A'],
      ['Average Salary', metrics.hr.avgSalary ? formatCurrency(metrics.hr.avgSalary, currency) : 'N/A'],
      ['Engagement Score', metrics.hr.engagementScore ? `${metrics.hr.engagementScore.toFixed(1)}/5` : 'N/A'],
    ]

    autoTable(doc, {
      startY: yPos,
      body: hrData,
      theme: 'plain',
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { cellWidth: 50 },
      },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14 },
    })

    yPos = doc.lastAutoTable.finalY + 10
  }

  // Retention Metrics Section
  if (metrics.retention) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Retention & Attrition', 14, yPos)
    yPos += 8

    const retentionData = [
      ['Voluntary Turnover', metrics.retention.voluntaryTurnover ? `${metrics.retention.voluntaryTurnover.toFixed(1)}%` : 'N/A'],
      ['Involuntary Turnover', metrics.retention.involuntaryTurnover ? `${metrics.retention.involuntaryTurnover.toFixed(1)}%` : 'N/A'],
      ['Retention Rate', metrics.retention.retentionRate ? `${metrics.retention.retentionRate.toFixed(1)}%` : 'N/A'],
      ['First Year Turnover', metrics.retention.firstYearTurnover ? `${metrics.retention.firstYearTurnover.toFixed(1)}%` : 'N/A'],
    ]

    autoTable(doc, {
      startY: yPos,
      body: retentionData,
      theme: 'plain',
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { cellWidth: 50 },
      },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14 },
    })

    yPos = doc.lastAutoTable.finalY + 10
  }

  // Recruitment Metrics Section
  if (metrics.recruitment) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Recruitment Analytics', 14, yPos)
    yPos += 8

    const recruitmentData = [
      ['Open Positions', metrics.recruitment.openPositions?.toLocaleString() || 'N/A'],
      ['Time to Hire', metrics.recruitment.timeToHire ? `${metrics.recruitment.timeToHire} days` : 'N/A'],
      ['Cost per Hire', metrics.recruitment.costPerHire ? formatCurrency(metrics.recruitment.costPerHire, currency) : 'N/A'],
      ['Offer Acceptance Rate', metrics.recruitment.offerAcceptanceRate ? `${metrics.recruitment.offerAcceptanceRate.toFixed(1)}%` : 'N/A'],
      ['Quality of Hire', metrics.recruitment.qualityOfHire ? `${metrics.recruitment.qualityOfHire.toFixed(1)}/5` : 'N/A'],
    ]

    autoTable(doc, {
      startY: yPos,
      body: recruitmentData,
      theme: 'plain',
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { cellWidth: 50 },
      },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14 },
    })
  }

  // Add page numbers
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    addFooter(doc, i, totalPages)
  }

  doc.save(`dashboard-report-${new Date().toISOString().split('T')[0]}.pdf`)
}

/**
 * Export candidates/recruitment pipeline to PDF
 */
export function exportCandidatesToPdf(
  candidates: Candidate[],
  options: ExportOptions = {}
): void {
  const doc = new jsPDF('landscape')
  const { title = 'Recruitment Pipeline Report', companyName } = options

  let yPos = addHeader(doc, title, `${candidates.length} candidates`, companyName)

  // Pipeline summary by stage
  const stages = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected']
  const stageCounts = stages.map(stage => ({
    stage: stage.charAt(0).toUpperCase() + stage.slice(1),
    count: candidates.filter(c => c.status === stage).length,
  }))

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Pipeline Summary', 14, yPos)
  yPos += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  let xPos = 14
  stageCounts.forEach(({ stage, count }) => {
    doc.text(`${stage}: ${count}`, xPos, yPos)
    xPos += 40
  })

  yPos += 10

  // Candidates table
  const tableData = candidates.map(c => [
    `${c.firstName} ${c.lastName}`,
    c.appliedPosition,
    c.department,
    c.source,
    c.status.toUpperCase(),
    c.applicationDate ? formatDate(c.applicationDate) : 'N/A',
    c.recruiter || 'Unassigned',
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['Candidate', 'Position', 'Department', 'Source', 'Status', 'Applied', 'Recruiter']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [0, 0, 0],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
    },
    margin: { left: 14, right: 14 },
  })

  // Add page numbers
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    addFooter(doc, i, totalPages)
  }

  doc.save(`recruitment-pipeline-${new Date().toISOString().split('T')[0]}.pdf`)
}

/**
 * Export scenario planning results to PDF
 */
export function exportScenarioToPdf(
  scenarios: Array<{
    name: string
    type: string
    headcountChange: number
    projectedRevenue: number
    projectedProfit: number
    roi: number
    totalImpact: number
  }>,
  companyMetrics: {
    annualRevenue: number
    annualProfit: number
    currentHeadcount: number
  },
  options: ExportOptions = {}
): void {
  const doc = new jsPDF()
  const { title = 'Scenario Planning Report', companyName, currency = 'EUR' } = options

  let yPos = addHeader(doc, title, 'Workforce Planning Analysis', companyName)

  // Current State
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Current State', 14, yPos)
  yPos += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Current Headcount: ${companyMetrics.currentHeadcount.toLocaleString()}`, 14, yPos)
  doc.text(`Annual Revenue: ${formatCurrency(companyMetrics.annualRevenue, currency)}`, 80, yPos)
  doc.text(`Annual Profit: ${formatCurrency(companyMetrics.annualProfit, currency)}`, 160, yPos)

  yPos += 15

  // Scenario Comparison Table
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Scenario Comparison', 14, yPos)
  yPos += 8

  const tableData = scenarios.map(s => [
    s.name,
    s.type,
    s.headcountChange >= 0 ? `+${s.headcountChange}` : s.headcountChange.toString(),
    formatCurrency(s.projectedRevenue, currency),
    formatCurrency(s.projectedProfit, currency),
    `${s.roi.toFixed(1)}%`,
    formatCurrency(s.totalImpact, currency),
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['Scenario', 'Type', 'HC Change', 'Revenue', 'Profit', 'ROI', 'Net Impact']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [0, 0, 0],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
    },
    margin: { left: 14, right: 14 },
  })

  // Add page numbers
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    addFooter(doc, i, totalPages)
  }

  doc.save(`scenario-planning-${new Date().toISOString().split('T')[0]}.pdf`)
}

/**
 * Export diversity report to PDF
 */
export function exportDiversityToPdf(
  data: {
    genderDistribution: Record<string, number>
    ethnicityDistribution: Record<string, number>
    ageDistribution: Record<string, number>
    payGap?: number
  },
  options: ExportOptions = {}
): void {
  const doc = new jsPDF()
  const { title = 'Diversity & Inclusion Report', companyName } = options

  let yPos = addHeader(doc, title, 'DEI Analytics', companyName)

  // Gender Distribution
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Gender Distribution', 14, yPos)
  yPos += 8

  const genderData = Object.entries(data.genderDistribution).map(([k, v]) => [
    k.charAt(0).toUpperCase() + k.slice(1).replace('_', ' '),
    `${v}%`,
  ])

  autoTable(doc, {
    startY: yPos,
    body: genderData,
    theme: 'plain',
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
      1: { cellWidth: 30 },
    },
    bodyStyles: { fontSize: 9 },
    margin: { left: 14 },
  })

  yPos = doc.lastAutoTable.finalY + 10

  // Ethnicity Distribution
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Ethnicity Distribution', 14, yPos)
  yPos += 8

  const ethnicityData = Object.entries(data.ethnicityDistribution).map(([k, v]) => [k, `${v}%`])

  autoTable(doc, {
    startY: yPos,
    body: ethnicityData,
    theme: 'plain',
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
      1: { cellWidth: 30 },
    },
    bodyStyles: { fontSize: 9 },
    margin: { left: 14 },
  })

  yPos = doc.lastAutoTable.finalY + 10

  // Pay Gap
  if (data.payGap !== undefined) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Pay Equity', 14, yPos)
    yPos += 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Gender Pay Gap: ${data.payGap.toFixed(1)}%`, 14, yPos)
  }

  // Add page numbers
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    addFooter(doc, i, totalPages)
  }

  doc.save(`diversity-report-${new Date().toISOString().split('T')[0]}.pdf`)
}

/**
 * Generic table export to PDF
 */
export function exportTableToPdf(
  title: string,
  headers: string[],
  data: (string | number)[][],
  options: ExportOptions = {}
): void {
  const doc = new jsPDF(headers.length > 6 ? 'landscape' : 'portrait')
  const { subtitle, companyName } = options

  const yPos = addHeader(doc, title, subtitle || `${data.length} records`, companyName)

  autoTable(doc, {
    startY: yPos,
    head: [headers],
    body: data,
    theme: 'striped',
    headStyles: {
      fillColor: [0, 0, 0],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
    },
    margin: { left: 14, right: 14 },
  })

  // Add page numbers
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    addFooter(doc, i, totalPages)
  }

  const filename = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  doc.save(`${filename}-${new Date().toISOString().split('T')[0]}.pdf`)
}
