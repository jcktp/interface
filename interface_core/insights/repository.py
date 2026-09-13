from datetime import datetime, timezone
from uuid import uuid4
import sqlite3
from ..database import SQLiteDatabase
from ..events import ActivityJournal
from ..policy import DomainError


class SQLiteInsightsRepository:
    def __init__(self, database: SQLiteDatabase, journal=None):
        self.database = database
        self.journal = journal or ActivityJournal()

    def snapshot(self):
        with self.database.connect() as db:
            db.execute('BEGIN')
            people = [dict(row) for row in db.execute('SELECT p.id,p.name,p.status,p.department,e.hire_date,e.end_date,e.previous_company FROM people p LEFT JOIN employment_records e ON e.person_id=p.id')]
            finances = [dict(row) for row in db.execute('SELECT * FROM financial_periods ORDER BY end_date DESC,id')]
            plans = [dict(row) for row in db.execute('SELECT * FROM workforce_plans ORDER BY created_at DESC,id')]
            return people, finances, plans

    def employment(self, person_id):
        with self.database.connect() as db:
            row = db.execute('SELECT * FROM employment_records WHERE person_id=?', (person_id,)).fetchone()
            return dict(row) if row else None

    def save_employment(self, actor, person_id, data):
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            person = db.execute('SELECT status FROM people WHERE id=?', (person_id,)).fetchone()
            if not person:
                raise DomainError(404, 'Person not found')
            if person['status'] == 'inactive' and not data.end_date:
                raise DomainError(422, 'Inactive people require an employment end date')
            row = db.execute('SELECT * FROM employment_records WHERE person_id=?', (person_id,)).fetchone()
            version = row['version'] if row else 0
            if data.version != version:
                raise DomainError(409, 'Employment changed; reload before saving')
            db.execute('INSERT INTO employment_records VALUES (?,?,?,?,?) ON CONFLICT(person_id) DO UPDATE SET hire_date=excluded.hire_date,end_date=excluded.end_date,previous_company=excluded.previous_company,version=excluded.version', (person_id, data.hire_date.isoformat(), data.end_date.isoformat() if data.end_date else None, data.previous_company, version + 1))
            self.journal.record(db, 'employment', person_id, 'employment.updated.v1', actor.name)
            return dict(db.execute('SELECT * FROM employment_records WHERE person_id=?', (person_id,)).fetchone())

    def save_finance(self, actor, data):
        record_id = str(uuid4())
        try:
            with self.database.connect() as db:
                db.execute('INSERT INTO financial_periods(id,start_date,end_date,currency,revenue_minor,profit_minor) VALUES (?,?,?,?,?,?)', (record_id, data.start_date.isoformat(), data.end_date.isoformat(), data.currency, int(data.revenue * 100), int(data.profit * 100)))
                self.journal.record(db, 'finance', record_id, 'finance.created.v1', actor.name)
            return {'id': record_id}
        except sqlite3.IntegrityError as exc:
            raise DomainError(409, 'A financial record for this period and currency already exists') from exc

    def save_plan(self, actor, data):
        record_id = str(uuid4())
        with self.database.connect() as db:
            db.execute('INSERT INTO workforce_plans(id,name,target_headcount,annual_cost_minor,months,currency,created_at) VALUES (?,?,?,?,?,?,?)', (record_id, data.name, data.target_headcount, int(data.annual_cost_per_employee * 100), data.months, data.currency, datetime.now(timezone.utc).isoformat()))
            self.journal.record(db, 'plan', record_id, 'plan.created.v1', actor.name)
        return {'id': record_id}

    def update_finance(self, actor, record_id, data):
        try:
            with self.database.connect() as db:
                db.execute('BEGIN IMMEDIATE')
                changed = db.execute('UPDATE financial_periods SET start_date=?,end_date=?,currency=?,revenue_minor=?,profit_minor=?,version=version+1 WHERE id=? AND version=?', (data.start_date.isoformat(), data.end_date.isoformat(), data.currency, int(data.revenue*100), int(data.profit*100), record_id, data.version)).rowcount
                if not changed:
                    raise DomainError(409, 'Financial period changed or is missing; reload before saving')
                self.journal.record(db, 'finance', record_id, 'finance.updated.v1', actor.name)
            return {'id': record_id, 'version': data.version+1}
        except sqlite3.IntegrityError as exc:
            raise DomainError(409, 'A financial record for this period and currency already exists') from exc

    def update_plan(self, actor, record_id, data):
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            changed = db.execute('UPDATE workforce_plans SET name=?,target_headcount=?,annual_cost_minor=?,months=?,currency=?,version=version+1 WHERE id=? AND version=?', (data.name, data.target_headcount, int(data.annual_cost_per_employee*100), data.months, data.currency, record_id, data.version)).rowcount
            if not changed:
                raise DomainError(409, 'Plan changed or is missing; reload before saving')
            self.journal.record(db, 'plan', record_id, 'plan.updated.v1', actor.name)
        return {'id': record_id, 'version': data.version+1}
