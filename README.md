# interface

**HR data and workflows, with an API at the center.**

Interface is a modular, self-hosted HRIS for small teams. Employees can sign in,
manage their preferred name, request time off, and complete onboarding tasks.
HR administrators maintain people and employment records, approve requests, inspect
workforce metrics, and save costed headcount scenarios.

The Interface name, logo, compact slate design and sidebar are retained. The rebuild
uses a single Python application with SQLite, explicit OOP services and repositories,
and a browser UI that calls the same HTTP operations available to developers.

**Version 0.2.0 · BSL 1.1 · source-available.** This is a functional early release,
not a demo or complete replacement for payroll/enterprise HR suites. Every instance
starts empty. There are no seed files, demo commands or invented metrics.

## Implemented features

| Module | What works now |
|---|---|
| People | Create, edit, search, paginate and inactivate people; work email uniqueness and version checks |
| Accounts | Named email/password login, employee/admin roles, password changes, account activation/deactivation and expiring, revocable sessions |
| SSO | Google and Okta OIDC, explicit identity linking, optional SSO-only accounts, PKCE and signed-token verification |
| Ashby | Resumable candidate name/email import and refresh |
| Google Workspace | Read-only delegated directory import, including suspended status; no automatic account changes |
| Self-service | My profile; employees can change their preferred name but cannot change roles, employment terms or someone else's record |
| Time off | Request annual/personal leave, approve/reject as a different named admin, cancel your own request, overlap checks and transition history |
| Onboarding | HR assigns dated tasks to a person; assignees or HR complete/reopen tasks |
| Employment | Hire date, last employed date and previous company, with restricted access and version checks |
| Workforce insights | Active headcount, departments, previous-company breakdown, average and combined company tenure, explicit missing-data coverage |
| Financial metrics | Enter/edit period revenue and net profit; revenue and profit per employee using average daily headcount |
| Workforce planning | Create/edit scenarios with target headcount, fully loaded annual cost, duration and currency; calculate projected workforce cost |
| Greenhouse | Real Harvest API adapter: verify credentials and import candidate names/emails in resumable pages; stable external-ID upserts |
| Slack | Real `auth.test` adapter verifies token/workspace. Sending messages or workflow notifications is **not** implemented |
| Developer interface | Typed REST endpoints, generated OpenAPI, transactional journals and optional read-only MCP directory search |
| Operations | Versioned schema upgrades, SQLite backup, explicit host allowlist and optional disabling of setup keys |

Connectors and SSO are tested with provider-response fixtures and signed identity tokens; they have
not been validated against your live accounts because no credentials were supplied.
Their buttons perform real network requests when configured. Only implemented
providers appear in the connector setup screen.

## Quick start — no Docker required

Requires Python 3.11 or newer. Tested locally with Python 3.14.7.

```sh
git clone https://github.com/jcktp/interface.git
cd interface
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e .
interface init
interface serve
```

On Windows, activate with `.venv\Scripts\activate` and use `python` where appropriate.
Windows deployment has not been validated in this release.

Open [Interface](http://127.0.0.1:8000). For the first administrator:

1. Open **Administrator setup / API key access** on the sign-in screen.
2. Read the administrator key from `data/keys.json`, whose absolute path `init` prints.
   The CLI does not print the key itself.
3. Add yourself in **People**, then create an **admin** account for that person in
   **Accounts**. Initial passwords require at least 12 characters.
4. Sign out and sign in using your work email and password.
5. Add colleagues, create their accounts, and share initial passwords through an
   appropriate private channel. Employees can change passwords in **My profile**.
6. Once named administration works, restart with `interface serve --disable-access-keys`
   to disable the shared setup/admin and reader keys.

No emails are sent automatically. Email verification, invitation links and forgotten
password recovery are not implemented. A server administrator can re-enable setup-key
access if needed; this is powerful local recovery access and should be protected.

## Use the workflows

**Time off:** sign in as a named employee, select **Time off**, choose inclusive start
and end dates, and submit. A different named administrator approves or rejects the
request. Administrators cannot approve their own leave. The requester can cancel a
pending or approved request. Exact retries reuse a live request rather than creating
a duplicate. Cancelled/rejected dates can be requested again.

Dates are calendar dates, not charged workdays. This release does not calculate
holiday calendars, accruals, balances, half days, payroll deductions or legal leave
entitlements. The workflow records decisions and does not make entitlement decisions.

**Onboarding:** an administrator finds a person, enters a task and due date, and saves.
Employees see only their own tasks. Both assignee and HR can complete or reopen a task.
There is no background notification system yet.

**Employment and insights:** select **Employment** beside a person to enter hire/end
dates and previous company. Open **Insights & planning** to inspect calculated values,
add a financial period or save a workforce scenario. Financial periods and plans can
be corrected through their edit forms; concurrent changes produce a conflict rather
than silently overwriting newer values.

## What the numbers mean

- **Active headcount** counts people currently marked active in the directory.
- **Company tenure** uses hire date through today for currently active people whose
  employment interval includes today. Years use 365.2425 days. It is not lifetime
  career tenure. The displayed sample size and missing count show coverage.
- **Previous company** is the recorded immediately previous employer, not a full
  employment-history graph.
- **Average daily headcount** is total employed person-days divided by days in the
  financial period. Hire and end dates are inclusive. It is not FTE.
- **Revenue/profit per employee** divides the supplied period amount by that average
  headcount. Incomplete employment intervals or a zero denominator produce a missing
  result. Net profit is provided by you, not inferred from salaries.
- **Planning cost** is `target headcount × annual fully loaded cost × months / 12`.
  The target headcount is assumed constant throughout the period. Hiring ramps,
  attrition, departmental budgets and demand forecasting are future modules.
- Money is stored as integer minor units and calculated with decimal arithmetic.
  EUR, USD and GBP are supported; currencies are never converted or aggregated.

## Connectors

Set credentials in the application server's environment before starting Interface,
then select the provider in **Connectors** and enter the environment variable's name:

```sh
export INTERFACE_CONNECTOR_GREENHOUSE='your-harvest-api-key'
export INTERFACE_CONNECTOR_SLACK='your-slack-token'
interface serve
```

The database stores only the variable name, not its secret value. Variable names
must begin `INTERFACE_CONNECTOR_`. Do not commit credentials or put them in URLs.
A missing variable is shown as missing credentials, not a successful connection.

For Greenhouse, grant the Harvest key permission to list candidates. **Test connection**
checks access. **Sync next page** imports up to 100 records and saves progress
atomically. Repeat until complete; **Start refresh** resets pagination for another pass.
Repeated records update by external ID. The UI previews the first 100 candidates.
Candidates are never silently turned into employees. Source deletions are not propagated.

Slack currently verifies the token/workspace only. Nothing is posted to Slack.
For **Ashby, Google Workspace and Google/Okta SSO**, install `.[integrations]` and
follow the [setup guide](docs/CONNECTORS.md). The same instructions are linked in the
app. Local accounts may omit a password for SSO-only access; an administrator must
explicitly link their provider subject. SSO does not grant roles based on email.
Lever, SmartRecruiters, payroll, Jira, Confluence and AI adapters remain planned.

## API and MCP

- Interactive reference: [Swagger](http://127.0.0.1:8000/docs)
- Machine-readable schema: `/openapi.json`
- Authentication: `Authorization: Bearer <session-or-enabled-access-key>`
- Session lifetime: 12 hours; logout, password changes and deactivation revoke access.

Representative endpoints:

```text
POST /api/v1/auth/login                 Sign in
POST /api/v1/auth/logout                Revoke current session
GET  /api/v1/me/profile                 Read own profile
PATCH /api/v1/me/profile                Update preferred name + version
GET/POST /api/v1/people                 Directory
GET/POST /api/v1/accounts               HR account management
GET/POST /api/v1/leave                  Scoped leave requests
POST /api/v1/leave/{id}/transition       Approve, reject or cancel
GET/POST /api/v1/tasks                  Scoped onboarding tasks
POST /api/v1/tasks/{id}/transition       Complete or reopen
GET/PUT /api/v1/people/{id}/employment   Employment record
GET /api/v1/insights                    HR-only metrics and scenarios
POST/PUT /api/v1/financial-periods[/{id}]
POST/PUT /api/v1/plans[/{id}]
GET/POST /api/v1/connectors
POST /api/v1/connectors/{id}/test
POST /api/v1/connectors/{id}/sync
```

The optional MCP adapter currently exposes `list_people(query, limit, offset)` over
stdio. It calls the authenticated HTTP API; it cannot bypass policy or run raw SQL.

```sh
python -m pip install -e '.[mcp]'
export INTERFACE_URL='http://127.0.0.1:8000'
export INTERFACE_TOKEN='a-current-session-token-or-enabled-reader-key'
interface-mcp
```

Run the HTTP app first. Configure an MCP client to launch the absolute path to
`.venv/bin/interface-mcp` with those environment variables. This release uses the
Python MCP SDK 1.x. Remote MCP, OAuth delegation and workflow tools are not yet shipped.

## Architecture

```text
Browser / REST / MCP
         │
Typed requests → application services → authorization policies
                         │
                 repository protocols
                         │
            SQLite repositories + transactional journals
                         │
             versioned migrations / persistent storage
```

```text
interface_core/
  bootstrap.py            Composition root
  models.py, service.py   People contracts and operations
  policy.py               Actor context and directory policy
  repository.py           People storage
  database.py, events.py   Transactions, migration runner, journals
  identity/               Accounts, password hashing, sessions
  sso/                    OIDC configuration, token verification, identity links
  workflows/              Leave and onboarding
  insights/               Employment, calculations, financial periods, plans
  connectors/             Provider protocol, adapters, configuration, sync
  app.py, cli.py           HTTP/application lifecycle
  mcp_server.py           Optional MCP adapter
  static/                 Interface UI; no frontend build/CDN
  migrations/             Ordered SQL migrations
```

Modules use composition, injected dependencies and explicit repository interfaces.
Every domain write commits its journal entry in the same transaction. Passwords use
salted scrypt hashes; only SHA-256 session-token digests are stored. Browser credentials
remain in memory; a reload requires sign-in. The journals are attributable change
records, not tamper-proof compliance storage.

## Deploy, upgrade, back up

See [operations](docs/OPERATIONS.md). Default binding is localhost. To serve behind
an HTTPS reverse proxy using an explicit hostname:

```sh
interface --data-dir /path/to/private-data serve \
  --allowed-host hr.example.com --disable-access-keys
```

The proxy can connect to `127.0.0.1:8000`. An alternate bind address is available via
`--host`; HTTPS termination and process supervision are the deployer's responsibility.
This release targets one organization and one application process per database.

```sh
interface backup backup.sqlite3
python -m pip install -e '.[dev,mcp,integrations]'
pytest
python tests/performance_check.py
```

Backups use SQLite's online backup API and refuse to overwrite existing files.
Stop the server before restoring a backup as `people.sqlite3`; preserve the previous
file. Account/session data is in the database. Setup keys and connector environment
secrets must be secured/backed up separately.

## Roadmap and boundaries

Next: invitations/recovery, SCIM provisioning, richer employment
history and organization relationships, leave balances, notifications, ATS adapters,
scoped integration keys and delivery retries. Then payroll exchange, departmental
planning, hiring/attrition scenarios and optional AI assistance grounded in permissioned
records. The existing analytics ideas remain in scope; expensive ML infrastructure
will not become a prerequisite for normal HR workflows.

[Rebuild rationale](docs/REBUILD.md) · [Connector roadmap](docs/CONNECTORS.md) ·
[Validation and limitations](docs/VALIDATION.md)

## License

Interface 0.2.0 is **source-available under Business Source License 1.1**, not an
OSI open-source release. Licensor: **Jorick Polderman**. The Additional Use Grant
allows internal business production use, including employees and contractors acting
on your behalf. Offering the software as a hosted/managed service to third parties
requires separate permission.

This release changes to **Apache License 2.0 on September 13, 2030**, or earlier
under the BSL's four-year rule. Future releases must set their own change date no
later than four years after their first BSL distribution. See [LICENSE](LICENSE)
for the governing text. The earlier 0.1.0 MIT release remains in Git history;
this change does not retract the permissions attached to that release.
