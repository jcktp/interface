"""Single composition root; modules share a database, never transport state."""
from .app import create_app
from .repository import SQLitePeopleRepository
from .service import PeopleService
from .identity.repository import SQLiteIdentityRepository
from .identity.service import IdentityService
from .workflows.repository import SQLiteWorkflowRepository
from .workflows.service import WorkflowService
from .insights.repository import SQLiteInsightsRepository
from .insights.service import InsightsService
from .connectors.repository import SQLiteConnectorRepository
from .connectors.service import ConnectorService


def build_app(database, keys, allowed_hosts=None, access_keys=True):
    return create_app(
        PeopleService(SQLitePeopleRepository(database)), keys['admin'], keys['reader'],
        identity=IdentityService(SQLiteIdentityRepository(database)),
        workflows=WorkflowService(SQLiteWorkflowRepository(database)),
        insights=InsightsService(SQLiteInsightsRepository(database)),
        connectors=ConnectorService(SQLiteConnectorRepository(database)),
        allowed_hosts=allowed_hosts, access_keys=access_keys,
    )
