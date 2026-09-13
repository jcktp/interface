"""Opt-in local measurement. Temporary synthetic fixture, never application data."""
from pathlib import Path
from statistics import median, quantiles
from tempfile import TemporaryDirectory
from time import perf_counter
import json

from fastapi.testclient import TestClient
from interface_core.app import create_app
from interface_core.database import SQLiteDatabase
from interface_core.repository import SQLitePeopleRepository
from interface_core.service import PeopleService


def main():
    with TemporaryDirectory() as folder:
        db = SQLiteDatabase(Path(folder) / 'benchmark.sqlite3')
        start = perf_counter()
        db.migrate()
        migration_ms = (perf_counter() - start) * 1000
        with db.connect() as connection:
            connection.executemany('INSERT INTO people VALUES (?,?,?,?,?,?,1,?,?)',
                [(str(i), f'Person {i:05}', f'p{i}@example.test', 'Engineer', 'Engineering' if i % 2 else 'People', 'active', '2026-01-01', '2026-01-01') for i in range(4500)])
        service = PeopleService(SQLitePeopleRepository(db))
        headers = {'Authorization': 'Bearer ' + 'r' * 40}
        with TestClient(create_app(service, 'a' * 40, 'r' * 40)) as client:
            durations = []
            for _ in range(100):
                start = perf_counter()
                response = client.get('/api/v1/people?q=Engineering&limit=20', headers=headers)
                durations.append((perf_counter() - start) * 1000)
                assert response.status_code == 200
                assert response.json()['total'] == 2250
                assert len(response.json()['items']) == 20
            print(json.dumps({'records':4500, 'requests':100, 'migration_ms':round(migration_ms,2), 'api_p50_ms':round(median(durations),2), 'api_p95_ms':round(quantiles(durations,n=20)[18],2)}, indent=2))

if __name__ == '__main__':
    main()
