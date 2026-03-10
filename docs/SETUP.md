# Setup & Development Guide

## Prerequisites

- Docker Desktop (with Docker Compose v2)
- No local Node.js or Python required — everything runs in containers

## Quick Start

```bash
# Clone and start
git clone <repo>
cd interface

# Build and start all services
docker-compose up --build

# App is available at http://localhost:3000
```

> **Note**: Every code change requires a full rebuild since the frontend is compiled at build time (no volume mount for hot reload).

## Environment Variables

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

### Required

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | JWT secret (any random string for dev) |
| `DATABASE_URL` | Auto-set by docker-compose: `postgresql://postgres:postgres@db/hr_analytics` |
| `REDIS_URL` | Auto-set by docker-compose: `redis://redis:6379/0` |

### Optional

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | For AI Chat and Deep Dive features |
| `LLM_BASE_URL` | Custom LLM endpoint (defaults to OpenAI) |
| `LLM_MODEL` | Model ID (defaults to `gpt-4o`) |
| `SLACK_BOT_TOKEN` | For Slack integration (requires `--profile slack`) |
| `ML_MODELS_PATH` | Path to persist ML model files |

## Seeding Demo Data

1. Start the app: `docker-compose up --build`
2. Open `http://localhost:3000`
3. Login as `admin@interface.app` / `admin123`
4. Go to **Data & Integrations** → **Import** tab
5. Click **Load Mock Database**

This seeds:
- ~3,800 employees across departments
- ~4,000 candidates
- ~200 job requisitions
- KPI definitions
- 730 days of attendance records per employee
- Org health alerts

## Demo Users

| Email | Password | Role |
|-------|----------|------|
| `admin@interface.app` | `admin123` | Super Admin (full access) |
| `demo@interface.app` | `demo123` | HR Manager (permissions set by admin) |

To customize what `demo@` can see:
1. Login as `admin@interface.app`
2. Go to **User Management** (`/app/admin/users`)
3. Find Demo User → click **Permissions**
4. Check/uncheck permissions → **Save**
5. `demo@` will get these exact permissions on next login

## Optional Services

### Slack Bot
```bash
docker-compose --profile slack up --build
```
Requires `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN`.

### ML Worker
```bash
docker-compose --profile ml up --build
```
Adds a separate Python worker for async ML training jobs.

## Rebuilding After Code Changes

```bash
docker-compose up --build
```

The Dockerfile uses a multi-stage build:
1. Node.js stage: `npm install && npm run build` → produces `dist/`
2. Python stage: `pip install -r requirements.txt`
3. Final stage: Nginx serves static files, Uvicorn runs FastAPI

## Database Migrations

Migrations live in `backend/alembic/versions/`. The app auto-runs `init_db()` on startup (via `SQLAlchemy.Base.metadata.create_all`) which creates tables if they don't exist.

To create a new migration:
```bash
docker-compose exec app alembic revision --autogenerate -m "description"
docker-compose exec app alembic upgrade head
```

## Useful Commands

```bash
# View logs
docker-compose logs -f app

# Access PostgreSQL
docker-compose exec db psql -U postgres hr_analytics

# Access Redis CLI
docker-compose exec redis redis-cli

# Restart without rebuild
docker-compose restart app
```
