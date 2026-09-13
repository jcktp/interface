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


def test_ashby_cursor_refresh_and_conflict(tmp_path):
    import json
    def provider(request):
        assert str(request.url)=='https://api.ashbyhq.com/candidate.list'
        assert request.headers['authorization']=='Basic c2VjcmV0Og=='
        body=json.loads(request.content)
        first=body['cursor']=='start'
        return httpx.Response(200,json={'success':True,'results':[{'id':'a' if first else 'b','name':'Candidate','emailAddresses':[{'value':'a@example.test'}]}],'moreDataAvailable':first,'nextCursor':'opaque-next' if first else ''})
    db,service=setup(tmp_path,provider,{'INTERFACE_CONNECTOR_ASHBY':'secret'})
    connection=service.create(ADMIN,ConnectionInput(name='Ashby',provider='ashby',secret_env='INTERFACE_CONNECTOR_ASHBY'))
    result=service.execute(ADMIN,connection['id'],sync=True)
    assert result['cursor']=='opaque-next'
    with pytest.raises(DomainError): service.repository.sync(ADMIN,connection,[],0,'')
    assert service.execute(ADMIN,connection['id'],sync=True)['next_page']==0
    assert len(service.list(ADMIN)['candidates'])==2
    service.restart_sync(ADMIN,connection['id']);service.execute(ADMIN,connection['id'],sync=True)
    assert len(service.list(ADMIN)['candidates'])==2


@pytest.mark.parametrize('payload',[{'success':False}, {'success':True,'results':[],'moreDataAvailable':True,'nextCursor':''}, {'success':True,'results':[{'name':'Missing ID'}],'moreDataAvailable':False}])
def test_ashby_bad_response_no_progress(tmp_path,payload):
    db,service=setup(tmp_path,lambda request:httpx.Response(200,json=payload),{'INTERFACE_CONNECTOR_ASHBY':'secret'})
    connection=service.create(ADMIN,ConnectionInput(name='Ashby',provider='ashby',secret_env='INTERFACE_CONNECTOR_ASHBY'))
    result=service.execute(ADMIN,connection['id'],sync=True)
    assert result['status']=='error' and result['cursor']=='' and result['next_page']==1
    assert service.list(ADMIN)['candidates']==[]


def test_workspace_delegated_token_pagination_and_isolation(tmp_path):
    import json
    import jwt
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization
    from urllib.parse import parse_qs
    from interface_core.connectors.workspace import SCOPE
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    secret=json.dumps({'delegated_subject':'admin@example.test','service_account':{'type':'service_account','client_email':'test@project.iam.gserviceaccount.com','token_uri':'https://oauth2.googleapis.com/token','private_key':key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()).decode()}})
    tokens=[]
    def provider(request):
        if request.url.host=='oauth2.googleapis.com':
            tokens.append(request)
            assertion=parse_qs(request.content.decode())['assertion'][0]
            claims=jwt.decode(assertion,key.public_key(),algorithms=['RS256'],audience='https://oauth2.googleapis.com/token')
            assert claims['scope']==SCOPE and claims['sub']=='admin@example.test'
            return httpx.Response(200,json={'access_token':'workspace-token','expires_in':3600,'token_type':'Bearer'})
        assert str(request.url).startswith('https://admin.googleapis.com/admin/directory/v1/users?')
        assert request.headers['authorization']=='Bearer workspace-token'
        assert request.url.params['customer']=='my_customer'
        more='pageToken' not in request.url.params
        return httpx.Response(200,json={'users':[{'id':'google-id','name':{'fullName':'Employee'},'primaryEmail':'employee@example.test','suspended':not more}],**({'nextPageToken':'next'} if more else {})})
    db,service=setup(tmp_path,provider,{'INTERFACE_CONNECTOR_WORKSPACE':secret})
    connection=service.create(ADMIN,ConnectionInput(name='Workspace',provider='google_workspace',secret_env='INTERFACE_CONNECTOR_WORKSPACE'))
    assert service.execute(ADMIN,connection['id'],sync=True)['cursor']=='next'
    assert service.execute(ADMIN,connection['id'],sync=True)['next_page']==0
    result=service.list(ADMIN)
    assert len(result['workspace_users'])==1 and result['workspace_users'][0]['suspended']==1
    assert result['candidates']==[] and len(tokens)==1
    with db.connect() as conn:
        assert conn.execute('SELECT count(*) FROM users').fetchone()[0]==0
        assert conn.execute('SELECT count(*) FROM people').fetchone()[0]==0
        assert 'private_key' not in str([tuple(row) for row in conn.execute('SELECT * FROM connections')])


def test_restart_invalidates_inflight_page_and_sync_rolls_back(tmp_path):
    db,service=setup(tmp_path,lambda request:httpx.Response(200,json=[]))
    connection=service.create(ADMIN,ConnectionInput(name='ATS',provider='greenhouse',secret_env='INTERFACE_CONNECTOR_ATS'))
    service.restart_sync(ADMIN,connection['id'])
    with pytest.raises(DomainError):service.repository.sync(ADMIN,connection,[],0)
    fresh=service.repository.get(connection['id'])
    class BrokenJournal:
        def record(self,*args): raise RuntimeError('journal failed')
    service.repository.journal=BrokenJournal()
    with pytest.raises(RuntimeError):service.repository.sync(ADMIN,fresh,[{'external_id':'a','name':'A','email':''}],0)
    assert service.repository.get(connection['id'])['next_page']==1
    assert service.list(ADMIN)['candidates']==[]
