"""SQLite storage adapter; writes and events commit together."""
from datetime import datetime, timezone
import json
import sqlite3
from uuid import uuid4
from .database import SQLiteDatabase
from .models import PersonInput, PersonUpdate
from .policy import Actor, DomainError


class SQLitePeopleRepository:
    def __init__(self, database: SQLiteDatabase):
        self.database = database

    def list(self, q="", limit=50, offset=0):
        # Literal substring search: % and _ have no wildcard meaning.
        clause = "WHERE instr(casefold(name || ' ' || email || ' ' || department || ' ' || title), casefold(?)) > 0"
        with self.database.connect() as db:
            db.execute("BEGIN")  # Count and page see one consistent snapshot.
            total = db.execute(f"SELECT count(*) FROM people {clause}", (q,)).fetchone()[0]
            rows = db.execute(f"SELECT * FROM people {clause} ORDER BY name COLLATE NOCASE, id LIMIT ? OFFSET ?", (q, limit, offset))
            return dict(items=[dict(row) for row in rows], total=total, limit=limit, offset=offset)

    def get(self, person_id: str):
        with self.database.connect() as db:
            row = db.execute("SELECT * FROM people WHERE id = ?", (person_id,)).fetchone()
            if not row:
                raise DomainError(404, "Person not found")
            return dict(row)

    def save(self, actor: Actor, data: PersonInput, person_id=None):
        values = data.model_dump(exclude={"version"})
        now = datetime.now(timezone.utc).isoformat()
        try:
            with self.database.connect() as db:
                db.execute("BEGIN IMMEDIATE")
                if person_id:
                    old = db.execute("SELECT * FROM people WHERE id = ?", (person_id,)).fetchone()
                    if not old:
                        raise DomainError(404, "Person not found")
                    if not isinstance(data, PersonUpdate) or old["version"] != data.version:
                        raise DomainError(409, "This person changed. Reload before saving.")
                    changed = [key for key, value in values.items() if old[key] != value]
                    if not changed:
                        return dict(old)
                    db.execute("UPDATE people SET name=:name, email=:email, title=:title, department=:department, status=:status, version=version+1, updated_at=:now WHERE id=:id", dict(values, now=now, id=person_id))
                    event = "person.updated.v1"
                else:
                    person_id = str(uuid4())
                    changed = list(values)
                    db.execute("INSERT INTO people (id,name,email,title,department,status,created_at,updated_at) VALUES (:id,:name,:email,:title,:department,:status,:now,:now)", dict(values, id=person_id, now=now))
                    event = "person.created.v1"
                db.execute("INSERT INTO events(type,person_id,actor,occurred_at,changed_fields) VALUES (?,?,?,?,?)", (event, person_id, actor.name, now, json.dumps(changed)))
                return dict(db.execute("SELECT * FROM people WHERE id=?", (person_id,)).fetchone())
        except sqlite3.IntegrityError as exc:
            if "people.email" in str(exc):
                raise DomainError(409, "A person with that email already exists") from exc
            raise DomainError(500, "The change could not be saved") from exc

    def health(self):
        with self.database.connect() as db:
            db.execute("SELECT id FROM people LIMIT 1")

    def events(self, after=0, limit=100):
        with self.database.connect() as db:
            rows = db.execute("SELECT * FROM events WHERE sequence > ? ORDER BY sequence LIMIT ?", (after, limit))
            return [dict(row, changed_fields=json.loads(row["changed_fields"])) for row in rows]
