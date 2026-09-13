import hashlib
import secrets
import time
from typing import Protocol

from ..policy import Actor, DirectoryPolicy, DomainError
from .models import AccountCreate, Login, PasswordChange
from .security import PasswordHasher


class IdentityRepository(Protocol):
    def create(self, actor, person_id, role, password_hash): ...
    def find_by_email(self, email): ...
    def create_session(self, user_id, token_hash, expires_at, now, verified_hash): ...
    def authenticate(self, token_hash, now): ...
    def revoke(self, token_hash, actor): ...
    def list(self, limit, offset): ...
    def set_active(self, actor, user_id, active): ...
    def password_hash(self, user_id): ...
    def change_password(self, actor, old_hash, new_hash): ...


class IdentityService:
    def __init__(self, repository: IdentityRepository, hasher: PasswordHasher | None = None):
        self.repository = repository
        self.hasher = hasher or PasswordHasher()
        self.dummy_hash = self.hasher.hash(secrets.token_urlsafe(24))
        self.policy = DirectoryPolicy()

    @staticmethod
    def digest(token):
        return hashlib.sha256(token.encode()).hexdigest()

    def create(self, actor: Actor, data: AccountCreate):
        self.policy.authorize(actor, write=True)
        return self.repository.create(actor, data.person_id, data.role, self.hasher.hash(data.password.get_secret_value()))

    def login(self, data: Login):
        user = self.repository.find_by_email(data.email.strip().lower())
        valid = self.hasher.verify(data.password.get_secret_value(), user['password_hash'] if user else self.dummy_hash)
        if not valid or not user or not user['active'] or user['status'] != 'active':
            raise DomainError(401, "Invalid email or password")
        token = secrets.token_urlsafe(32)
        now = int(time.time())
        self.repository.create_session(user['id'], self.digest(token), now + 12 * 3600, now, user['password_hash'])
        return {"access_token": token, "token_type": "bearer", "expires_in": 12 * 3600}

    def authenticate(self, token):
        actor = self.repository.authenticate(self.digest(token), int(time.time()))
        if not actor:
            raise DomainError(401, "Sign in again; your session is invalid or expired")
        return actor

    def logout(self, actor: Actor, token: str):
        if actor.person_id:
            self.repository.revoke(self.digest(token), actor)

    def list(self, actor: Actor, limit=50, offset=0):
        self.policy.authorize(actor, write=True)
        if not 1 <= limit <= 100 or offset < 0:
            raise DomainError(422, "Invalid pagination")
        return self.repository.list(limit, offset)

    def set_active(self, actor: Actor, user_id: str, active: bool):
        self.policy.authorize(actor, write=True)
        if actor.name == user_id and not active:
            raise DomainError(409, "You cannot deactivate your own account")
        return self.repository.set_active(actor, user_id, active)

    def change_password(self, actor: Actor, data: PasswordChange):
        if not actor.person_id:
            raise DomainError(403, "Sign in with a named employee account")
        old_hash = self.repository.password_hash(actor.name)
        if not self.hasher.verify(data.current_password.get_secret_value(), old_hash):
            raise DomainError(401, "Current password is incorrect")
        self.repository.change_password(actor, old_hash, self.hasher.hash(data.new_password.get_secret_value()))
