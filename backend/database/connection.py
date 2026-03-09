"""
Database connection and session management for Interface
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import QueuePool

# Database URL from environment
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/hr_analytics"
)

# Create engine with connection pooling
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,  # Recycle connections after 30 minutes
    echo=os.environ.get("SQL_ECHO", "false").lower() == "true",
)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base class for models
Base = declarative_base()


def get_db():
    """
    Dependency that provides a database session.
    Use with FastAPI's Depends() for automatic session management.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Initialize database tables.
    Called on application startup.
    Uses create_all which handles pre-existing tables/indexes gracefully.
    Also adds any missing columns to existing tables.
    """
    from . import models  # Import models to register them
    try:
        Base.metadata.create_all(bind=engine, checkfirst=True)
        print("All database tables created/verified successfully")
    except Exception as e:
        print(f"Warning during create_all: {e}")
        # Fallback: try tables individually
        from sqlalchemy import inspect
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())
        for table in Base.metadata.sorted_tables:
            if table.name not in existing_tables:
                try:
                    table.create(bind=engine, checkfirst=True)
                    print(f"Created table: {table.name}")
                except Exception as te:
                    print(f"Warning creating table {table.name}: {te}")

    # Add missing columns to existing tables
    _add_missing_columns()
    # Add missing indexes to existing tables
    _add_missing_indexes()


def _add_missing_indexes():
    """Add any new indexes to existing tables."""
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    
    for table in Base.metadata.sorted_tables:
        existing_indexes = {idx["name"] for idx in inspector.get_indexes(table.name)}
        for index in table.indexes:
            if index.name not in existing_indexes:
                try:
                    index.create(bind=engine)
                    print(f"Created index {index.name} on {table.name}")
                except Exception as e:
                    if "already exists" not in str(e).lower():
                        print(f"Warning creating index {index.name}: {e}")


def _add_missing_columns():
    """Add any new columns to existing tables (lightweight migration)."""
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue
        existing_cols = {col["name"] for col in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name not in existing_cols:
                col_type = column.type.compile(dialect=engine.dialect)
                nullable = "NULL" if column.nullable else "NOT NULL"
                default = ""
                if column.server_default is not None:
                    default = f" DEFAULT {column.server_default.arg}"
                sql = f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {col_type} {nullable}{default}'
                try:
                    with engine.begin() as conn:
                        conn.execute(text(sql))
                    print(f"Added column {table.name}.{column.name} ({col_type})")
                except Exception as e:
                    if "already exists" not in str(e).lower():
                        print(f"Warning adding column {table.name}.{column.name}: {e}")


def check_db_connection():
    """
    Check if database connection is working.
    Returns True if connection is successful, False otherwise.
    """
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False
