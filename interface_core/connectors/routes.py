from fastapi import Depends
from ..policy import Actor
from .models import ConnectionInput


def register_connector_routes(app,service,actor_dependency):
    @app.get('/api/v1/connectors',tags=['Connectors'])
    def connections(actor: Actor=Depends(actor_dependency)):
        return service.list(actor)

    @app.post('/api/v1/connectors',status_code=201,tags=['Connectors'])
    def create(data: ConnectionInput,actor: Actor=Depends(actor_dependency)):
        return service.create(actor,data)

    @app.post('/api/v1/connectors/{connection_id}/test',tags=['Connectors'])
    def test(connection_id: str,actor: Actor=Depends(actor_dependency)):
        return service.execute(actor,connection_id)

    @app.post('/api/v1/connectors/{connection_id}/sync',tags=['Connectors'])
    def sync(connection_id: str,actor: Actor=Depends(actor_dependency)):
        return service.execute(actor,connection_id,sync=True)

    @app.post('/api/v1/connectors/{connection_id}/restart',tags=['Connectors'])
    def restart(connection_id: str,actor: Actor=Depends(actor_dependency)):
        return service.restart_sync(actor,connection_id)
