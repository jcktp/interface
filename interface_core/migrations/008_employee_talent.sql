CREATE TABLE private_details (person_id TEXT PRIMARY KEY REFERENCES people(id), kind TEXT NOT NULL DEFAULT 'personal', payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE bank_details (person_id TEXT PRIMARY KEY REFERENCES people(id), payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE contracts (person_id TEXT PRIMARY KEY REFERENCES people(id), payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE talent_records (person_id TEXT PRIMARY KEY REFERENCES people(id), payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE import_batches (id TEXT PRIMARY KEY, actor TEXT NOT NULL, payload TEXT NOT NULL, expires_at INTEGER NOT NULL, result TEXT);
CREATE TABLE hiring_inbox (connection_id TEXT NOT NULL REFERENCES connections(id), external_id TEXT NOT NULL, payload TEXT NOT NULL, person_id TEXT REFERENCES people(id), version INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(connection_id,external_id));
CREATE TABLE leave_allowances (person_id TEXT NOT NULL REFERENCES people(id), year INTEGER NOT NULL, days INTEGER NOT NULL CHECK(days>=0), version INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(person_id,year));
CREATE TABLE quality_assessments (sequence INTEGER PRIMARY KEY AUTOINCREMENT, person_id TEXT NOT NULL REFERENCES people(id), payload TEXT NOT NULL, actor TEXT NOT NULL, recorded_at TEXT NOT NULL);
CREATE INDEX quality_person ON quality_assessments(person_id,sequence);
