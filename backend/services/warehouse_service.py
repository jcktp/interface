"""Data Warehouse Service for 2Model.

Manages Redshift connections, schema introspection, and query execution.
"""

import os
import json
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from uuid import UUID, uuid4

from sqlalchemy.orm import Session
from sqlalchemy import text

from database.models import WarehouseConnection


class WarehouseService:
    """Manages data warehouse connections and queries."""

    def __init__(self, db: Session):
        self.db = db

    def list_connections(self, org_id: UUID) -> List[WarehouseConnection]:
        return (
            self.db.query(WarehouseConnection)
            .filter(WarehouseConnection.organization_id == org_id)
            .order_by(WarehouseConnection.created_at.desc())
            .all()
        )

    def get_connection(self, connection_id: UUID, org_id: UUID) -> WarehouseConnection:
        conn = self.db.query(WarehouseConnection).filter(
            WarehouseConnection.id == connection_id,
            WarehouseConnection.organization_id == org_id,
        ).first()
        if not conn:
            raise ValueError("Connection not found")
        return conn

    def create_connection(self, org_id: UUID, user_id: UUID, data: Dict[str, Any]) -> WarehouseConnection:
        conn = WarehouseConnection(
            id=uuid4(),
            organization_id=org_id,
            name=data["name"],
            connection_type=data.get("connection_type", "redshift"),
            host=data.get("host", ""),
            port=data.get("port", 5439),
            database=data.get("database", ""),
            username=data.get("username", ""),
            password_encrypted=data.get("password", ""),  # In production, encrypt this
            schema_name=data.get("schema", "public"),
            ssl_enabled=data.get("ssl_enabled", True),
            extra_config=data.get("extra_config", {}),
            status="pending",
            created_by=user_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        self.db.add(conn)
        self.db.commit()
        return conn

    def delete_connection(self, connection_id: UUID, org_id: UUID) -> bool:
        conn = self.get_connection(connection_id, org_id)
        self.db.delete(conn)
        self.db.commit()
        return True

    def test_connection(self, connection_id: UUID, org_id: UUID) -> Tuple[bool, str]:
        """Test a warehouse connection by attempting to connect and run SELECT 1."""
        conn = self.get_connection(connection_id, org_id)

        try:
            engine = self._create_engine(conn)
            with engine.connect() as connection:
                result = connection.execute(text("SELECT 1"))
                result.fetchone()

            conn.status = "connected"
            conn.last_sync_at = datetime.utcnow()
            conn.updated_at = datetime.utcnow()
            self.db.commit()
            return True, "Connection successful"

        except Exception as e:
            conn.status = "error"
            conn.error_message = str(e)[:500]
            conn.updated_at = datetime.utcnow()
            self.db.commit()
            return False, f"Connection failed: {str(e)}"

    def execute_query(self, connection_id: UUID, org_id: UUID, sql: str) -> Dict[str, Any]:
        """Execute a read-only query against the warehouse."""
        conn = self.get_connection(connection_id, org_id)

        # Validate query is SELECT only
        sql_upper = sql.upper().strip()
        if not (sql_upper.startswith("SELECT") or sql_upper.startswith("WITH")):
            raise ValueError("Only SELECT queries are allowed")

        dangerous = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE"]
        for keyword in dangerous:
            if f" {keyword} " in f" {sql_upper} ":
                raise ValueError(f"Query contains forbidden keyword: {keyword}")

        try:
            engine = self._create_engine(conn)
            with engine.connect() as connection:
                # Set timeout
                connection.execute(text("SET statement_timeout = 30000"))
                result = connection.execute(text(sql))

                columns = list(result.keys())
                rows = []
                for row in result.fetchmany(1000):  # Limit to 1000 rows
                    row_dict = {}
                    for i, col in enumerate(columns):
                        val = row[i]
                        if hasattr(val, 'isoformat'):
                            val = val.isoformat()
                        elif isinstance(val, bytes):
                            val = val.decode('utf-8', errors='replace')
                        row_dict[col] = val
                    rows.append(row_dict)

            return {
                "columns": columns,
                "rows": rows,
                "row_count": len(rows),
                "truncated": len(rows) == 1000,
            }

        except Exception as e:
            raise ValueError(f"Query execution failed: {str(e)}")

    def get_schema(self, connection_id: UUID, org_id: UUID) -> Dict[str, Any]:
        """Introspect the warehouse schema."""
        conn = self.get_connection(connection_id, org_id)

        try:
            engine = self._create_engine(conn)
            with engine.connect() as connection:
                # Get tables
                tables_result = connection.execute(text("""
                    SELECT table_schema, table_name, table_type
                    FROM information_schema.tables
                    WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
                    ORDER BY table_schema, table_name
                    LIMIT 200
                """))

                tables = {}
                for row in tables_result:
                    schema = row[0]
                    table = row[1]
                    table_type = row[2]
                    key = f"{schema}.{table}"

                    # Get columns for this table
                    cols_result = connection.execute(text(f"""
                        SELECT column_name, data_type, is_nullable
                        FROM information_schema.columns
                        WHERE table_schema = '{schema}' AND table_name = '{table}'
                        ORDER BY ordinal_position
                    """))

                    tables[key] = {
                        "schema": schema,
                        "table": table,
                        "type": table_type,
                        "columns": [
                            {"name": col[0], "type": col[1], "nullable": col[2] == "YES"}
                            for col in cols_result
                        ],
                    }

            return {"tables": tables, "connection": conn.name}

        except Exception as e:
            raise ValueError(f"Schema introspection failed: {str(e)}")

    def _create_engine(self, conn: WarehouseConnection):
        """Create a SQLAlchemy engine for the warehouse connection."""
        from sqlalchemy import create_engine

        if conn.connection_type == "redshift":
            try:
                url = f"redshift+redshift_connector://{conn.username}:{conn.password_encrypted}@{conn.host}:{conn.port}/{conn.database}"
                if conn.ssl_enabled:
                    return create_engine(url, connect_args={"sslmode": "verify-ca"})
                return create_engine(url)
            except Exception:
                # Fallback to psycopg2 driver
                url = f"postgresql+psycopg2://{conn.username}:{conn.password_encrypted}@{conn.host}:{conn.port}/{conn.database}"
                return create_engine(url)
        else:
            # Generic PostgreSQL
            url = f"postgresql+psycopg2://{conn.username}:{conn.password_encrypted}@{conn.host}:{conn.port}/{conn.database}"
            return create_engine(url)
