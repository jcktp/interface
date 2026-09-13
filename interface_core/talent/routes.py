from datetime import date
from fastapi import Depends,Query
from ..policy import Actor
from .models import TalentInput,CSVPreview,HireAccept
from .writer import IMPORT_FIELDS

def register_talent_routes(app,service,actor_dependency):
    @app.get('/api/v1/talent')
    def analytics(department:str=Query('',max_length=120),start:date|None=None,end:date|None=None,actor:Actor=Depends(actor_dependency)):return service.analytics(actor,department,start,end)
    @app.get('/api/v1/talent/{person_id}')
    def get(person_id:str,actor:Actor=Depends(actor_dependency)):return service.get(actor,person_id)
    @app.get('/api/v1/talent/{person_id}/history')
    def history(person_id:str,actor:Actor=Depends(actor_dependency)):return {'items':service.history(actor,person_id)}
    @app.put('/api/v1/talent/{person_id}')
    def save(person_id:str,data:TalentInput,actor:Actor=Depends(actor_dependency)):return service.save(actor,person_id,data)
    @app.post('/api/v1/imports/inspect')
    def inspect(data:CSVPreview,actor:Actor=Depends(actor_dependency)):
        headers,rows=service.inspect(actor,data.content)
        return {'headers':headers,'count':len(rows),'fields':sorted(IMPORT_FIELDS)}
    @app.post('/api/v1/imports/preview')
    def preview(data:CSVPreview,actor:Actor=Depends(actor_dependency)):return service.preview(actor,data)
    @app.post('/api/v1/imports/{batch_id}/commit')
    def commit(batch_id:str,actor:Actor=Depends(actor_dependency)):return service.commit(actor,batch_id)
    @app.get('/api/v1/hires')
    def inbox(actor:Actor=Depends(actor_dependency)):return service.inbox(actor)
    @app.post('/api/v1/hires/{connection_id}/{external_id}/accept')
    def accept(connection_id:str,external_id:str,data:HireAccept,actor:Actor=Depends(actor_dependency)):return service.accept(actor,connection_id,external_id,data)
