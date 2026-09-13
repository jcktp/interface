"""Optional stdio adapter. HTTP enforces the same policies as the UI."""
import os
from urllib.parse import urlparse

import httpx
from mcp.server.fastmcp import FastMCP


def build_server(base_url: str, token: str):
    url = urlparse(base_url)
    if url.scheme != "http" or url.hostname not in ("127.0.0.1", "localhost") or url.username or url.password or url.path not in ("", "/") or url.query or url.fragment:
        raise ValueError("This local adapter requires an http://localhost or http://127.0.0.1 base URL")
    if not token:
        raise ValueError("INTERFACE_TOKEN is required; use the reader key")
    server = FastMCP("Interface")

    @server.tool()
    async def list_people(query: str = "", limit: int = 50, offset: int = 0) -> dict:
        """Search the work directory by name, work email, or department. Read only."""
        async with httpx.AsyncClient(base_url=base_url, headers={"Authorization": f"Bearer {token}"}, trust_env=False) as client:
            response = await client.get("/api/v1/people", params={"q": query, "limit": limit, "offset": offset})
            response.raise_for_status()
            return response.json()

    return server


def main():
    build_server(os.environ.get("INTERFACE_URL", "http://127.0.0.1:8000"), os.environ.get("INTERFACE_TOKEN", "")).run(transport="stdio")


if __name__ == "__main__":
    main()
