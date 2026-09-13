# Interface

A small foundation for an open-source HRIS: people records, a work directory,
an HTTP API, and an optional read-only MCP adapter. Fresh implementation, MIT licensed.

**Status: first local development slice, not a production HR system.** One organization
per data directory; local reader/admin keys, not named employee accounts. Store fictional
data while developing. See [the inspection and rebuild plan](docs/REBUILD.md).

## Run without Docker

Requires Python 3.11+. From this folder:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e .
interface init
interface serve
```

Open http://127.0.0.1:8000. Open `data/keys.json` locally and paste the admin key
into the access form to add/edit people, or the reader key to browse. Keys stay
in browser memory and are cleared by “Lock directory” or a page reload.
The CLI reports the absolute key-file path; it never prints the keys.

Every instance starts empty. There is no seed file, demo command, or automatic
sample-data loading. Synthetic data exists only inside temporary tests and benchmarks.

No Docker, Node build, Redis, PostgreSQL, LLM, or email service is required. The base
package has two direct runtime dependencies: FastAPI and Uvicorn. Lightweight means
fast, accurate, and maintainable; see [validation](docs/VALIDATION.md) for measured results.

## What works

- Searchable, paginated directory; create, edit, and mark people inactive.
- Explicit validated fields: name, work email, job title, department, active/inactive.
- Reader/admin authorization in domain operations as well as HTTP authentication.
- SQLite persistence; numbered initial migration and fail-fast schema version check.
- Optimistic version checks prevent silently overwriting another edit.
- Transactional change events with actor label, timestamp, and changed field names.
- Generated OpenAPI `/openapi.json` and interactive API documentation `/docs`.
- Optional stdio MCP `list_people` tool using the same authenticated HTTP API.
- Empty initialization and SQLite online backup command.

The event feed is a small change journal, not an immutable compliance audit trail
or a delivered webhook queue. Local keys identify a role, not an individual person.

## API example

Set `INTERFACE_TOKEN` to a local key without committing it. Then:

```sh
curl http://127.0.0.1:8000/api/v1/people \
  -H "Authorization: Bearer $INTERFACE_TOKEN"

curl http://127.0.0.1:8000/api/v1/people \
  -H "Authorization: Bearer $INTERFACE_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Jordan Lee","email":"jordan@example.test","department":"Engineering"}'
```

Writes require the admin key. `PUT /api/v1/people/{id}` replaces the editable
fields and requires the current integer `version`. A stale version or duplicate
email returns 409. Unknown fields return 422; reads never include compensation,
home addresses, birth dates, or other HR fields because these are not yet modeled.
Names are plain text, not HTML. API data is never stored in localStorage.

`GET /api/v1/events?after=0&limit=100` is admin-only. Consumers can retain the last
`sequence` and poll again. Events identify changed fields; they do not snapshot values.

## MCP (optional)

```sh
python -m pip install -e '.[mcp]'
# In your MCP client's environment, set the reader key:
export INTERFACE_TOKEN='your-local-reader-key'
export INTERFACE_URL='http://127.0.0.1:8000'
interface-mcp
```

The HTTP app must already be running. Configure your MCP client to launch the
absolute path to `.venv/bin/interface-mcp`, with those two environment variables.
This is a real stdio MCP server using the Python SDK 1.x, pinned below the 2.x API
change. Only `list_people(query, limit, offset)` is exposed. It has no write tools
or direct database access. Localhost HTTP is the only accepted upstream destination;
redirects and environment proxies are not used. Remote MCP and delegated identity
are later milestones. Do not paste production credentials into sample config files.

## Test and back up

```sh
python -m pip install -e '.[dev,mcp]'
pytest
interface backup backup.sqlite3
```

Backup uses SQLite's backup API and refuses to overwrite an existing file.
To restore: stop the app, retain the current database, and copy the backup into
your data directory as `people.sqlite3`; retain your `keys.json`, then restart.
The database backup excludes keys. Protect both files and test restoration before
relying on it. The initial migration runs during `init`; subsequent commands also
check the schema. Never run two migration commands concurrently.

`requirements-tested.txt` records the exact environment used for this slice's
tests (including optional MCP and developer dependencies). It is a reproduction
snapshot, not a cross-platform release lock or a vulnerability audit.

## Structure

```text
interface_core/
  models.py            validated public data contracts
  policy.py            actor and authorization policy
  service.py           PeopleService + repository protocol
  repository.py        SQLitePeopleRepository; atomic writes/events
  database.py          connections and migrations
  app.py               HTTP adapter and static UI
  cli.py               init, serve, backup
  mcp_server.py        optional MCP-to-HTTP adapter
  migrations/          versioned SQL
  static/              HTML, CSS, and browser JavaScript; no build
tests/                 permissions, persistence, conflicts, transactions, MCP
docs/REBUILD.md         source inspection and incremental roadmap
```

OOP uses composition and dependency injection: `PeopleService` depends on a
`PeopleRepository` protocol and a `DirectoryPolicy`, with `SQLitePeopleRepository`
as the storage adapter. Browser code separates `ApiClient` and `DirectoryApp`.
HTTP and MCP stay thin adapters.

Extend by adding a domain operation with a typed input, permission check, and
transactional event, then expose it through HTTP and optionally MCP. Add a new
module when a second domain (e.g. leave) arrives. Don't create an empty plugin
framework or a generic workflow designer before there is a second real use case.

## Before a team pilot

Implement named identities, login/logout with revocable sessions, employee-to-user
mapping, field-level self-service policies, and attributable audit history. Add
TLS deployment configuration, host configuration, rate limits, upgrade/restore
tests, and an operational guide. Current binding and host allowlist intentionally
limit this slice to localhost. Key rotation currently requires replacing keys
locally and restarting; there is no key management UI. SQLite is suited to the
initial single-process deployment, not an untested multi-replica installation.

## License

MIT for the new implementation. The existing Interface name, logo geometry and
visual language are retained at the owner’s request; see `NOTICE`. The previous
application is retained in Git history rather than shipped alongside this rebuild.
