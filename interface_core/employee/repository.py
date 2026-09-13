import json
from ..events import ActivityJournal
from ..policy import DomainError

class SQLiteEmployeeRepository:
    TABLES={'personal':'private_details','bank':'bank_details','contract':'contracts'}
    def __init__(self,database,vault,journal=None):
        self.database,self.vault=database,vault
        self.journal=journal or ActivityJournal()

    def get(self,person_id,kind):
        with self.database.connect() as db:
            if not db.execute('SELECT id FROM people WHERE id=?',(person_id,)).fetchone(): raise DomainError(404,'Person not found')
            row=db.execute(f'SELECT payload,version FROM {self.TABLES[kind]} WHERE person_id=?',(person_id,)).fetchone()
            if not row:return {'version':0}
            value=self.vault.decrypt(row['payload']) if kind in ('personal','bank') else row['payload']
            return {**json.loads(value),'version':row['version']}

    def save(self,actor,person_id,kind,data):
        values=data.model_dump(mode='json',exclude={'version'})
        payload=json.dumps(values)
        if kind in ('personal','bank'):payload=self.vault.encrypt(payload)
        table=self.TABLES[kind]
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if not db.execute('SELECT id FROM people WHERE id=?',(person_id,)).fetchone():raise DomainError(404,'Person not found')
            row=db.execute(f'SELECT version FROM {table} WHERE person_id=?',(person_id,)).fetchone()
            version=row['version'] if row else 0
            if version!=data.version:raise DomainError(409,'Details changed; reload before saving')
            db.execute(f'INSERT INTO {table}(person_id,payload,version) VALUES (?,?,?) ON CONFLICT(person_id) DO UPDATE SET payload=excluded.payload,version=excluded.version',(person_id,payload,version+1))
            self.journal.record(db,kind,person_id,f'{kind}.updated.v1',actor.name)
        return {'saved':True,'version':version+1}

    def allowance(self,person_id,year):
        with self.database.connect() as db:
            row=db.execute('SELECT * FROM leave_allowances WHERE person_id=? AND year=?',(person_id,year)).fetchone()
            return dict(row) if row else {'year':year,'days':None,'version':0}

    def save_allowance(self,actor,person_id,data):
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if not db.execute('SELECT id FROM people WHERE id=?',(person_id,)).fetchone():raise DomainError(404,'Person not found')
            row=db.execute('SELECT version FROM leave_allowances WHERE person_id=? AND year=?',(person_id,data.year)).fetchone()
            if (row['version'] if row else 0)!=data.version:raise DomainError(409,'Allowance changed; reload')
            db.execute('INSERT INTO leave_allowances VALUES (?,?,?,?) ON CONFLICT(person_id,year) DO UPDATE SET days=excluded.days,version=excluded.version',(person_id,data.year,data.days,data.version+1))
            self.journal.record(db,'allowance',person_id,'allowance.updated.v1',actor.name)
        return self.allowance(person_id,data.year)

    def absence(self,person_id,year):
        with self.database.connect() as db:
            return [dict(row) for row in db.execute("SELECT * FROM leave_requests WHERE person_id=? AND start_date<=? AND end_date>=? AND status IN ('approved','requested')",(person_id,f'{year}-12-31',f'{year}-01-01'))]

    def payroll_export(self,actor):
        import csv,io
        output=io.StringIO();writer=csv.writer(output)
        writer.writerow(['employee_id','name','work_email','account_holder','bank_name','format','account_number','routing_code','annual_salary','currency','weekly_hours'])
        count=0
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            for row in db.execute("SELECT p.id,p.name,p.email,b.payload,c.payload AS contract FROM people p JOIN bank_details b ON b.person_id=p.id LEFT JOIN contracts c ON c.person_id=p.id WHERE p.status='active' ORDER BY p.name,p.id"):
                bank=json.loads(self.vault.decrypt(row['payload']));contract=json.loads(row['contract'] or '{}')
                values=[row['id'],row['name'],row['email'],*[bank.get(k,'') for k in ('holder','bank_name','format','account_number','routing_code')],*[contract.get(k,'') for k in ('annual_salary','currency','weekly_hours')]]
                writer.writerow(["'"+str(v) if str(v).lstrip().startswith(('=','+','-','@')) else v for v in values]);count+=1
            self.journal.record(db,'payroll','export','payroll.bank_exported.v1',actor.name)
        return {'csv':output.getvalue(),'records':count}
