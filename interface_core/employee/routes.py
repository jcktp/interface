from fastapi import Depends,Query
from ..policy import Actor
from .models import PersonalDetails,BankDetails,ContractDetails,Allowance

def register_employee_routes(app,service,actor_dependency):
    @app.get('/api/v1/employee/{person_id}/{kind}')
    def details(person_id:str,kind:str,actor:Actor=Depends(actor_dependency)):
        from ..policy import DomainError
        if kind not in ('personal','bank','contract'):raise DomainError(404,'Section not found')
        return service.get(actor,person_id,kind)
    @app.put('/api/v1/employee/{person_id}/personal')
    def personal(person_id:str,data:PersonalDetails,actor:Actor=Depends(actor_dependency)):return service.save(actor,person_id,'personal',data)
    @app.put('/api/v1/employee/{person_id}/bank')
    def bank(person_id:str,data:BankDetails,actor:Actor=Depends(actor_dependency)):return service.save(actor,person_id,'bank',data)
    @app.put('/api/v1/employee/{person_id}/contract')
    def contract(person_id:str,data:ContractDetails,actor:Actor=Depends(actor_dependency)):return service.save(actor,person_id,'contract',data)
    @app.get('/api/v1/employee/{person_id}/leave/balance')
    def balance(person_id:str,year:int=Query(ge=2000,le=2200),actor:Actor=Depends(actor_dependency)):return service.balance(actor,person_id,year)
    @app.put('/api/v1/employee/{person_id}/leave/allowance')
    def allowance(person_id:str,data:Allowance,actor:Actor=Depends(actor_dependency)):return service.save_allowance(actor,person_id,data)

    @app.post('/api/v1/payroll/export')
    def payroll(actor:Actor=Depends(actor_dependency)):return service.payroll_export(actor)
