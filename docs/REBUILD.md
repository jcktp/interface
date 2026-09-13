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
| README labels source proprietary | [README.md](https://github.com/jcktp/interface/blob/a6ac2237d281e45cd5f733e5e24c10920e06a4fd/README.md) | New code has an explicit MIT license; assess rights before copying old assets/code |

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

## Incremental rebuild plan

Each step has a user-visible result and a stopping criterion. Do not recreate all
old features before letting someone use it.

1. **Directory core — implemented here.** Empty startup, add/edit/inactivate person,
   search, pagination, reader/admin policies, OpenAPI, SQLite migration, conflict
   checks, transaction-bound events, empty initialization, backup, optional MCP search.
   Done when restart preserves records; bad fields, duplicate emails, stale edits
   and unauthorized writes are rejected; event failure rolls back the write.

2. **Named identity and employee self-service — next.** Add user-to-person mapping,
   one supported login method, revocable sessions, HR admin and employee policies.
   Employee home is “My profile” and “My requests”; administrative controls are
   separate. Employees can edit only explicit fields such as preferred name; job,
   manager and employment status remain HR-managed. Add organizations/settings for
   the single deployment, then teams and a manager relationship with cycle checks.
   Done when two employees cannot edit one another, cannot elevate their own role,
   and every change identifies an individual actor. Required before a real team pilot.

3. **Reliable import/export and employment history.** CSV preview with row errors,
   dry run, stable external IDs, duplicate/conflict policy and repeatable upserts.
   Separate a person from their employment assignment so rehires and job changes
   do not overwrite history. Capture effective dates, location and employment type.
   Start with plain CSV export; handle spreadsheet formula injection in exported
   text. Done when importing the same file twice produces no duplicates and a
   failed row has a clear outcome. Port only selected directory data from Interface;
   preserve a source-ID mapping. Never migrate seeded demo rows as real staff.

4. **One useful workflow: leave requests.** Explicit requested → approved/rejected →
   cancelled transitions, named approver, authorization, dates/timezone semantics,
   overlapping-request checks and an event history. Begin without payroll accrual
   calculations. Employee sees status and next action; approver sees an inbox.
   Done when repeated approval is safe and an employee cannot approve their own
   request. This proves workflow rails without a generic flow-builder UI.

5. **Extension contract and one integration.** Add scoped revocable API keys,
   versioned webhooks with a durable outbox, per-consumer delivery state, and one
   real connector (choose the first pilot customer's system). Define record ownership
   and conflict handling between manual edits and sync. Add a generated TypeScript
   client if needed. Done when an integration can restart/replay without duplicates
   and exposes useful failures without leaking credentials.

6. **MCP workflow tools.** Extend beyond directory search with `get_my_profile`,
   `request_leave` and `get_request_status`, bound to a named authenticated actor.
   Add idempotency keys and confirmation in the consuming client for consequential
   writes. Never expose raw SQL, unrestricted field changes or a shared superuser
   identity. Done when the same permission tests pass through UI, HTTP and MCP.
   Introduce remote transport only with an explicit authentication design.

7. **Deployment and contributor polish.** Reproducible release dependencies,
   install/upgrade/backup/restore tests, supported runtime matrix, one optional
   container, HTTPS deployment guide, rate limits, session hardening, CI, contribution
   guide and a tiny extension example. Avoid mandatory telemetry. Done when a fresh
   machine runs a clean instance and upgrades it without losing data, and a second
   developer adds an operation without modifying unrelated domains.

8. **Only then add demand-led modules.** Onboarding checklists, document
   acknowledgments, simple time-off balances, or basic headcount reports. Keep
   compensation and private documents in restricted modules. Measure completed
   employee tasks and support burden before adding analytics or another integration.

## First-slice boundaries

This is a running starter repository, not feature parity with Interface. There are
no employee accounts, payroll, leave workflow, invitation emails, org chart,
employment history, CSV import, webhook delivery, remote MCP, SaaS tenancy, SSO,
or public hosting yet. No production-readiness claim is made. The simple local keys
do not expire and the event journal records role labels instead of individual users;
milestone 2 replaces that arrangement. The API intentionally has no permanent delete.

The rebuilt application replaces the old files at the repository root on a rebuild
branch. The old application remains in Git history. Domain code is new; the Interface
logo geometry and design language are retained at the owner’s request. There is no
seed or demo loader. MIT is the starter license for the new implementation.
