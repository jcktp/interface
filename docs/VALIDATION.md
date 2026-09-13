# Validation

Checked 2026-09-13 on the local macOS host with Python 3.14.7.

- `pytest`: **8 passed**. Covers read/write authorization, explicit field validation,
  duplicate email handling, stale-version conflicts, persistence after reopening,
  event rollback, filtered pagination, Unicode case-insensitive search, separate
  database isolation, HTTP/static routes, host checks, CLI initialization, backup
  overwrite refusal, readable backup contents, key-file permissions, and a real
  MCP stdio handshake/list/tool call through a running HTTP server.
- Browser: inspected Interface's restored logo/sidebar/slate styling, authenticated
  directory, and final empty state displaying **0 people**. The final app has no
  demo loader. Browser form submission was not automated end-to-end; create/edit
  behavior is covered at the HTTP/domain boundary.
- Opt-in performance check: 4,500 synthetic people in a temporary database, 100
  authenticated API calls searching Engineering with 20 rows per page. Each response
  asserted a total of 2,250 and exactly 20 returned rows. Median **3.03 ms**, p95
  **3.23 ms**; initial migration **0.67 ms**. Uses FastAPI's in-process test client,
  so excludes real network latency and is not a load/concurrency benchmark. No
  before/after speed claim against the old application has been measured.
- Two upstream deprecation warnings occur in Starlette's httpx/AnyIO test adapter;
  tests pass. Dependencies are recorded in `requirements-tested.txt`.

Reproduce from the repository root after installing `.[dev,mcp]`:

```sh
pytest
python tests/performance_check.py
```

Performance fixtures are temporary and are never loaded by `interface init` or
`interface serve`. Tests do not require third-party accounts or LLM services.

Not validated: deployment on other operating systems/Python versions, simultaneous
writers under load, multi-replica operation, external HR provider sync, remote MCP,
and real employee identity. Those remain later roadmap milestones.
