"""Ashby ATS integration provider."""

from typing import Dict, List, Any, Optional
from datetime import datetime
import base64

from ..provider_base import BaseProvider, ConnectionConfig, SyncResult


class AshbyProvider(BaseProvider):
    """Ashby ATS integration for candidates, jobs, and applications."""

    @property
    def provider_name(self) -> str:
        return "ashby"

    @property
    def base_url(self) -> str:
        return "https://api.ashbyhq.com"

    @property
    def supported_data_types(self) -> List[str]:
        return ["candidates", "jobs", "applications"]

    def get_auth_headers(self) -> Dict[str, str]:
        """Ashby uses Basic Auth with API key as username, empty password."""
        if not self.config.api_key:
            return {}

        credentials = base64.b64encode(f"{self.config.api_key}:".encode()).decode()
        return {
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json",
        }

    def transform_employee(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Not applicable for Ashby - it's an ATS, not HRIS."""
        return {}

    def transform_candidate(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform Ashby candidate to our schema."""
        emails = raw_data.get("emailAddresses", [])
        email = emails[0].get("value", "") if emails else raw_data.get("primaryEmailAddress", {}).get("value", "")

        phones = raw_data.get("phoneNumbers", [])
        phone = phones[0].get("value", "") if phones else ""

        # Get application info
        applications = raw_data.get("applications", [])
        current_app = applications[0] if applications else {}
        job = current_app.get("job", {})

        # Map Ashby status to our schema
        status_map = {
            "Lead": "new",
            "Prospect": "new",
            "Active": "screening",
            "Hired": "hired",
            "Rejected": "rejected",
            "Archived": "rejected",
        }

        return {
            "first_name": raw_data.get("firstName", ""),
            "last_name": raw_data.get("lastName", ""),
            "email": email,
            "phone": phone,
            "applied_position": job.get("title", ""),
            "department": job.get("department", {}).get("name", "") if isinstance(job.get("department"), dict) else "",
            "application_date": self._parse_date(raw_data.get("createdAt")),
            "source": raw_data.get("source", {}).get("title", "") if isinstance(raw_data.get("source"), dict) else "",
            "status": status_map.get(current_app.get("status", ""), "new"),
            "stage": current_app.get("currentInterviewStage", {}).get("title", "") if isinstance(current_app.get("currentInterviewStage"), dict) else "",
            "external_id": str(raw_data.get("id", "")),
            "source_system": "ashby",
            "raw_data": raw_data,
        }

    def transform_job(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform Ashby job posting to our requisition schema."""
        department = raw_data.get("department", {})
        dept_name = department.get("name", "") if isinstance(department, dict) else ""

        location = raw_data.get("location", "")
        if isinstance(location, dict):
            location = location.get("name", "")

        status_map = {
            "Published": "open",
            "Closed": "closed",
            "Draft": "on_hold",
            "Internal": "open",
        }

        return {
            "title": raw_data.get("title", ""),
            "department": dept_name,
            "location": location,
            "status": status_map.get(raw_data.get("status", ""), "open"),
            "open_date": self._parse_date(raw_data.get("publishedAt") or raw_data.get("createdAt")),
            "closed_date": self._parse_date(raw_data.get("closedAt")),
            "external_id": str(raw_data.get("id", "")),
            "source_system": "ashby",
            "raw_data": raw_data,
        }

    def _fetch_employees_paginated(
        self, since: Optional[datetime] = None, page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """Not applicable for Ashby."""
        return []

    def _fetch_candidates_paginated(
        self, since: Optional[datetime] = None, page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """Fetch candidates from Ashby with cursor-based pagination. Ashby uses POST for list endpoints."""
        all_candidates = []
        cursor = None

        while True:
            body: Dict[str, Any] = {"limit": page_size}
            if cursor:
                body["cursor"] = cursor
            if since:
                body["createdAfter"] = int(since.timestamp() * 1000)

            response = self._make_request(
                "POST",
                f"{self.base_url}/candidate.list",
                json=body,
            )

            if not response or not isinstance(response, dict):
                break

            results = response.get("results", [])
            all_candidates.extend(results)

            # Ashby cursor pagination
            if response.get("moreDataAvailable") and response.get("nextCursor"):
                cursor = response["nextCursor"]
            else:
                break

        return all_candidates

    def _fetch_jobs_paginated(
        self, since: Optional[datetime] = None, page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """Fetch job postings from Ashby with cursor-based pagination."""
        all_jobs = []
        cursor = None

        while True:
            body: Dict[str, Any] = {"limit": page_size}
            if cursor:
                body["cursor"] = cursor

            response = self._make_request(
                "POST",
                f"{self.base_url}/jobPosting.list",
                json=body,
            )

            if not response or not isinstance(response, dict):
                break

            results = response.get("results", [])
            all_jobs.extend(results)

            if response.get("moreDataAvailable") and response.get("nextCursor"):
                cursor = response["nextCursor"]
            else:
                break

        return all_jobs

    def sync_candidates(self, since: Optional[datetime] = None) -> SyncResult:
        """Sync candidates from Ashby."""
        result = SyncResult(data_type="candidates")
        result.started_at = datetime.utcnow()

        try:
            raw_candidates = self._fetch_candidates_paginated(since)
            result.records_fetched = len(raw_candidates)

            for raw in raw_candidates:
                try:
                    transformed = self.transform_candidate(raw)
                    result.records.append(transformed)
                except Exception as e:
                    result.records_failed += 1
                    result.errors.append(f"Transform error for candidate {raw.get('id')}: {str(e)}")

            result.status = "completed"

        except Exception as e:
            result.status = "failed"
            result.errors.append(str(e))

        result.completed_at = datetime.utcnow()
        return result

    def sync_jobs(self, since: Optional[datetime] = None) -> SyncResult:
        """Sync jobs from Ashby."""
        result = SyncResult(data_type="jobs")
        result.started_at = datetime.utcnow()

        try:
            raw_jobs = self._fetch_jobs_paginated(since)
            result.records_fetched = len(raw_jobs)

            for raw in raw_jobs:
                try:
                    transformed = self.transform_job(raw)
                    result.records.append(transformed)
                except Exception as e:
                    result.records_failed += 1
                    result.errors.append(f"Transform error for job {raw.get('id')}: {str(e)}")

            result.status = "completed"

        except Exception as e:
            result.status = "failed"
            result.errors.append(str(e))

        result.completed_at = datetime.utcnow()
        return result

    def test_connection(self) -> tuple[bool, str]:
        """Test Ashby API connection."""
        try:
            response = self._make_request(
                "POST",
                f"{self.base_url}/candidate.list",
                json={"limit": 1},
            )
            if response is not None:
                return True, "Successfully connected to Ashby"
            return False, "Unable to connect to Ashby API"
        except Exception as e:
            return False, f"Connection failed: {str(e)}"
