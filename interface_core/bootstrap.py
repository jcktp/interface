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


def build_app(database, keys, allowed_hosts=None, access_keys=True, sso_config=None, sso_client=None):
    from .sso.config import SSOConfig
    from .sso.repository import SQLiteSSORepository
    from .sso.service import SSOService
    return create_app(
        PeopleService(SQLitePeopleRepository(database)), keys['admin'], keys['reader'],
        identity=IdentityService(SQLiteIdentityRepository(database)),
        workflows=WorkflowService(SQLiteWorkflowRepository(database)),
        insights=InsightsService(SQLiteInsightsRepository(database)),
        connectors=ConnectorService(SQLiteConnectorRepository(database)),
        allowed_hosts=allowed_hosts, access_keys=access_keys,
        sso=SSOService(SQLiteSSORepository(database),sso_config or SSOConfig.from_environment(),sso_client),
    )
