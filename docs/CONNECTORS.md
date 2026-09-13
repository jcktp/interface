# Connector capabilities and plan

Interface treats identity, data synchronization, messaging and AI as different
capabilities. A common settings screen does not make their security models interchangeable.
Only real implemented adapters appear in the app's provider dropdown.

## Shipped

| Provider | Capability | Setup | Validation |
|---|---|---|---|
| Greenhouse Harvest | Candidate name/email import; page cursor, external-ID upsert, manual refresh | Server environment variable; candidate-list permission on Harvest API key | Contract tests for Basic authentication, mapping, paging, retries/upserts and hostile pagination links; no live customer account tested |
| Slack | Verify token and workspace with auth.test | Server environment variable containing Slack token | Success/error request path implemented; mocked invalid-token and failure tests; no live workspace tested |

[Greenhouse's Harvest API](https://docs.greenhouse.io/harvest.html) uses HTTPS Basic
Auth with the key as username and an empty password. Interface requests only the
candidate-list endpoint and saves names/emails, not raw payloads, attachments or
interview material. It does not import candidates into the employee directory.

[Slack auth.test](https://docs.slack.dev/reference/methods/auth.test/) checks the
configured credential. A verified connection does not imply notifications, slash
commands or user sync exist. Those capabilities are not shipped.

Secrets are read from `INTERFACE_CONNECTOR_*` environment variables. The database
contains secret references only. The adapters use fixed HTTPS provider hosts, do not
follow redirects or environment proxies, and do not log provider error bodies/tokens.
Errors preserve the last completed cursor. Manual retry is supported; automatic
backoff/scheduling, source-deletion handling and conflict review are future work.

## Next adapters, in implementation order

| Family | Requested providers | Concrete next capability / acceptance criterion |
|---|---|---|
| Identity | Okta, generic OIDC, Google Workspace | Named sign-in using state/nonce/PKCE, verified issuer/audience, explicit person mapping, no automatic admin grant; test revoked users and account linking |
| ATS | Ashby, Lever, SmartRecruiters | Candidate/application schemas, source IDs and resumable cursors; validate a real sandbox and repeat imports without duplication |
| Collaboration | Slack, Jira, Confluence | Durable outbound notification/task queue; least-privilege OAuth, explicit destination, bounded retries and replay visibility |
| Directory | Google Workspace | Admin-authorized user import with field ownership and deactivation review; never silently grant roles |
| Payroll | Selected payroll vendor | Export/import contract and reconciliation first; no claim to calculate taxes or submit payroll until validated per provider |
| AI | Anthropic/Claude, OpenAI APIs, Google/Gemini | Optional model/provider adapter, explicit data-sharing controls, usage limits and permission-filtered tools; no provider required to run Interface |

A ChatGPT consumer subscription is not treated as an API credential. The same
principle applies to consumer chat products from other providers. MCP can connect
an agent to Interface independently of a built-in AI-provider integration.

## Extension contract

1. Add a `ProviderSpec` with capability names and an adapter implementing the
   `ProviderAdapter` protocol. No empty placeholders in the live registry.
2. Define a typed configuration schema and the precise credential scopes. Resolve
   secrets only on the server; OAuth adapters will need encrypted token storage.
3. Add connection verification against a harmless, read-only provider endpoint.
4. For sync, normalize into a domain-specific contract. Keep stable external IDs,
   cursor state and writes in one transaction; never overwrite HR-owned fields silently.
5. Add contract tests for 401/403/429, malformed payloads, pagination, repeated pages,
   rate limits and deleted records. Require a live sandbox verification before labeling
   a connector as production-validated.
6. Expose setup, last result and retry controls in the common UI, with accurate
   capability labels. Notifications and financial submissions need separate actions.

There is no hidden provider connection, automatic external message, telemetry or AI
call on startup. All connector network requests require an admin action in the app/API.
