"""Connection lifecycle and schema migrations."""
from contextlib import contextmanager
from pathlib import Path
import sqlite3

class SQLiteDatabase:
    def __init__(self, path: Path):
        self.path = Path(path)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.create_function("casefold", 1, str.casefold, deterministic=True)
        db.execute("PRAGMA foreign_keys = ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    def migrate(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            version = db.execute("PRAGMA user_version").fetchone()[0]
            if version > 1:
                raise RuntimeError("Database is newer than this application")
            if version == 0:
                sql = (Path(__file__).parent / "migrations/001_core.sql").read_text()
                db.executescript("BEGIN IMMEDIATE;\n" + sql + "\nPRAGMA user_version = 1;\nCOMMIT;")
