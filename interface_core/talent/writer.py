"""Shared transactional employee import contract for CSV and reviewed ATS hires."""
import json
from uuid import uuid4
from datetime import datetime,timezone
from ..models import PersonInput
from ..insights.models import EmploymentInput
from ..events import ActivityJournal,EventJournal
from ..policy import DomainError
from .models import TalentInput
from .assessments import AssessmentHistory

PERSON_FIELDS=set(PersonInput.model_fields)
EMPLOYMENT_FIELDS={'hire_date','end_date','previous_company'}
TALENT_FIELDS=set(TalentInput.model_fields)-{'version'}
IMPORT_FIELDS=PERSON_FIELDS|EMPLOYMENT_FIELDS|TALENT_FIELDS

class EmployeeWriter:
    def __init__(self,journal=None):self.journal=journal or ActivityJournal();self.people_journal=EventJournal()
    def prepare(self,db,fields,mode='upsert'):
        email=fields['email'].lower()
        row=db.execute('SELECT * FROM people WHERE email=? COLLATE NOCASE',(email,)).fetchone()
        if row and mode=='create_only':raise DomainError(409,'Email already exists; choose update mode to change existing people')
        current=dict(row) if row else {}
        person=PersonInput.model_validate({**{k:v for k,v in current.items() if k in PERSON_FIELDS},**{k:v for k,v in fields.items() if k in PERSON_FIELDS}}).model_dump(mode='json')
        employment=db.execute('SELECT * FROM employment_records WHERE person_id=?',(current.get('id',''),)).fetchone()
        talent=db.execute('SELECT * FROM talent_records WHERE person_id=?',(current.get('id',''),)).fetchone()
        em=None;ta=None
        if EMPLOYMENT_FIELDS.intersection(fields):
            values={**(dict(employment) if employment else {}),**{k:v for k,v in fields.items() if k in EMPLOYMENT_FIELDS}}
            values.pop('person_id',None)
            em=EmploymentInput.model_validate(values).model_dump(mode='json',exclude={'version'})
            if person['status']=='inactive' and not em['end_date']:raise DomainError(422,'Inactive employment needs an end date')
        if TALENT_FIELDS.intersection(fields):
            ta=TalentInput.model_validate({**(json.loads(talent['payload']) if talent else {}),**{k:v for k,v in fields.items() if k in TALENT_FIELDS}}).model_dump(mode='json',exclude={'version'})
        return {'person_id':current.get('id'),'person':person,'employment':em,'talent':ta,'versions':[current.get('version',0),employment['version'] if employment else 0,talent['version'] if talent else 0]}

    def apply(self,db,actor,record):
        person=record['person'];person_id=record['person_id'] or str(uuid4())
        current=db.execute('SELECT id,version FROM people WHERE email=? COLLATE NOCASE',(person['email'],)).fetchone()
        employment=db.execute('SELECT version FROM employment_records WHERE person_id=?',(person_id,)).fetchone()
        talent=db.execute('SELECT version,payload FROM talent_records WHERE person_id=?',(person_id,)).fetchone()
        versions=[current['version'] if current else 0,employment['version'] if employment else 0,talent['version'] if talent else 0]
        if versions!=record['versions'] or (current and current['id']!=record['person_id']):raise DomainError(409,'A previewed record changed; preview the import again')
        now=datetime.now(timezone.utc).isoformat()
        if current:
            db.execute('UPDATE people SET name=?,title=?,department=?,status=?,preferred_name=?,version=version+1,updated_at=? WHERE id=?',(person['name'],person['title'],person['department'],person['status'],person['preferred_name'],now,person_id))
            if person['status']=='inactive':
                db.execute('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE person_id=?)',(person_id,))
                db.execute('DELETE FROM sso_handoffs WHERE user_id IN (SELECT id FROM users WHERE person_id=?)',(person_id,))
        else:
            db.execute('INSERT INTO people(id,name,email,title,department,status,preferred_name,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)',(person_id,person['name'],person['email'],person['title'],person['department'],person['status'],person['preferred_name'],now,now))
        self.people_journal.record(db,'person.updated.v1' if current else 'person.created.v1',person_id,actor.name,list(person))
        if record['employment'] is not None:
            em=record['employment']
            db.execute('INSERT INTO employment_records VALUES (?,?,?,?,?) ON CONFLICT(person_id) DO UPDATE SET hire_date=excluded.hire_date,end_date=excluded.end_date,previous_company=excluded.previous_company,version=excluded.version',(person_id,em['hire_date'],em['end_date'],em['previous_company'],versions[1]+1))
        if record['talent'] is not None:
            AssessmentHistory().record(db,actor,person_id,record['talent'],json.loads(talent['payload']) if talent else None)
            db.execute('INSERT INTO talent_records VALUES (?,?,?) ON CONFLICT(person_id) DO UPDATE SET payload=excluded.payload,version=excluded.version',(person_id,json.dumps(record['talent']),versions[2]+1))
        self.journal.record(db,'person',person_id,'employee.imported.v1',actor.name)
        return person_id
