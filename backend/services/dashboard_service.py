"""
Dashboard Service

Handles dashboard CRUD, widget management, and data fetching.
Refactored to delegate analytical logic to specialized modules.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
import uuid

from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from database.models import Dashboard, DashboardShare, WidgetTemplate
from services.analytics.metric_analytics import MetricAnalytics
from services.analytics.chart_analytics import ChartAnalytics
from services.analytics.table_analytics import TableAnalytics
from services.analytics.gauge_analytics import GaugeAnalytics


class DashboardService:
    """Service for dashboard management."""

    def __init__(self, db: Session):
        self.db = db
        self.metrics = MetricAnalytics(db)
        self.charts = ChartAnalytics(db)
        self.tables = TableAnalytics(db)
        self.gauges = GaugeAnalytics(db)

    # ==================== Dashboard CRUD ====================

    def create_dashboard(self, organization_id: UUID, name: str, created_by: UUID, **kwargs) -> Dashboard:
        if kwargs.get("is_default"):
            self.db.execute(Dashboard.__table__.update().where(Dashboard.organization_id == organization_id).values(is_default=False))
        dashboard = Dashboard(id=uuid.uuid4(), organization_id=organization_id, name=name, created_by=created_by, **kwargs)
        self.db.add(dashboard)
        self.db.commit()
        return dashboard

    def get_dashboard(self, dashboard_id: UUID) -> Optional[Dashboard]:
        return self.db.execute(select(Dashboard).where(Dashboard.id == dashboard_id)).scalar_one_or_none()

    def get_dashboards(self, organization_id: UUID, user_id: UUID) -> List[Dashboard]:
        owned = self.db.execute(select(Dashboard).where(Dashboard.organization_id == organization_id, or_(Dashboard.created_by == user_id, Dashboard.is_public == True))).scalars().all()
        shared = self.db.execute(select(Dashboard).join(DashboardShare, Dashboard.id == DashboardShare.dashboard_id).where(DashboardShare.shared_with_user_id == user_id)).scalars().all()
        result = {d.id: d for d in list(owned) + list(shared)}.values()
        return sorted(result, key=lambda x: (not x.is_default, x.name))

    def update_dashboard(self, dashboard_id: UUID, updates: Dict[str, Any], updated_by: UUID) -> Optional[Dashboard]:
        dashboard = self.get_dashboard(dashboard_id)
        if not dashboard: return None
        if updates.get("is_default"):
            self.db.execute(Dashboard.__table__.update().where(Dashboard.organization_id == dashboard.organization_id).values(is_default=False))
        for key, value in updates.items():
            if hasattr(dashboard, key): setattr(dashboard, key, value)
        dashboard.updated_by = updated_by
        dashboard.updated_at = datetime.utcnow()
        self.db.commit(); self.db.refresh(dashboard)
        return dashboard

    def delete_dashboard(self, dashboard_id: UUID) -> bool:
        dashboard = self.get_dashboard(dashboard_id)
        if not dashboard: return False
        self.db.delete(dashboard); self.db.commit()
        return True

    # ==================== Widget Data ====================

    def get_widget_data(self, organization_id: UUID, widget_type: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Fetch data for a widget by delegating to specialized analytics modules."""
        try:
            if widget_type == "metric":
                return self.metrics.get_data(organization_id, config)
            elif widget_type in ["line", "bar", "area", "pie"]:
                return self.charts.get_data(organization_id, widget_type, config)
            elif widget_type == "table":
                return self.tables.get_data(organization_id, config)
            elif widget_type == "gauge":
                return self.gauges.get_data(organization_id, config)
            return {"error": f"Unknown widget type: {widget_type}"}
        except Exception as e:
            return {"error": str(e)}

    # ==================== Sharing & Templates ====================

    def share_dashboard(self, dashboard_id: UUID, shared_with_user_id: UUID, permission: str, shared_by: UUID) -> DashboardShare:
        share = DashboardShare(id=uuid.uuid4(), dashboard_id=dashboard_id, shared_with_user_id=shared_with_user_id, permission=permission, shared_by=shared_by)
        self.db.add(share); self.db.commit(); return share

    def get_widget_templates(self, organization_id: Optional[UUID] = None) -> List[WidgetTemplate]:
        return list(self.db.execute(select(WidgetTemplate).where(or_(WidgetTemplate.is_system == True, WidgetTemplate.organization_id == organization_id))).scalars().all())
