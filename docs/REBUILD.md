# Interface: modular HRIS rebuild

## Recommendation

Build a trustworthy system of record for a small organization, with useful employee
screens and documented operations that other software and agents can use. Think
of “rails” as stable data models, permissions, migrations, events, and extension
conventions. MCP is an adapter to those capabilities; it is not the database,
authorization system, workflow engine, or a required AI dependency.

Start with a modular monolith. One process, one database file, one installable
package, one organization per deployment. Preserve the Interface name, layered logo, monochrome slate palette, compact table
density, sidebar and subtle purple accent. Lightweight means fast and accurate,
with modular OOP and measurable behavior—not simply fewer dependencies.

Keep the existing Python/FastAPI direction;
changing languages would add work without addressing the product's main complexity.

## Inspection scope and evidence

Inspected the public repository at commit
[`a6ac2237d281e45cd5f733e5e24c10920e06a4fd`](https://github.com/jcktp/interface/tree/a6ac2237d281e45cd5f733e5e24c10920e06a4fd)
on 2026-09-13. Read the README, dependency manifests, Docker setup, application
entry point, data models, employee routes/CRUD, authentication, permission definitions,
integration base/sync service, and navigation. This was source inspection, not a
full runtime/security audit; external providers and advertised features were not
individually validated. The old application was not started or modified.

The repository describes itself as workforce intelligence, and its source supports
that emphasis. The central model file is 2,076 lines, mixing organization billing,
employees, demographics, compensation, recruiting, planning, dashboards, and other
domains. The navigation gives analytics and administration considerable prominence.
The goal is therefore a product refocus as much as a deployment refactor.

| Finding | Source evidence | Rebuild implication |
|---|---|---|
| App depends on DB, Redis, and Ollama; model pull service starts by default | [docker-compose.yml](https://github.com/jcktp/interface/blob/a6ac2237d281e45cd5f733e5e24c10920e06a4fd/docker-compose.yml) | Eliminate mandatory auxiliary services; make AI external and optional |
| Main backend installs pandas, ML/forecasting packages, SHAP, warehouse clients, SAML and AI clients | [backend/requirements.txt](https://github.com/jcktp/interface/blob/a6ac2237d281e45cd5f733e5e24c10920e06a4fd/backend/requirements.txt) | Separate optional adapters; directory startup should not import analytics |
| Startup script signs in with a known admin password and seeds when empty | [Dockerfile](https://github.com/jcktp/interface/blob/a6ac2237d281e45cd5f733e5e24c10920e06a4fd/Dockerfile) | Treat empty state as normal; remove demo loading entirely |
| FastAPI routers are separated by domain, but all are imported eagerly | [backend/main.py](https://github.com/jcktp/interface/blob/a6ac2237d281e45cd5f733e5e24c10920e06a4fd/backend/main.py) | Keep domain boundaries; core should run without optional packages |
| Employee records contain salary, demographics, performance and hiring scores alongside directory fields | [backend/database/models.py](https://github.com/jcktp/interface/blob/a6ac2237d281e45cd5f733e5e24c10920e06a4fd/backend/database/models.py) | Separate directory, employment and restricted HR data contracts |
| Employee routes authenticate but do not invoke the defined employee permission checks; writes accept dictionaries | [backend/routes/employees.py](https://github.com/jcktp/interface/blob/a6ac2237d281e45cd5f733e5e24c10920e06a4fd/backend/routes/employees.py) | Authorization belongs in every operation, not only navigation |
| Update sets any matching model attribute; list total omits department/location filters | [backend/services/crud.py](https://github.com/jcktp/interface/blob/a6ac2237d281e45cd5f733e5e24c10920e06a4fd/backend/services/crud.py) | Explicit writable schemas and matching filter/count tests |
| Organization/user helpers fall back to demo identities for missing/invalid identity data | [backend/services/auth/security.py](https://github.com/jcktp/interface/blob/a6ac2237d281e45cd5f733e5e24c10920e06a4fd/backend/services/auth/security.py) | Fail closed; never select an organization by fallback |
| Startup combines create_all with automatic column/index patches despite Alembic files | [backend/database/connection.py](https://github.com/jcktp/interface/blob/a6ac2237d281e45cd5f733e5e24c10920e06a4fd/backend/database/connection.py) | One versioned migration path; fail visibly on migration failure |
| Provider abstraction covers transformation, pagination, retries and sync results | [provider_base.py](https://github.com/jcktp/interface/blob/a6ac2237d281e45cd5f733e5e24c10920e06a4fd/backend/services/integrations/provider_base.py) | Retain the adapter concept, narrow to capabilities each provider supports |
| Sync employee CRUD calls omit organization arguments now required by CRUD; credential decryption is marked placeholder | [sync_service.py](https://github.com/jcktp/interface/blob/a6ac2237d281e45cd5f733e5e24c10920e06a4fd/backend/services/integrations/sync_service.py) | Rebuild one verified connector with contract tests; do not assume provider count equals readiness |
| README labels source proprietary | [README.md](https://github.com/jcktp/interface/blob/a6ac2237d281e45cd5f733e5e24c10920e06a4fd/README.md) | Current release uses BSL 1.1; earlier MIT release remains in history |

## What to carry forward

| Keep the idea | Simplify it |
|---|---|
| People and organization records, stable IDs | Directory fields first; move employment history and private fields into separate models as needed |
| Department/team/manager relationships | Add real team IDs and manager constraints in the identity/employment milestone; don't start with cost-center planning |
| Domain APIs and request validation | Keep FastAPI/OpenAPI, thin routes and shared services; no generic arbitrary-model mutation endpoint |
| Permissions | Start with employee, HR admin, integration scopes; add manager privileges only for an actual approval workflow |
| Imports and field mapping | CSV preview, validation and external-ID upserts before multiple HRIS connectors |
| Provider adapters and sync results | Optional packages with explicit capabilities, bounded retries and resumable jobs |
| Empty-state onboarding | No seed file, no demo loader, no sample records on startup |
| Employee table and filters | Search, clear empty/error states, accessible forms; no dashboard designer |
| API documentation | First-class examples, predictable errors and generated schemas; add SDK generation once contracts settle |

Do not port predictive attrition, salary predictions, uploaded executable models,
custom SQL, NL-to-SQL, Monte Carlo planning, custom dashboards, recruitment analytics,
compensation cycles, warehouse connectivity, billing or marketing pages into the core.
Some could become consumers of the API later; none is necessary to prove the HRIS.

Keep Docker as a future optional packaging convenience. Docker itself isn't the
fundamental problem: the service graph and feature dependencies are. An eventual
container should run the same single application and mount the same data folder.

## Target architecture

```text
Employee / HR screens ─┐
CLI / integration ────┼── authenticated operations ── policy + domain ── SQLite
MCP adapter ─ HTTP ───┘                                      └── event journal
```

The implementation uses OOP boundaries from the first slice: `PeopleService`,
`DirectoryPolicy`, a `PeopleRepository` protocol, `SQLitePeopleRepository`, and
`SQLiteDatabase`. Models define the public data contract. Composition roots assemble
these dependencies explicitly. Browser code separates an API client from the directory
controller. Group these into `people/`, `identity/`, and `leave/` domains as they grow;
avoid unnecessary base-class hierarchies and empty extension frameworks.

Decisions:

- **Single organization per deployment now.** There is no organization selector
  or pretend multitenancy. A future hosted multi-tenant offering needs authenticated
  organization context, tenant-scoped uniqueness and foreign keys, and isolation tests
  across every API, event and background operation. That is a separate milestone.
- **SQLite first.** Good for a small local/single-process pilot. Keep transactions
  explicit; use an online backup. PostgreSQL should follow demonstrated concurrency
  or hosting needs, with a real migration plan rather than an unsupported URL toggle.
- **Plain browser UI first.** Same origin, no frontend build or CDN. React remains
  a reasonable later choice for complex interaction, but should not force a second
  deployed service. The current UI uses text nodes for user-supplied content.
- **Typed operations first.** Fields, error cases, scopes and events are the extension
  contract. Future modules should call these rather than accessing arbitrary tables.
- **MCP is optional and read-only initially.** Its tool calls go through HTTP and the
  same policy. Official [MCP documentation](https://modelcontextprotocol.io/docs/develop/build-server)
  distinguishes tools/resources/prompts and stdio transport; this slice uses the
  installed Python SDK 1.30.0 API, deliberately constrained below 2.x.
- **No universal custom-field builder yet.** Add typed, namespaced field definitions
  only after concrete customer fields repeat. Specify visibility and validation per
  field; a free-form JSON blob should not become an authorization escape hatch.
- **No broker yet.** The committed event journal is the initial extension point.
  For outgoing webhooks add a durable delivery table, signatures, bounded retries,
  replay tooling and idempotent consumers; don't send network calls inside transactions.

## Current progress and next steps

The functional 0.2 release goes beyond the first directory slice. See the root README
for setup and the exact implemented feature table.

- Implemented: named accounts and self-service, leave request/approval/cancellation,
  onboarding tasks, employment dates/previous company, tenure and per-employee financial
  metrics, editable workforce cost scenarios, and connector adapters for Greenhouse
  and Ashby candidate import, Workspace directory import, Google/Okta OIDC and Slack credential verification.
- Preserved: Interface branding, modular OOP, no seed/demo loader, one process,
  explicit policies, typed APIs and atomic journals.
- Next identity work: SCIM, invitation/recovery, MFA and richer account lifecycle handling. These precede a broad enterprise deployment claim.
- Next HR work: organization hierarchy, full employment histories/rehire intervals,
  leave balances/calendars and notification delivery.
- Next insights work: departmental plans, hiring ramps, attrition assumptions,
  fiscal-period comparisons, richer recruitment and workforce analytics. The original
  planning/insights product direction remains in scope as separate modules.
- Next integrations: Lever, SmartRecruiters, payroll exchange, Jira, Confluence,
  AI-provider adapters and permission-aware MCP workflow tools. See CONNECTORS.md.

## Licensing

The 0.2 release uses BSL 1.1, with Jorick Polderman as licensor, free internal production
use, a restriction on third-party hosted services, and an Apache 2.0 change date of
September 13, 2030. It is source-available. The earlier MIT release remains in history.

## Integration follow-up

Ashby candidate sync, delegated Google Workspace directory snapshots, and Google/Okta
OIDC sign-in now use the existing service/repository structure. No deployment service
was added. Optional integration dependencies handle credential signing and JWT checks.
See CONNECTORS.md for exact setup, supported hosts and remaining boundaries.

## Product capability restoration

Version 0.3 adds CSV mapping/preview/commit, an Ashby hiring inbox, private employee
self-service, contracts, payroll export, sickness/balances and quality-of-hire cohorts.
[The restoration inventory](RESTORATION.md) compares it with the original workflows
and explicitly tracks the remaining gaps.
