import pytest
from fastapi.testclient import TestClient
from interface_core.app import create_app
from interface_core.models import PersonInput
from interface_core.policy import Actor, DomainError
from interface_core.database import SQLiteDatabase
from interface_core.repository import SQLitePeopleRepository
from interface_core.service import PeopleService

ADMIN = {"Authorization": "Bearer " + "a" * 40}
READER = {"Authorization": "Bearer " + "r" * 40}


@pytest.fixture
def setup(tmp_path):
    database = SQLiteDatabase(tmp_path / "people.sqlite3")
    database.migrate()
    directory = PeopleService(SQLitePeopleRepository(database))
    return directory, TestClient(create_app(directory, "a" * 40, "r" * 40)), database


def test_permissions_on_all_data_routes(setup):
    directory, client, database = setup
    data = {"name": "Alex", "email": "alex@example.test"}
    assert client.get("/api/v1/people").status_code == 401
    assert client.post("/api/v1/people", json=data, headers=READER).status_code == 403
    assert client.get("/api/v1/events", headers=READER).status_code == 403
    with pytest.raises(DomainError):
        directory.save(Actor("reader", "reader"), PersonInput(**data))
    assert client.get("/api/v1/people", headers=READER).json()["total"] == 0


def test_create_update_conflict_and_events(setup):
    directory, client, database = setup
    result = client.post("/api/v1/people", json={"name": " Alex ", "email": "Alex@EXAMPLE.test"}, headers=ADMIN)
    assert result.status_code == 201
    person = result.json()
    assert person["name"] == "Alex" and person["email"] == "alex@example.test"
    body = {k: person[k] for k in ["name", "email", "title", "department", "status", "version"]}
    body["status"] = "inactive"
    path = "/api/v1/people/" + person["id"]
    assert client.put(path, json=body, headers=READER).status_code == 403
    assert client.put(path, json=body, headers=ADMIN).json()["version"] == 2
    assert client.put(path, json=body, headers=ADMIN).status_code == 409
    events = client.get("/api/v1/events", headers=ADMIN).json()["items"]
    assert len(events) == 2 and events[-1]["changed_fields"] == ["status"]
    assert len(client.get("/api/v1/events?after=1", headers=ADMIN).json()["items"]) == 1
    database.migrate()
    assert PeopleService(SQLitePeopleRepository(SQLiteDatabase(database.path))).get(Actor("reader", "reader"), person["id"])["status"] == "inactive"


def test_validation_duplicates_and_filtered_pagination(setup):
    _, client, _ = setup
    for i in range(3):
        assert client.post("/api/v1/people", json={"name": f"Person {i}", "email": f"{i}@example.test", "department": "Engineering"}, headers=ADMIN).status_code == 201
    assert client.post("/api/v1/people", json={"name": "Duplicate", "email": "0@EXAMPLE.TEST"}, headers=ADMIN).status_code == 409
    assert len(client.get("/api/v1/events", headers=ADMIN).json()["items"]) == 3
    for extra in [{"salary": 100}, {"organization_id": "other"}, {"name": " "}, {"email": "bad"}, {"status": "other"}]:
        assert client.post("/api/v1/people", json={"name": "Alex", "email": "new@example.test", **extra}, headers=ADMIN).status_code == 422
    page = client.get("/api/v1/people?q=engineering&limit=2&offset=2", headers=READER).json()
    assert page["total"] == 3 and len(page["items"]) == 1
    assert client.get("/api/v1/people?q=%25", headers=READER).json()["total"] == 0
    assert client.get("/api/v1/people?limit=100000", headers=READER).status_code == 422
    assert client.get("/api/v1/people/missing", headers=READER).status_code == 404


def test_failed_event_rolls_back_person(setup):
    directory, _, database = setup
    with database.connect() as db:
        db.execute("CREATE TRIGGER fail_event BEFORE INSERT ON events BEGIN SELECT RAISE(ABORT, 'fail'); END")
    with pytest.raises(DomainError):
        directory.save(Actor("admin", "admin"), PersonInput(name="Alex", email="alex@example.test"))
    assert directory.list(Actor("admin", "admin"))["total"] == 0


def test_ui_and_openapi(setup):
    _, client, _ = setup
    assert client.get("/").status_code == 200
    assert "script-src 'self'" in client.get("/").headers["content-security-policy"]
    assert client.get("/static/app.js").status_code == 200
    assert client.get("/health").json() == {"status": "ok"}
    assert "/api/v1/people" in client.get("/openapi.json").json()["paths"]
    assert client.get("/", headers={"host": "evil.example"}).status_code == 400


def test_unicode_search_and_database_isolation(tmp_path):
    services = []
    for name in ("one", "two"):
        db = SQLiteDatabase(tmp_path / f"{name}.sqlite3")
        db.migrate()
        services.append(PeopleService(SQLitePeopleRepository(db)))
    actor = Actor("admin", "admin")
    person = services[0].save(actor, PersonInput(name="Éva Straße", email="eva@example.test"))
    assert services[0].list(actor, "éVA STRASSE")["total"] == 1
    assert services[1].list(actor)["total"] == 0
    with pytest.raises(DomainError) as error:
        services[1].get(actor, person["id"])
    assert error.value.status == 404
