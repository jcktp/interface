from fastapi import Depends, Query, Request
from fastapi.responses import RedirectResponse, JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from ..policy import Actor, DomainError
from ..identity.security import LoginRateLimiter


class SSOLink(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    provider: str = Field(min_length=1, max_length=40)
    subject: str = Field(min_length=1, max_length=255)
    user_id: str = Field(min_length=1, max_length=80)


def register_sso_routes(app, service, actor_dependency):
    limiter = LoginRateLimiter()
    binding_cookie = 'interface_sso_browser'
    handoff_cookie = 'interface_sso_handoff'

    @app.get('/api/v1/auth/sso/providers', tags=['SSO'])
    def providers():
        return {'items':service.providers()}

    @app.get('/api/v1/sso', tags=['SSO'])
    def settings(actor: Actor=Depends(actor_dependency)):
        return service.settings(actor)

    @app.post('/api/v1/sso/links', status_code=201, tags=['SSO'])
    def link(data: SSOLink, actor: Actor=Depends(actor_dependency)):
        return service.link(actor,data.provider,data.subject,data.user_id)

    @app.delete('/api/v1/sso/links/{provider}/{user_id}', tags=['SSO'])
    def unlink(provider: str, user_id: str, actor: Actor=Depends(actor_dependency)):
        service.unlink(actor,provider,user_id)
        return {'unlinked':True}

    @app.get('/api/v1/auth/sso/{provider}/start', tags=['SSO'])
    def start(provider: str, request: Request):
        limiter.check(request.client.host if request.client else 'unknown')
        location, browser = service.begin(provider)
        response = RedirectResponse(location, status_code=303)
        response.set_cookie(binding_cookie,browser,max_age=300,httponly=True,secure=service.config.secure,samesite='lax',path='/api/v1/auth/sso')
        return response

    @app.get('/api/v1/auth/sso/{provider}/callback', tags=['SSO'])
    def callback(provider: str, request: Request, state: str=Query('',max_length=256), code: str=Query('',max_length=8192)):
        try:
            token = service.complete(provider,state,request.cookies.get(binding_cookie,''),code)
            response = RedirectResponse('/?sso=complete',status_code=303)
            response.set_cookie(handoff_cookie,token,max_age=60,httponly=True,secure=service.config.secure,samesite='strict',path='/api/v1/auth/sso/session')
        except DomainError:
            # Never put provider errors, identities or tokens into URLs or browser HTML.
            response = RedirectResponse('/?sso=failed',status_code=303)
        response.delete_cookie(binding_cookie,path='/api/v1/auth/sso')
        response.headers['Referrer-Policy'] = 'no-referrer'
        return response

    @app.post('/api/v1/auth/sso/session', tags=['SSO'])
    def exchange(request: Request):
        if not service.config.origin or request.headers.get('origin') != service.config.origin:
            raise DomainError(403, 'Sign-in must finish from the Interface origin')
        result = service.exchange(request.cookies.get(handoff_cookie,''))
        response = JSONResponse(result)
        response.delete_cookie(handoff_cookie,path='/api/v1/auth/sso/session')
        return response
