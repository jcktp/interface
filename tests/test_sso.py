import base64
import hashlib
import json
import time
from urllib.parse import urlsplit, parse_qs
import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from interface_core.bootstrap import build_app
from interface_core.database import SQLiteDatabase
from interface_core.sso.config import SSOConfig
from interface_core.sso.repository import SQLiteSSORepository
from interface_core.sso.service import SSOService
from interface_core.policy import Actor, DomainError

ADMIN={'Authorization':'Bearer '+'a'*40}

@pytest.fixture
def sso(tmp_path):
    db=SQLiteDatabase(tmp_path/'sso.sqlite3');db.migrate()
    config=SSOConfig.from_environment({'INTERFACE_PUBLIC_URL':'https://testserver','INTERFACE_SSO_GOOGLE_CLIENT_ID':'test-client','INTERFACE_SSO_GOOGLE_CLIENT_SECRET':'test-secret','INTERFACE_SSO_OKTA_CLIENT_ID':'okta-client','INTERFACE_SSO_OKTA_CLIENT_SECRET':'okta-secret','INTERFACE_SSO_OKTA_ISSUER':'https://test.okta.com/oauth2/default'})
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    public=json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()));public.update(kid='test-key',alg='RS256',use='sig')
    context={'nonce':'','claims':{},'provider':'google','calls':[]}
    def remote(request):
        context['calls'].append(request)
        provider=config.providers[context['provider']]
        if str(request.url)==provider.jwks_url:
            return httpx.Response(200,json={'keys':[public]})
        assert str(request.url)==provider.token_url
        form=parse_qs(request.content.decode())
        challenge=base64.urlsafe_b64encode(hashlib.sha256(form['code_verifier'][0].encode()).digest()).rstrip(b'=').decode()
        assert challenge==context['challenge']
        assert form['redirect_uri']==['https://testserver/api/v1/auth/sso/'+provider.id+'/callback']
        assert form['client_secret']==[provider.client_secret]
        claims={'iss':provider.issuer,'aud':provider.client_id,'sub':'subject-123','exp':int(time.time())+300,'iat':int(time.time()),'nonce':context['nonce'],**context['claims']}
        signed=jwt.encode(claims,key,algorithm='RS256',headers={'kid':'test-key'})
        if context.get('corrupt'): signed=signed[:-8]+'abcdefgh'
        return httpx.Response(200,json={'id_token':signed,'access_token':'not-stored'})
    client=TestClient(build_app(db,{'admin':'a'*40,'reader':'r'*40},sso_config=config,sso_client=httpx.Client(transport=httpx.MockTransport(remote))),base_url='https://testserver')
    person=client.post('/api/v1/people',headers=ADMIN,json={'name':'SSO Employee','email':'employee@example.test'}).json()
    account=client.post('/api/v1/accounts',headers=ADMIN,json={'person_id':person['id']}).json()
    for provider in config.providers:
        assert client.post('/api/v1/sso/links',headers=ADMIN,json={'provider':provider,'subject':'subject-123','user_id':account['id']}).status_code==201
    yield db,client,context,account,config
    client.close()


def start(client,context,provider='google'):
    context['provider']=provider
    response=client.get('/api/v1/auth/sso/'+provider+'/start',follow_redirects=False)
    assert response.status_code==303
    query=parse_qs(urlsplit(response.headers['location']).query)
    context['nonce']=query['nonce'][0];context['challenge']=query['code_challenge'][0]
    assert query['code_challenge_method']==['S256']
    assert 'HttpOnly' in response.headers['set-cookie'] and 'Secure' in response.headers['set-cookie']
    return '/api/v1/auth/sso/'+provider+'/callback?code=test-code&state='+query['state'][0]


@pytest.mark.parametrize('provider',['google','okta'])
def test_sso_end_to_end_and_revocation(sso,provider):
    db,client,context,account,config=sso
    # SSO-only accounts never accept a password, including an empty value.
    assert client.post('/api/v1/auth/login',json={'email':'employee@example.test','password':'wrong-password'}).status_code==401
    callback=start(client,context,provider)
    result=client.get(callback,follow_redirects=False)
    assert result.headers['location']=='/?sso=complete'
    assert 'access_token' not in result.headers['location']
    assert client.post('/api/v1/auth/sso/session',headers={'Origin':'https://evil.test'}).status_code==403
    response=client.post('/api/v1/auth/sso/session',headers={'Origin':'https://testserver'})
    assert response.status_code==200,response.text
    token=response.json()['access_token'];headers={'Authorization':'Bearer '+token}
    assert client.get('/api/v1/me',headers=headers).json()['role']=='employee'
    assert client.get('/api/v1/me',headers=headers).json()['password_login'] is False
    assert client.post('/api/v1/auth/password',headers=headers,json={'current_password':'anything','new_password':'New-password-123!'}).status_code==403
    assert client.post('/api/v1/auth/password',headers=headers,json={'current_password':'anything','new_password':None}).status_code==422
    assert client.get('/api/v1/sso',headers=headers).status_code==403
    assert client.post('/api/v1/auth/sso/session',headers={'Origin':'https://testserver'}).status_code==401
    assert client.get(callback,follow_redirects=False).headers['location']=='/?sso=failed'
    assert client.delete('/api/v1/sso/links/'+provider+'/'+account['id'],headers=ADMIN).status_code==200
    assert client.get('/api/v1/me',headers=headers).status_code==401
    with db.connect() as conn:
        assert conn.execute('SELECT count(*) FROM sso_handoffs').fetchone()[0]==0
        assert conn.execute('SELECT count(*) FROM sessions').fetchone()[0]==0


@pytest.mark.parametrize('claims',[{'iss':'https://evil.test'},{'aud':'other-client'},{'nonce':'wrong'}, {'exp':1},{'iat':4102444800},{'sub':'unlinked'}, {'azp':'other-client'}, {'aud':['test-client','other']}])
def test_reject_invalid_identity(sso,claims):
    db,client,context,account,config=sso
    context['claims']=claims
    assert client.get(start(client,context),follow_redirects=False).headers['location']=='/?sso=failed'
    with db.connect() as conn:
        assert conn.execute('SELECT count(*) FROM sessions').fetchone()[0]==0
        assert conn.execute('SELECT count(*) FROM sso_handoffs').fetchone()[0]==0


def test_browser_binding_signature_expiry_and_disabled_account(sso):
    db,client,context,account,config=sso
    callback=start(client,context)
    client.cookies.clear()
    assert client.get(callback,follow_redirects=False).headers['location']=='/?sso=failed'
    assert context['calls']==[]
    callback=start(client,context);context['corrupt']=True
    assert client.get(callback,follow_redirects=False).headers['location']=='/?sso=failed'
    context['corrupt']=False
    callback=start(client,context)
    with db.connect() as conn:conn.execute('UPDATE sso_attempts SET expires_at=0')
    assert client.get(callback,follow_redirects=False).headers['location']=='/?sso=failed'
    callback=start(client,context)
    assert client.get(callback,follow_redirects=False).headers['location']=='/?sso=complete'
    assert client.put('/api/v1/accounts/'+account['id']+'/state',headers=ADMIN,json={'active':False}).status_code==200
    assert client.put('/api/v1/accounts/'+account['id']+'/state',headers=ADMIN,json={'active':True}).status_code==200
    assert client.post('/api/v1/auth/sso/session',headers={'Origin':'https://testserver'}).status_code==401


def test_link_conflicts_and_atomic_rollback(sso):
    db,client,context,account,config=sso
    person=client.post('/api/v1/people',headers=ADMIN,json={'name':'Other','email':'other@example.test'}).json()
    other=client.post('/api/v1/accounts',headers=ADMIN,json={'person_id':person['id']}).json()
    assert client.post('/api/v1/sso/links',headers=ADMIN,json={'provider':'google','subject':'subject-123','user_id':other['id']}).status_code==409
    repo=SQLiteSSORepository(db)
    class BrokenJournal:
        def record(self,*args): raise RuntimeError('journal failed')
    repo.journal=BrokenJournal()
    with pytest.raises(RuntimeError):repo.link(Actor('admin','admin'),config.providers['google'].issuer,'other-subject',other['id'])
    assert len(repo.list_links())==2


def test_config_constraints():
    assert SSOConfig.from_environment({}).providers=={}
    env={'INTERFACE_PUBLIC_URL':'http://public.example','INTERFACE_SSO_GOOGLE_CLIENT_ID':'id','INTERFACE_SSO_GOOGLE_CLIENT_SECRET':'secret'}
    with pytest.raises(ValueError):SSOConfig.from_environment(env)
    env['INTERFACE_PUBLIC_URL']='http://localhost:8765'
    assert not SSOConfig.from_environment(env).secure
    env.update(INTERFACE_SSO_OKTA_CLIENT_ID='id',INTERFACE_SSO_OKTA_CLIENT_SECRET='secret',INTERFACE_SSO_OKTA_ISSUER='https://test.okta.com.evil.test')
    with pytest.raises(ValueError):SSOConfig.from_environment(env)
