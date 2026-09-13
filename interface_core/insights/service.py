from datetime import date
from typing import Protocol
from ..policy import DirectoryPolicy, DomainError
from .calculator import WorkforceCalculator


class InsightsRepository(Protocol):
    def snapshot(self): ...
    def employment(self, person_id): ...
    def save_employment(self, actor, person_id, data): ...
    def save_finance(self, actor, data): ...
    def save_plan(self, actor, data): ...
    def update_finance(self, actor, record_id, data): ...
    def update_plan(self, actor, record_id, data): ...


class InsightsService:
    def __init__(self, repository: InsightsRepository, calculator=None, policy=None):
        self.repository = repository
        self.calculator = calculator or WorkforceCalculator()
        self.policy = policy or DirectoryPolicy()

    def dashboard(self, actor):
        self.policy.authorize(actor, write=True)
        people, finances, plans = self.repository.snapshot()
        summary = self.calculator.summarize(people, date.today())
        return {**summary, 'financial_periods': [self.calculator.finance(p, people) for p in finances],
                'plans': [self.calculator.plan(p, summary['active_headcount']) for p in plans]}

    def employment(self, actor, person_id):
        if actor.role != 'admin' and actor.person_id != person_id:
            raise DomainError(403, 'Employment records are restricted')
        return self.repository.employment(person_id)

    def save_employment(self, actor, person_id, data):
        self.policy.authorize(actor, write=True)
        return self.repository.save_employment(actor, person_id, data)

    def save_finance(self, actor, data):
        self.policy.authorize(actor, write=True)
        return self.repository.save_finance(actor, data)

    def save_plan(self, actor, data):
        self.policy.authorize(actor, write=True)
        return self.repository.save_plan(actor, data)

    def update_finance(self, actor, record_id, data):
        self.policy.authorize(actor, write=True)
        return self.repository.update_finance(actor, record_id, data)

    def update_plan(self, actor, record_id, data):
        self.policy.authorize(actor, write=True)
        return self.repository.update_plan(actor, record_id, data)
