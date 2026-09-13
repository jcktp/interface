"""Application service. All adapters enter through this policy boundary."""
from typing import Protocol

from .models import PersonInput
from .policy import Actor, DirectoryPolicy, DomainError


class PeopleRepository(Protocol):
    def list(self, q: str, limit: int, offset: int) -> dict: ...
    def get(self, person_id: str) -> dict: ...
    def save(self, actor: Actor, data: PersonInput, person_id: str | None) -> dict: ...
    def events(self, after: int, limit: int) -> list[dict]: ...
    def health(self) -> None: ...


class PeopleService:
    def __init__(self, repository: PeopleRepository, policy: DirectoryPolicy | None = None):
        self.repository = repository
        self.policy = policy or DirectoryPolicy()

    def list(self, actor: Actor, q: str = "", limit: int = 50, offset: int = 0) -> dict:
        self.policy.authorize(actor)
        if not 1 <= limit <= 100 or offset < 0 or len(q) > 120:
            raise DomainError(422, "Invalid pagination or search")
        return self.repository.list(q.strip(), limit, offset)

    def get(self, actor: Actor, person_id: str) -> dict:
        self.policy.authorize(actor)
        return self.repository.get(person_id)

    def save(self, actor: Actor, data: PersonInput, person_id: str | None = None) -> dict:
        self.policy.authorize(actor, write=True)
        return self.repository.save(actor, data, person_id)

    def events(self, actor: Actor, after: int = 0, limit: int = 100) -> list[dict]:
        self.policy.authorize(actor, write=True)
        if after < 0 or not 1 <= limit <= 100:
            raise DomainError(422, "Invalid event cursor")
        return self.repository.events(after, limit)

    def health(self) -> None:
        self.repository.health()
