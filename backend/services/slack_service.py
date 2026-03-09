"""
Slack Integration Service

Handles Slack workspace management, user mapping, and query processing.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
import uuid
import re

from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from database.models import (
    SlackWorkspace, SlackUserMapping, SlackInteraction, SlackScheduledReport,
    Organization, User, Employee, JobRequisition, PlanningPeriod, WorkforcePlan
)


class SlackService:
    """Service for Slack integration operations."""

    def __init__(self, db: Session):
        self.db = db

    # ==================== Workspace Management ====================

    def register_workspace(
        self,
        organization_id: UUID,
        team_id: str,
        team_name: str,
        access_token: str,
        bot_user_id: str,
        bot_access_token: str,
        app_id: str,
        scope: str,
        installed_by: UUID
    ) -> SlackWorkspace:
        """Register a new Slack workspace connection."""
        # Check if workspace already exists
        existing = self.db.execute(
            select(SlackWorkspace).where(SlackWorkspace.team_id == team_id)
        ).scalar_one_or_none()

        if existing:
            # Update existing workspace
            existing.organization_id = organization_id
            existing.team_name = team_name
            existing.access_token_encrypted = access_token  # In production, encrypt this
            existing.bot_user_id = bot_user_id
            existing.bot_access_token_encrypted = bot_access_token
            existing.app_id = app_id
            existing.scope = scope
            existing.installed_by = installed_by
            existing.is_active = True
            existing.updated_at = datetime.utcnow()
            self.db.commit()
            return existing

        workspace = SlackWorkspace(
            id=uuid.uuid4(),
            organization_id=organization_id,
            team_id=team_id,
            team_name=team_name,
            access_token_encrypted=access_token,
            bot_user_id=bot_user_id,
            bot_access_token_encrypted=bot_access_token,
            app_id=app_id,
            scope=scope,
            installed_by=installed_by
        )
        self.db.add(workspace)
        self.db.commit()
        return workspace

    def get_workspace_by_team_id(self, team_id: str) -> Optional[SlackWorkspace]:
        """Get a workspace by its Slack team ID."""
        return self.db.execute(
            select(SlackWorkspace).where(
                SlackWorkspace.team_id == team_id,
                SlackWorkspace.is_active == True
            )
        ).scalar_one_or_none()

    def get_workspace_by_org(self, organization_id: UUID) -> Optional[SlackWorkspace]:
        """Get workspace for an organization."""
        return self.db.execute(
            select(SlackWorkspace).where(
                SlackWorkspace.organization_id == organization_id,
                SlackWorkspace.is_active == True
            )
        ).scalar_one_or_none()

    def disconnect_workspace(self, team_id: str) -> bool:
        """Disconnect a Slack workspace."""
        workspace = self.get_workspace_by_team_id(team_id)
        if not workspace:
            return False

        workspace.is_active = False
        workspace.updated_at = datetime.utcnow()
        self.db.commit()
        return True

    # ==================== User Mapping ====================

    def map_slack_user(
        self,
        workspace_id: UUID,
        slack_user_id: str,
        slack_username: Optional[str] = None,
        slack_email: Optional[str] = None,
        slack_display_name: Optional[str] = None,
        user_id: Optional[UUID] = None
    ) -> SlackUserMapping:
        """Create or update a Slack user mapping."""
        existing = self.db.execute(
            select(SlackUserMapping).where(
                SlackUserMapping.slack_workspace_id == workspace_id,
                SlackUserMapping.slack_user_id == slack_user_id
            )
        ).scalar_one_or_none()

        if existing:
            existing.slack_username = slack_username or existing.slack_username
            existing.slack_email = slack_email or existing.slack_email
            existing.slack_display_name = slack_display_name or existing.slack_display_name
            if user_id:
                existing.user_id = user_id
                existing.is_verified = True
            existing.updated_at = datetime.utcnow()
            self.db.commit()
            return existing

        mapping = SlackUserMapping(
            id=uuid.uuid4(),
            slack_workspace_id=workspace_id,
            slack_user_id=slack_user_id,
            slack_username=slack_username,
            slack_email=slack_email,
            slack_display_name=slack_display_name,
            user_id=user_id,
            is_verified=user_id is not None
        )
        self.db.add(mapping)

        # Try to auto-map by email
        if slack_email and not user_id:
            user = self.db.execute(
                select(User).where(User.email == slack_email)
            ).scalar_one_or_none()
            if user:
                mapping.user_id = user.id
                mapping.is_verified = True

        self.db.commit()
        return mapping

    def get_user_mapping(
        self,
        workspace_id: UUID,
        slack_user_id: str
    ) -> Optional[SlackUserMapping]:
        """Get a user mapping by Slack user ID."""
        return self.db.execute(
            select(SlackUserMapping).where(
                SlackUserMapping.slack_workspace_id == workspace_id,
                SlackUserMapping.slack_user_id == slack_user_id
            )
        ).scalar_one_or_none()

    def get_organization_for_slack_user(
        self,
        team_id: str,
        slack_user_id: str
    ) -> Optional[UUID]:
        """Get the organization ID for a Slack user."""
        workspace = self.get_workspace_by_team_id(team_id)
        if not workspace:
            return None
        return workspace.organization_id

    # ==================== Query Processing ====================

    def process_query(
        self,
        team_id: str,
        slack_user_id: str,
        query: str,
        channel_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Process a natural language query from Slack."""
        start_time = datetime.utcnow()

        workspace = self.get_workspace_by_team_id(team_id)
        if not workspace:
            return {"success": False, "error": "Workspace not connected"}

        org_id = workspace.organization_id

        try:
            # Parse and execute query
            result = self._execute_query(query, org_id)

            # Log interaction
            elapsed_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            self._log_interaction(
                workspace_id=workspace.id,
                slack_user_id=slack_user_id,
                channel_id=channel_id,
                interaction_type="query",
                query_text=query,
                response_summary=result.get("summary", ""),
                response_time_ms=elapsed_ms,
                success=True
            )

            return result

        except Exception as e:
            elapsed_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            self._log_interaction(
                workspace_id=workspace.id,
                slack_user_id=slack_user_id,
                channel_id=channel_id,
                interaction_type="query",
                query_text=query,
                response_time_ms=elapsed_ms,
                success=False,
                error_message=str(e)
            )
            return {"success": False, "error": str(e)}

    def _execute_query(self, query: str, org_id: UUID) -> Dict[str, Any]:
        """Execute a parsed query and return results."""
        query_lower = query.lower()

        # Headcount queries
        if any(kw in query_lower for kw in ["headcount", "employees", "how many people"]):
            return self._query_headcount(query_lower, org_id)

        # Turnover/attrition queries
        if any(kw in query_lower for kw in ["turnover", "attrition", "left", "departed"]):
            return self._query_turnover(query_lower, org_id)

        # Hiring queries
        if any(kw in query_lower for kw in ["hired", "new hires", "hiring", "recruits"]):
            return self._query_hires(query_lower, org_id)

        # Open positions queries
        if any(kw in query_lower for kw in ["open positions", "requisitions", "jobs", "vacancies"]):
            return self._query_open_positions(query_lower, org_id)

        # Salary/compensation queries
        if any(kw in query_lower for kw in ["salary", "compensation", "pay", "budget"]):
            return self._query_compensation(query_lower, org_id)

        # Fall through to AI Q&A for complex natural language questions
        try:
            return self._query_ai_qa(query, org_id)
        except Exception:
            pass

        # Default - return basic metrics
        return self._query_summary_metrics(org_id)

    def _query_headcount(self, query: str, org_id: UUID) -> Dict[str, Any]:
        """Query headcount information."""
        # Extract department filter if mentioned
        department = self._extract_department(query)

        query_stmt = select(func.count(Employee.id)).where(
            Employee.organization_id == org_id,
            Employee.status == "active"
        )
        if department:
            query_stmt = query_stmt.where(Employee.department.ilike(f"%{department}%"))

        count = self.db.execute(query_stmt).scalar()

        # Get breakdown by department
        breakdown = self.db.execute(
            select(
                Employee.department,
                func.count(Employee.id).label("count")
            )
            .where(Employee.organization_id == org_id, Employee.status == "active")
            .group_by(Employee.department)
            .order_by(func.count(Employee.id).desc())
            .limit(5)
        ).all()

        return {
            "success": True,
            "type": "headcount",
            "total": count,
            "department_filter": department,
            "breakdown": [{"department": d.department, "count": d.count} for d in breakdown],
            "summary": f"Total headcount: {count}" + (f" in {department}" if department else ""),
            "blocks": self._format_headcount_blocks(count, breakdown, department)
        }

    def _query_turnover(self, query: str, org_id: UUID) -> Dict[str, Any]:
        """Query turnover/attrition information."""
        from datetime import timedelta
        last_year = datetime.utcnow() - timedelta(days=365)

        terminated = self.db.execute(
            select(func.count(Employee.id)).where(
                Employee.organization_id == org_id,
                Employee.status == "terminated",
                Employee.termination_date >= last_year.date()
            )
        ).scalar()

        total = self.db.execute(
            select(func.count(Employee.id)).where(
                Employee.organization_id == org_id
            )
        ).scalar()

        rate = (terminated / total * 100) if total > 0 else 0

        return {
            "success": True,
            "type": "turnover",
            "terminated_count": terminated,
            "total_employees": total,
            "turnover_rate": round(rate, 1),
            "summary": f"Turnover rate: {rate:.1f}% ({terminated} departures in the last 12 months)",
            "blocks": self._format_metric_blocks("Turnover Rate", f"{rate:.1f}%", f"{terminated} departures in 12 months")
        }

    def _query_hires(self, query: str, org_id: UUID) -> Dict[str, Any]:
        """Query hiring information."""
        from datetime import timedelta

        # Determine time period
        if "month" in query:
            since = datetime.utcnow() - timedelta(days=30)
            period = "last month"
        elif "quarter" in query:
            since = datetime.utcnow() - timedelta(days=90)
            period = "last quarter"
        else:
            since = datetime.utcnow() - timedelta(days=365)
            period = "last 12 months"

        hires = self.db.execute(
            select(func.count(Employee.id)).where(
                Employee.organization_id == org_id,
                Employee.status == "active",
                Employee.hire_date >= since.date()
            )
        ).scalar()

        return {
            "success": True,
            "type": "hires",
            "count": hires,
            "period": period,
            "summary": f"New hires ({period}): {hires}",
            "blocks": self._format_metric_blocks("New Hires", str(hires), period)
        }

    def _query_open_positions(self, query: str, org_id: UUID) -> Dict[str, Any]:
        """Query open positions."""
        department = self._extract_department(query)

        query_stmt = select(func.sum(JobRequisition.headcount)).where(
            JobRequisition.organization_id == org_id,
            JobRequisition.status == "open"
        )
        if department:
            query_stmt = query_stmt.where(JobRequisition.department.ilike(f"%{department}%"))

        open_count = self.db.execute(query_stmt).scalar() or 0

        # Get by department
        by_dept = self.db.execute(
            select(
                JobRequisition.department,
                func.sum(JobRequisition.headcount).label("count")
            )
            .where(JobRequisition.organization_id == org_id, JobRequisition.status == "open")
            .group_by(JobRequisition.department)
            .order_by(func.sum(JobRequisition.headcount).desc())
            .limit(5)
        ).all()

        return {
            "success": True,
            "type": "open_positions",
            "total": open_count,
            "department_filter": department,
            "by_department": [{"department": d.department, "count": int(d.count)} for d in by_dept],
            "summary": f"Open positions: {open_count}" + (f" in {department}" if department else ""),
            "blocks": self._format_positions_blocks(open_count, by_dept)
        }

    def _query_compensation(self, query: str, org_id: UUID) -> Dict[str, Any]:
        """Query compensation information."""
        stats = self.db.execute(
            select(
                func.avg(Employee.salary).label("avg"),
                func.sum(Employee.salary).label("total")
            )
            .where(Employee.organization_id == org_id, Employee.status == "active")
        ).one()

        avg_salary = float(stats.avg) if stats.avg else 0
        total_payroll = float(stats.total) if stats.total else 0

        return {
            "success": True,
            "type": "compensation",
            "avg_salary": round(avg_salary, 0),
            "total_payroll": round(total_payroll, 0),
            "summary": f"Average salary: ${avg_salary:,.0f} | Total payroll: ${total_payroll:,.0f}",
            "blocks": self._format_compensation_blocks(avg_salary, total_payroll)
        }

    def _query_ai_qa(self, query: str, org_id: UUID) -> Dict[str, Any]:
        """Route complex questions to the AI Q&A service."""
        from services.ai_qa_service import AIQAService
        ai_service = AIQAService(self.db)

        # Use a system user ID for Slack queries
        from uuid import UUID as UUIDType
        system_user_id = UUIDType("00000000-0000-4000-a000-000000000010")

        result = ai_service.ask(
            org_id=org_id,
            user_id=system_user_id,
            question=query,
        )

        answer = result.get("answer", "I couldn't find an answer to that question.")
        sql_used = result.get("sql", "")

        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*AI Assistant*\n\n{answer}"
                }
            }
        ]

        if sql_used:
            blocks.append({
                "type": "context",
                "elements": [
                    {"type": "mrkdwn", "text": f"_Query: `{sql_used[:200]}`_"}
                ]
            })

        return {
            "success": True,
            "type": "ai_qa",
            "answer": answer,
            "summary": answer[:200],
            "blocks": blocks,
        }

    def _query_summary_metrics(self, org_id: UUID) -> Dict[str, Any]:
        """Get summary metrics."""
        headcount = self.db.execute(
            select(func.count(Employee.id)).where(
                Employee.organization_id == org_id,
                Employee.status == "active"
            )
        ).scalar()

        open_positions = self.db.execute(
            select(func.sum(JobRequisition.headcount)).where(
                JobRequisition.organization_id == org_id,
                JobRequisition.status == "open"
            )
        ).scalar() or 0

        return {
            "success": True,
            "type": "summary",
            "headcount": headcount,
            "open_positions": open_positions,
            "summary": f"Headcount: {headcount} | Open positions: {open_positions}",
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*HR Metrics Summary*\n\n:busts_in_silhouette: *Headcount:* {headcount}\n:briefcase: *Open Positions:* {open_positions}"
                    }
                }
            ]
        }

    def _extract_department(self, query: str) -> Optional[str]:
        """Extract department name from query."""
        departments = ["engineering", "sales", "marketing", "product", "hr", "finance", "operations", "support", "design"]
        for dept in departments:
            if dept in query.lower():
                return dept.title()
        return None

    def _format_headcount_blocks(self, total: int, breakdown: List, department: Optional[str]) -> List[Dict]:
        """Format headcount data as Slack blocks."""
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Headcount{' - ' + department if department else ''}*\n\n:busts_in_silhouette: *Total:* {total}"
                }
            }
        ]

        if breakdown and not department:
            breakdown_text = "\n".join([f"  {d.department}: {d.count}" for d in breakdown])
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Top Departments:*\n{breakdown_text}"
                }
            })

        return blocks

    def _format_metric_blocks(self, title: str, value: str, subtitle: str) -> List[Dict]:
        """Format a single metric as Slack blocks."""
        return [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{title}*\n\n:chart_with_upwards_trend: *{value}*\n_{subtitle}_"
                }
            }
        ]

    def _format_positions_blocks(self, total: int, by_dept: List) -> List[Dict]:
        """Format open positions as Slack blocks."""
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Open Positions*\n\n:briefcase: *Total:* {total}"
                }
            }
        ]

        if by_dept:
            dept_text = "\n".join([f"  {d.department}: {int(d.count)}" for d in by_dept])
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*By Department:*\n{dept_text}"
                }
            })

        return blocks

    def _format_compensation_blocks(self, avg: float, total: float) -> List[Dict]:
        """Format compensation data as Slack blocks."""
        return [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Compensation Overview*\n\n:moneybag: *Average Salary:* ${avg:,.0f}\n:money_with_wings: *Total Payroll:* ${total:,.0f}"
                }
            }
        ]

    # ==================== Interaction Logging ====================

    def _log_interaction(
        self,
        workspace_id: UUID,
        slack_user_id: str,
        channel_id: Optional[str],
        interaction_type: str,
        query_text: Optional[str] = None,
        command: Optional[str] = None,
        response_summary: Optional[str] = None,
        response_time_ms: Optional[int] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        metadata: Optional[Dict] = None
    ):
        """Log a Slack interaction."""
        interaction = SlackInteraction(
            id=uuid.uuid4(),
            slack_workspace_id=workspace_id,
            slack_user_id=slack_user_id,
            channel_id=channel_id,
            interaction_type=interaction_type,
            command=command,
            query_text=query_text,
            response_summary=response_summary,
            response_time_ms=response_time_ms,
            success=success,
            error_message=error_message,
            metadata=metadata
        )
        self.db.add(interaction)
        self.db.commit()

    def log_command(
        self,
        team_id: str,
        slack_user_id: str,
        channel_id: str,
        command: str,
        text: Optional[str] = None
    ):
        """Log a slash command usage."""
        workspace = self.get_workspace_by_team_id(team_id)
        if workspace:
            self._log_interaction(
                workspace_id=workspace.id,
                slack_user_id=slack_user_id,
                channel_id=channel_id,
                interaction_type="command",
                command=command,
                query_text=text
            )

    # ==================== Scheduled Reports ====================

    def create_scheduled_report(
        self,
        workspace_id: UUID,
        channel_id: str,
        report_type: str,
        schedule: str,
        config: Optional[Dict] = None,
        created_by: Optional[UUID] = None
    ) -> SlackScheduledReport:
        """Create a scheduled report."""
        report = SlackScheduledReport(
            id=uuid.uuid4(),
            slack_workspace_id=workspace_id,
            channel_id=channel_id,
            report_type=report_type,
            schedule=schedule,
            config=config or {},
            created_by=created_by
        )
        self.db.add(report)
        self.db.commit()
        return report

    def get_due_reports(self) -> List[SlackScheduledReport]:
        """Get reports that are due to run."""
        return list(self.db.execute(
            select(SlackScheduledReport).where(
                SlackScheduledReport.is_active == True,
                SlackScheduledReport.next_run_at <= datetime.utcnow()
            )
        ).scalars().all())

    def update_report_run(self, report_id: UUID, next_run: datetime):
        """Update a report's last/next run times."""
        report = self.db.execute(
            select(SlackScheduledReport).where(SlackScheduledReport.id == report_id)
        ).scalar_one_or_none()

        if report:
            report.last_run_at = datetime.utcnow()
            report.next_run_at = next_run
            self.db.commit()
