"""Greenhouse ATS integration provider."""

from typing import Dict, List, Any, Optional
from datetime import datetime
import base64

from ..provider_base import BaseProvider, ConnectionConfig, SyncResult


class GreenhouseProvider(BaseProvider):
    """Greenhouse ATS integration for candidates and jobs."""

    @property
    def provider_name(self) -> str:
        return "greenhouse"

    @property
    def base_url(self) -> str:
        return "https://harvest.greenhouse.io/v1"

    @property
    def supported_data_types(self) -> List[str]:
        return ["candidates", "jobs", "applications"]

    def get_auth_headers(self) -> Dict[str, str]:
        """Greenhouse uses Basic Auth with API key as username."""
        if not self.config.api_key:
            return {}

        # Greenhouse expects the API key as username with empty password
        credentials = base64.b64encode(f"{self.config.api_key}:".encode()).decode()
        return {
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json",
        }

    def transform_employee(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Not applicable for Greenhouse - it's an ATS, not HRIS."""
        return {}

    def transform_candidate(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform Greenhouse candidate to our schema."""
        # Get primary email
        emails = raw_data.get("email_addresses", [])
        email = emails[0].get("value", "") if emails else ""

        # Get phone
        phones = raw_data.get("phone_numbers", [])
        phone = phones[0].get("value", "") if phones else ""

        # Get current application
        applications = raw_data.get("applications", [])
        current_app = applications[0] if applications else {}
        job = current_app.get("jobs", [{}])[0] if current_app.get("jobs") else {}

        # Map status
        status_map = {
            "active": "screening",
            "hired": "hired",
            "rejected": "rejected",
        }

        return {
            "first_name": raw_data.get("first_name", ""),
            "last_name": raw_data.get("last_name", ""),
            "email": email,
            "phone": phone,
            "applied_position": job.get("name", ""),
            "department": current_app.get("department", {}).get("name", ""),
            "application_date": self._parse_date(raw_data.get("created_at")),
            "source": current_app.get("source", {}).get("public_name", ""),
            "status": status_map.get(current_app.get("status", ""), "new"),
            "stage": current_app.get("current_stage", {}).get("name", ""),
            "external_id": str(raw_data.get("id", "")),
            "source_system": "greenhouse",
            "raw_data": raw_data,
        }

    def transform_job(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform Greenhouse job to our requisition schema."""
        # Get department
        departments = raw_data.get("departments", [])
        department = departments[0].get("name", "") if departments else ""

        # Get location
        offices = raw_data.get("offices", [])
        location = offices[0].get("name", "") if offices else ""

        # Map status
        status_map = {
            "open": "open",
            "closed": "closed",
            "draft": "on_hold",
        }

        return {
            "title": raw_data.get("name", ""),
            "department": department,
            "location": location,
            "status": status_map.get(raw_data.get("status", ""), "open"),
            "open_date": self._parse_date(raw_data.get("opened_at")),
            "closed_date": self._parse_date(raw_data.get("closed_at")),
            "external_id": str(raw_data.get("id", "")),
            "source_system": "greenhouse",
            "raw_data": raw_data,
        }

    def _fetch_employees_paginated(
        self, since: Optional[datetime] = None, page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """Not applicable for Greenhouse."""
        return []

    def _fetch_candidates_paginated(
        self, since: Optional[datetime] = None, page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """Fetch candidates from Greenhouse with pagination."""
        all_candidates = []
        page = 1

        while True:
            params = {
                "per_page": page_size,
                "page": page,
            }

            if since:
                params["updated_after"] = since.isoformat()

            response = self._make_request(
                "GET",
                f"{self.base_url}/candidates",
                params=params,
            )

            if not response or not isinstance(response, list):
                break

            all_candidates.extend(response)

            # Check if we got a full page (more data available)
            if len(response) < page_size:
                break

            page += 1

        return all_candidates

    def _fetch_jobs_paginated(
        self, since: Optional[datetime] = None, page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """Fetch jobs from Greenhouse with pagination."""
        all_jobs = []
        page = 1

        while True:
            params = {
                "per_page": page_size,
                "page": page,
            }

            if since:
                params["updated_after"] = since.isoformat()

            response = self._make_request(
                "GET",
                f"{self.base_url}/jobs",
                params=params,
            )

            if not response or not isinstance(response, list):
                break

            all_jobs.extend(response)

            if len(response) < page_size:
                break

            page += 1

        return all_jobs

    def sync_candidates(self, since: Optional[datetime] = None) -> SyncResult:
        """Sync candidates from Greenhouse."""
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
        """Sync jobs from Greenhouse."""
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
        """Test Greenhouse API connection."""
        try:
            response = self._make_request("GET", f"{self.base_url}/jobs", params={"per_page": 1})
            if response is not None:
                return True, "Successfully connected to Greenhouse"
            return False, "Unable to connect to Greenhouse API"
        except Exception as e:
            return False, f"Connection failed: {str(e)}"
