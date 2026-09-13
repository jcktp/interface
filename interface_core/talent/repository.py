import json,time
from uuid import uuid4
from ..policy import DomainError
from ..events import ActivityJournal
from .writer import EmployeeWriter
from .assessments import AssessmentHistory

class SQLiteTalentRepository:
    def __init__(self,database,journal=None):
        self.database=database;self.journal=journal or ActivityJournal();self.writer=EmployeeWriter(self.journal)
    def get(self,person_id):
        with self.database.connect() as db:
            row=db.execute('SELECT * FROM talent_records WHERE person_id=?',(person_id,)).fetchone()
            return {**json.loads(row['payload']),'version':row['version']} if row else {'version':0}
    def save(self,actor,person_id,data):
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if not db.execute('SELECT id FROM people WHERE id=?',(person_id,)).fetchone():raise DomainError(404,'Person not found')
            row=db.execute('SELECT version,payload FROM talent_records WHERE person_id=?',(person_id,)).fetchone()
            if (row['version'] if row else 0)!=data.version:raise DomainError(409,'Hiring record changed; reload')
            AssessmentHistory().record(db,actor,person_id,data.model_dump(mode='json'),json.loads(row['payload']) if row else None)
            db.execute('INSERT INTO talent_records VALUES (?,?,?) ON CONFLICT(person_id) DO UPDATE SET payload=excluded.payload,version=excluded.version',(person_id,data.model_dump_json(exclude={'version'}),data.version+1))
            self.journal.record(db,'talent',person_id,'talent.updated.v1',actor.name)
        return self.get(person_id)
    def snapshot(self):
        with self.database.connect() as db:
            return [{**dict(row),**json.loads(row['payload'] or '{}')} for row in db.execute('SELECT p.id,p.name,p.email,p.department,p.status,e.hire_date,e.end_date,e.previous_company,t.payload FROM people p LEFT JOIN employment_records e ON e.person_id=p.id LEFT JOIN talent_records t ON t.person_id=p.id')]
    def preview(self,actor,rows,mode):
        from pydantic import ValidationError
        records=[];errors=[]
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            for index,values in rows:
                try:records.append({'row':index,**self.writer.prepare(db,values,mode)})
                except (ValidationError,DomainError,KeyError) as error:
                    message=error.message if isinstance(error,DomainError) else '; '.join(e['msg'] for e in error.errors()) if isinstance(error,ValidationError) else 'Name and email are required'
                    errors.append({'row':index,'message':message})
            batch_id=str(uuid4())
            db.execute('DELETE FROM import_batches WHERE expires_at<=?',(int(time.time()),))
            if not errors:
                db.execute('INSERT INTO import_batches VALUES (?,?,?,?,NULL)',(batch_id,actor.name,json.dumps(records),int(time.time())+3600))
                self.journal.record(db,'import',batch_id,'import.previewed.v1',actor.name)
        return {'batch_id':batch_id if not errors else None,'rows':records,'errors':errors,'creates':sum(r['person_id'] is None for r in records),'updates':sum(r['person_id'] is not None for r in records)}
    def commit(self,actor,batch_id):
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            batch=db.execute('SELECT * FROM import_batches WHERE id=? AND actor=? AND expires_at>?',(batch_id,actor.name,int(time.time()))).fetchone()
            if not batch:raise DomainError(404,'Preview expired or belongs to another administrator')
            if batch['result']:return json.loads(batch['result'])
            rows=json.loads(batch['payload'])
            for row in rows:self.writer.apply(db,actor,row)
            result={'imported':len(rows)}
            db.execute("UPDATE import_batches SET result=?,payload='[]' WHERE id=?",(json.dumps(result),batch_id))
            self.journal.record(db,'import',batch_id,'import.committed.v1',actor.name)
            return result
    def inbox(self):
        with self.database.connect() as db:
            return [{**json.loads(row['payload']),'connection_id':row['connection_id'],'external_id':row['external_id'],'person_id':row['person_id'],'version':row['version']} for row in db.execute('SELECT * FROM hiring_inbox ORDER BY person_id,external_id LIMIT 500')]
    def accept(self,actor,connection_id,external_id,data):
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row=db.execute('SELECT * FROM hiring_inbox WHERE connection_id=? AND external_id=?',(connection_id,external_id)).fetchone()
            if not row:raise DomainError(404,'Hire not found')
            if row['person_id']:return {'person_id':row['person_id']}
            if row['version']!=data.version:raise DomainError(409,'Hire changed; reload')
            imported=json.loads(row['payload'])
            values={k:v for k,v in imported.items() if k in ('source','job_id','job_title','hiring_manager','applied_date') and v}
            values.update(name=data.name,email=data.email,hire_date=data.hire_date.isoformat(),department=data.department,recruiter=data.recruiter,title=imported.get('job_title',''))
            if data.hired_date:values['hired_date']=data.hired_date.isoformat()
            # Explicit review creates a new employee; existing employees must not be overwritten by a candidate's personal email.
            record=self.writer.prepare(db,values,'create_only')
            person_id=self.writer.apply(db,actor,record)
            db.execute('UPDATE hiring_inbox SET person_id=?,version=version+1 WHERE connection_id=? AND external_id=?',(person_id,connection_id,external_id))
            self.journal.record(db,'hire',external_id,'hire.accepted.v1',actor.name)
            return {'person_id':person_id}

    def history(self,person_id):
        with self.database.connect() as db:
            return [{**json.loads(row['payload']),'recorded_at':row['recorded_at'],'actor':row['actor']} for row in db.execute('SELECT * FROM quality_assessments WHERE person_id=? ORDER BY sequence DESC LIMIT 100',(person_id,))]
