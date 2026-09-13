CREATE TABLE people (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    title TEXT NOT NULL,
    department TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('active', 'inactive')),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE events (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    person_id TEXT NOT NULL REFERENCES people(id),
    actor TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    changed_fields TEXT NOT NULL
);
