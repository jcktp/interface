ALTER TABLE connections ADD COLUMN cursor TEXT NOT NULL DEFAULT '';
ALTER TABLE connections ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
CREATE TABLE workspace_users (
 connection_id TEXT NOT NULL REFERENCES connections(id), external_id TEXT NOT NULL,
 name TEXT NOT NULL, email TEXT NOT NULL, suspended INTEGER NOT NULL,
 synced_at TEXT NOT NULL, PRIMARY KEY(connection_id,external_id)
);
CREATE TABLE sso_links (
 issuer TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
 PRIMARY KEY(issuer,subject), UNIQUE(issuer,user_id)
);
CREATE TABLE sso_attempts (
 state_hash TEXT PRIMARY KEY, browser_hash TEXT NOT NULL, provider TEXT NOT NULL,
 nonce TEXT NOT NULL, verifier TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE sso_handoffs (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
);
