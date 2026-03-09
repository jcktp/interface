"""Deep Dive Analysis Service for 2Model.

Provides drill-down analysis capabilities for investigating
organizational metrics, alerts, and trends in detail.
"""

from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID
import math

from sqlalchemy.orm import Session
from sqlalchemy import func, extract, case, and_
from utils.filters import apply_global_filters

from database.models import (
    Employee, EmployeeStatus, OrgHealthAlert, JobRequisition,
    AttendanceRecord, AttendanceStatus,
)


class DeepDiveService:
    """Provides detailed analytical breakdowns of organizational metrics."""

    def __init__(self, db: Session):
        self.db = db

    def analyze(
        self,
        org_id: UUID,
        metric: str,
        alert_id: Optional[UUID] = None,
        department: Optional[str] = None,
        location: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Run a deep-dive analysis on a specific metric."""

        # If alert_id provided, load alert context
        alert_context = None
        if alert_id:
            alert = self.db.query(OrgHealthAlert).filter(
                OrgHealthAlert.id == alert_id,
                OrgHealthAlert.organization_id == org_id,
            ).first()
            if alert:
                alert_context = {
                    "title": alert.title,
                    "severity": alert.severity.value if alert.severity else None,
                    "description": alert.description,
                    "metric_value": alert.metric_value,
                    "threshold_value": alert.threshold_value,
                    "affected_department": alert.affected_org_unit,
                }
                # Use alert's department if no department specified
                if not department and alert.affected_org_unit:
                    department = alert.affected_org_unit
                
                # If metric is default, try to infer it from alert type
                if metric == "engagement":
                    at = alert.alert_type.lower()
                    if "attrition" in at or "retention" in at or "turnover" in at:
                        metric = "attrition"
                    elif "headcount" in at or "hiring" in at:
                        metric = "headcount"
                    elif "compensation" in at or "salary" in at or "pay" in at:
                        metric = "salary"
                    elif "performance" in at or "rating" in at:
                        metric = "performance"
                    elif "tenure" in at:
                        metric = "tenure"
                    elif "age" in at:
                        metric = "age"

        # Get breakdown by multiple dimensions
        analysis = {
            "metric": metric,
            "alert_context": alert_context,
            "filters": {"department": department, "location": location},
            "by_department": self._breakdown_by_dimension(org_id, metric, "department", department, location),
            "by_location": self._breakdown_by_dimension(org_id, metric, "location", department, location),
            "trend": self._trend_over_time(org_id, metric, department, location, months=12),
            "contributing_factors": self._contributing_factors(org_id, metric, department, location),
            "correlations": self._correlations(org_id, metric, department, location),
            "heatmap": self._heatmap(org_id, metric, department, location),
            "distribution_stats": self._calculate_distribution_stats(org_id, metric, department, location),
            "cross_tabulation": self._cross_tabulate(org_id, metric, department, location),
            "summary": {},
        }

        # Add overall summary
        analysis["summary"] = self._compute_summary(org_id, metric, department, location)

        return analysis

    def _calculate_distribution_stats(
        self, org_id: UUID, metric: str,
        department: Optional[str] = None, location: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Calculate advanced distribution statistics (Percentiles, Std Dev)."""
        metric_col = self._get_metric_column(metric)
        if metric_col is None:
            return {}

        base_filter = [
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.active,
            metric_col.isnot(None)
        ]
        if department:
            base_filter.append(Employee.department == department)
        if location:
            base_filter.append(Employee.location == location)

        rows = self.db.query(metric_col).filter(*base_filter).all()
        data = [float(row[0]) for row in rows]
        
        if not data:
            return {}

        data.sort()
        n = len(data)
        
        avg = sum(data) / n
        variance = sum((x - avg) ** 2 for x in data) / n
        std_dev = math.sqrt(variance)

        return {
            "min": round(data[0], 2),
            "p25": round(data[int(n * 0.25)], 2),
            "median": round(data[int(n * 0.5)], 2),
            "p75": round(data[int(n * 0.75)], 2),
            "max": round(data[-1], 2),
            "std_dev": round(std_dev, 2),
            "sample_size": n
        }

    def _cross_tabulate(
        self, org_id: UUID, metric: str,
        department: Optional[str] = None, location: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Perform cross-tabulation (e.g., Performance by Tenure Bucket)."""
        metric_col = self._get_metric_column(metric)
        if metric_col is None:
            return []

        base_filter = [
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.active,
        ]
        if department:
            base_filter.append(Employee.department == department)
        if location:
            base_filter.append(Employee.location == location)
        
        results = self.db.query(
            case(
                (Employee.tenure < 1, "0-1y"),
                (Employee.tenure < 3, "1-3y"),
                (Employee.tenure < 5, "3-5y"),
                else_="5y+",
            ).label("tenure_bucket"),
            func.count(Employee.id).label("count"),
            func.avg(metric_col).label("avg_val")
        ).filter(*base_filter, metric_col.isnot(None)).group_by("tenure_bucket").all()

        return [
            {
                "segment": r.tenure_bucket,
                "count": r.count,
                "value": round(float(r.avg_val or 0), 2)
            } for r in results
        ]

    def _correlations(
        self, org_id: UUID, primary_metric: str,
        department: Optional[str] = None, location: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Calculate correlations between the primary metric and other relevant metrics."""
        correlations = []
        
        base_filter = [
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.active,
        ]
        if department:
            base_filter.append(Employee.department == department)
        if location:
            base_filter.append(Employee.location == location)
            
        other_metrics = ["performance_rating", "engagement_score", "tenure", "salary", "age"]
        primary_col = self._get_metric_column(primary_metric)
        
        if primary_col is None:
            return []

        for other in other_metrics:
            if other == primary_metric:
                continue
            
            other_col = self._get_metric_column(other.replace('_rating', '').replace('_score', ''))
            if other_col is None:
                continue
                
            try:
                data = self.db.query(primary_col, other_col).filter(
                    *base_filter, primary_col.isnot(None), other_col.isnot(None)
                ).all()
                
                if len(data) < 10:
                    continue
                    
                x = [float(d[0]) for d in data]
                y = [float(d[1]) for d in data]
                
                n = len(x)
                sum_x = sum(x)
                sum_y = sum(y)
                sum_x2 = sum(i**2 for i in x)
                sum_y2 = sum(i**2 for i in y)
                sum_xy = sum(i*j for i, j in zip(x, y))
                
                denom = math.sqrt((n * sum_x2 - sum_x**2) * (n * sum_y2 - sum_y**2))
                r = (n * sum_xy - sum_x * sum_y) / denom if denom != 0 else 0
                
                correlations.append({
                    "metric": other.replace('_', ' ').title(),
                    "r": round(r, 3),
                    "strength": "Strong" if abs(r) > 0.6 else "Moderate" if abs(r) > 0.3 else "Weak",
                    "direction": "Positive" if r > 0 else "Negative"
                })
            except Exception:
                continue
                
        return sorted(correlations, key=lambda x: abs(x['r']), reverse=True)

    def _heatmap(
        self, org_id: UUID, metric: str,
        dept_filter: Optional[str] = None, loc_filter: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate a 2D heatmap data (e.g., Department vs Performance Bucket)."""
        metric_col = self._get_metric_column(metric)
        if metric_col is None:
            return {}
            
        # Buckets for performance/engagement
        if metric in ["performance", "engagement"]:
            buckets = [
                (0, 2, "1-2 (Low)"),
                (2, 3.5, "2-3.5 (Mid)"),
                (3.5, 4.5, "3.5-4.5 (High)"),
                (4.5, 5.1, "4.5-5 (Top)")
            ]
        elif metric == "salary":
            buckets = [
                (0, 60000, "< 60k"),
                (60000, 100000, "60k-100k"),
                (100000, 150000, "100k-150k"),
                (150000, 1000000, "150k+")
            ]
        else:
            return {}

        base_q = self.db.query(Employee.department, Employee.id, metric_col).filter(
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.active,
            metric_col.isnot(None)
        )
        if dept_filter:
            base_q = base_q.filter(Employee.department == dept_filter)
            
        data = base_q.all()
        departments = sorted(list(set(d[0] for d in data)))
        
        heatmap_data = []
        for dept in departments:
            dept_row = {"name": dept}
            dept_emps = [d for d in data if d[0] == dept]
            total_dept = len(dept_emps)
            
            for low, high, label in buckets:
                count = len([e for e in dept_emps if low <= float(e[2]) < high])
                dept_row[label] = round((count / total_dept * 100), 1) if total_dept > 0 else 0
            
            heatmap_data.append(dept_row)
            
        return {
            "x_labels": [b[2] for b in buckets],
            "data": heatmap_data
        }

    def _breakdown_by_dimension(
        self, org_id: UUID, metric: str, dimension: str,
        dept_filter: Optional[str] = None, loc_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Break down a metric by a given dimension (department or location)."""
        group_col = Employee.department if dimension == "department" else Employee.location

        base_q = self.db.query(Employee).filter(
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.active,
        )
        base_q = apply_global_filters(base_q, Employee, departments=dept_filter, locations=loc_filter)

        if metric == "headcount":
            results = (
                base_q.with_entities(
                    group_col.label("dimension_value"),
                    func.count(Employee.id).label("count"),
                )
                .group_by(group_col)
                .order_by(func.count(Employee.id).desc())
                .all()
            )
            return [
                {
                    "name": row.dimension_value or "Unknown",
                    "count": row.count,
                    "avg_value": row.count,
                    "min_value": row.count,
                    "max_value": row.count,
                }
                for row in results
            ]

        if metric == "attrition":
            today = date.today()
            twelve_months_ago = today - timedelta(days=365)

            active_counts = dict(
                base_q.with_entities(group_col, func.count(Employee.id))
                .group_by(group_col)
                .all()
            )

            term_q = self.db.query(Employee.department if dimension == "department" else Employee.location, func.count(Employee.id)).filter(
                Employee.organization_id == org_id,
                Employee.status == EmployeeStatus.terminated,
                Employee.termination_date >= twelve_months_ago,
                Employee.termination_date <= today,
            )
            term_q = apply_global_filters(term_q, Employee, departments=dept_filter, locations=loc_filter)
            term_counts = dict(term_q.group_by(group_col).all())

            all_dims = set(list(active_counts.keys()) + list(term_counts.keys()))
            results_list = []
            for dim_val in all_dims:
                active = active_counts.get(dim_val, 0)
                termed = term_counts.get(dim_val, 0)
                total = active + termed
                rate = (termed / total * 100) if total > 0 else 0
                results_list.append({
                    "name": dim_val or "Unknown",
                    "count": active,
                    "avg_value": round(rate, 2),
                    "min_value": round(rate, 2),
                    "max_value": round(rate, 2),
                })
            results_list.sort(key=lambda x: x["avg_value"], reverse=True)
            return results_list

        metric_col = self._get_metric_column(metric)

        results = (
            base_q.with_entities(
                group_col.label("dimension_value"),
                func.count(Employee.id).label("count"),
                func.avg(metric_col).label("avg_value") if metric_col is not None else func.count(Employee.id).label("avg_value"),
                func.min(metric_col).label("min_value") if metric_col is not None else func.count(Employee.id).label("min_value"),
                func.max(metric_col).label("max_value") if metric_col is not None else func.count(Employee.id).label("max_value"),
            )
            .group_by(group_col)
            .order_by(func.count(Employee.id).desc())
            .all()
        )

        return [
            {
                "name": row.dimension_value or "Unknown",
                "count": row.count,
                "avg_value": round(float(row.avg_value or 0), 2),
                "min_value": round(float(row.min_value or 0), 2),
                "max_value": round(float(row.max_value or 0), 2),
            }
            for row in results
        ]

    def _trend_over_time(
        self, org_id: UUID, metric: str,
        department: Optional[str] = None, location: Optional[str] = None,
        months: int = 12,
    ) -> List[Dict[str, Any]]:
        """Get monthly trend for a metric."""
        trends = []
        today = date.today()

        for i in range(months - 1, -1, -1):
            month_date = date(today.year, today.month, 1) - timedelta(days=i * 30)
            month_start = date(month_date.year, month_date.month, 1)
            if month_start.month == 12:
                month_end = date(month_start.year + 1, 1, 1) - timedelta(days=1)
            else:
                month_end = date(month_start.year, month_start.month + 1, 1) - timedelta(days=1)

            base_filter = [
                Employee.organization_id == org_id,
                Employee.hire_date <= month_end,
                (Employee.termination_date.is_(None)) | (Employee.termination_date > month_end),
            ]
            if department:
                base_filter.append(Employee.department == department)
            if location:
                base_filter.append(Employee.location == location)

            if metric == "attrition":
                term_filter = [
                    Employee.organization_id == org_id,
                    Employee.termination_date >= month_start,
                    Employee.termination_date <= month_end,
                ]
                if department:
                    term_filter.append(Employee.department == department)
                if location:
                    term_filter.append(Employee.location == location)

                headcount = self.db.query(func.count(Employee.id)).filter(*base_filter).scalar() or 0
                terminations = self.db.query(func.count(Employee.id)).filter(*term_filter).scalar() or 0
                value = (terminations / headcount * 100) if headcount > 0 else 0
            elif metric == "headcount":
                value = self.db.query(func.count(Employee.id)).filter(*base_filter).scalar() or 0
            else:
                metric_col = self._get_metric_column(metric)
                if metric_col is not None:
                    value = self.db.query(func.avg(metric_col)).filter(
                        *base_filter, metric_col.isnot(None)
                    ).scalar() or 0
                else:
                    value = 0

            trends.append({
                "month": month_start.strftime("%Y-%m"),
                "value": round(float(value), 2),
            })

        return trends

    def _contributing_factors(
        self, org_id: UUID, metric: str,
        department: Optional[str] = None, location: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Analyze contributing factors for a metric."""
        factors = []

        base_filter = [
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.active,
        ]
        if department:
            base_filter.append(Employee.department == department)
        if location:
            base_filter.append(Employee.location == location)

        tenure_buckets = self.db.query(
            case(
                (Employee.tenure < 1, "< 1 year"),
                (Employee.tenure < 3, "1-3 years"),
                (Employee.tenure < 5, "3-5 years"),
                else_="5+ years",
            ).label("bucket"),
            func.count(Employee.id).label("count"),
            func.avg(Employee.engagement_score).label("avg_engagement"),
        ).filter(*base_filter).group_by("bucket").all()

        if tenure_buckets:
            factors.append({
                "factor": "Tenure Distribution",
                "data": [
                    {"label": row.bucket, "count": row.count, "engagement": round(float(row.avg_engagement or 0), 2)}
                    for row in tenure_buckets
                ],
            })

        salary_stats = self.db.query(
            func.avg(Employee.salary).label("avg"),
            func.min(Employee.salary).label("min"),
            func.max(Employee.salary).label("max"),
        ).filter(*base_filter).first()
        if salary_stats and salary_stats.avg:
            factors.append({
                "factor": "Salary Analysis",
                "data": {
                    "average": round(float(salary_stats.avg), 0),
                    "min": round(float(salary_stats.min or 0), 0),
                    "max": round(float(salary_stats.max or 0), 0),
                },
            })

        perf_dist = self.db.query(
            case(
                (Employee.performance_rating < 2, "Low (1-2)"),
                (Employee.performance_rating < 3.5, "Medium (2-3.5)"),
                (Employee.performance_rating < 4.5, "High (3.5-4.5)"),
                else_="Top (4.5-5)",
            ).label("bucket"),
            func.count(Employee.id).label("count"),
        ).filter(*base_filter, Employee.performance_rating.isnot(None)).group_by("bucket").all()

        if perf_dist:
            factors.append({
                "factor": "Performance Distribution",
                "data": [{"label": row.bucket, "count": row.count} for row in perf_dist],
            })

        return factors

    def _get_metric_column(self, metric: str):
        """Map metric name to SQLAlchemy column."""
        mapping = {
            "engagement": Employee.engagement_score,
            "performance": Employee.performance_rating,
            "salary": Employee.salary,
            "tenure": Employee.tenure,
            "age": Employee.age,
        }
        return mapping.get(metric)

    def _compute_summary(
        self, org_id: UUID, metric: str,
        department: Optional[str] = None, location: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Compute summary statistics for the metric."""
        base_filter = [
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.active,
        ]
        if department:
            base_filter.append(Employee.department == department)
        if location:
            base_filter.append(Employee.location == location)

        count = self.db.query(func.count(Employee.id)).filter(*base_filter).scalar() or 0

        if metric == "headcount":
            return {
                "employee_count": count,
                "total_headcount": count,
            }

        if metric == "attrition":
            today = date.today()
            twelve_months_ago = today - timedelta(days=365)
            all_filter = [
                Employee.organization_id == org_id,
                Employee.termination_date >= twelve_months_ago,
                Employee.termination_date <= today,
            ]
            if department:
                all_filter.append(Employee.department == department)
            if location:
                all_filter.append(Employee.location == location)
            termed = self.db.query(func.count(Employee.id)).filter(*all_filter).scalar() or 0
            total = count + termed
            rate = (termed / total * 100) if total > 0 else 0
            return {
                "employee_count": count,
                "terminations_12m": termed,
                "attrition_rate": round(rate, 2),
            }

        metric_col = self._get_metric_column(metric)
        if metric_col is not None:
            stats = self.db.query(
                func.avg(metric_col).label("avg"),
                func.min(metric_col).label("min"),
                func.max(metric_col).label("max"),
            ).filter(*base_filter, metric_col.isnot(None)).first()

            return {
                "employee_count": count,
                "metric_avg": round(float(stats.avg or 0), 2) if stats else 0,
                "metric_min": round(float(stats.min or 0), 2) if stats else 0,
                "metric_max": round(float(stats.max or 0), 2) if stats else 0,
            }

        return {"employee_count": count}
