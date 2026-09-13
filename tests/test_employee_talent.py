import json
from datetime import date
from pathlib import Path
import httpx
import pytest
from fastapi.testclient import TestClient
from interface_core.bootstrap import build_app
from interface_core.database import SQLiteDatabase
from interface_core.policy import Actor,DomainError
from interface_core.talent.repository import SQLiteTalentRepository
from interface_core.employee.repository import SQLiteEmployeeRepository
from interface_core.employee.vault import PrivateVault
from interface_core.employee.models import PersonalDetails
from interface_core.connectors.adapters import ProviderRegistry
from interface_core.connectors.models import ConnectionInput
from interface_core.connectors.repository import SQLiteConnectorRepository
from interface_core.connectors.service import ConnectorService

KEYS={'admin':'a'*40,'reader':'r'*40}; ADMIN={'Authorization':'Bearer '+KEYS['admin']}

@pytest.fixture
def portal(tmp_path):
    db=SQLiteDatabase(tmp_path/'test.sqlite3');db.migrate();client=TestClient(build_app(db,KEYS));people=[];tokens=[]
    for i,role in enumerate(['employee','employee','admin']):
        person=client.post('/api/v1/people',headers=ADMIN,json={'name':f'Employee {i}','email':f'employee{i}@example.test'}).json();people.append(person)
        assert client.post('/api/v1/accounts',headers=ADMIN,json={'person_id':person['id'],'role':role,'password':'Testing-password-123'}).status_code==201
        login=client.post('/api/v1/auth/login',json={'email':person['email'],'password':'Testing-password-123'}).json();tokens.append({'Authorization':'Bearer '+login['access_token']})
    yield db,client,people,tokens
    client.close()


def test_private_profile_bank_contract_permissions_and_encryption(portal):
    db,client,people,tokens=portal;pid=people[0]['id'];base=f'/api/v1/employee/{pid}'
    for section in ['personal','bank','contract']:
        assert client.get(base+'/'+section,headers=tokens[1]).status_code==404
        assert client.get(base+'/'+section,headers={'Authorization':'Bearer '+KEYS['reader']}).status_code==404
    data={'phone':'12345678','emergency_name':'Emergency Person','emergency_phone':'87654321','version':0}
    assert client.put(base+'/personal',headers=tokens[0],json=data).status_code==200
    assert client.put(base+'/personal',headers=tokens[0],json=data).status_code==409
    assert client.get(base+'/personal',headers=tokens[0]).json()['emergency_name']=='Emergency Person'
    assert client.put(base+'/personal',headers=tokens[1],json=data).status_code==404
    bank={'holder':'Employee','account_number':'GB82 WEST 1234 5698 7654 32','bank_name':'Test bank','format':'iban','version':0}
    assert client.put(base+'/bank',headers=tokens[0],json={**bank,'account_number':'GB00WEST12345698765432'}).status_code==422
    assert client.put(base+'/bank',headers=tokens[0],json=bank).status_code==200
    result=client.get(base+'/bank',headers=tokens[0]).json()
    assert result['account_number']=='•••• 5432'
    contract={'weekly_hours':'40','annual_salary':'60000.00','effective_date':'2026-01-01','version':0}
    assert client.put(base+'/contract',headers=tokens[0],json=contract).status_code==403
    assert client.put(base+'/contract',headers=ADMIN,json=contract).status_code==200
    assert client.get(base+'/contract',headers=tokens[0]).json()['annual_salary']=='60000.00'
    assert 'annual_salary' not in client.get('/api/v1/people',headers=tokens[1]).text
    with db.connect() as conn:
        assert 'Emergency Person' not in conn.execute('SELECT payload FROM private_details').fetchone()[0]
        assert 'WEST' not in conn.execute('SELECT payload FROM bank_details').fetchone()[0]
    assert (db.path.parent/'private.key').stat().st_mode & 0o777==0o600


def test_sickness_amend_cancel_and_annual_balance(portal):
    db,client,people,tokens=portal;pid=people[0]['id'];base=f'/api/v1/employee/{pid}/leave'
    assert client.get(base+'/balance?year=2026',headers=tokens[0]).json()['remaining'] is None
    assert client.put(base+'/allowance',headers=tokens[0],json={'year':2026,'days':25}).status_code==403
    assert client.put(base+'/allowance',headers=ADMIN,json={'year':2026,'days':25}).status_code==200
    body={'start_date':'2026-10-02','end_date':'2026-10-05','kind':'annual'}
    leave=client.post('/api/v1/leave',headers=tokens[0],json=body).json()
    assert client.get(base+'/balance?year=2026',headers=tokens[0]).json()['requested']==2
    assert client.post('/api/v1/leave/'+leave['id']+'/transition',headers=tokens[2],json={'action':'approve','version':1}).status_code==200
    assert client.get(base+'/balance?year=2026',headers=tokens[0]).json()['remaining']==23
    client.post('/api/v1/leave/'+leave['id']+'/transition',headers=tokens[0],json={'action':'cancel','version':2})
    assert client.get(base+'/balance?year=2026',headers=tokens[0]).json()['remaining']==25
    sick=client.post('/api/v1/leave',headers=tokens[0],json={**body,'kind':'sick'}).json();assert sick['status']=='approved'
    path='/api/v1/leave/'+sick['id']+'/sickness'
    assert client.put(path,headers=tokens[1],json={'end_date':'2026-10-06','version':1}).status_code==404
    assert client.put(path,headers=tokens[0],json={'end_date':'2026-09-01','version':1}).status_code==422
    assert client.put(path,headers=tokens[0],json={'end_date':'2026-10-06','version':1}).status_code==200
    assert client.get(base+'/balance?year=2026',headers=tokens[0]).json()['sick']==3
    assert client.get(base+'/balance?year=2026',headers=tokens[0]).json()['remaining']==25
    assert client.post('/api/v1/leave/'+sick['id']+'/transition',headers=tokens[0],json={'action':'cancel','version':2}).status_code==200
    assert client.get(base+'/balance?year=2026',headers=tokens[0]).json()['sick']==0


CSV='name,email,department,hire_date,previous_company,recruiter,source,quality_score,assessed_on,score_basis\nImport Person,import@example.test,Engineering,2025-01-01,Previous Co,Recruiter A,Referral,0,2026-01-01,Recorded review\nSecond Person,second@example.test,Engineering,2025-02-01,Previous Co,Recruiter A,Referral,80,2026-01-01,Recorded review\n'

def test_csv_preview_commit_replay_quality_and_permissions(portal):
    db,client,people,tokens=portal
    assert client.post('/api/v1/imports/preview',headers=tokens[0],json={'content':CSV}).status_code==403
    assert client.get('/api/v1/talent',headers=tokens[0]).status_code==403
    preview=client.post('/api/v1/imports/preview',headers=ADMIN,json={'content':CSV}).json()
    assert preview['errors']==[] and preview['creates']==2
    assert client.get('/api/v1/people',headers=ADMIN).json()['total']==3
    path='/api/v1/imports/'+preview['batch_id']+'/commit'
    assert client.post(path,headers=tokens[2]).status_code==404
    assert client.post(path,headers=ADMIN).json()=={'imported':2}
    assert client.post(path,headers=ADMIN).json()=={'imported':2}
    assert client.get('/api/v1/people',headers=ADMIN).json()['total']==5
    analytics=client.get('/api/v1/talent?department=Engineering',headers=ADMIN).json()
    assert analytics['quality']==40 and analytics['scored']==2 and analytics['retention_90']==100
    assert analytics['by_recruiter'][0]['quality']==40
    assert analytics['cohorts'][0]['name']=='2025 Q1'
    assert client.get('/api/v1/talent?start=2025-02-01',headers=ADMIN).json()['quality']==80
    assert client.get('/api/v1/talent?start=2027-01-01',headers=ADMIN).json()['quality'] is None
    assert client.post('/api/v1/imports/preview',headers=ADMIN,json={'content':CSV}).json()['batch_id'] is None
    with db.connect() as conn:
        assert conn.execute('SELECT count(*) FROM users').fetchone()[0]==3
        assert conn.execute('SELECT payload FROM import_batches WHERE id=?',(preview['batch_id'],)).fetchone()[0]=='[]'


def test_csv_validation_mapping_and_stale_rollback(portal):
    db,client,people,tokens=portal
    content='Full name,Work email\nNew Colleague,new@example.test\n'
    preview=client.post('/api/v1/imports/preview',headers=ADMIN,json={'content':content,'mapping':{'name':'Full name','email':'Work email'}}).json()
    assert preview['creates']==1
    bad=client.post('/api/v1/imports/preview',headers=ADMIN,json={'content':CSV.replace('2025-01-01','bad-date')}).json()
    assert bad['batch_id'] is None and bad['errors'][0]['row']==2
    assert client.post('/api/v1/imports/inspect',headers=ADMIN,json={'content':'name,name\nA,B'}).status_code==422
    assert client.post('/api/v1/imports/preview',headers=ADMIN,json={'content':'name,email\nA,a@example.test\nB,a@example.test'}).status_code==422
    content='name,email\nChanged,'+people[0]['email']+'\nNew person,new2@example.test\n'
    preview=client.post('/api/v1/imports/preview',headers=ADMIN,json={'content':content,'mode':'upsert'}).json()
    original=people[0];client.put('/api/v1/people/'+original['id'],headers=ADMIN,json={k:v for k,v in {**original,'name':'Concurrent edit'}.items() if k not in ('id','created_at','updated_at')})
    assert client.post('/api/v1/imports/'+preview['batch_id']+'/commit',headers=ADMIN).status_code==409
    assert client.get('/api/v1/people?q=new2',headers=ADMIN).json()['total']==0


def test_import_and_private_write_journal_failure_rollback(portal):
    db,client,people,tokens=portal
    preview=client.post('/api/v1/imports/preview',headers=ADMIN,json={'content':CSV}).json()
    class Broken:
        def record(self,*args):raise RuntimeError('journal failed')
    repository=SQLiteTalentRepository(db,Broken())
    with pytest.raises(RuntimeError):repository.commit(Actor('local-admin','admin'),preview['batch_id'])
    assert client.get('/api/v1/people',headers=ADMIN).json()['total']==3
    repo=SQLiteEmployeeRepository(db,PrivateVault(db.path.parent/'private.key'),Broken())
    with pytest.raises(RuntimeError):repo.save(Actor('local-admin','admin'),people[0]['id'],'personal',PersonalDetails(phone='123'))
    assert repo.get(people[0]['id'],'personal')=={'version':0}


def test_ashby_hiring_context_review_and_idempotent_create(portal):
    db,client,people,tokens=portal
    def remote(request):
        assert str(request.url)=='https://api.ashbyhq.com/application.list'
        assert json.loads(request.content)['status']=='Hired'
        return httpx.Response(200,json={'success':True,'results':[{'id':'application-1','status':'Hired','createdAt':'2026-01-01T10:00:00Z','candidate':{'id':'candidate-1','name':'New Hire','primaryEmailAddress':{'value':'personal@example.test'}},'job':{'id':'job-1','title':'Engineer'},'source':{'title':'Referral'},'hiringTeam':[{'role':'Recruiter','firstName':'Alex','lastName':'Recruiter'}]}],'moreDataAvailable':False})
    service=ConnectorService(SQLiteConnectorRepository(db),ProviderRegistry(httpx.Client(transport=httpx.MockTransport(remote))),{'INTERFACE_CONNECTOR_ASHBY':'secret'})
    connection=service.create(Actor('local-admin','admin'),ConnectionInput(name='Hires',provider='ashby_hires',secret_env='INTERFACE_CONNECTOR_ASHBY'))
    assert service.execute(Actor('local-admin','admin'),connection['id'],True)['next_page']==0
    inbox=client.get('/api/v1/hires',headers=ADMIN).json()['items'];assert inbox[0]['recruiter']=='Alex Recruiter' and inbox[0]['hired_date'] is None
    path=f"/api/v1/hires/{connection['id']}/application-1/accept"
    data={'name':'New Hire','email':'work@example.test','hire_date':'2026-02-01','hired_date':'2026-01-15','recruiter':'Alex Recruiter','department':'Engineering','version':1}
    assert client.post(path,headers=tokens[0],json=data).status_code==403
    response=client.post(path,headers=ADMIN,json=data);assert response.status_code==200,response.text
    assert client.post(path,headers=ADMIN,json=data).json()==response.json()
    person_id=response.json()['person_id']
    assert client.get('/api/v1/talent/'+person_id,headers=ADMIN).json()['job_id']=='job-1'
    assert client.get('/api/v1/people/'+person_id+'/employment',headers=ADMIN).json()['hire_date']=='2026-02-01'
    assert client.get('/api/v1/people',headers=ADMIN).json()['total']==4


def test_payroll_export_and_assessment_history(portal):
    db,client,people,tokens=portal;pid=people[0]['id']
    bank={'holder':'=unsafe-formula','account_number':'GB82WEST12345698765432','bank_name':'Test bank','format':'iban'}
    assert client.put(f'/api/v1/employee/{pid}/bank',headers=tokens[0],json=bank).status_code==200
    assert client.post('/api/v1/payroll/export',headers=tokens[0]).status_code==403
    exported=client.post('/api/v1/payroll/export',headers=ADMIN).json()
    assert exported['records']==1 and 'GB82WEST12345698765432' in exported['csv'] and "'=unsafe-formula" in exported['csv']
    body={'quality_score':'70','assessed_on':'2026-01-01','score_basis':'90-day review','version':0,'cost_per_hire':'1200.50','currency':'EUR','applied_date':'2025-01-01','hired_date':'2025-01-11'}
    assert client.put('/api/v1/talent/'+pid,headers=ADMIN,json=body).status_code==200
    assert client.put('/api/v1/talent/'+pid,headers=ADMIN,json={**body,'quality_score':'80','version':1}).status_code==200
    history=client.get('/api/v1/talent/'+pid+'/history',headers=ADMIN).json()['items']
    assert [h['quality_score'] for h in history]==['80','70']
    metrics=client.get('/api/v1/talent',headers=ADMIN).json()
    assert metrics['hiring_cycle_days']==10 and metrics['hiring_cycle_sample']==1
    assert metrics['costs']==[{'currency':'EUR','average_cost':'1200.50','sample':1}]
    assert client.get('/api/v1/talent/'+pid+'/history',headers=tokens[0]).status_code==403
    with db.connect() as conn:assert conn.execute("SELECT count(*) FROM activity WHERE event='payroll.bank_exported.v1'").fetchone()[0]==1
