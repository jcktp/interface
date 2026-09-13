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
            migrations = sorted((Path(__file__).parent / "migrations").glob("[0-9]*_*.sql"))
            if version > len(migrations):
                raise RuntimeError("Database is newer than this application")
            for number, migration in enumerate(migrations, 1):
                if number > version:
                    db.executescript("BEGIN IMMEDIATE;\n" + migration.read_text() + f"\nPRAGMA user_version = {number};\nCOMMIT;")
