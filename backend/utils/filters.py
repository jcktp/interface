"""Global filtering utilities for SQLAlchemy queries."""

from typing import Optional
from sqlalchemy import or_
from database.models import Employee as EmployeeModel

def apply_global_filters(
    query, 
    model, 
    departments: Optional[str] = None, 
    locations: Optional[str] = None, 
    status_filter: Optional[str] = None, 
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None
):
    """Apply global header filters to a SQLAlchemy query.

    Works with any model that has the relevant columns.
    Silently skips filters when the model doesn't have the matching column.
    """
    if departments:
        dept_list = [d.strip() for d in departments.split(',')]
        if hasattr(model, 'department'):
            query = query.filter(model.department.in_(dept_list))
            
    if locations:
        loc_list = [loc.strip() for loc in locations.split(',')]
        if hasattr(model, 'location'):
            query = query.filter(model.location.in_(loc_list))
            
    if status_filter:
        status_list = [s.strip() for s in status_filter.split(',')]
        if hasattr(model, 'status'):
            query = query.filter(model.status.in_(status_list))
            
    # Normalize 'all' values
    if start_date == 'all': start_date = None
    if end_date == 'all': end_date = None

    if start_date or end_date:
        if hasattr(model, 'hire_date'):
            # For employee models, date range means "active during this period":
            if end_date:
                query = query.filter(model.hire_date <= end_date)
            if start_date and hasattr(model, 'termination_date'):
                query = query.filter(
                    or_(
                        model.termination_date.is_(None),
                        model.termination_date >= start_date
                    )
                )
        elif hasattr(model, 'application_date'):
            if start_date:
                query = query.filter(model.application_date >= start_date)
            if end_date:
                query = query.filter(model.application_date <= end_date)
        elif hasattr(model, 'record_date'): # for attendance
            if start_date:
                query = query.filter(model.record_date >= start_date)
            if end_date:
                query = query.filter(model.record_date <= end_date)
                
    return query
