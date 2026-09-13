CREATE TABLE connections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    secret_env TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_tested',
    message TEXT NOT NULL DEFAULT '',
    next_page INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE candidates (
    connection_id TEXT NOT NULL REFERENCES connections(id),
    external_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    synced_at TEXT NOT NULL,
    PRIMARY KEY(connection_id,external_id)
);
