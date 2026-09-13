import httpx
import pytest
from interface_core.database import SQLiteDatabase
from interface_core.connectors.adapters import ProviderRegistry
from interface_core.connectors.models import ConnectionInput
from interface_core.connectors.repository import SQLiteConnectorRepository
from interface_core.connectors.service import ConnectorService
from interface_core.policy import Actor, DomainError

ADMIN=Actor('test-admin','admin')

def setup(tmp_path, handler, environment=None):
    db=SQLiteDatabase(tmp_path/'connectors.sqlite3');db.migrate()
    client=httpx.Client(transport=httpx.MockTransport(handler),follow_redirects=False)
    service=ConnectorService(SQLiteConnectorRepository(db),ProviderRegistry(client),{} if environment is None else environment)
    return db,service

def test_greenhouse_pagination_upsert_and_secrets(tmp_path):
    def provider(request):
        assert request.url.host=='harvest.greenhouse.io'
        assert request.headers['authorization']=='Basic c2VjcmV0Og=='
        page=request.url.params['page']
        headers={'link':'<https://harvest.greenhouse.io/v1/candidates?page=2&per_page=100>; rel="next"'} if page=='1' else {}
        return httpx.Response(200,json=[{'id':int(page),'first_name':'Test','last_name':page,'email_addresses':[{'value':page+'@example.test'}]}],headers=headers)
    db,service=setup(tmp_path,provider,{'INTERFACE_CONNECTOR_GREENHOUSE':'secret'})
    connection=service.create(ADMIN,ConnectionInput(name='Recruitment',provider='greenhouse',secret_env='INTERFACE_CONNECTOR_GREENHOUSE'))
    assert service.execute(ADMIN,connection['id'])['status']=='verified'
    assert service.execute(ADMIN,connection['id'],sync=True)['next_page']==2
    assert service.execute(ADMIN,connection['id'],sync=True)['next_page']==0
    assert len(service.list(ADMIN)['candidates'])==2
    service.restart_sync(ADMIN,connection['id']);service.execute(ADMIN,connection['id'],sync=True)
    assert len(service.list(ADMIN)['candidates'])==2
    with db.connect() as conn:
        assert 'secret' not in dict(conn.execute('SELECT * FROM connections').fetchone()).values()
        assert conn.execute('SELECT count(*) FROM people').fetchone()[0]==0
    with pytest.raises(DomainError):service.list(Actor('reader','reader'))
    with pytest.raises(DomainError):service.execute(Actor('reader','reader'),connection['id'])

def test_missing_credentials_and_slack_rejection(tmp_path):
    db,service=setup(tmp_path,lambda request:httpx.Response(200,json={'ok':False,'error':'invalid_auth'}))
    connection=service.create(ADMIN,ConnectionInput(name='Slack',provider='slack',secret_env='INTERFACE_CONNECTOR_SLACK'))
    assert service.execute(ADMIN,connection['id'])['status']=='missing_credentials'
    service.environment['INTERFACE_CONNECTOR_SLACK']='invalid'
    assert service.execute(ADMIN,connection['id'])['status']=='error'

def test_hostile_pagination_no_progress(tmp_path):
    def provider(request):
        return httpx.Response(200,json=[{'id':1,'first_name':'Test'}],headers={'link':'<https://evil.example/candidates?page=2>; rel="next"'})
    db,service=setup(tmp_path,provider,{'INTERFACE_CONNECTOR_GREENHOUSE':'secret'})
    connection=service.create(ADMIN,ConnectionInput(name='ATS',provider='greenhouse',secret_env='INTERFACE_CONNECTOR_GREENHOUSE'))
    result=service.execute(ADMIN,connection['id'],sync=True)
    assert result['status']=='error' and result['next_page']==1
    assert service.list(ADMIN)['candidates']==[]

def test_network_errors_redacted(tmp_path):
    def provider(request):raise httpx.ConnectError('secret-token-in-error',request=request)
    db,service=setup(tmp_path,provider,{'INTERFACE_CONNECTOR_SLACK':'secret'})
    connection=service.create(ADMIN,ConnectionInput(name='Slack',provider='slack',secret_env='INTERFACE_CONNECTOR_SLACK'))
    result=service.execute(ADMIN,connection['id'])
    assert result['status']=='error' and 'secret-token' not in result['message']
