from fastapi import Depends, Query, Request
from ..models import Person, SelfProfileUpdate
from ..policy import Actor
from .models import AccountCreate, AccountState, Login, PasswordChange
from .security import LoginRateLimiter


def register_identity_routes(app, identity, directory, actor_dependency, token_dependency):
    limiter = LoginRateLimiter()

    @app.post('/api/v1/auth/login', tags=['Identity'])
    def login(data: Login, request: Request):
        limiter.check((request.client.host if request.client else 'unknown') + ':' + data.email.strip().lower())
        return identity.login(data)

    @app.post('/api/v1/auth/logout', tags=['Identity'])
    def logout(current: Actor = Depends(actor_dependency), token: str = Depends(token_dependency)):
        identity.logout(current, token)
        return {'ok': True}

    @app.post('/api/v1/auth/password', tags=['Identity'])
    def password(data: PasswordChange, current: Actor = Depends(actor_dependency)):
        identity.change_password(current, data)
        return {'ok': True, 'message': 'Password changed. Sign in again.'}

    @app.get('/api/v1/accounts', tags=['Identity'])
    def accounts(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0), current: Actor = Depends(actor_dependency)):
        return {'items': identity.list(current, limit, offset)}

    @app.post('/api/v1/accounts', status_code=201, tags=['Identity'])
    def create_account(data: AccountCreate, current: Actor = Depends(actor_dependency)):
        return identity.create(current, data)

    @app.put('/api/v1/accounts/{account_id}/state', tags=['Identity'])
    def account_state(account_id: str, data: AccountState, current: Actor = Depends(actor_dependency)):
        return identity.set_active(current, account_id, data.active)

    @app.get('/api/v1/me/profile', response_model=Person, tags=['Self-service'])
    def profile(current: Actor = Depends(actor_dependency)):
        return directory.my_profile(current)

    @app.patch('/api/v1/me/profile', response_model=Person, tags=['Self-service'])
    def update_profile(data: SelfProfileUpdate, current: Actor = Depends(actor_dependency)):
        return directory.update_my_profile(current, data)
