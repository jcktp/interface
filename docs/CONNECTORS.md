# Connectors and single sign-on

All integrations are optional. The application starts empty and makes no provider
calls until an administrator runs a connector or a user starts SSO. Credentials stay
on the server. Only implemented providers appear in the app.

| Provider | Implemented capability | Not included |
|---|---|---|
| Ashby | Verify API access; resumable candidate name/email import; external-ID upserts and manual refresh | Applications, hiring stages, hire-to-employee conversion, incremental sync tokens |
| Ashby hired applications | Candidate/job/team/source context into a reviewed hire inbox | Offer/start-date enrichment, automatic employee creation |
| Greenhouse Harvest | Verify API access; resumable candidate name/email import and refresh | Applications and hire-to-employee conversion |
| Google Workspace | Delegated read-only directory import: names, email, suspended status and Google user ID | Provisioning, automatic HR changes, group membership and deletion propagation |
| Google sign-in | Authorization code + PKCE, signed ID-token verification and explicitly linked Interface accounts | Automatic email-based linking or domain-wide admission |
| Okta sign-in | OIDC using an organization or authorization-server issuer and linked accounts | SAML, SCIM, custom Okta domains, provider logout/session revocation events |
| Slack | Token/workspace verification through auth.test | Sending messages, notifications or user synchronization |

The adapters execute real HTTP requests. Automated tests use simulated providers and
real cryptographic signing/verification. No customer tenant has been connected or
live-validated yet. A successful local test is not a claim of live tenant validation.

## Install

```sh
python -m pip install -e '.[integrations]'
```

This installs Google's credential library and PyJWT with cryptographic support.
The base HRIS and Ashby/Greenhouse/Slack do not require this extra. No extra database,
Docker service or frontend build is needed.

## Ashby

1. Create an Ashby API key with **candidatesRead** permission.
2. Set `INTERFACE_CONNECTOR_ASHBY` to that key in the server environment and restart
   Interface. Keep credentials in your deployment secret manager; never commit them.
3. In **Connectors → Add connection**, choose **ashby**, give it a name and enter
   `INTERFACE_CONNECTOR_ASHBY` as the credentials variable.
4. Select **Test connection**, then **Sync next page** until the result says complete.
   Each request imports at most 100 candidate names and primary-listed email addresses.
5. **Start refresh** begins another complete pass. Existing candidates update by source
   ID. Imports remain separate from employees and never create login accounts.

The adapter uses fixed `https://api.ashbyhq.com/candidate.list` requests, HTTP Basic
API-key authentication and opaque pagination cursors. It currently performs full
refreshes, not Ashby's incremental sync-token protocol.
[Endpoint](https://developers.ashbyhq.com/reference/candidatelist) ·
[Authentication](https://developers.ashbyhq.com/docs/authentication) ·
[Pagination](https://developers.ashbyhq.com/docs/pagination)

## Google Workspace directory

1. Enable the Admin SDK API in your Google Cloud project and create a service account
   with domain-wide delegation. Download its JSON credentials into private storage.
2. In Google Admin's domain-wide delegation settings, authorize its client ID for only
   `https://www.googleapis.com/auth/admin.directory.user.readonly`.
3. Choose an administrator with permission to read the directory as the delegated subject.
4. Store the following JSON object as the value of `INTERFACE_CONNECTOR_WORKSPACE`.
   `service_account` is the complete downloaded service-account object; do not put it
   in this repository or in the browser form.

```json
{
  "delegated_subject": "directory-admin@example.com",
  "service_account": {
    "type": "service_account",
    "client_email": "service-account@project.iam.gserviceaccount.com",
    "private_key": "REPLACE_WITH_THE_PRIVATE_KEY_FROM_GOOGLE_JSON",
    "token_uri": "https://oauth2.googleapis.com/token"
  }
}
```

5. Restart Interface. Add a **google_workspace** connection referencing that environment
   variable, test it, then sync pages. The library refreshes access tokens automatically.

The Workspace preview shows up to 100 imported users, including suspended status.
It never overwrites HR records, creates accounts or assigns roles. A suspended Google
record therefore does **not** deactivate an Interface account: HR must deactivate it
explicitly in Accounts. Directory pagination tokens can expire; restart a refresh if
Google rejects an old cursor. Deleted source records remain in the local snapshot.
[Google delegation setup](https://developers.google.com/identity/protocols/oauth2/service-account) ·
[Directory users API](https://developers.google.com/workspace/admin/directory/reference/rest/v1/users/list)

## Google or Okta SSO

SSO and directory import are separate capabilities. SSO does not require a Workspace
service account. Use an OAuth/OIDC **web application** with a client secret and the
authorization-code flow. The server's public origin must match the browser origin:

```sh
export INTERFACE_PUBLIC_URL='https://hr.example.com'
export INTERFACE_SSO_GOOGLE_CLIENT_ID='your-google-web-client-id'
export INTERFACE_SSO_GOOGLE_CLIENT_SECRET='your-google-web-client-secret'
export INTERFACE_SSO_OKTA_CLIENT_ID='your-okta-web-client-id'
export INTERFACE_SSO_OKTA_CLIENT_SECRET='your-okta-web-client-secret'
export INTERFACE_SSO_OKTA_ISSUER='https://your-org.okta.com'
interface serve --allowed-host hr.example.com
```

Configure one provider or both. The secret values above are placeholders, not shipped
credentials. Provide them through your deployment environment. Register these exact
redirect URIs in the corresponding provider application:

- Google: `https://hr.example.com/api/v1/auth/sso/google/callback`
- Okta: `https://hr.example.com/api/v1/auth/sso/okta/callback`

Okta also supports an explicit authorization-server issuer such as
`https://your-org.okta.com/oauth2/default`. Supported hosts are organization subdomains
of `okta.com`, `oktapreview.com` and `okta-emea.com`. Use client-secret POST authentication
for the token endpoint. Assign the intended users to the Okta application. Configure
RS256 ID tokens. Custom domains and other signing algorithms are not supported yet.

For local development only, an HTTP origin at `localhost` or `127.0.0.1` is accepted;
include its port in the origin and both redirect registrations. HTTPS is required for
other hosts. Keep `--allowed-host` aligned with the origin's hostname.

After restarting:

1. Create a person and an Interface account in **Accounts**. Choose the Interface role.
   Leave the initial password empty for **SSO-only** access, or set a password for
   deliberate local fallback. There is no organization-wide SSO enforcement switch.
2. In **Connectors → Link an SSO identity**, select the provider and Interface account.
3. Enter the provider's stable **subject (`sub`)**, not an assumed email address.
   Google's user ID is visible in the imported Workspace directory. For Okta, obtain
   the subject for the selected authorization server/application from your identity
   administrator; custom claim mappings can change its value. Verify the person first.
4. Sign out and use **Continue with Google** or **Continue with Okta**. Buttons appear
   only for configured providers. Matching email addresses alone never grant access.
5. Once named administration works, disable setup keys with `--disable-access-keys`.

The implementation checks RS256 signature, issuer, audience, authorized party where
applicable, expiry and nonce, plus browser-bound state and PKCE. Temporary attempts
expire in five minutes. A single-use HttpOnly handoff expires after 60 seconds; the
same-origin exchange creates a normal 12-hour Interface session held in browser memory.
No access token or session token appears in redirect URLs. Unlinking an identity or
locally deactivating an account revokes sessions. Provider-side logout/deactivation
is not continuously polled: existing Interface sessions can remain valid until their
expiry or local revocation. Apply local deactivation for immediate removal.

Proxy access logs should omit query strings on SSO callbacks because authorization
codes are present there. Interface's CLI disables Uvicorn access logs for this reason.
Never enable request-body logging for token exchanges. Local logout revokes the
Interface session; it does not sign out of Google or Okta.
[Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect) ·
[Okta validation](https://developer.okta.com/docs/guides/validate-id-tokens/main/) ·
[JWT implementation](https://pyjwt.readthedocs.io/en/stable/usage.html)

## Greenhouse, Slack and sync behavior

Set an `INTERFACE_CONNECTOR_*` variable on the server and enter its name in Connectors.
Greenhouse requires Harvest candidate-list permission. Slack uses a token authorized
for `auth.test`; nothing is posted. Credentials are never stored in connection rows.
[Harvest](https://docs.greenhouse.io/harvest.html) ·
[Slack auth.test](https://docs.slack.dev/reference/methods/auth.test/)

Manual sync imports one page per action. Records and cursor advancement share a
transaction and journal entry. A revision check rejects concurrent syncs, including
pages that arrive after a refresh was restarted. Failed requests leave progress intact;
use retry for rate limits/network failures. There is no scheduler or automatic backoff.
The browser previews the first 100 records by name. Source deletions are not propagated.

## Extend the system

A `ProviderSpec` and adapter define capabilities. `test(secret)` verifies read access;
`sync(secret, page, cursor)` returns normalized records, next page (0 when complete)
and an opaque cursor. The service authorizes HR access and resolves secrets, while the
repository owns transactional persistence. SSO has a separate service/repository and
explicit provider configuration because it grants authentication rather than importing
data. Add a migration for new domains; do not overwrite HR-owned fields implicitly.

Next capabilities: candidate applications and reviewed hire conversion, Lever and
SmartRecruiters, SCIM provisioning, invitations/recovery, durable Slack/Jira/Confluence
notifications, payroll reconciliation and optional AI adapters with explicit data-sharing
controls. These are not implemented by the current connectors.

## Hired applications

Choose `ashby_hires` for the application-context workflow and `ashby` for the earlier
candidate-only snapshot. Both use candidatesRead. See [hire inbox and restoration guide](RESTORATION.md)
for exact mappings, review steps and date limitations.
