"""
CRUD operations for Interface database
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from utils.filters import apply_global_filters

from database.models import (
    User, Employee, Candidate, JobRequisition,
    ApiConnection, DataUpload, SyncLog,
    EmployeeStatus, CandidateStatus, RequisitionStatus, ConnectionStatus
)


# ============== User CRUD ==============

class UserCRUD:
    @staticmethod
    def get_by_id(db: Session, user_id: UUID) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email).first()

    @staticmethod
    def create(db: Session, email: str, password_hash: str, name: str, role: str = "viewer") -> User:
        user = User(
            email=email,
            password_hash=password_hash,
            name=name,
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def update_last_login(db: Session, user_id: UUID) -> None:
        db.query(User).filter(User.id == user_id).update({"last_login": datetime.utcnow()})
        db.commit()


# ============== Employee CRUD ==============

class EmployeeCRUD:
    @staticmethod
    def get_all(
        db: Session,
        org_id: UUID,
        skip: int = 0,
        limit: int = 100,
        department: Optional[str] = None,
        status: Optional[str] = None,
        location: Optional[str] = None,
    ) -> List[Employee]:
        query = db.query(Employee).filter(Employee.organization_id == org_id)
        query = apply_global_filters(query, Employee, departments=department, status_filter=status, locations=location)
        return query.offset(skip).limit(limit).all()

    @staticmethod
    def get_by_id(db: Session, org_id: UUID, employee_id: UUID) -> Optional[Employee]:
        return db.query(Employee).filter(
            and_(Employee.id == employee_id, Employee.organization_id == org_id)
        ).first()

    @staticmethod
    def get_by_employee_id(db: Session, org_id: UUID, employee_id: str) -> Optional[Employee]:
        return db.query(Employee).filter(
            and_(Employee.employee_id == employee_id, Employee.organization_id == org_id)
        ).first()

    @staticmethod
    def get_by_email(db: Session, org_id: UUID, email: str) -> Optional[Employee]:
        return db.query(Employee).filter(
            and_(Employee.email == email, Employee.organization_id == org_id)
        ).first()

    @staticmethod
    def create(db: Session, org_id: UUID, data: Dict[str, Any]) -> Employee:
        data['organization_id'] = org_id
        employee = Employee(**data)
        db.add(employee)
        db.commit()
        db.refresh(employee)
        return employee

    @staticmethod
    def update(db: Session, org_id: UUID, employee_id: UUID, data: Dict[str, Any]) -> Optional[Employee]:
        employee = db.query(Employee).filter(
            and_(Employee.id == employee_id, Employee.organization_id == org_id)
        ).first()
        if employee:
            for key, value in data.items():
                if hasattr(employee, key):
                    setattr(employee, key, value)
            employee.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(employee)
        return employee

    @staticmethod
    def delete(db: Session, org_id: UUID, employee_id: UUID) -> bool:
        result = db.query(Employee).filter(
            and_(Employee.id == employee_id, Employee.organization_id == org_id)
        ).delete()
        db.commit()
        return result > 0

    @staticmethod
    def bulk_create(db: Session, org_id: UUID, employees: List[Dict[str, Any]]) -> int:
        """Bulk create employees, returns count of created records"""
        created = 0
        for emp_data in employees:
            try:
                emp_data['organization_id'] = org_id
                employee = Employee(**emp_data)
                db.add(employee)
                created += 1
            except Exception:
                continue
        db.commit()
        return created

    @staticmethod
    def get_count(db: Session, org_id: UUID, status: Optional[str] = None) -> int:
        query = db.query(func.count(Employee.id)).filter(Employee.organization_id == org_id)
        query = apply_global_filters(query, Employee, status_filter=status)
        return query.scalar()

    @staticmethod
    def get_by_department(db: Session, org_id: UUID) -> Dict[str, int]:
        """Get employee count by department"""
        results = db.query(
            Employee.department,
            func.count(Employee.id)
        ).filter(
            and_(Employee.organization_id == org_id, Employee.status == EmployeeStatus.active)
        ).group_by(Employee.department).all()

        return {dept: count for dept, count in results if dept}

    @staticmethod
    def get_metrics(db: Session, org_id: UUID) -> Dict[str, Any]:
        """Calculate HR metrics from employee data"""
        base_query = db.query(Employee).filter(Employee.organization_id == org_id)
        
        total = base_query.count()
        active = base_query.filter(Employee.status == EmployeeStatus.active).count()
        terminated = base_query.filter(Employee.status == EmployeeStatus.terminated).count()
        
        avg_salary = db.query(func.avg(Employee.salary)).filter(
            and_(Employee.organization_id == org_id, Employee.status == EmployeeStatus.active)
        ).scalar() or 0
        
        return {
            "total": total,
            "active": active,
            "terminated": terminated,
            "avg_salary": float(avg_salary)
        }
        active_employees = db.query(Employee).filter(Employee.status == EmployeeStatus.active).all()

        if not active_employees:
            return {}

        total = len(active_employees)
        avg_salary = sum(e.salary or 0 for e in active_employees) / total if total > 0 else 0
        avg_tenure = sum(e.tenure or 0 for e in active_employees) / total if total > 0 else 0
        avg_engagement = sum(e.engagement_score or 0 for e in active_employees if e.engagement_score) / len([e for e in active_employees if e.engagement_score]) if any(e.engagement_score for e in active_employees) else 0

        # Calculate turnover (terminated in last 12 months)
        year_ago = date.today().replace(year=date.today().year - 1)
        terminated = db.query(func.count(Employee.id)).filter(
            and_(
                Employee.status == EmployeeStatus.terminated,
                Employee.termination_date >= year_ago
            )
        ).scalar()

        turnover_rate = (terminated / total * 100) if total > 0 else 0

        return {
            "total_headcount": total,
            "active_employees": total,
            "avg_salary": round(avg_salary, 2),
            "avg_tenure": round(avg_tenure, 2),
            "avg_engagement": round(avg_engagement, 2),
            "turnover_rate": round(turnover_rate, 2),
            "terminated_count": terminated,
        }


# ============== Candidate CRUD ==============

class CandidateCRUD:
    @staticmethod
    def get_all(
        db: Session,
        org_id: UUID,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        department: Optional[str] = None,
        source: Optional[str] = None,
    ) -> List[Candidate]:
        query = db.query(Candidate).filter(Candidate.organization_id == org_id)

        if status:
            query = query.filter(Candidate.status == status)
        if department:
            query = query.filter(Candidate.department == department)
        if source:
            query = query.filter(Candidate.source == source)

        return query.order_by(Candidate.application_date.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def get_by_id(db: Session, org_id: UUID, candidate_id: UUID) -> Optional[Candidate]:
        return db.query(Candidate).filter(
            and_(Candidate.id == candidate_id, Candidate.organization_id == org_id)
        ).first()

    @staticmethod
    def create(db: Session, org_id: UUID, data: Dict[str, Any]) -> Candidate:
        data['organization_id'] = org_id
        candidate = Candidate(**data)
        db.add(candidate)
        db.commit()
        db.refresh(candidate)
        return candidate

    @staticmethod
    def update(db: Session, org_id: UUID, candidate_id: UUID, data: Dict[str, Any]) -> Optional[Candidate]:
        candidate = db.query(Candidate).filter(
            and_(Candidate.id == candidate_id, Candidate.organization_id == org_id)
        ).first()
        if candidate:
            for key, value in data.items():
                if hasattr(candidate, key):
                    setattr(candidate, key, value)
            candidate.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(candidate)
        return candidate

    @staticmethod
    def get_pipeline_stats(
        db: Session,
        org_id: UUID,
        departments: Optional[str] = None,
        locations: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, int]:
        """Get candidate counts by status and specific key stages"""
        query = db.query(Candidate.status, func.count(Candidate.id)).filter(Candidate.organization_id == org_id)
        query = apply_global_filters(query, Candidate, departments=departments, locations=locations, start_date=start_date, end_date=end_date)
        results = query.group_by(Candidate.status).all()

        stats = {str(status.value): count for status, count in results}

        # Add specific count for Final Round
        final_round_q = db.query(func.count(Candidate.id)).filter(
            and_(
                Candidate.organization_id == org_id,
                Candidate.status == CandidateStatus.interview, 
                Candidate.stage == 'Final Round'
            )
        )
        final_round_q = apply_global_filters(final_round_q, Candidate, departments=departments, locations=locations, start_date=start_date, end_date=end_date)
        final_round_count = final_round_q.scalar() or 0

        stats['final_round'] = final_round_count
        return stats

    @staticmethod
    def get_source_effectiveness(
        db: Session,
        org_id: UUID,
        departments: Optional[str] = None,
        locations: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Dict[str, Any]]:
        """Calculate source effectiveness metrics"""
        sources_q = db.query(Candidate.source).distinct().filter(Candidate.organization_id == org_id)
        sources_q = apply_global_filters(sources_q, Candidate, departments=departments, locations=locations, start_date=start_date, end_date=end_date)
        sources = sources_q.all()
        
        effectiveness = {}

        for (source,) in sources:
            if not source:
                continue

            total_q = db.query(func.count(Candidate.id)).filter(
                Candidate.organization_id == org_id,
                Candidate.source == source
            )
            total_q = apply_global_filters(total_q, Candidate, departments=departments, locations=locations, start_date=start_date, end_date=end_date)
            total = total_q.scalar()
            
            hired_q = db.query(func.count(Candidate.id)).filter(
                and_(
                    Candidate.organization_id == org_id,
                    Candidate.source == source, 
                    Candidate.status == CandidateStatus.hired
                )
            )
            hired_q = apply_global_filters(hired_q, Candidate, departments=departments, locations=locations, start_date=start_date, end_date=end_date)
            hired = hired_q.scalar()

            effectiveness[source] = {
                "total": total,
                "hired": hired,
                "conversion_rate": round((hired / total * 100) if total > 0 else 0, 2)
            }

        return effectiveness


# ============== Job Requisition CRUD ==============

class RequisitionCRUD:
    @staticmethod
    def get_all(
        db: Session,
        org_id: UUID,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        department: Optional[str] = None,
    ) -> List[JobRequisition]:
        query = db.query(JobRequisition).filter(JobRequisition.organization_id == org_id)

        if status:
            query = query.filter(JobRequisition.status == status)
        if department:
            query = query.filter(JobRequisition.department == department)

        return query.order_by(JobRequisition.open_date.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def get_by_id(db: Session, org_id: UUID, req_id: UUID) -> Optional[JobRequisition]:
        return db.query(JobRequisition).filter(
            and_(JobRequisition.id == req_id, JobRequisition.organization_id == org_id)
        ).first()

    @staticmethod
    def create(db: Session, org_id: UUID, data: Dict[str, Any]) -> JobRequisition:
        data['organization_id'] = org_id
        req = JobRequisition(**data)
        db.add(req)
        db.commit()
        db.refresh(req)
        return req

    @staticmethod
    def update(db: Session, org_id: UUID, req_id: UUID, data: Dict[str, Any]) -> Optional[JobRequisition]:
        req = db.query(JobRequisition).filter(
            and_(JobRequisition.id == req_id, JobRequisition.organization_id == org_id)
        ).first()
        if req:
            for key, value in data.items():
                if hasattr(req, key):
                    setattr(req, key, value)
            req.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(req)
        return req

    @staticmethod
    def get_open_count(db: Session, org_id: UUID) -> int:
        return db.query(func.count(JobRequisition.id)).filter(
            and_(
                JobRequisition.organization_id == org_id,
                JobRequisition.status == RequisitionStatus.open
            )
        ).scalar()


# ============== API Connection CRUD ==============

class ConnectionCRUD:
    @staticmethod
    def get_all(db: Session) -> List[ApiConnection]:
        return db.query(ApiConnection).all()

    @staticmethod
    def get_by_id(db: Session, conn_id: UUID) -> Optional[ApiConnection]:
        return db.query(ApiConnection).filter(ApiConnection.id == conn_id).first()

    @staticmethod
    def get_by_provider(db: Session, provider: str) -> Optional[ApiConnection]:
        return db.query(ApiConnection).filter(ApiConnection.provider == provider).first()

    @staticmethod
    def create(db: Session, data: Dict[str, Any]) -> ApiConnection:
        conn = ApiConnection(**data)
        db.add(conn)
        db.commit()
        db.refresh(conn)
        return conn

    @staticmethod
    def update(db: Session, conn_id: UUID, data: Dict[str, Any]) -> Optional[ApiConnection]:
        conn = db.query(ApiConnection).filter(ApiConnection.id == conn_id).first()
        if conn:
            for key, value in data.items():
                if hasattr(conn, key):
                    setattr(conn, key, value)
            conn.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(conn)
        return conn

    @staticmethod
    def update_sync_status(
        db: Session,
        conn_id: UUID,
        status: str,
        records_synced: int = 0,
        error: Optional[str] = None
    ) -> None:
        update_data = {
            "status": status,
            "last_sync": datetime.utcnow(),
            "last_sync_status": status,
            "records_synced": records_synced,
        }
        if error:
            update_data["last_error"] = error

        db.query(ApiConnection).filter(ApiConnection.id == conn_id).update(update_data)
        db.commit()

    @staticmethod
    def delete(db: Session, conn_id: UUID) -> bool:
        result = db.query(ApiConnection).filter(ApiConnection.id == conn_id).delete()
        db.commit()
        return result > 0


# ============== Data Upload CRUD ==============

class UploadCRUD:
    @staticmethod
    def get_all(db: Session, limit: int = 50) -> List[DataUpload]:
        return db.query(DataUpload).order_by(DataUpload.created_at.desc()).limit(limit).all()

    @staticmethod
    def get_by_id(db: Session, upload_id: UUID) -> Optional[DataUpload]:
        return db.query(DataUpload).filter(DataUpload.id == upload_id).first()

    @staticmethod
    def create(db: Session, data: Dict[str, Any]) -> DataUpload:
        upload = DataUpload(**data)
        db.add(upload)
        db.commit()
        db.refresh(upload)
        return upload

    @staticmethod
    def update_progress(
        db: Session,
        upload_id: UUID,
        status: str,
        progress: int,
        records_processed: int = 0,
        records_created: int = 0,
        records_failed: int = 0,
        errors: Optional[List[str]] = None
    ) -> None:
        update_data = {
            "status": status,
            "progress": progress,
            "records_processed": records_processed,
            "records_created": records_created,
            "records_failed": records_failed,
        }
        if errors:
            update_data["errors"] = errors
        if status == "completed":
            update_data["completed_at"] = datetime.utcnow()

        db.query(DataUpload).filter(DataUpload.id == upload_id).update(update_data)
        db.commit()


# ============== Sync Log CRUD ==============

class SyncLogCRUD:
    @staticmethod
    def create(db: Session, connection_id: UUID, sync_type: str) -> SyncLog:
        log = SyncLog(
            connection_id=connection_id,
            sync_type=sync_type,
            started_at=datetime.utcnow(),
            status="running"
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def complete(
        db: Session,
        log_id: UUID,
        status: str,
        records_fetched: int = 0,
        records_created: int = 0,
        records_updated: int = 0,
        records_failed: int = 0,
        error_message: Optional[str] = None
    ) -> None:
        log = db.query(SyncLog).filter(SyncLog.id == log_id).first()
        if log:
            log.status = status
            log.completed_at = datetime.utcnow()
            log.records_fetched = records_fetched
            log.records_created = records_created
            log.records_updated = records_updated
            log.records_failed = records_failed
            log.error_message = error_message
            log.duration_seconds = (log.completed_at - log.started_at).total_seconds()
            db.commit()

    @staticmethod
    def get_recent(db: Session, connection_id: UUID, limit: int = 10) -> List[SyncLog]:
        return db.query(SyncLog).filter(
            SyncLog.connection_id == connection_id
        ).order_by(SyncLog.started_at.desc()).limit(limit).all()
