from fastapi import Depends
from ..policy import Actor
from .models import EmploymentInput, FinanceInput, PlanInput, FinanceUpdate, PlanUpdate


def register_insight_routes(app, service, actor_dependency):
    @app.get('/api/v1/insights', tags=['Insights'])
    def dashboard(actor: Actor = Depends(actor_dependency)):
        return service.dashboard(actor)

    @app.get('/api/v1/people/{person_id}/employment', tags=['Employment'])
    def employment(person_id: str, actor: Actor = Depends(actor_dependency)):
        return service.employment(actor, person_id)

    @app.put('/api/v1/people/{person_id}/employment', tags=['Employment'])
    def save_employment(person_id: str, data: EmploymentInput, actor: Actor = Depends(actor_dependency)):
        return service.save_employment(actor, person_id, data)

    @app.post('/api/v1/financial-periods', status_code=201, tags=['Insights'])
    def finances(data: FinanceInput, actor: Actor = Depends(actor_dependency)):
        return service.save_finance(actor, data)

    @app.post('/api/v1/plans', status_code=201, tags=['Planning'])
    def plans(data: PlanInput, actor: Actor = Depends(actor_dependency)):
        return service.save_plan(actor, data)

    @app.put('/api/v1/financial-periods/{record_id}', tags=['Insights'])
    def update_finances(record_id: str, data: FinanceUpdate, actor: Actor = Depends(actor_dependency)):
        return service.update_finance(actor, record_id, data)

    @app.put('/api/v1/plans/{record_id}', tags=['Planning'])
    def update_plan(record_id: str, data: PlanUpdate, actor: Actor = Depends(actor_dependency)):
        return service.update_plan(actor, record_id, data)
