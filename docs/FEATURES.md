# Feature Guide

## Navigation Overview

The app is organized into these sections (visible in the sidebar):

| Section | Pages |
|---------|-------|
| **Intelligence** | Command Center, AI Chat, Deep Dive |
| **Analytics** | Dashboard, My Dashboards, Workforce Planning, Recruitment, Retention, Diversity, Performance, Attendance, Compensation, Scenarios |
| **Intelligence** | KPIs, Benchmarks |
| **Data** | SQL Editor, Data & Integrations, API Docs |
| **Admin** | User Management, SSO Settings, Slack Settings |
| **Modeling** | Prediction Modeling |
| **Metrics** | Metric Definitions |

---

## Command Center (`/app/command-center`)

Real-time organizational health dashboard.

- **Health Score Cards**: Headcount, attrition rate, avg engagement, avg performance, open requisitions, attendance rate
- **Trend Charts**: 6-month headcount and attrition trends
- **Alerts**: Active org health alerts with acknowledge/resolve actions
- **Anomaly Detection**: Trigger alert detection manually

Data comes from live DB queries. Attendance rate is computed over the last 30 days.

---

## Dashboard (`/app/dashboard`)

Executive summary metrics with global filters.

**Metric cards**: Total employees, active/terminated/on-leave, avg salary, total payroll, avg engagement, avg performance

**Charts**: Headcount by department (bar chart), Salary distribution by department

**Global filters** (top bar): Date range, departments, locations, status — all metrics respond to these filters.

---

## My Dashboards (`/app/dashboards`)

Build custom dashboards with drag-and-drop widgets.

**Widget types**:
- Metric Card — single number from DB or manual
- Bar/Line/Area/Pie/Gauge Charts — linked to data queries
- Table — tabular data view
- SQL Query — execute saved query and show results

Dashboards can be shared, duplicated, and exported.

---

## Prediction Modeling (`/app/ml-models`)

Full ML model lifecycle for workforce predictions.

**Creating a model**: Click "Create Model", choose type + algorithm.

**Model types**:
- `attrition` — Employee flight risk prediction
- `headcount_forecast` — 12-month headcount projection
- `performance` — Performance score prediction
- `salary_prediction` — Expected salary predictor
- `cost_forecast` — Workforce cost projection

**Training**: Click "Train Model" — training runs synchronously with simulated metrics based on actual employee data.

**Predictions tab**: After training, run predictions to see:
- Attrition models: Per-employee risk table sorted by score (High/Medium/Low)
- Forecast models: 12-month table with bounds and projected cost

**Insights panel** (top): Shows active model per type + current high-risk count.

---

## SQL Query Editor (`/app/query-editor`)

Execute read-only SELECT queries against HR data.

**Allowed tables**: `employees`, `candidates`, `job_requisitions`, `departments`, `locations`, `planning_periods`, `workforce_plans`, `compensation_plans`

**Features**:
- Monaco SQL editor with syntax highlighting
- Schema explorer sidebar (left)
- Saved queries panel (left)
- Execution history (right)
- Save queries for reuse
- Create Metric Definition from current SQL

**Security**: Only SELECT statements allowed; max 10,000 rows returned.

---

## Metric Definitions (`/app/metrics`)

View and customize how metrics are calculated.

**System metrics**: Pre-defined metrics (headcount, turnover rate, etc.) with standard formulas.

**Custom metrics**: Create your own metrics with:
- Category, formula description
- SQL expression override — executed live against the DB
- Optional: link to a saved query from the SQL Editor

**Calculate button**: For any metric with a SQL expression, click "Calculate" to see the live value.

**Linking workflows**:
- SQL Editor → "Create Metric" button → creates a metric linked to current SQL
- Metric Definitions → "Link Saved Query" dropdown in edit modal → populates SQL from saved query

---

## Data & Integrations (`/app/data`)

Unified data platform with 5 tabs:

| Tab | Purpose |
|-----|---------|
| **Connections** | Connect HRIS/ATS/Payroll systems (Workday, BambooHR, Greenhouse, etc.) + Direct database connection |
| **Import** | Upload CSV/Excel files, data preview, cleaning rules, mock database seeder |
| **Pipelines** | dbt Cloud and Fivetran configuration for ELT pipelines |
| **Webhooks** | Create/manage webhook endpoints for real-time event notifications |
| **Export** | Export employee data as CSV or XLSX |

---

## Recruitment (`/app/recruitment`)

Full recruitment analytics dashboard.

**Tabs**: Overview, Pipeline, Recruiter Goals, Recruiter Capacity, Quality, Cost

**Recruiter Goals**: Per-recruiter target vs actual hires with pagination (20 per page)

**Recruiter Trends**: Historical performance table with bar chart visualization

**Capacity Planning**: Per-recruiter workload analysis with overhead and utilization metrics

---

## Attendance Monitoring (`/app/attendance`)

Tracks daily attendance patterns.

**Status types**: In Office, Remote, Absent, On Leave, Holiday

**Summary cards**:
- Total employees
- In Office (%)
- Remote (%)
- Holidays & PTO (%)
- Absences (%)

**Filters**: Time period, department, location (from global filter bar)

---

## User Management (`/app/admin/users`)

Manage users and their permissions.

**Create user**: Email, name, role, password

**Set permissions**: Select user → Permissions button → check/uncheck individual permissions → Save

This sets `custom_permissions` JSON on the user, which overrides role-based permissions on next login.

---

## AI Chat (`/app/ai`)

Natural language Q&A about your HR data.

Ask questions like:
- "What is the headcount in Engineering?"
- "Which department has the highest attrition?"
- "Show me salary distribution by job level"

The AI generates SQL, executes it, and explains the results. Requires `OPENAI_API_KEY`.

---

## Deep Dive (`/app/deep-dive`)

Automated workforce segment analysis.

Selects interesting data segments, generates insights and charts automatically. Requires `OPENAI_API_KEY`.
