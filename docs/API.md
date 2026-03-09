# API Reference

Base URL: `/api`

All authenticated endpoints require: `Authorization: Bearer <token>`

---

## Authentication (`/api/auth`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login with email/password → returns `{token, user, permissions}` |
| POST | `/auth/logout` | Invalidate token |
| POST | `/auth/signup` | Register new user |
| GET  | `/auth/me` | Get current user info |
| POST | `/auth/refresh` | Refresh session token |
| PUT  | `/auth/change-password` | Change current user password |

---

## Employees (`/api/employees`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/employees` | List employees (supports filters: department, location, status, search) |
| GET | `/employees/{id}` | Get single employee |
| POST | `/employees` | Create employee |
| PUT | `/employees/{id}` | Update employee |
| DELETE | `/employees/{id}` | Delete employee |
| GET | `/employees/stats/summary` | Aggregate stats |

---

## Metrics (`/api/metrics`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/metrics/dashboard` | Dashboard metrics (headcount, salary, engagement) |
| GET | `/metrics/diversity` | Diversity metrics (gender, ethnicity, pay gap) |
| GET | `/metrics/financial` | Financial metrics (revenue, profit per employee) |
| GET | `/metrics/retention` | Retention metrics (turnover rate, flight risk) |
| GET | `/metrics/workforce-planning` | Workforce planning metrics |
| GET | `/metrics/definitions` | List metric definitions |
| POST | `/metrics/definitions` | Create custom metric definition |
| PUT | `/metrics/definitions/{id}` | Update metric definition |
| DELETE | `/metrics/definitions/{id}` | Delete custom metric |
| GET | `/metrics/definitions/{id}/calculate` | Execute metric SQL, return scalar value |

---

## SQL Queries (`/api/queries`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/queries/schema` | Get DB schema for allowed tables |
| POST | `/queries/execute` | Execute a SELECT query |
| GET | `/queries/history` | Recent execution history |
| GET | `/queries` | List saved queries |
| POST | `/queries` | Save a new query |
| PUT | `/queries/{id}` | Update saved query |
| DELETE | `/queries/{id}` | Delete saved query |

**Query execute body**:
```json
{ "sql": "SELECT COUNT(*) FROM employees WHERE status = 'active'" }
```

**Security**: Only SELECT statements, max 10,000 rows, 30s timeout.

---

## Machine Learning (`/api/ml`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ml/models` | List ML models (supports `?model_type=attrition&status=active`) |
| POST | `/ml/models` | Create model |
| GET | `/ml/models/{id}` | Get model details |
| PUT | `/ml/models/{id}` | Update model config |
| DELETE | `/ml/models/{id}` | Delete model |
| POST | `/ml/models/{id}/train` | Start training job |
| GET | `/ml/models/{id}/training-status` | Get latest training job status |
| POST | `/ml/models/{id}/activate` | Activate trained model |
| POST | `/ml/models/{id}/predict` | Run batch predictions |
| GET | `/ml/models/{id}/predictions` | Get prediction history |
| GET | `/ml/models/{id}/employee-scores` | Per-employee attrition risk scores |
| GET | `/ml/models/{id}/forecast` | Headcount forecast (12 months) |
| POST | `/ml/compare` | Compare model metrics |
| GET | `/ml/hyperparameters/{algorithm}` | Get hyperparameter options |

---

## Command Center (`/api/command-center`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/command-center/health` | Org health metrics |
| GET | `/command-center/trends` | Headcount/attrition trends (supports `?months=6`) |
| GET | `/command-center/alerts` | Active org health alerts |
| POST | `/command-center/alerts/{id}/acknowledge` | Acknowledge alert |
| POST | `/command-center/alerts/{id}/resolve` | Resolve alert |
| POST | `/command-center/run-detection` | Trigger anomaly detection |

---

## Recruitment (`/api/recruitment`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/recruitment/pipeline` | Full recruitment pipeline metrics |
| GET | `/recruitment/candidates` | List candidates |
| GET | `/recruitment/requisitions` | List job requisitions |
| GET | `/recruitment/stats` | Recruitment stats (time-to-hire, source mix) |
| GET | `/recruiters` | List recruiters with performance stats |

---

## Attendance (`/api/attendance`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/attendance/summary` | Attendance summary stats |
| GET | `/attendance/records` | Attendance records (paginated, filterable) |
| GET | `/attendance/trends` | Attendance trends over time |

---

## Admin (`/api/admin`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/users` | List all users in org |
| POST | `/admin/users` | Create user |
| PUT | `/admin/users/{id}/permissions` | Set custom permissions for user |
| GET | `/admin/data-summary` | DB row counts per entity |
| POST | `/admin/seed-full` | Seed full demo database |
| POST | `/admin/clear` | Clear all data |

---

## Organization (`/api/organization`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/organization` | Get org settings |
| PUT | `/organization` | Update org settings |
| GET | `/organization/permissions` | Get available permissions list |

---

## KPIs (`/api/kpis`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/kpis` | List KPI definitions |
| POST | `/kpis` | Create KPI definition |
| GET | `/kpis/{id}/values` | Get historical KPI values |

---

## AI (`/api/ai`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai/query` | Natural language HR data query |
| GET | `/ai/history` | Conversation history |

Requires `OPENAI_API_KEY` environment variable.

---

## Integrations (`/api/integrations`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/integrations/sync/{provider}` | Trigger provider sync |
| POST | `/integrations/database/test-connection` | Test direct DB connection |
| GET | `/integrations/field-mappings` | List field mappings |
| POST | `/integrations/field-mapping` | Create field mapping |
| PUT | `/integrations/field-mapping/{id}` | Update field mapping |
| DELETE | `/integrations/field-mapping/{id}` | Delete field mapping |

---

## Response Format

All endpoints return:

```json
{
  "status": "success",
  "data": { ... }
}
```

Errors return HTTP 4xx/5xx with:
```json
{
  "detail": "Error message"
}
```
