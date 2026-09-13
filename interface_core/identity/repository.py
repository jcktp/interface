import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

from ..database import SQLiteDatabase
from ..events import EventJournal
from ..policy import Actor, DomainError


class SQLiteIdentityRepository:
    def __init__(self, database: SQLiteDatabase, journal: EventJournal | None = None):
        self.database = database
        self.journal = journal or EventJournal()

    def create(self, actor: Actor, person_id: str, role: str, password_hash: str):
        account_id = str(uuid4())
        try:
            with self.database.connect() as db:
                db.execute("BEGIN IMMEDIATE")
                person = db.execute("SELECT status FROM people WHERE id=?", (person_id,)).fetchone()
                if not person or person['status'] != 'active':
                    raise DomainError(422, "Select an active person")
                db.execute("INSERT INTO users(id,person_id,role,password_hash,created_at) VALUES (?,?,?,?,?)", (account_id, person_id, role, password_hash, datetime.now(timezone.utc).isoformat()))
                self.journal.record(db, "account.created.v1", person_id, actor.name, ["role"])
            return {"id": account_id, "person_id": person_id, "role": role, "active": True}
        except sqlite3.IntegrityError as exc:
            if "users.person_id" in str(exc):
                raise DomainError(409, "This person already has an account") from exc
            raise

    def find_by_email(self, email: str):
        with self.database.connect() as db:
            row = db.execute("SELECT u.*,p.status FROM users u JOIN people p ON p.id=u.person_id WHERE p.email=? COLLATE NOCASE", (email,)).fetchone()
            return dict(row) if row else None

    def create_session(self, user_id: str, token_hash: str, expires_at: int, now: int, verified_hash: str):
        with self.database.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT u.active,p.status,u.person_id FROM users u JOIN people p ON p.id=u.person_id WHERE u.id=? AND u.password_hash=?", (user_id, verified_hash)).fetchone()
            if not row or not row['active'] or row['status'] != 'active':
                raise DomainError(401, "Invalid email or password")
            db.execute("DELETE FROM sessions WHERE expires_at<=?", (now,))
            db.execute("INSERT INTO sessions VALUES (?,?,?)", (token_hash, user_id, expires_at))
            self.journal.record(db, "session.created.v1", row['person_id'], user_id, [])

    def authenticate(self, token_hash: str, now: int):
        with self.database.connect() as db:
            row = db.execute("SELECT u.id,u.person_id,u.role FROM sessions s JOIN users u ON u.id=s.user_id JOIN people p ON p.id=u.person_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1 AND p.status='active'", (token_hash, now)).fetchone()
            return Actor(row['id'], row['role'], row['person_id']) if row else None

    def revoke(self, token_hash: str, actor: Actor):
        with self.database.connect() as db:
            db.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash,))
            self.journal.record(db, "session.revoked.v1", actor.person_id, actor.name, [])

    def list(self, limit: int, offset: int):
        with self.database.connect() as db:
            return [dict(row) for row in db.execute("SELECT u.id,u.person_id,u.role,u.active,p.name,p.email FROM users u JOIN people p ON p.id=u.person_id ORDER BY p.name,u.id LIMIT ? OFFSET ?", (limit, offset))]

    def set_active(self, actor: Actor, user_id: str, active: bool):
        with self.database.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT person_id FROM users WHERE id=?", (user_id,)).fetchone()
            if not row:
                raise DomainError(404, "Account not found")
            db.execute("UPDATE users SET active=? WHERE id=?", (int(active), user_id))
            if not active:
                db.execute("DELETE FROM sessions WHERE user_id=?", (user_id,))
            self.journal.record(db, "account.state_changed.v1", row['person_id'], actor.name, ["active"])
        return {"id": user_id, "active": active}

    def password_hash(self, user_id: str):
        with self.database.connect() as db:
            return db.execute("SELECT password_hash FROM users WHERE id=?", (user_id,)).fetchone()[0]

    def change_password(self, actor: Actor, old_hash: str, new_hash: str):
        with self.database.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            changed = db.execute("UPDATE users SET password_hash=? WHERE id=? AND password_hash=?", (new_hash, actor.name, old_hash)).rowcount
            if not changed:
                raise DomainError(409, "Password changed; sign in again")
            db.execute("DELETE FROM sessions WHERE user_id=?", (actor.name,))
            self.journal.record(db, "account.password_changed.v1", actor.person_id, actor.name, [])
