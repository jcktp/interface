import sqlite3
import time
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from interface_core.bootstrap import build_app
from interface_core.database import SQLiteDatabase
from interface_core.insights.calculator import WorkforceCalculator
from interface_core.identity.security import LoginRateLimiter
from interface_core.policy import DomainError

KEYS = {'admin': 'a'*40, 'reader': 'r'*40}
ADMIN = {'Authorization': 'Bearer '+KEYS['admin']}
PASSWORD = 'Initial-password-123!'


@pytest.fixture
def workspace(tmp_path):
    db = SQLiteDatabase(tmp_path/'people.sqlite3'); db.migrate()
    client = TestClient(build_app(db, KEYS))
    people, tokens, accounts = [], [], []
    for i, role in enumerate(['admin', 'employee', 'employee']):
        person = client.post('/api/v1/people', headers=ADMIN, json={'name': f'Person {i}', 'email': f'p{i}@example.test'}).json()
        people.append(person)
        response = client.post('/api/v1/accounts', headers=ADMIN, json={'person_id': person['id'], 'role': role, 'password': PASSWORD})
        assert response.status_code == 201, response.text
        accounts.append(response.json())
        response = client.post('/api/v1/auth/login', json={'email': person['email'], 'password': PASSWORD})
        assert response.status_code == 200, response.text
        tokens.append({'Authorization': 'Bearer '+response.json()['access_token']})
    yield db, client, people, tokens, accounts
    client.close()


def test_employee_workflow_and_permissions(workspace):
    db, client, people, tokens, accounts = workspace
    admin, employee, other = tokens
    assert client.get('/api/v1/accounts', headers=employee).status_code == 403
    assert client.patch('/api/v1/me/profile', headers=employee, json={'preferred_name': 'Sam', 'version': 1}).json()['preferred_name'] == 'Sam'
    assert client.patch('/api/v1/me/profile', headers=employee, json={'preferred_name': 'Stale', 'version': 1}).status_code == 409
    assert client.patch('/api/v1/me/profile', headers=employee, json={'preferred_name': 'Sam', 'version': 2, 'role': 'admin'}).status_code == 422
    assert client.get('/api/v1/me/profile', headers=other).json()['preferred_name'] == ''
    body = {'start_date': '2026-10-01', 'end_date': '2026-10-03', 'kind': 'annual'}
    leave = client.post('/api/v1/leave', headers=employee, json=body).json()
    assert client.post('/api/v1/leave', headers=employee, json=body).json()['id'] == leave['id']
    assert client.get('/api/v1/leave', headers=other).json()['items'] == []
    assert client.post('/api/v1/leave', headers=employee, json={**body, 'end_date': '2026-10-04'}).status_code == 409
    path = f"/api/v1/leave/{leave['id']}/transition"
    assert client.post(path, headers=employee, json={'action': 'approve', 'version': 1}).status_code == 403
    assert client.post(path, headers=other, json={'action': 'cancel', 'version': 1}).status_code == 404
    assert client.post(path, headers=admin, json={'action': 'approve', 'version': 1}).json()['status'] == 'approved'
    assert client.post(path, headers=admin, json={'action': 'approve', 'version': 1}).json()['version'] == 2
    assert client.post(path, headers=employee, json={'action': 'cancel', 'version': 2}).json()['status'] == 'cancelled'
    assert client.post('/api/v1/leave', headers=employee, json=body).json()['id'] != leave['id']
    own = client.post('/api/v1/leave', headers=admin, json=body).json()
    assert client.post(f"/api/v1/leave/{own['id']}/transition", headers=admin, json={'action': 'approve', 'version': 1}).status_code == 403
    task = client.post('/api/v1/tasks', headers=admin, json={'person_id': people[1]['id'], 'title': 'Read handbook', 'due_date': '2026-10-01'}).json()
    path = f"/api/v1/tasks/{task['id']}/transition"
    assert client.post(path, headers=other, json={'status': 'done', 'version': 1}).status_code == 404
    assert client.post(path, headers=employee, json={'status': 'done', 'version': 1}).json()['status'] == 'done'
    with db.connect() as conn:
        assert conn.execute("SELECT actor FROM activity WHERE event='leave.approved.v1'").fetchone()[0] == accounts[0]['id']


def test_password_sessions_expiry_and_deactivation(workspace):
    db, client, people, tokens, accounts = workspace
    admin, employee, other = tokens
    with db.connect() as conn:
        assert PASSWORD not in conn.execute('SELECT password_hash FROM users LIMIT 1').fetchone()[0]
        assert conn.execute('SELECT 1 FROM sessions WHERE token_hash=?', (employee['Authorization'][7:],)).fetchone() is None
    assert client.post('/api/v1/auth/login', json={'email': 'missing@example.test', 'password': PASSWORD}).status_code == 401
    assert client.post('/api/v1/auth/password', headers=employee, json={'current_password': PASSWORD, 'new_password': 'new-password-long-123'}).status_code == 200
    assert client.get('/api/v1/me/profile', headers=employee).status_code == 401
    assert client.post('/api/v1/auth/login', json={'email': people[1]['email'], 'password': PASSWORD}).status_code == 401
    result = client.post('/api/v1/auth/login', json={'email': people[1]['email'], 'password': 'new-password-long-123'}).json()
    new = {'Authorization': 'Bearer '+result['access_token']}
    assert client.post('/api/v1/auth/logout', headers=new).status_code == 200
    assert client.get('/api/v1/me/profile', headers=new).status_code == 401
    assert client.put(f"/api/v1/accounts/{accounts[2]['id']}/state", headers=admin, json={'active': False}).status_code == 200
    assert client.get('/api/v1/me/profile', headers=other).status_code == 401
    assert client.put(f"/api/v1/accounts/{accounts[2]['id']}/state", headers=admin, json={'active': True}).status_code == 200
    assert client.get('/api/v1/me/profile', headers=other).status_code == 401
    assert client.put(f"/api/v1/accounts/{accounts[0]['id']}/state", headers=admin, json={'active': False}).status_code == 409
    with db.connect() as conn:
        conn.execute('UPDATE sessions SET expires_at=?', (int(time.time())-1,))
    assert client.get('/api/v1/me/profile', headers=admin).status_code == 401
    with TestClient(build_app(db, KEYS, access_keys=False)) as locked:
        assert locked.get('/api/v1/people', headers=ADMIN).status_code == 401


def test_insights_data_and_restrictions(workspace):
    _, client, people, tokens, _ = workspace
    admin, employee, _ = tokens
    assert client.get('/api/v1/insights', headers=employee).status_code == 403
    assert client.get('/api/v1/people/'+people[0]['id']+'/employment', headers=employee).status_code == 403
    finance = {'start_date': '2026-01-01', 'end_date': '2026-01-10', 'currency': 'EUR', 'revenue': '3000.00', 'profit': '-300.00'}
    assert client.post('/api/v1/financial-periods', headers=admin, json=finance).status_code == 201
    assert client.get('/api/v1/insights', headers=admin).json()['financial_periods'][0]['revenue_per_employee'] is None
    for person in people:
        assert client.put(f"/api/v1/people/{person['id']}/employment", headers=admin, json={'hire_date': '2025-01-01', 'previous_company': 'Example Co', 'version': 0}).status_code == 200
    data = client.get('/api/v1/insights', headers=admin).json()
    assert data['financial_periods'][0]['revenue_per_employee'] == '1000.00'
    assert data['financial_periods'][0]['profit_per_employee'] == '-100.00'
    assert data['previous_companies'] == [{'company': 'Example Co', 'people': 3}]
    assert client.post('/api/v1/financial-periods', headers=admin, json=finance).status_code == 409
    assert client.post('/api/v1/plans', headers=admin, json={'name': 'Grow', 'target_headcount': 5, 'annual_cost_per_employee': '60000.00', 'months': 6, 'currency': 'EUR'}).status_code == 201
    plan = client.get('/api/v1/insights', headers=admin).json()['plans'][0]
    assert plan['projected_workforce_cost'] == '150000.00' and plan['headcount_change'] == 2
    update = {'name': 'Grow revised', 'target_headcount': 6, 'annual_cost_per_employee': '60000.00', 'months': 6, 'currency': 'EUR', 'version': 1}
    assert client.put('/api/v1/plans/'+plan['id'], headers=admin, json=update).status_code == 200
    assert client.put('/api/v1/plans/'+plan['id'], headers=admin, json=update).status_code == 409
    period_id = data['financial_periods'][0]['id']
    assert client.put('/api/v1/financial-periods/'+period_id, headers=admin, json={**finance, 'revenue': '6000.00', 'version': 1}).status_code == 200
    assert client.put('/api/v1/financial-periods/'+period_id, headers=employee, json={**finance, 'version': 2}).status_code == 403
    assert client.get('/api/v1/insights', headers=admin).json()['financial_periods'][0]['revenue_per_employee'] == '2000.00'


def test_partial_period_headcount_and_zero_division():
    calculator = WorkforceCalculator()
    period = {'start_date': '2026-01-01', 'end_date': '2026-01-10', 'revenue_minor': 100000, 'profit_minor': 10000}
    result = calculator.finance(period, [{'hire_date': '2026-01-06', 'end_date': None, 'status': 'active'}])
    assert result['average_headcount'] == .5 and result['revenue_per_employee'] == '2000.00'
    assert calculator.finance(period, [])['profit_per_employee'] is None


def test_workflow_rollback_and_rate_limit(workspace):
    db, client, people, tokens, _ = workspace
    with db.connect() as conn:
        conn.execute("CREATE TRIGGER fail_activity BEFORE INSERT ON activity BEGIN SELECT RAISE(ABORT,'test failure'); END")
    with pytest.raises(sqlite3.IntegrityError):
        client.post('/api/v1/tasks', headers=tokens[0], json={'person_id': people[1]['id'], 'title': 'No partial write', 'due_date': '2026-10-01'})
    with db.connect() as conn:
        assert conn.execute('SELECT count(*) FROM onboarding_tasks').fetchone()[0] == 0
    limiter = LoginRateLimiter()
    for _ in range(10):
        limiter.check('test')
    with pytest.raises(DomainError) as error:
        limiter.check('test')
    assert error.value.status == 429


def test_migration_preserves_v1(tmp_path):
    import interface_core
    db = SQLiteDatabase(tmp_path/'upgrade.sqlite3')
    with db.connect() as conn:
        sql = (Path(interface_core.__file__).parent/'migrations/001_core.sql').read_text()
        conn.executescript(sql+'\nPRAGMA user_version=1;')
        conn.execute("INSERT INTO people VALUES ('one','Original','original@example.test','','','active',1,'2026-01-01','2026-01-01')")
    db.migrate(); db.migrate()
    with db.connect() as conn:
        assert conn.execute('PRAGMA user_version').fetchone()[0] == 7
        assert conn.execute('SELECT name FROM people').fetchone()[0] == 'Original'
        assert conn.execute('SELECT count(*) FROM users').fetchone()[0] == 0
