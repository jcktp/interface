"""
Interface - Backend API
Refactored for maintainability and scalability.
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Database imports
from database.connection import init_db

# Domain Routers
from routes.auth import router as auth_router
from routes.employees import router as employees_router
from routes.recruitment import router as recruitment_router, recruiter_router
from routes.attendance import router as attendance_router
from routes.compensation import router as compensation_router
from routes.metrics import router as metrics_router
from routes.admin import router as admin_router
from routes.ml import router as ml_router
from routes.kpis import router as kpis_router
from routes.performance import router as performance_router
from routes.data import router as data_router
from routes.integrations import router as integrations_router
from routes.command_center import router as command_center_router
from routes.ai import router as ai_router
from routes.deep_dive import router as deep_dive_router
from routes.organization import router as organization_router
from routes.warehouse import router as warehouse_router
from routes.queries import router as queries_router
from routes.planning import router as planning_router
from routes.reports import router as reports_router
from routes.dashboards import router as dashboards_router, widgets_router
from routes.retention import router as retention_router

# App initialization
app = FastAPI(
    title="Interface API",
    description="AI-powered Workforce Intelligence Platform",
    version="1.0.0",
)

# CORS middleware
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# Include Domain Routers
app.include_router(auth_router)
app.include_router(employees_router)
app.include_router(recruitment_router)
app.include_router(recruiter_router)
app.include_router(attendance_router)
app.include_router(compensation_router)
app.include_router(metrics_router)
app.include_router(admin_router)
app.include_router(ml_router)
app.include_router(kpis_router)
app.include_router(performance_router)
app.include_router(data_router)
app.include_router(integrations_router)
app.include_router(command_center_router)
app.include_router(ai_router)
app.include_router(deep_dive_router)
app.include_router(organization_router)
app.include_router(warehouse_router)
app.include_router(queries_router)
app.include_router(planning_router)
app.include_router(reports_router)
app.include_router(dashboards_router)
app.include_router(widgets_router)
app.include_router(retention_router)

@app.get("/health")
@app.get("/api/health")
async def health_check():
    from datetime import datetime
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat() + "Z"}

@app.get("/")
async def root():
    return {
        "name": "Interface API",
        "status": "online",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.on_event("startup")
async def startup_event():
    # Initialize database tables
    init_db()

