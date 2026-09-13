# Validation — 0.2.0

Checked locally on 2026-09-13 with Python 3.14.7/macOS.

- **37 tests pass.** Includes actual HTTP/MCP stdio integration, directory validation,
  permissions, persistent sessions, session expiry/revocation, password changes,
  account deactivation, self-service isolation, leave overlaps/approvals/self-approval
  rejection/cancellation, task ownership, transactional rollback, v1 schema upgrade,
  backup contents and overwrite refusal, Unicode search, financial ratios, missing
  data, zero division, partial-period employment, scenario costs and stale edits.
- Connector tests use HTTP response fixtures: Greenhouse authentication, pagination,
  upserts and secret-reference storage; missing credentials, Slack rejection, hostile
  pagination and redacted network errors. No live customer credentials were supplied.
- Additional connector/SSO tests cover Ashby cursors and malformed responses, refresh
  conflicts and rollback, delegated Google JWT signing and token reuse, Workspace
  pagination/suspended status and import isolation, Google/Okta authorization-code flows
  with real RSA signatures and PKCE, invalid issuer/audience/nonce/expiry/signature,
  state/browser binding, replay rejection, identity-link conflicts, same-origin handoff,
  SSO-only accounts and session revocation. Provider HTTP is simulated in these tests.
- Browser inspection confirmed the updated sign-in screen, setup-key login, module
  navigation and live empty insights/planning screen. Employee workflows are exercised
  end-to-end through HTTP; browser form submission is not yet automated in the suite.
- Directory performance baseline: 4,500 synthetic records, 100 in-process authenticated
  search/page requests; median **3.15 ms**, p95 **3.35 ms**. Each response asserts the
  correct filtered total and page size. Excludes network latency and concurrency;
  this is not a production load benchmark or a comparison with the old application.
- JavaScript syntax checks pass. Two upstream test-adapter deprecation warnings remain
  (Starlette/httpx and AnyIO). The tested dependency snapshot is requirements-tested.txt.

```sh
python -m pip install -e '.[dev,mcp,integrations]'
pytest
python tests/performance_check.py
```

Synthetic fixtures live only in temporary tests. Application startup stays empty.

Not yet validated: live provider accounts, HTTPS proxy setup, other operating systems,
multiple replicas, sustained concurrent writers, full security audit and recovery drill.
The provider roadmap and operations guide state these limits explicitly.

Integration follow-up: the app starts from a fresh virtual environment in the relocated
project. The real HTTP login, admin role, connector registry, SSO settings and in-app
setup page were checked locally. A test administrator was created only in the operator’s
ignored local database on request; no account or seed data is part of the repository.
