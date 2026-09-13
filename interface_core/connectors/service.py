from dataclasses import asdict
import os
from typing import Protocol
import httpx
from ..policy import DirectoryPolicy, DomainError
from .adapters import ProviderRegistry


class ConnectorRepository(Protocol):
    def list(self): ...
    def get(self, connection_id): ...
    def create(self, actor, data): ...
    def status(self, actor, connection_id, status, message): ...
    def sync(self, actor, connection, records, next_page): ...
    def restart_sync(self, actor, connection_id): ...


class ConnectorService:
    def __init__(self, repository: ConnectorRepository, registry=None, environment=None):
        self.repository=repository
        self.registry=registry or ProviderRegistry()
        self.environment=os.environ if environment is None else environment
        self.policy=DirectoryPolicy()

    def list(self,actor):
        self.policy.authorize(actor,write=True)
        connections,candidates=self.repository.list()
        return {'providers':[asdict(adapter.spec) for adapter in self.registry.adapters.values()], 'connections':connections,'candidates':candidates}

    def create(self,actor,data):
        self.policy.authorize(actor,write=True)
        self.registry.get(data.provider)
        return self.repository.create(actor,data)

    def execute(self,actor,connection_id,sync=False):
        self.policy.authorize(actor,write=True)
        connection=self.repository.get(connection_id)
        adapter=self.registry.get(connection['provider'])
        secret=self.environment.get(connection['secret_env'])
        if not secret:
            return self.repository.status(actor,connection_id,'missing_credentials','Set the configured environment variable on the server and restart it.')
        try:
            if sync:
                if connection['provider']!='greenhouse':
                    raise DomainError(422,'This provider does not support candidate sync')
                if not connection['next_page']:
                    return connection
                records,next_page=adapter.sync(secret,connection['next_page'])
                return self.repository.sync(actor,connection,records,next_page)
            return self.repository.status(actor,connection_id,'verified',adapter.test(secret))
        except httpx.HTTPError:
            return self.repository.status(actor,connection_id,'error','Provider request failed. Check token permissions, connectivity, or provider rate limits; retry later.')
        except (ValueError,KeyError,TypeError):
            return self.repository.status(actor,connection_id,'error','Provider returned an unexpected response; no sync progress was saved.')
        except DomainError as error:
            if error.status == 409:
                raise
            return self.repository.status(actor,connection_id,'error',error.message)

    def restart_sync(self, actor, connection_id):
        self.policy.authorize(actor, write=True)
        connection = self.repository.get(connection_id)
        if connection['provider'] != 'greenhouse':
            raise DomainError(422, 'This provider does not support candidate sync')
        return self.repository.restart_sync(actor, connection_id)
