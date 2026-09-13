from typing import Protocol
from ..policy import DomainError
from .policy import WorkflowPolicy


class WorkflowRepository(Protocol):
    def list_leave(self, actor, limit, offset): ...
    def create_leave(self, actor, data): ...
    def transition_leave(self, actor, record_id, data): ...
    def list_tasks(self, actor, limit, offset): ...
    def amend_sickness(self, actor, record_id, data): ...
    def create_task(self, actor, data): ...
    def transition_task(self, actor, record_id, data): ...


class WorkflowService:
    def __init__(self, repository: WorkflowRepository, policy=None):
        self.repository = repository
        self.policy = policy or WorkflowPolicy()

    def readable(self, actor, limit=50, offset=0):
        if actor.role != 'admin':
            self.policy.named(actor)
        if not 1 <= limit <= 100 or offset < 0:
            raise DomainError(422, 'Invalid pagination')

    def list_leave(self, actor, limit=50, offset=0):
        self.readable(actor, limit, offset)
        return self.repository.list_leave(actor, limit, offset)

    def create_leave(self, actor, data):
        self.policy.named(actor)
        return self.repository.create_leave(actor, data)

    def transition_leave(self, actor, record_id, data):
        self.policy.named(actor)
        return self.repository.transition_leave(actor, record_id, data)

    def list_tasks(self, actor, limit=50, offset=0):
        self.readable(actor, limit, offset)
        return self.repository.list_tasks(actor, limit, offset)

    def create_task(self, actor, data):
        self.policy.authorize(actor, write=True)
        return self.repository.create_task(actor, data)

    def transition_task(self, actor, record_id, data):
        self.readable(actor)
        return self.repository.transition_task(actor, record_id, data)

    def amend_sickness(self,actor,record_id,data):
        self.policy.named(actor)
        return self.repository.amend_sickness(actor,record_id,data)
