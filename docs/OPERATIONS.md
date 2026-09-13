# Running Interface

## Deployment model

One organization, one application process, one SQLite database on local durable disk.
The base package needs Python, FastAPI, Uvicorn and httpx; MCP is an optional extra.
No seed, database server, broker, ML worker or frontend build is required.

Initialize a private data directory, bootstrap a named admin through the UI, then
serve with setup keys disabled. Protect the data directory: it contains HR records,
password hashes and sessions. Connector tokens belong in a private server environment
file or secret manager, not in the repository. Environment variable names must use
the `INTERFACE_CONNECTOR_` prefix.

## HTTPS and process supervision

Keep Interface on localhost behind a reverse proxy that provides HTTPS. Example
Caddy configuration (replace the hostname):

```text
hr.example.com {
    reverse_proxy 127.0.0.1:8000
}
```

Start the application with that hostname explicitly allowed:

```sh
interface --data-dir /path/to/private-data serve \
  --allowed-host hr.example.com --disable-access-keys
```

Use your platform's process supervisor to restart on failure and inject secrets.
An explicit `--host` option exists for container/network deployments. Do not use
plain HTTP for employee passwords over an untrusted network. Reverse-proxy/TLS
installation is not automated or externally validated by this release.

The application ignores forwarded client-IP headers. Login attempts are limited
per source address and email in a bounded, per-process in-memory window (10/minute).
Restarting clears that window; it is not a distributed anti-abuse system.

## Upgrade

1. Back up the live database with `interface backup /private/path/backup.sqlite3`.
2. Stop the application and retain the currently deployed code/version.
3. Pull the intended release and install its dependencies in the virtual environment.
4. Start Interface against the existing data directory. Ordered migrations run before
   serving; a newer unsupported schema fails rather than attempting a downgrade.
5. Check `/health`, sign in and verify a representative record/workflow.

The 0.1 → 0.2 schema path is covered by an automated data-preservation test.
There are no down-migrations. Roll back by stopping the app and restoring both the
prior code and its database backup. Never run migrations simultaneously from several
processes, or use the database on an untested network filesystem.

## Backup and restore

The backup command uses SQLite's backup API and refuses to overwrite a destination.
It includes users, sessions, requests, tasks, financial records, plans and connector
references. It excludes `keys.json` and environment secrets; protect those separately.

To restore: stop Interface, keep the current database, copy the backup to the data
directory as `people.sqlite3`, restore the intended configuration, restart and verify.
A restored backup may contain previously active sessions until their 12-hour expiry.
For incident recovery, revoke those sessions before reopening service.

## Limits of this release

- No SSO, MFA, email verification, password-reset email or invitation service yet.
- No payroll engine, accrual/holiday entitlement calculation, or multi-organization SaaS.
- Journals are transactional and attributable, but not immutable/tamper-evident.
- Financial plans assume a constant target headcount and user-supplied costs.
- Connector live-account testing, scheduling, retries with backoff, and source-deletion
  reconciliation are not complete. Greenhouse sync is manually paged/refreshed.
- Only the local macOS/Python environment is validated so far. Multi-replica and
  high-concurrency operation, full security audit and disaster-recovery drill remain
  required work for a broader production rollout.

The README's feature table is the authoritative distinction between available
operations and planned work. No UI-only feature is advertised as implemented.
