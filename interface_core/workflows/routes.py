from .models import LeaveAmend
from fastapi import Depends, Query
from ..policy import Actor
from .models import LeaveCreate, LeaveTransition, TaskCreate, TaskTransition


def register_workflow_routes(app, service, actor_dependency):
    @app.get('/api/v1/leave', tags=['Time off'])
    def leave(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0), actor: Actor = Depends(actor_dependency)):
        return {'items': service.list_leave(actor, limit, offset)}

    @app.post('/api/v1/leave', status_code=201, tags=['Time off'])
    def request(data: LeaveCreate, actor: Actor = Depends(actor_dependency)):
        return service.create_leave(actor, data)

    @app.post('/api/v1/leave/{record_id}/transition', tags=['Time off'])
    def decide(record_id: str, data: LeaveTransition, actor: Actor = Depends(actor_dependency)):
        return service.transition_leave(actor, record_id, data)

    @app.get('/api/v1/tasks', tags=['Onboarding'])
    def tasks(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0), actor: Actor = Depends(actor_dependency)):
        return {'items': service.list_tasks(actor, limit, offset)}

    @app.post('/api/v1/tasks', status_code=201, tags=['Onboarding'])
    def create(data: TaskCreate, actor: Actor = Depends(actor_dependency)):
        return service.create_task(actor, data)

    @app.post('/api/v1/tasks/{record_id}/transition', tags=['Onboarding'])
    def complete(record_id: str, data: TaskTransition, actor: Actor = Depends(actor_dependency)):
        return service.transition_task(actor, record_id, data)

    @app.put('/api/v1/leave/{record_id}/sickness')
    def amend_sickness(record_id: str, data: LeaveAmend, actor: Actor=Depends(actor_dependency)):
        return service.amend_sickness(actor,record_id,data)
