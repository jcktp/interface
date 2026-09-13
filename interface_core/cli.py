import argparse
import json
import os
from pathlib import Path
import secrets
import sqlite3

from .database import SQLiteDatabase
from .repository import SQLitePeopleRepository
from .service import PeopleService


def main():
    parser = argparse.ArgumentParser(description="Interface — one organization per local data folder")
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("init", help="Create an empty database and private access keys")
    serve = sub.add_parser("serve", help="Serve on localhost")
    serve.add_argument("--port", type=int, default=8000)
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--allowed-host", action="append", default=[])
    serve.add_argument("--disable-access-keys", action="store_true", help="Require named accounts after bootstrap")
    backup = sub.add_parser("backup", help="Create a consistent SQLite backup")
    backup.add_argument("destination", type=Path)
    args = parser.parse_args()
    folder = args.data_dir.resolve()
    database = SQLiteDatabase(folder / "people.sqlite3")
    directory = PeopleService(SQLitePeopleRepository(database))
    keys_path = folder / "keys.json"
    if args.command == "init":
        folder.mkdir(parents=True, exist_ok=True, mode=0o700)
        if not keys_path.exists():
            with os.fdopen(os.open(keys_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as f:
                json.dump({"admin": secrets.token_urlsafe(32), "reader": secrets.token_urlsafe(32)}, f, indent=2)
        database.migrate()
        print(f"Ready. Access keys: {keys_path}\nRun: interface --data-dir '{folder}' serve")
        return
    if not keys_path.exists() or not database.path.exists():
        parser.error("Run init first")
    database.migrate()
    if args.command == "serve":
        import uvicorn
        from .bootstrap import build_app
        keys = json.loads(keys_path.read_text())
        if any('*' in host or '/' in host for host in args.allowed_host):
            parser.error('Use explicit hostnames, without wildcards or URL schemes')
        hosts=['127.0.0.1','localhost',*args.allowed_host]
        uvicorn.run(build_app(database, keys, hosts, not args.disable_access_keys), host=args.host, port=args.port, proxy_headers=False)
    else:
        destination = args.destination.resolve()
        if destination.exists():
            parser.error("Backup destination already exists")
        with os.fdopen(os.open(destination, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600), "wb"):
            pass
        with database.connect() as source:
            target = sqlite3.connect(destination)
            try:
                source.backup(target)
            finally:
                target.close()
        print(f"Backup saved: {destination}")


if __name__ == "__main__":
    main()
