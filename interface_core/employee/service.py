from datetime import date,timedelta
from typing import Protocol
from ..policy import DomainError

class EmployeeRepository(Protocol):
    def get(self,person_id,kind): ...
    def save(self,actor,person_id,kind,data): ...
    def allowance(self,person_id,year): ...
    def save_allowance(self,actor,person_id,data): ...
    def absence(self,person_id,year): ...
    def payroll_export(self,actor): ...

class EmployeeService:
    def __init__(self,repository: EmployeeRepository): self.repository=repository
    def authorize(self,actor,person_id,write_hr=False):
        if actor.role=='admin':return
        if write_hr:raise DomainError(403,'HR administrator access required')
        if actor.role!='employee' or not actor.person_id or actor.person_id!=person_id:raise DomainError(404,'Employee record not found')

    def get(self,actor,person_id,kind):
        self.authorize(actor,person_id)
        result=self.repository.get(person_id,kind)
        if kind=='bank' and 'account_number' in result:
            result['account_number']='•••• '+result['account_number'][-4:]
            result['routing_code']='••••' if result.get('routing_code') else ''
        return result
    def save(self,actor,person_id,kind,data):
        self.authorize(actor,person_id,kind=='contract')
        return self.repository.save(actor,person_id,kind,data)
    def balance(self,actor,person_id,year):
        self.authorize(actor,person_id)
        allowance=self.repository.allowance(person_id,year)
        counts={'approved':0,'requested':0,'sick':0}
        for row in self.repository.absence(person_id,year):
            start=max(date.fromisoformat(row['start_date']),date(year,1,1));end=min(date.fromisoformat(row['end_date']),date(year,12,31))
            days=sum((start+timedelta(days=i)).weekday()<5 for i in range((end-start).days+1))
            if row['kind']=='annual':counts[row['status']]+=days
            elif row['kind']=='sick' and row['status']=='approved':counts['sick']+=days
        return {**allowance,**counts,'remaining':None if allowance['days'] is None else allowance['days']-counts['approved'],'basis':'Monday–Friday; public holidays and part-time schedules are not deducted. Pending requests are shown separately.'}
    def save_allowance(self,actor,person_id,data):
        self.authorize(actor,person_id,True)
        return self.repository.save_allowance(actor,person_id,data)

    def payroll_export(self,actor):
        self.authorize(actor,'',True)
        return self.repository.payroll_export(actor)
