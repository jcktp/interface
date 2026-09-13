from datetime import datetime, timezone
from uuid import uuid4
from ..database import SQLiteDatabase
from ..events import ActivityJournal
from ..policy import DomainError


class SQLiteConnectorRepository:
    def __init__(self, database: SQLiteDatabase, journal=None):
        self.database=database
        self.journal=journal or ActivityJournal()

    def list(self):
        with self.database.connect() as db:
            connections=[dict(row) for row in db.execute('SELECT * FROM connections ORDER BY name,id')]
            candidates=[dict(row) for row in db.execute('SELECT c.*,x.provider FROM candidates c JOIN connections x ON x.id=c.connection_id ORDER BY c.name,c.external_id LIMIT 100')]
            return connections,candidates

    def get(self, connection_id):
        with self.database.connect() as db:
            row=db.execute('SELECT * FROM connections WHERE id=?',(connection_id,)).fetchone()
            if not row:
                raise DomainError(404,'Connection not found')
            return dict(row)

    def create(self,actor,data):
        connection_id=str(uuid4())
        with self.database.connect() as db:
            db.execute('INSERT INTO connections(id,name,provider,secret_env) VALUES (?,?,?,?)',(connection_id,data.name,data.provider,data.secret_env))
            self.journal.record(db,'connection',connection_id,'connection.created.v1',actor.name)
        return self.get(connection_id)

    def status(self,actor,connection_id,status,message):
        with self.database.connect() as db:
            db.execute('UPDATE connections SET status=?,message=? WHERE id=?',(status,message,connection_id))
            self.journal.record(db,'connection',connection_id,'connection.tested.v1',actor.name)
        return self.get(connection_id)

    def sync(self,actor,connection,records,next_page):
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row=db.execute('SELECT next_page FROM connections WHERE id=?',(connection['id'],)).fetchone()
            if row['next_page']!=connection['next_page']:
                raise DomainError(409,'Another sync already advanced this connection; refresh')
            for record in records:
                db.execute('INSERT INTO candidates VALUES (?,?,?,?,?) ON CONFLICT(connection_id,external_id) DO UPDATE SET name=excluded.name,email=excluded.email,synced_at=excluded.synced_at',(connection['id'],record['external_id'],record['name'],record['email'],datetime.now(timezone.utc).isoformat()))
            db.execute("UPDATE connections SET next_page=?,status='verified',message=? WHERE id=?",(next_page,f"Imported {len(records)} records. " + ('More pages available.' if next_page else 'Sync complete.'),connection['id']))
            self.journal.record(db,'connection',connection['id'],'connection.synced.v1',actor.name)
        return self.get(connection['id'])

    def restart_sync(self, actor, connection_id):
        with self.database.connect() as db:
            db.execute("UPDATE connections SET next_page=1,message='Refresh ready. Sync the next page to begin.' WHERE id=?", (connection_id,))
            self.journal.record(db, 'connection', connection_id, 'connection.refresh_requested.v1', actor.name)
        return self.get(connection_id)
