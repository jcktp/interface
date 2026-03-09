"""
SQL Query Service

Handles query execution with security restrictions and saved queries.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
import uuid
import re
import hashlib
import time

from sqlalchemy import select, text
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from database.models import SavedQuery, QueryExecution


# Security configuration
MAX_ROWS = 10000
QUERY_TIMEOUT_SECONDS = 30
ALLOWED_TABLES = {
    'employees', 'candidates', 'job_requisitions',
    'departments', 'locations', 'planning_periods',
    'workforce_plans', 'compensation_plans'
}

# Dangerous SQL patterns to block
DANGEROUS_PATTERNS = [
    r'\bDROP\b',
    r'\bDELETE\b',
    r'\bTRUNCATE\b',
    r'\bINSERT\b',
    r'\bUPDATE\b',
    r'\bALTER\b',
    r'\bCREATE\b',
    r'\bGRANT\b',
    r'\bREVOKE\b',
    r'\bEXEC\b',
    r'\bEXECUTE\b',
    r'--',  # SQL comments
    r'/\*',  # Multi-line comments
    r'\bINTO\b\s+OUTFILE',
    r'\bLOAD_FILE\b',
    r'\bPG_SLEEP\b',
    r'\bWAITFOR\b',
]


class QueryValidationError(Exception):
    """Raised when a query fails validation."""
    pass


class QueryService:
    """Service for executing and managing SQL queries."""

    def __init__(self, db: Session):
        self.db = db

    # ==================== Query Validation ====================

    def validate_query(self, sql: str) -> Tuple[bool, Optional[str]]:
        """
        Validate a SQL query for security.
        Returns (is_valid, error_message).
        """
        sql_upper = sql.upper().strip()

        # Must start with SELECT
        if not sql_upper.startswith('SELECT'):
            return False, "Only SELECT queries are allowed"

        # Check for dangerous patterns
        for pattern in DANGEROUS_PATTERNS:
            if re.search(pattern, sql, re.IGNORECASE):
                return False, f"Query contains forbidden pattern"

        # Check for subqueries that might bypass restrictions
        if sql_upper.count('(') > 5:
            return False, "Query is too complex (too many subqueries)"

        # Check for UNION which could be used for injection
        if 'UNION' in sql_upper and 'UNION ALL' not in sql_upper:
            # Allow UNION ALL but be cautious with plain UNION
            pass

        return True, None

    def extract_tables(self, sql: str) -> List[str]:
        """Extract table names from a SQL query."""
        # Simple regex to find table names after FROM and JOIN
        pattern = r'\b(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)'
        matches = re.findall(pattern, sql, re.IGNORECASE)
        return [m.lower() for m in matches]

    def check_table_access(self, tables: List[str]) -> Tuple[bool, Optional[str]]:
        """Check if all tables in the query are allowed."""
        for table in tables:
            if table.lower() not in ALLOWED_TABLES:
                return False, f"Access to table '{table}' is not allowed"
        return True, None

    # ==================== Query Execution ====================

    def execute_query(
        self,
        organization_id: UUID,
        user_id: UUID,
        sql: str,
        saved_query_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Execute a SQL query with security restrictions.
        Returns execution result with columns and rows.
        """
        start_time = time.time()

        # Create execution record
        execution = QueryExecution(
            id=uuid.uuid4(),
            organization_id=organization_id,
            saved_query_id=saved_query_id,
            sql_query=sql,
            executed_by=user_id,
            status="running"
        )
        self.db.add(execution)
        self.db.commit()

        try:
            # Validate query
            is_valid, error = self.validate_query(sql)
            if not is_valid:
                raise QueryValidationError(error)

            # Check table access
            tables = self.extract_tables(sql)
            is_allowed, error = self.check_table_access(tables)
            if not is_allowed:
                raise QueryValidationError(error)

            # Add LIMIT if not present
            sql_with_limit = self._add_limit(sql)

            # Execute query with timeout
            result = self.db.execute(
                text(sql_with_limit).execution_options(
                    timeout=QUERY_TIMEOUT_SECONDS
                )
            )

            # Fetch results
            columns = list(result.keys())
            rows = [dict(row._mapping) for row in result.fetchall()]

            # Convert any non-serializable types
            for row in rows:
                for key, value in row.items():
                    if isinstance(value, datetime):
                        row[key] = value.isoformat()
                    elif hasattr(value, '__str__') and not isinstance(value, (str, int, float, bool, type(None))):
                        row[key] = str(value)

            execution_time = int((time.time() - start_time) * 1000)

            # Update execution record
            execution.status = "completed"
            execution.rows_returned = len(rows)
            execution.execution_time_ms = execution_time
            execution.completed_at = datetime.utcnow()
            self.db.commit()

            return {
                "success": True,
                "execution_id": str(execution.id),
                "columns": columns,
                "rows": rows,
                "row_count": len(rows),
                "execution_time_ms": execution_time,
                "truncated": len(rows) >= MAX_ROWS
            }

        except QueryValidationError as e:
            execution.status = "failed"
            execution.error_message = str(e)
            execution.completed_at = datetime.utcnow()
            self.db.commit()
            return {
                "success": False,
                "execution_id": str(execution.id),
                "error": str(e),
                "error_type": "validation"
            }

        except SQLAlchemyError as e:
            execution.status = "failed"
            execution.error_message = str(e)
            execution.completed_at = datetime.utcnow()
            self.db.commit()
            return {
                "success": False,
                "execution_id": str(execution.id),
                "error": "Database error: " + str(e)[:200],
                "error_type": "database"
            }

        except Exception as e:
            execution.status = "failed"
            execution.error_message = str(e)
            execution.completed_at = datetime.utcnow()
            self.db.commit()
            return {
                "success": False,
                "execution_id": str(execution.id),
                "error": "Unexpected error: " + str(e)[:200],
                "error_type": "unknown"
            }

    def _add_limit(self, sql: str) -> str:
        """Add LIMIT clause if not present."""
        sql_upper = sql.upper()
        if 'LIMIT' not in sql_upper:
            # Remove trailing semicolon if present
            sql = sql.rstrip().rstrip(';')
            return f"{sql} LIMIT {MAX_ROWS}"
        return sql

    # ==================== Saved Queries ====================

    def save_query(
        self,
        organization_id: UUID,
        user_id: UUID,
        name: str,
        sql: str,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None,
        is_public: bool = False
    ) -> SavedQuery:
        """Save a query for later use."""
        # Validate first
        is_valid, error = self.validate_query(sql)
        if not is_valid:
            raise QueryValidationError(error)

        query = SavedQuery(
            id=uuid.uuid4(),
            organization_id=organization_id,
            name=name,
            description=description,
            sql_query=sql,
            tags=tags or [],
            is_public=is_public,
            created_by=user_id
        )
        self.db.add(query)
        self.db.commit()
        return query

    def get_saved_query(self, query_id: UUID) -> Optional[SavedQuery]:
        """Get a saved query by ID."""
        return self.db.execute(
            select(SavedQuery).where(SavedQuery.id == query_id)
        ).scalar_one_or_none()

    def get_saved_queries(
        self,
        organization_id: UUID,
        user_id: UUID
    ) -> List[SavedQuery]:
        """Get all saved queries accessible to a user."""
        from sqlalchemy import or_

        return list(self.db.execute(
            select(SavedQuery)
            .where(
                SavedQuery.organization_id == organization_id,
                or_(
                    SavedQuery.created_by == user_id,
                    SavedQuery.is_public == True
                )
            )
            .order_by(SavedQuery.updated_at.desc())
        ).scalars().all())

    def update_saved_query(
        self,
        query_id: UUID,
        user_id: UUID,
        updates: Dict[str, Any]
    ) -> Optional[SavedQuery]:
        """Update a saved query."""
        query = self.get_saved_query(query_id)
        if not query:
            return None

        # Validate new SQL if provided
        if 'sql_query' in updates:
            is_valid, error = self.validate_query(updates['sql_query'])
            if not is_valid:
                raise QueryValidationError(error)

        for key, value in updates.items():
            if hasattr(query, key):
                setattr(query, key, value)

        query.updated_by = user_id
        query.updated_at = datetime.utcnow()
        self.db.commit()
        return query

    def delete_saved_query(self, query_id: UUID) -> bool:
        """Delete a saved query."""
        query = self.get_saved_query(query_id)
        if not query:
            return False

        self.db.delete(query)
        self.db.commit()
        return True

    # ==================== Schema Information ====================

    def get_schema(self) -> Dict[str, Any]:
        """Get schema information for allowed tables."""
        schema = {}

        for table_name in ALLOWED_TABLES:
            try:
                # Get column info from information_schema
                result = self.db.execute(text(f"""
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns
                    WHERE table_name = :table_name
                    ORDER BY ordinal_position
                """), {"table_name": table_name})

                columns = [
                    {
                        "name": row.column_name,
                        "type": row.data_type,
                        "nullable": row.is_nullable == 'YES'
                    }
                    for row in result
                ]

                if columns:
                    schema[table_name] = {"columns": columns}

            except Exception:
                # Table might not exist yet
                pass

        return schema

    # ==================== Execution History ====================

    def get_execution_history(
        self,
        organization_id: UUID,
        user_id: Optional[UUID] = None,
        limit: int = 50
    ) -> List[QueryExecution]:
        """Get query execution history."""
        query = select(QueryExecution).where(
            QueryExecution.organization_id == organization_id
        )

        if user_id:
            query = query.where(QueryExecution.executed_by == user_id)

        query = query.order_by(QueryExecution.started_at.desc()).limit(limit)

        return list(self.db.execute(query).scalars().all())
