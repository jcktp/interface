from pathlib import Path
import secrets

from fastapi import Depends, FastAPI, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .models import Person, PersonInput, PersonUpdate, PeoplePage
from .policy import Actor, DomainError
from .service import PeopleService


def create_app(directory: PeopleService, admin_token: str, reader_token: str):
    if min(len(admin_token), len(reader_token)) < 32 or admin_token == reader_token:
        raise ValueError("Two distinct tokens of at least 32 characters are required")
    app = FastAPI(title="Interface", version="0.1.0")
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "testserver"])
    bearer = HTTPBearer(auto_error=False)

    def actor(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
        token = credentials.credentials if credentials else ""
        if secrets.compare_digest(token, admin_token):
            return Actor("local-admin", "admin")
        if secrets.compare_digest(token, reader_token):
            return Actor("local-reader", "reader")
        raise DomainError(401, "Enter a valid access key")

    @app.exception_handler(DomainError)
    async def domain_error(request, exc):
        return JSONResponse({"detail": exc.message}, status_code=exc.status)

    @app.middleware("http")
    async def headers(request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        if request.url.path == "/" or request.url.path.startswith("/static"):
            response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'"
        return response

    @app.get("/health")
    def health():
        directory.health()
        return {"status": "ok"}

    @app.get("/api/v1/me")
    def me(current: Actor = Depends(actor)):
        return {"name": current.name, "role": current.role}

    @app.get("/api/v1/people", response_model=PeoplePage)
    def people(q: str = Query("", max_length=120), limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0), current: Actor = Depends(actor)):
        return directory.list(current, q, limit, offset)

    @app.get("/api/v1/people/{person_id}", response_model=Person)
    def person(person_id: str, current: Actor = Depends(actor)):
        return directory.get(current, person_id)

    @app.post("/api/v1/people", response_model=Person, status_code=201)
    def create(data: PersonInput, current: Actor = Depends(actor)):
        return directory.save(current, data)

    @app.put("/api/v1/people/{person_id}", response_model=Person)
    def update(person_id: str, data: PersonUpdate, current: Actor = Depends(actor)):
        return directory.save(current, data, person_id)

    @app.get("/api/v1/events")
    def events(after: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=100), current: Actor = Depends(actor)):
        return {"items": directory.events(current, after, limit)}

    static = Path(__file__).parent / "static"
    app.mount("/static", StaticFiles(directory=static), name="static")

    @app.get("/", include_in_schema=False)
    def index():
        return FileResponse(static / "index.html")

    return app
