from datetime import datetime
import httpx
from .adapters import ProviderSpec
from ..policy import DomainError

class AshbyHiresAdapter:
    spec=ProviderSpec('ashby_hires','Ashby · hired applications','Import hires with candidate, job, hiring team and source into a review inbox. HR confirms work email and employment dates before creating an employee.',('connection verification','hiring sync'))
    def __init__(self,client):self.client=client
    def request(self,secret,cursor,limit):
        response=self.client.post('https://api.ashbyhq.com/application.list',auth=httpx.BasicAuth(secret,''),json={'status':'Hired','cursor':cursor or 'start','limit':limit})
        response.raise_for_status();body=response.json()
        if not isinstance(body,dict) or body.get('success') is not True or not isinstance(body.get('results'),list) or len(body['results'])>limit:raise DomainError(502,'Ashby did not return a valid hired-application page; check candidatesRead permission')
        return body
    def test(self,secret):self.request(secret,'',1);return 'Verified Ashby hired applications'
    def sync(self,secret,page,cursor=''):
        body=self.request(secret,cursor,100);records=[]
        for item in body['results']:
            if item.get('status')!='Hired' or not item.get('id'):raise DomainError(502,'Unexpected application in hired results')
            candidate=item['candidate'];job=item['job'];team=item.get('hiringTeam') or []
            def member(role):return ', '.join((m.get('firstName','')+' '+m.get('lastName','')).strip() for m in team if m.get('role','').lower().replace(' ','')==role)[:120]
            records.append({'external_id':str(item['id']),'candidate_id':str(candidate['id']),'name':str(candidate['name'])[:120], 'email':str((candidate.get('primaryEmailAddress') or {}).get('value',''))[:254], 'job_id':str(job['id']), 'job_title':str(job['title'])[:120], 'recruiter':member('recruiter'),'hiring_manager':member('hiringmanager'),'source':str((item.get('source') or {}).get('title',''))[:160],'applied_date':datetime.fromisoformat(item['createdAt'].replace('Z','+00:00')).date().isoformat(),'hired_date':None,'hire_date':None})
        more=body.get('moreDataAvailable',False);next_cursor=body.get('nextCursor','') if more else ''
        if not isinstance(more,bool) or not isinstance(next_cursor,str) or len(next_cursor)>4096 or (more and (not next_cursor or next_cursor==cursor)):raise DomainError(502,'Invalid Ashby pagination')
        return records,page+1 if more else 0,next_cursor
