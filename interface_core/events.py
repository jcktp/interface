"""A shared transactional journal. Call inside the domain write transaction."""
from datetime import datetime, timezone
import json


class EventJournal:
    def record(self, connection, event: str, person_id: str, actor: str, fields: list[str]):
        connection.execute(
            "INSERT INTO events(type,person_id,actor,occurred_at,changed_fields) VALUES (?,?,?,?,?)",
            (event, person_id, actor, datetime.now(timezone.utc).isoformat(), json.dumps(fields)),
        )


class ActivityJournal:
    def record(self, connection, entity_type: str, entity_id: str, event: str, actor: str):
        connection.execute(
            "INSERT INTO activity(entity_type,entity_id,event,actor,occurred_at) VALUES (?,?,?,?,?)",
            (entity_type, entity_id, event, actor, datetime.now(timezone.utc).isoformat()),
        )
