import csv,io
from datetime import date,timedelta
from decimal import Decimal
from collections import defaultdict
from typing import Protocol
from ..policy import DirectoryPolicy,DomainError
from .writer import IMPORT_FIELDS

class TalentRepository(Protocol):
    def get(self,person_id): ...
    def save(self,actor,person_id,data): ...
    def history(self,person_id): ...
    def snapshot(self): ...
    def preview(self,actor,rows,mode): ...
    def commit(self,actor,batch_id): ...
    def inbox(self): ...
    def accept(self,actor,connection,external,data): ...

class TalentService:
    def __init__(self,repository: TalentRepository):self.repository=repository;self.policy=DirectoryPolicy()
    def admin(self,actor):self.policy.authorize(actor,write=True)
    def get(self,actor,person_id):self.admin(actor);return self.repository.get(person_id)
    def history(self,actor,person_id):self.admin(actor);return self.repository.history(person_id)
    def save(self,actor,person_id,data):self.admin(actor);return self.repository.save(actor,person_id,data)
    def inspect(self,actor,content):
        self.admin(actor)
        try:
            reader=csv.DictReader(io.StringIO(content.lstrip('\ufeff')),strict=True)
            headers=reader.fieldnames
            if not headers or len(headers)>80 or len(set(headers))!=len(headers):raise DomainError(422,'Use a CSV with unique headers (maximum 80 columns)')
            rows=[]
            for i,row in enumerate(reader,2):
                if i>1001:raise DomainError(422,'Import at most 1,000 rows per batch')
                if None in row or None in row.values():raise DomainError(422,f'Row {i} has the wrong number of columns')
                rows.append((i,row))
            if not rows:raise DomainError(422,'The CSV contains no records')
            return headers,rows
        except csv.Error:raise DomainError(422,'Invalid CSV quoting or oversized cell') from None
    def preview(self,actor,data):
        headers,rows=self.inspect(actor,data.content)
        mapping=data.mapping or {key:key for key in headers if key in IMPORT_FIELDS}
        if not {'name','email'}<=mapping.keys() or set(mapping)-IMPORT_FIELDS or any(v not in headers for v in mapping.values()) or len(set(mapping.values()))!=len(mapping):raise DomainError(422,'Map distinct columns to name and email; use supported fields only')
        normalized=[];seen=set()
        for index,row in rows:
            values={target:row[column].strip() for target,column in mapping.items() if row[column].strip()}
            email=values.get('email','').lower()
            if email in seen:raise DomainError(422,f'Row {index} repeats an email within this CSV')
            seen.add(email);normalized.append((index,values))
        return self.repository.preview(actor,normalized,data.mode)
    def commit(self,actor,batch_id):self.admin(actor);return self.repository.commit(actor,batch_id)
    def inbox(self,actor):self.admin(actor);return {'items':self.repository.inbox()}
    def accept(self,actor,connection,external,data):self.admin(actor);return self.repository.accept(actor,connection,external,data)
    def analytics(self,actor,department='',start=None,end=None):
        self.admin(actor)
        if start and end and end<start:raise DomainError(422,'Choose an ordered hire-date range')
        rows=[r for r in self.repository.snapshot() if (not department or r['department']==department) and (not start or (r['hire_date'] and r['hire_date']>=start.isoformat())) and (not end or (r['hire_date'] and r['hire_date']<=end.isoformat()))]
        def avg(values):return float(round(sum(values)/len(values),2)) if values else None
        def scores(group,key='quality_score'):return [Decimal(str(r[key])) for r in group if r.get(key) is not None]
        def groups(key):
            grouped=defaultdict(list)
            for row in rows:grouped[row.get(key) or 'Not recorded'].append(row)
            return [{'name':key,'people':len(group),'scored':len(scores(group)),'quality':avg(scores(group))} for key,group in sorted(grouped.items())]
        eligible=[];retained=0;unknown=0
        for row in rows:
            if not row['hire_date']:continue
            milestone=date.fromisoformat(row['hire_date'])+timedelta(days=90)
            if milestone>date.today():continue
            if row['status']=='inactive' and not row['end_date']:unknown+=1;continue
            eligible.append(row)
            if not row['end_date'] or date.fromisoformat(row['end_date'])>=milestone:retained+=1
        distribution=[{'range':f'{low}–{low+20}','count':sum(low<=s and (s<low+20 or low==80) for s in scores(rows))} for low in range(0,100,20)]
        quarters=defaultdict(list)
        for row in rows:
            if row['hire_date']:
                hired=date.fromisoformat(row['hire_date']);quarters[f'{hired.year} Q{(hired.month-1)//3+1}'].append(row)
        cycle=[Decimal((date.fromisoformat(r['hired_date'])-date.fromisoformat(r['applied_date'])).days) for r in rows if r.get('hired_date') and r.get('applied_date')]
        costs=defaultdict(list)
        for row in rows:
            if row.get('cost_per_hire') is not None:costs[row.get('currency','EUR')].append(Decimal(str(row['cost_per_hire'])))
        return {'hiring_cycle_days':avg(cycle),'hiring_cycle_sample':len(cycle),'costs':[{'currency':key,'average_cost':str(round(sum(values)/len(values),2)),'sample':len(values)} for key,values in sorted(costs.items())],'people':len(rows),'scored':len(scores(rows)),'quality':avg(scores(rows)),'performance':avg(scores(rows,'performance_rating')),'performance_sample':len(scores(rows,'performance_rating')),'engagement':avg(scores(rows,'engagement_score')),'engagement_sample':len(scores(rows,'engagement_score')),'retention_90':round(retained/len(eligible)*100,1) if eligible else None,'retention_sample':len(eligible),'retention_unknown':unknown,'by_recruiter':groups('recruiter'),'by_source':groups('source'),'by_department':groups('department'),'by_previous_company':groups('previous_company'),'distribution':distribution,'cohorts':[{'name':key,'people':len(group),'scored':len(scores(group)),'quality':avg(scores(group))} for key,group in sorted(quarters.items())]}
