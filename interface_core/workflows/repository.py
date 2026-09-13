from datetime import datetime, timezone
from uuid import uuid4
from ..database import SQLiteDatabase
from ..events import ActivityJournal
from ..policy import DomainError
from .policy import WorkflowPolicy


class SQLiteWorkflowRepository:
    def __init__(self, database: SQLiteDatabase, policy=None, journal=None):
        self.database = database
        self.policy = policy or WorkflowPolicy()
        self.journal = journal or ActivityJournal()

    def list_leave(self, actor, limit, offset):
        where, args = ('', []) if actor.role == 'admin' else ('WHERE l.person_id=?', [actor.person_id])
        with self.database.connect() as db:
            return [dict(row) for row in db.execute(f'SELECT l.*,p.name FROM leave_requests l JOIN people p ON p.id=l.person_id {where} ORDER BY l.created_at DESC,l.id LIMIT ? OFFSET ?', (*args, limit, offset))]

    def create_leave(self, actor, data):
        values = data.model_dump(mode='json')
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            existing = db.execute("SELECT * FROM leave_requests WHERE person_id=? AND start_date=? AND end_date=? AND kind=? AND status IN ('requested','approved')", (actor.person_id, values['start_date'], values['end_date'], data.kind)).fetchone()
            if existing:
                # Exact retries do not duplicate live requests; cancelled dates can be requested again.
                if existing['note'] != data.note:
                    raise DomainError(409, 'A request for these dates exists with a different note')
                return dict(existing)
            overlap = db.execute("SELECT 1 FROM leave_requests WHERE person_id=? AND status IN ('requested','approved') AND start_date<=? AND end_date>=?", (actor.person_id, values['end_date'], values['start_date'])).fetchone()
            if overlap:
                raise DomainError(409, 'These dates overlap an existing request')
            record_id = str(uuid4())
            db.execute("INSERT INTO leave_requests(id,person_id,start_date,end_date,kind,note,status,created_at) VALUES (?,?,?,?,?,?,'requested',?)", (record_id, actor.person_id, values['start_date'], values['end_date'], data.kind, data.note, datetime.now(timezone.utc).isoformat()))
            self.journal.record(db, 'leave', record_id, 'leave.requested.v1', actor.name)
            return dict(db.execute('SELECT * FROM leave_requests WHERE id=?', (record_id,)).fetchone())

    def transition_leave(self, actor, record_id, data):
        target = {'approve': 'approved', 'reject': 'rejected', 'cancel': 'cancelled'}[data.action]
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT * FROM leave_requests WHERE id=?', (record_id,)).fetchone()
            if not row:
                raise DomainError(404, 'Request not found')
            self.policy.view(actor, row['person_id'])
            self.policy.decide_leave(actor, row, data.action)
            if row['status'] == target:
                return dict(row)
            if row['version'] != data.version:
                raise DomainError(409, 'Request changed; reload before acting')
            allowed = row['status'] == 'requested' or (data.action == 'cancel' and row['status'] == 'approved')
            if not allowed:
                raise DomainError(409, 'This request is already closed')
            db.execute('UPDATE leave_requests SET status=?,decided_by=?,version=version+1 WHERE id=?', (target, actor.name, record_id))
            self.journal.record(db, 'leave', record_id, f'leave.{target}.v1', actor.name)
            return dict(db.execute('SELECT * FROM leave_requests WHERE id=?', (record_id,)).fetchone())

    def list_tasks(self, actor, limit, offset):
        where, args = ('', []) if actor.role == 'admin' else ('WHERE t.person_id=?', [actor.person_id])
        with self.database.connect() as db:
            return [dict(row) for row in db.execute(f'SELECT t.*,p.name FROM onboarding_tasks t JOIN people p ON p.id=t.person_id {where} ORDER BY t.due_date,t.id LIMIT ? OFFSET ?', (*args, limit, offset))]

    def create_task(self, actor, data):
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            person = db.execute("SELECT 1 FROM people WHERE id=? AND status='active'", (data.person_id,)).fetchone()
            if not person:
                raise DomainError(422, 'Select an active person')
            record_id = str(uuid4())
            db.execute("INSERT INTO onboarding_tasks(id,person_id,title,due_date,status,created_at) VALUES (?,?,?,?,'open',?)", (record_id, data.person_id, data.title, data.due_date.isoformat(), datetime.now(timezone.utc).isoformat()))
            self.journal.record(db, 'task', record_id, 'task.created.v1', actor.name)
            return dict(db.execute('SELECT * FROM onboarding_tasks WHERE id=?', (record_id,)).fetchone())

    def transition_task(self, actor, record_id, data):
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT * FROM onboarding_tasks WHERE id=?', (record_id,)).fetchone()
            if not row:
                raise DomainError(404, 'Task not found')
            self.policy.view(actor, row['person_id'])
            if row['status'] == data.status:
                return dict(row)
            if row['version'] != data.version:
                raise DomainError(409, 'Task changed; reload before acting')
            db.execute('UPDATE onboarding_tasks SET status=?,version=version+1 WHERE id=?', (data.status, record_id))
            self.journal.record(db, 'task', record_id, f'task.{data.status}.v1', actor.name)
            return dict(db.execute('SELECT * FROM onboarding_tasks WHERE id=?', (record_id,)).fetchone())
