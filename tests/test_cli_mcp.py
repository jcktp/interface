"""Exercise installed CLI, backup/restore and actual MCP stdio transport."""
import asyncio
import json
import os
from pathlib import Path
import socket
import sqlite3
import subprocess
import sys
import time

import httpx
import pytest


def test_cli_backup_and_mcp(tmp_path):
    pytest.importorskip("mcp")
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    command = [sys.executable, "-m", "interface_core.cli", "--data-dir", str(tmp_path / "data")]
    for action in ("init", "init"):
        subprocess.run([*command, action], check=True, capture_output=True)
    # Synthetic test fixture; production CLI has no demo/seed command.
    from interface_core.database import SQLiteDatabase
    from interface_core.repository import SQLitePeopleRepository
    from interface_core.service import PeopleService
    from interface_core.models import PersonInput
    from interface_core.policy import Actor
    db = SQLiteDatabase(tmp_path / "data/people.sqlite3")
    service = PeopleService(SQLitePeopleRepository(db))
    assert service.list(Actor("test", "reader"))["total"] == 0
    service.save(Actor("test", "admin"), PersonInput(name="Sam Rivera", email="sam@example.test", department="Engineering"))
    backup = tmp_path / "backup.sqlite3"
    subprocess.run([*command, "backup", str(backup)], check=True, capture_output=True)
    assert subprocess.run([*command, "backup", str(backup)], capture_output=True).returncode != 0
    with sqlite3.connect(backup) as db:
        assert db.execute("SELECT count(*) FROM people").fetchone()[0] == 1
        assert db.execute("SELECT count(*) FROM events").fetchone()[0] == 1
    keys_file = tmp_path / "data/keys.json"
    if os.name == "posix":
        assert keys_file.stat().st_mode & 0o777 == 0o600
    keys = json.loads(keys_file.read_text())
    assert keys["reader"] != keys["admin"]
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    base = f"http://127.0.0.1:{port}"
    process = subprocess.Popen([*command, "serve", "--port", str(port)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        with httpx.Client(trust_env=False) as client:
            for _ in range(100):
                try:
                    if client.get(base + "/health").status_code == 200:
                        break
                except httpx.ConnectError:
                    pass
                time.sleep(0.05)
            else:
                pytest.fail("Local HTTP server did not start")

        async def exercise():
            params = StdioServerParameters(command=sys.executable, args=["-m", "interface_core.mcp_server"], env={**os.environ, "INTERFACE_URL": base, "INTERFACE_TOKEN": keys["reader"]})
            async with stdio_client(params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    assert [tool.name for tool in (await session.list_tools()).tools] == ["list_people"]
                    result = await session.call_tool("list_people", {"query": "Engineering"})
                    assert not result.isError
                    body = json.loads(result.content[0].text)
                    assert body["total"] == 1 and body["items"][0]["name"] == "Sam Rivera"
                    assert (await session.call_tool("list_people", {"limit": 1000})).isError
                    assert (await session.call_tool("create_person", {})).isError
        asyncio.run(exercise())
    finally:
        process.terminate()
        process.wait(timeout=10)


def test_mcp_rejects_remote_destinations():
    pytest.importorskip("mcp")
    from interface_core.mcp_server import build_server
    for destination in ["https://example.com", "http://localhost@evil.example", "http://localhost/api", "http://localhost?x=1"]:
        with pytest.raises(ValueError):
            build_server(destination, "reader")
