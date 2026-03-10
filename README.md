# Interface

A comprehensive, AI-powered workforce intelligence platform. Combines people analytics dashboards, custom reporting, machine learning models, natural language data querying, and third-party integrations into a single unified system.

## Architecture

```
                    +-------------------+
                    |   React Frontend  |
                    |  (Vite + TS + TW) |
                    +--------+----------+
                             |
                    +--------v----------+
                    |   Nginx (port 80) |
                    |  Static + Proxy   |
                    +--------+----------+
                             |
              +--------------+--------------+
              |                             |
    +---------v---------+       +-----------v-----------+
    |   FastAPI Backend |       |   Slack Bot (Bolt.js) |
    |    (port 8000)    |       |     (Socket Mode)     |
    +---------+---------+       +-----------+-----------+
              |                             |
    +---------v---------+                   |
    |    PostgreSQL 15   |<-----------------+
    |    (port 5432)     |
    +---+------------+---+
        |            |
   +----v----+  +----v----+
   | Redis 7 |  |ML Worker|
   | (6379)  |  | (async) |
   +---------+  +---------+
```

## Features

### Command Center
- Organizational health score with real-time monitoring
- Risk detection and automated alerts
- Trend analysis across key HR metrics

### People Analytics
- **Dashboard**: Headcount, turnover, engagement, performance metrics with interactive charts
- **My Dashboards**: Create and manage multiple custom dashboards with drag-and-drop widget grid layout
  - Widget types: Metric Card, Bar Chart, Line Chart, Area Chart, Pie Chart, Table, Gauge, SQL Query
  - Dashboard sharing, duplication, and export
- **Workforce Planning**: Budget planning by department, plan vs actuals with variance reports, scenario modeling
- **Recruitment**: Pipeline analytics, source effectiveness, time-to-hire tracking
  - **Capacity Planning**: Per-recruiter capacity with overhead %, utilization %, max concurrent reqs, specializations
  - **Goaling**: Per-recruiter quarterly goals with team dashboard, attainment tracking, year-over-year comparison (CSV/PDF export)
  - **Role Complexity**: Weighted demand by job level (Junior through Executive)
  - **Quality of Hire**: Source company analysis, hire quality scoring, cost-per-hire tracking
- **Retention**: Flight risk identification, turnover analysis, exit reason trends, reasons for leaving breakdown
- **Diversity & Inclusion**: Demographic distributions, pay equity analysis, DEI tracking
- **Attendance**: Track attendance records, set org-unit targets, compliance reporting, workplace policy configuration (office days, remote days, holidays)
- **Compensation Planning**: Budget allocation, salary distributions, compensation grids, bulk salary increases (by department/location/team/company), period management

### AI & Intelligence
- **AI Assistant**: Natural language questions answered via NL-to-SQL (e.g., "What's the average tenure in Engineering?")
- **Deep Dive**: Automated analysis of workforce segments with AI-generated insights
- **ML Models**: Create, train, fine-tune, and compare models
  - Attrition prediction
  - Headcount forecasting
  - Attrition forecasting
  - Recruiter capacity planning
  - Salary prediction / benchmarking
  - Workforce cost forecasting
  - Import external models (.joblib, .pkl, .onnx)
  - Custom model code editor

### Data & Analytics
- **KPIs & Targets**: Define, track, and measure organizational KPIs with compact table view and expandable detail
- **Metric Definitions**: View and customize all computed metrics with SQL formula editor
- **Industry Benchmarks**: Import benchmarks via CSV or external datasource, compare org metrics
- **Scenario Planning**: What-if analysis for workforce growth, downturn, and restructuring
- **SQL Editor**: Direct database querying with saved queries and export
- **Reports**: Generate PDF reports, create view-only shareable links with optional expiry

### Integrations (13 Providers)
- **HRIS**: Workday, BambooHR, ADP, SAP SuccessFactors, UKG, Lattice
- **ATS**: Greenhouse, Lever, iCIMS, Ashby
- **Identity**: Google Workspace user sync
- **Communication**: Slack bot with `/hr` commands and AI Q&A
- **Data Warehouse**: Redshift, dbt Cloud, Fivetran connectivity
- **Custom**: REST API builder, webhooks, field mapping

### Admin & Security
- **RBAC**: 5 roles (super_admin, admin, hr_manager, analyst, viewer) with 111+ granular permissions
- **SSO**: Google, Okta, Azure AD (OAuth 2.0), SAML 2.0
- **User Management**: Invite, create users with generated passwords, deactivate, granular permission checkboxes per user
- **API Documentation**: Built-in interactive Swagger docs

---

## Getting Started

### Prerequisites

- **Docker Desktop** 4.0+ (or Docker Engine 24.0+ with Docker Compose v2.20+)

### Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/jcktp/interface.git
cd interface

# 2. Build and start all services
docker compose up --build -d

# 3. Wait for containers to be healthy (~30-60 seconds)
docker compose ps

# 4. Open the application
open http://localhost:3000
```

### First Login

Once the app is running, log in with the default admin account:

| Field | Value |
|-------|-------|
| **Email** | `admin@interface.app` |
| **Password** | `admin123` |

### Loading the Mock Database

After logging in:

1. Navigate to **Data Management** in the sidebar (under the Data section)
2. Click **Load Mock Database**
3. Set record count to **4500** and click confirm
4. Wait for seeding to complete (~30-60 seconds)

This populates:
- 4,500 total employees (~3,800 active, ~700 terminated) with realistic org structure
  - 9 departments, 50+ teams, cost centers per department
  - Manager hierarchy: Directors → Managers (8-15 direct reports) → ICs
  - Previous company, quality of hire score, cost per hire, reason for leaving
- 60 recruiters (Junior / Mid / Senior / Lead) with goaling and capacity data
- 2,000+ candidates with full pipeline data
- 500+ job requisitions across all departments
- Attendance records, performance reviews, compensation data
- KPI definitions and targets
- System metric definitions (15+ built-in metrics)

---

## Services & Ports

| Service | Port | Description |
|---------|------|-------------|
| **App (Frontend)** | `3000` | React SPA served via Nginx |
| **App (Backend API)** | `8000` | FastAPI REST API |
| **PostgreSQL** | `5432` | Database |
| **Redis** | `6379` | Cache and task queue |
| **Swagger Docs** | `3000/docs` | Interactive API docs |
| **ReDoc** | `3000/redoc` | Alternative API docs |

### Useful Commands

```bash
# Start all services (detached)
docker compose up -d

# Build and restart after code changes
docker compose up --build -d

# View logs
docker compose logs -f app

# Stop all services
docker compose down

# Stop and remove all data (fresh start)
docker compose down -v

# Check service health
docker compose ps

# Open a shell in the app container
docker compose exec app bash

# Direct API health check
curl http://localhost:8000/health
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure as needed:

```bash
cp .env.example .env
```

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SECRET_KEY` | JWT signing secret | `your-secret-key-change-in-production` | Yes (change for production) |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://postgres:postgres@db:5432/hr_analytics` | Auto-configured |
| `REDIS_URL` | Redis connection | `redis://redis:6379` | Auto-configured |
| `OPENAI_API_KEY` | OpenAI key for AI Q&A | None | Optional |
| `LLM_BASE_URL` | LLM API base URL | `https://api.openai.com/v1` | Optional |
| `LLM_MODEL` | LLM model name | `gpt-4o` | Optional |
| `SLACK_BOT_TOKEN` | Slack bot OAuth token | None | Optional |
| `SLACK_SIGNING_SECRET` | Slack signing secret | None | Optional |
| `SLACK_APP_TOKEN` | Slack app-level token | None | Optional |

### Integration API Keys (Optional)

These are only needed if connecting to external HRIS/ATS systems:

```
WORKDAY_API_KEY=
BAMBOOHR_API_KEY=
GREENHOUSE_API_KEY=
LEVER_API_KEY=
ASHBY_API_KEY=
GOOGLE_SERVICE_ACCOUNT_JSON=
DBT_CLOUD_API_TOKEN=
FIVETRAN_API_KEY=
```

---

## API Reference

### Interactive Documentation

- **Swagger UI**: http://localhost:3000/docs (or http://localhost:8000/docs)
- **ReDoc**: http://localhost:3000/redoc
- **In-App**: Navigate to API Documentation in the sidebar

### Authentication

All protected endpoints require a Bearer token obtained via login:

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@interface.app", "password": "admin123"}'

# Use the returned token
curl http://localhost:8000/api/employees \
  -H "Authorization: Bearer <token>"
```

### Key Endpoints

```
Auth
  POST   /api/auth/login                  Login (returns token)
  POST   /api/auth/register               Register new user

Employees
  GET    /api/employees                    List employees (filtered)
  GET    /api/employees/metrics            Aggregate employee metrics
  GET    /api/employees/:id                Get employee detail

Recruitment
  GET    /api/candidates                   List candidates
  GET    /api/candidates/pipeline/stats    Pipeline stage counts
  GET    /api/requisitions                 List job requisitions
  GET    /api/recruiter-goals              Recruiter goals (by year)
  POST   /api/recruiter-goals             Create recruiter goal
  PUT    /api/recruiter-goals/:id         Update recruiter goal
  GET    /api/recruitment/quality-of-hire  Quality of hire metrics
  GET    /api/recruitment/cost-per-hire    Cost per hire analytics
  GET    /api/recruitment/source-analysis  Source company effectiveness
  GET    /api/retention/reasons-for-leaving Reasons for leaving analytics

Dashboards
  GET    /api/dashboards                   List dashboards
  POST   /api/dashboards                   Create dashboard
  PUT    /api/dashboards/:id              Update dashboard
  GET    /api/dashboards/:id/data          Widget data

Reports
  GET    /api/reports                      List reports
  POST   /api/reports                      Create report
  POST   /api/reports/:id/share           Generate shareable link
  GET    /api/reports/shared/:token       Public view-only access

AI & ML
  POST   /api/ai/ask                      Natural language Q&A
  POST   /api/ai/deep-dive               Deep dive analysis
  GET    /api/ml/models                   List ML models
  POST   /api/ml/models/:id/train        Train a model

Compensation
  GET    /api/planning/periods            List planning periods
  POST   /api/planning/periods            Create planning period
  POST   /api/compensation/bulk-increase  Bulk salary increase

KPIs & Attendance
  GET    /api/kpis/dashboard              KPI dashboard
  POST   /api/kpis/calculate              Calculate all KPI measurements
  GET    /api/attendance/summary          Attendance summary
  GET    /api/attendance/policy           Workplace policy config

Metrics & Benchmarks
  GET    /api/metrics/definitions         List metric definitions
  POST   /api/metrics/calculate/:id       Calculate a metric
  GET    /api/benchmarks                  List industry benchmarks
  POST   /api/benchmarks/import-csv       Import benchmarks from CSV

Admin
  POST   /api/admin/seed                  Seed sample data
  POST   /api/admin/seed-full            Seed full database (4,500 employees, ~3,800 active)
  GET    /api/admin/users                 List users
  POST   /api/admin/users/create         Create user with generated password
  PUT    /api/admin/users/:id/permissions Update user permissions
```

---

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **TailwindCSS** for styling with custom design system
- **Zustand** for state management (persisted to localStorage)
- **TanStack Query** (React Query) for server state and caching
- **Recharts** for data visualization
- **TanStack Table** for data tables with sorting/filtering
- **React Router v6** for client-side routing
- **React Grid Layout** for dashboard widget drag-and-drop
- **Heroicons** for iconography

### Backend
- **FastAPI** (Python 3.11)
- **SQLAlchemy 2.0** ORM with PostgreSQL
- **Pydantic** for request/response validation
- **Redis** for caching and async task queues
- **Uvicorn** ASGI server

### ML / AI
- **scikit-learn** for classification and regression models
- **XGBoost** for gradient boosting
- **Prophet** for time-series forecasting
- **OpenAI API** for natural language to SQL
- **SHAP** for model explainability

### Infrastructure
- **Docker** multi-stage builds (Node.js + Python + Nginx)
- **Nginx** for static file serving and API reverse proxy
- **Docker Compose** for multi-service orchestration
- **PostgreSQL 15** for relational data
- **Redis 7** for caching

---

## Database Schema

| Model | Description |
|-------|-------------|
| `Organization` | Multi-tenant org container |
| `User` | Platform users with roles and permissions |
| `Employee` | Employee records (4,500 per org, ~3,800 active) with team, cost center, previous company, quality of hire |
| `Candidate` | Recruitment candidates with pipeline stages |
| `JobRequisition` | Open positions by department and level |
| `RecruiterGoal` | Per-recruiter quarterly goals and capacity settings |
| `Dashboard` | Custom dashboards with widget grid layouts |
| `DashboardShare` | Dashboard sharing permissions |
| `Report` | Report configurations with shareable tokens |
| `SavedQuery` | Saved SQL queries |
| `MLModel` | ML model configurations and parameters |
| `TrainingJob` | Model training runs with metrics |
| `KPIDefinition` | KPI definitions and targets |
| `AttendanceRecord` | Daily attendance records |
| `AttendanceTarget` | Attendance targets by org unit |
| `AIConversation` / `AIMessage` | AI Q&A conversation history |
| `OrgHealthAlert` | Automated health alerts |
| `WorkforcePlan` | Workforce planning scenarios |
| `SSOConfiguration` | SSO provider configs |
| `IntegrationConnection` | External system connections |
| `SlackWorkspace` | Connected Slack workspaces |
| `MetricDefinition` | Custom/system metric formulas and SQL expressions |
| `IndustryBenchmark` | Imported industry benchmark data for comparison |
| `CompensationPlan` | Compensation budgets tied to planning periods |
| `PlanningPeriod` | Workforce/compensation planning periods (draft/active/closed) |

---

## Security

- **Authentication**: Token-based with 24-hour expiry
- **Authorization**: Role-based access control (RBAC) with 111+ granular permissions
- **SSO**: OAuth 2.0 (Google, Okta, Azure AD) and SAML 2.0
- **Multi-tenancy**: Organization-level data isolation, all queries scoped to `organization_id`
- **Secrets**: Integration credentials encrypted at rest
- **CSRF**: OAuth state parameters with nonce
- **Audit**: Login events logged with IP, user agent, timestamps

---

## Slack Bot

Start the Slack bot with the `slack` profile:

```bash
docker compose --profile slack up -d
```

| Command | Description |
|---------|-------------|
| `/hr metrics [dept]` | View key HR metrics |
| `/hr headcount [by dept/location]` | Headcount breakdown |
| `/hr ask <question>` | AI-powered Q&A (natural language) |
| `/hr plan` | Workforce planning modal |
| `/hr help` | Available commands |
| `@HRBot <question>` | Natural language queries via mention |

---

## Setup on Another Machine

```bash
# 1. Clone the repo
git clone https://github.com/jcktp/interface.git
cd interface

# 2. Build and run
docker compose up --build -d

# 3. Open in browser
open http://localhost:3000
```

Everything is self-contained — no dependencies beyond Docker.

---

## Production Deployment

1. **Secrets**: Set `SECRET_KEY` to a strong random value in `.env`
2. **Database**: Point `DATABASE_URL` to a managed PostgreSQL (RDS, Cloud SQL, etc.)
3. **Redis**: Point `REDIS_URL` to a managed Redis (ElastiCache, Memorystore, etc.)
4. **SSL**: Configure Nginx with SSL certificates or use a load balancer
5. **AI Features**: Set `OPENAI_API_KEY` for natural language Q&A
6. **Monitoring**: Application logs go to stdout, compatible with any log aggregator

```bash
# Production build
docker compose up -d --build
```

---

## License

This project is proprietary software. All rights reserved.
