"""Import service for handling CSV/Excel data uploads with column mapping."""

from datetime import datetime, date
from typing import Optional, Any
from uuid import uuid4
import pandas as pd
from sqlalchemy.orm import Session

from database.models import (
    Employee, Candidate, JobRequisition, DataUpload,
    EmployeeStatus, CandidateStatus, RequisitionStatus
)


class ImportService:
    """Service for importing data from CSV/Excel files."""

    # Standard column mappings for different data types
    EMPLOYEE_COLUMNS = {
        'employee_id': ['employee_id', 'emp_id', 'id', 'employee_number', 'emp_number'],
        'first_name': ['first_name', 'firstname', 'first', 'given_name'],
        'last_name': ['last_name', 'lastname', 'last', 'surname', 'family_name'],
        'email': ['email', 'email_address', 'work_email'],
        'department': ['department', 'dept', 'department_name'],
        'job_title': ['job_title', 'title', 'position', 'role', 'job_name'],
        'hire_date': ['hire_date', 'start_date', 'join_date', 'date_hired'],
        'termination_date': ['termination_date', 'end_date', 'leave_date', 'term_date'],
        'location': ['location', 'office', 'work_location', 'city'],
        'salary': ['salary', 'annual_salary', 'base_salary', 'compensation'],
        'manager_email': ['manager_email', 'manager', 'reports_to', 'supervisor_email'],
        'status': ['status', 'employment_status', 'emp_status'],
        'performance_rating': ['performance_rating', 'rating', 'performance_score', 'perf_rating'],
        'engagement_score': ['engagement_score', 'engagement', 'esat_score'],
        'age': ['age', 'years_old'],
        'gender': ['gender', 'sex'],
        'ethnicity': ['ethnicity', 'race', 'ethnic_group'],
    }

    CANDIDATE_COLUMNS = {
        'first_name': ['first_name', 'firstname', 'first', 'given_name'],
        'last_name': ['last_name', 'lastname', 'last', 'surname'],
        'email': ['email', 'email_address', 'candidate_email'],
        'phone': ['phone', 'phone_number', 'mobile', 'telephone'],
        'applied_position': ['applied_position', 'position', 'job_title', 'role'],
        'department': ['department', 'dept'],
        'application_date': ['application_date', 'apply_date', 'date_applied', 'applied_date'],
        'source': ['source', 'referral_source', 'channel', 'origin'],
        'status': ['status', 'candidate_status', 'stage'],
        'recruiter': ['recruiter', 'recruiter_email', 'assigned_recruiter'],
    }

    REQUISITION_COLUMNS = {
        'title': ['title', 'job_title', 'position', 'role'],
        'department': ['department', 'dept'],
        'location': ['location', 'office', 'work_location'],
        'status': ['status', 'req_status', 'requisition_status'],
        'open_date': ['open_date', 'opened_date', 'created_date', 'posted_date'],
        'target_fill_date': ['target_fill_date', 'target_date', 'expected_fill_date'],
        'salary_min': ['salary_min', 'min_salary', 'salary_range_min'],
        'salary_max': ['salary_max', 'max_salary', 'salary_range_max'],
        'hiring_manager': ['hiring_manager', 'manager', 'hiring_manager_email'],
        'recruiter': ['recruiter', 'recruiter_email', 'assigned_recruiter'],
        'headcount': ['headcount', 'positions', 'num_positions', 'openings'],
    }

    @classmethod
    def analyze_file(cls, df: pd.DataFrame, data_type: str) -> dict:
        """
        Analyze uploaded file and suggest column mappings.

        Returns:
            dict with columns, suggested_mappings, and data_preview
        """
        columns = list(df.columns)
        columns_lower = [c.lower().strip() for c in columns]

        # Get mapping template based on data type
        if data_type == 'employees':
            mapping_template = cls.EMPLOYEE_COLUMNS
        elif data_type == 'candidates':
            mapping_template = cls.CANDIDATE_COLUMNS
        elif data_type == 'requisitions':
            mapping_template = cls.REQUISITION_COLUMNS
        else:
            mapping_template = {}

        # Auto-detect column mappings
        suggested_mappings = {}
        for target_col, possible_names in mapping_template.items():
            for possible_name in possible_names:
                if possible_name.lower() in columns_lower:
                    idx = columns_lower.index(possible_name.lower())
                    suggested_mappings[target_col] = columns[idx]
                    break

        # Get sample data for preview
        preview_data = df.head(5).to_dict(orient='records')

        return {
            'columns': columns,
            'suggested_mappings': suggested_mappings,
            'required_fields': cls._get_required_fields(data_type),
            'optional_fields': cls._get_optional_fields(data_type),
            'total_rows': len(df),
            'preview': preview_data,
        }

    @classmethod
    def _get_required_fields(cls, data_type: str) -> list[str]:
        """Get required fields for a data type."""
        if data_type == 'employees':
            return ['employee_id', 'first_name', 'last_name', 'email', 'department', 'job_title', 'hire_date']
        elif data_type == 'candidates':
            return ['first_name', 'last_name', 'email', 'applied_position', 'application_date']
        elif data_type == 'requisitions':
            return ['title', 'department', 'open_date']
        return []

    @classmethod
    def _get_optional_fields(cls, data_type: str) -> list[str]:
        """Get optional fields for a data type."""
        if data_type == 'employees':
            return ['location', 'salary', 'manager_email', 'status', 'termination_date',
                    'performance_rating', 'engagement_score', 'age', 'gender', 'ethnicity']
        elif data_type == 'candidates':
            return ['phone', 'department', 'source', 'status', 'recruiter']
        elif data_type == 'requisitions':
            return ['location', 'status', 'target_fill_date', 'salary_min', 'salary_max',
                    'hiring_manager', 'recruiter', 'headcount']
        return []

    @classmethod
    def validate_mappings(cls, mappings: dict, data_type: str) -> tuple[bool, list[str]]:
        """
        Validate that all required fields are mapped.

        Returns:
            Tuple of (is_valid, list of missing fields)
        """
        required = cls._get_required_fields(data_type)
        missing = [field for field in required if field not in mappings or not mappings[field]]
        return len(missing) == 0, missing

    @classmethod
    def import_data(
        cls,
        db: Session,
        df: pd.DataFrame,
        data_type: str,
        column_mappings: dict,
        organization_id: str,
        upload_id: Optional[str] = None,
    ) -> dict:
        """
        Import data from DataFrame using provided column mappings.

        Returns:
            dict with import results (created, updated, failed, errors)
        """
        # Validate mappings
        is_valid, missing = cls.validate_mappings(column_mappings, data_type)
        if not is_valid:
            return {
                'success': False,
                'error': f'Missing required columns: {", ".join(missing)}',
                'created': 0,
                'updated': 0,
                'failed': 0,
            }

        # Apply column mappings - rename columns
        rename_map = {v: k for k, v in column_mappings.items() if v}
        df_mapped = df.rename(columns=rename_map)

        # Import based on data type
        if data_type == 'employees':
            return cls._import_employees(db, df_mapped, organization_id)
        elif data_type == 'candidates':
            return cls._import_candidates(db, df_mapped, organization_id)
        elif data_type == 'requisitions':
            return cls._import_requisitions(db, df_mapped, organization_id)
        else:
            return {'success': False, 'error': f'Unknown data type: {data_type}'}

    @classmethod
    def _import_employees(cls, db: Session, df: pd.DataFrame, organization_id: str) -> dict:
        """Import employee records."""
        created = 0
        updated = 0
        failed = 0
        errors = []

        for idx, row in df.iterrows():
            try:
                # Check if employee exists
                existing = db.query(Employee).filter(
                    Employee.employee_id == str(row.get('employee_id', '')),
                    Employee.organization_id == organization_id,
                ).first()

                employee_data = {
                    'employee_id': str(row.get('employee_id', f'EMP-{idx}')),
                    'first_name': str(row.get('first_name', '')),
                    'last_name': str(row.get('last_name', '')),
                    'email': str(row.get('email', '')),
                    'department': str(row.get('department', '')),
                    'job_title': str(row.get('job_title', '')),
                    'hire_date': cls._parse_date(row.get('hire_date')),
                    'termination_date': cls._parse_date(row.get('termination_date')),
                    'location': str(row.get('location', '')) if pd.notna(row.get('location')) else None,
                    'salary': cls._parse_float(row.get('salary')),
                    'status': cls._parse_employee_status(row.get('status')),
                    'performance_rating': cls._parse_float(row.get('performance_rating')),
                    'engagement_score': cls._parse_float(row.get('engagement_score')),
                    'age': cls._parse_int(row.get('age')),
                    'gender': str(row.get('gender', '')) if pd.notna(row.get('gender')) else None,
                    'ethnicity': str(row.get('ethnicity', '')) if pd.notna(row.get('ethnicity')) else None,
                    'organization_id': organization_id,
                    'source_system': 'csv_import',
                }

                if existing:
                    for key, value in employee_data.items():
                        if value is not None and key != 'id':
                            setattr(existing, key, value)
                    updated += 1
                else:
                    employee_data['id'] = uuid4()
                    employee = Employee(**employee_data)
                    db.add(employee)
                    created += 1

            except Exception as e:
                failed += 1
                errors.append(f'Row {idx + 2}: {str(e)}')

        db.commit()

        return {
            'success': True,
            'created': created,
            'updated': updated,
            'failed': failed,
            'errors': errors[:50],  # Limit errors returned
        }

    @classmethod
    def _import_candidates(cls, db: Session, df: pd.DataFrame, organization_id: str) -> dict:
        """Import candidate records."""
        created = 0
        updated = 0
        failed = 0
        errors = []

        for idx, row in df.iterrows():
            try:
                email = str(row.get('email', ''))
                position = str(row.get('applied_position', ''))

                # Check if candidate exists
                existing = db.query(Candidate).filter(
                    Candidate.email == email,
                    Candidate.applied_position == position,
                    Candidate.organization_id == organization_id,
                ).first()

                candidate_data = {
                    'first_name': str(row.get('first_name', '')),
                    'last_name': str(row.get('last_name', '')),
                    'email': email,
                    'phone': str(row.get('phone', '')) if pd.notna(row.get('phone')) else None,
                    'applied_position': position,
                    'department': str(row.get('department', '')) if pd.notna(row.get('department')) else None,
                    'application_date': cls._parse_date(row.get('application_date')),
                    'source': str(row.get('source', '')) if pd.notna(row.get('source')) else None,
                    'status': cls._parse_candidate_status(row.get('status')),
                    'organization_id': organization_id,
                    'source_system': 'csv_import',
                }

                if existing:
                    for key, value in candidate_data.items():
                        if value is not None and key != 'id':
                            setattr(existing, key, value)
                    updated += 1
                else:
                    candidate_data['id'] = uuid4()
                    candidate = Candidate(**candidate_data)
                    db.add(candidate)
                    created += 1

            except Exception as e:
                failed += 1
                errors.append(f'Row {idx + 2}: {str(e)}')

        db.commit()

        return {
            'success': True,
            'created': created,
            'updated': updated,
            'failed': failed,
            'errors': errors[:50],
        }

    @classmethod
    def _import_requisitions(cls, db: Session, df: pd.DataFrame, organization_id: str) -> dict:
        """Import requisition records."""
        created = 0
        updated = 0
        failed = 0
        errors = []

        for idx, row in df.iterrows():
            try:
                title = str(row.get('title', ''))
                department = str(row.get('department', ''))
                open_date = cls._parse_date(row.get('open_date'))

                # Check if requisition exists
                existing = db.query(JobRequisition).filter(
                    JobRequisition.title == title,
                    JobRequisition.department == department,
                    JobRequisition.open_date == open_date,
                    JobRequisition.organization_id == organization_id,
                ).first()

                req_data = {
                    'title': title,
                    'department': department,
                    'location': str(row.get('location', '')) if pd.notna(row.get('location')) else None,
                    'status': cls._parse_requisition_status(row.get('status')),
                    'open_date': open_date,
                    'target_fill_date': cls._parse_date(row.get('target_fill_date')),
                    'salary_min': cls._parse_float(row.get('salary_min')),
                    'salary_max': cls._parse_float(row.get('salary_max')),
                    'headcount': cls._parse_int(row.get('headcount')) or 1,
                    'organization_id': organization_id,
                    'source_system': 'csv_import',
                }

                if existing:
                    for key, value in req_data.items():
                        if value is not None and key != 'id':
                            setattr(existing, key, value)
                    updated += 1
                else:
                    req_data['id'] = uuid4()
                    requisition = JobRequisition(**req_data)
                    db.add(requisition)
                    created += 1

            except Exception as e:
                failed += 1
                errors.append(f'Row {idx + 2}: {str(e)}')

        db.commit()

        return {
            'success': True,
            'created': created,
            'updated': updated,
            'failed': failed,
            'errors': errors[:50],
        }

    @staticmethod
    def _parse_date(value: Any) -> Optional[date]:
        """Parse various date formats."""
        if pd.isna(value) or value is None or value == '':
            return None

        if isinstance(value, (datetime, date)):
            return value.date() if isinstance(value, datetime) else value

        try:
            # Try various date formats
            for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y/%m/%d', '%m-%d-%Y']:
                try:
                    return datetime.strptime(str(value).strip(), fmt).date()
                except ValueError:
                    continue
            return pd.to_datetime(str(value)).date()
        except Exception:
            return None

    @staticmethod
    def _parse_float(value: Any) -> Optional[float]:
        """Parse float value."""
        if pd.isna(value) or value is None or value == '':
            return None
        try:
            # Remove currency symbols and commas
            clean = str(value).replace('$', '').replace(',', '').strip()
            return float(clean)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _parse_int(value: Any) -> Optional[int]:
        """Parse integer value."""
        if pd.isna(value) or value is None or value == '':
            return None
        try:
            return int(float(str(value)))
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _parse_employee_status(value: Any) -> EmployeeStatus:
        """Parse employee status."""
        if pd.isna(value) or value is None:
            return EmployeeStatus.active

        status_map = {
            'active': EmployeeStatus.active,
            'terminated': EmployeeStatus.terminated,
            'on leave': EmployeeStatus.on_leave,
            'on_leave': EmployeeStatus.on_leave,
        }
        return status_map.get(str(value).lower().strip(), EmployeeStatus.active)

    @staticmethod
    def _parse_candidate_status(value: Any) -> CandidateStatus:
        """Parse candidate status."""
        if pd.isna(value) or value is None:
            return CandidateStatus.new

        status_map = {
            'new': CandidateStatus.new,
            'screening': CandidateStatus.screening,
            'interview': CandidateStatus.interview,
            'offer': CandidateStatus.offer,
            'hired': CandidateStatus.hired,
            'rejected': CandidateStatus.rejected,
        }
        return status_map.get(str(value).lower().strip(), CandidateStatus.new)

    @staticmethod
    def _parse_requisition_status(value: Any) -> RequisitionStatus:
        """Parse requisition status."""
        if pd.isna(value) or value is None:
            return RequisitionStatus.open

        status_map = {
            'open': RequisitionStatus.open,
            'filled': RequisitionStatus.filled,
            'closed': RequisitionStatus.closed,
            'on hold': RequisitionStatus.on_hold,
            'on_hold': RequisitionStatus.on_hold,
        }
        return status_map.get(str(value).lower().strip(), RequisitionStatus.open)
