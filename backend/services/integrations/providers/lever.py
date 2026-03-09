"""Lever ATS integration provider."""

from typing import Dict, List, Any, Optional
from datetime import datetime
import base64

from ..provider_base import BaseProvider, ConnectionConfig, SyncResult


class LeverProvider(BaseProvider):
    """Lever ATS integration for opportunities and postings."""

    @property
    def provider_name(self) -> str:
        return "lever"

    @property
    def base_url(self) -> str:
        return "https://api.lever.co/v1"

    @property
    def supported_data_types(self) -> List[str]:
        return ["candidates", "jobs"]  # Lever calls them "opportunities" and "postings"

    def get_auth_headers(self) -> Dict[str, str]:
        """Lever uses Basic Auth with API key."""
        if not self.config.api_key:
            return {}

        # Lever expects API key as username with empty password
        credentials = base64.b64encode(f"{self.config.api_key}:".encode()).decode()
        return {
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json",
        }

    def transform_employee(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Not applicable for Lever - it's an ATS, not HRIS."""
        return {}

    def transform_candidate(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform Lever opportunity to our candidate schema."""
        # Get contact info
        contact = raw_data.get("contact", {})
        emails = contact.get("emails", [])
        phones = contact.get("phones", [])

        email = emails[0] if emails else ""
        phone = phones[0].get("value", "") if phones else ""

        # Get name parts
        name = raw_data.get("name", "")
        name_parts = name.split(" ", 1)
        first_name = name_parts[0] if name_parts else ""
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        # Get posting (job) info
        applications = raw_data.get("applications", [])
        current_app = applications[0] if applications else {}
        posting = current_app.get("posting", {}) if current_app else {}

        # Map stage to status
        stage = raw_data.get("stage", "")
        stage_map = {
            "lead": "new",
            "applicant": "screening",
            "phone screen": "screening",
            "interview": "interview",
            "offer": "offer",
            "hired": "hired",
        }
        status = stage_map.get(stage.lower(), "new")

        # Check for archived (rejected)
        if raw_data.get("archived", {}).get("reason"):
            status = "rejected"

        return {
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "phone": phone,
            "applied_position": posting.get("text", ""),
            "department": posting.get("categories", {}).get("department", ""),
            "application_date": self._parse_timestamp(raw_data.get("createdAt")),
            "source": raw_data.get("origin", "") or (raw_data.get("sources", [""])[0] if raw_data.get("sources") else ""),
            "status": status,
            "stage": stage,
            "external_id": raw_data.get("id", ""),
            "source_system": "lever",
            "raw_data": raw_data,
        }

    def transform_job(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform Lever posting to our requisition schema."""
        categories = raw_data.get("categories", {})

        # Map state to status
        state = raw_data.get("state", "")
        status_map = {
            "published": "open",
            "internal": "open",
            "closed": "closed",
            "pending": "on_hold",
            "draft": "on_hold",
        }

        return {
            "title": raw_data.get("text", ""),
            "department": categories.get("department", ""),
            "location": categories.get("location", ""),
            "status": status_map.get(state, "open"),
            "open_date": self._parse_timestamp(raw_data.get("createdAt")),
            "closed_date": self._parse_timestamp(raw_data.get("closedAt")),
            "external_id": raw_data.get("id", ""),
            "source_system": "lever",
            "raw_data": raw_data,
        }

    def _parse_timestamp(self, timestamp: Optional[int]) -> Optional[datetime]:
        """Parse Lever timestamp (milliseconds since epoch)."""
        if not timestamp:
            return None
        try:
            return datetime.fromtimestamp(timestamp / 1000)
        except (ValueError, TypeError):
            return None

    def _fetch_employees_paginated(
        self, since: Optional[datetime] = None, page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """Not applicable for Lever."""
        return []

    def _fetch_candidates_paginated(
        self, since: Optional[datetime] = None, page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """Fetch opportunities from Lever with pagination."""
        all_opportunities = []
        offset = None

        while True:
            params = {"limit": page_size}

            if offset:
                params["offset"] = offset

            if since:
                params["updated_at_start"] = int(since.timestamp() * 1000)

            response = self._make_request(
                "GET",
                f"{self.base_url}/opportunities",
                params=params,
            )

            if not response:
                break

            data = response.get("data", [])
            all_opportunities.extend(data)

            # Check for next page
            if response.get("hasNext") and response.get("next"):
                offset = response["next"]
            else:
                break

        return all_opportunities

    def _fetch_jobs_paginated(
        self, since: Optional[datetime] = None, page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """Fetch postings from Lever with pagination."""
        all_postings = []
        offset = None

        while True:
            params = {"limit": page_size}

            if offset:
                params["offset"] = offset

            response = self._make_request(
                "GET",
                f"{self.base_url}/postings",
                params=params,
            )

            if not response:
                break

            data = response.get("data", [])
            all_postings.extend(data)

            if response.get("hasNext") and response.get("next"):
                offset = response["next"]
            else:
                break

        return all_postings

    def sync_candidates(self, since: Optional[datetime] = None) -> SyncResult:
        """Sync opportunities from Lever."""
        result = SyncResult(data_type="candidates")
        result.started_at = datetime.utcnow()

        try:
            raw_opportunities = self._fetch_candidates_paginated(since)
            result.records_fetched = len(raw_opportunities)

            for raw in raw_opportunities:
                try:
                    transformed = self.transform_candidate(raw)
                    result.records.append(transformed)
                except Exception as e:
                    result.records_failed += 1
                    result.errors.append(f"Transform error for opportunity {raw.get('id')}: {str(e)}")

            result.status = "completed"

        except Exception as e:
            result.status = "failed"
            result.errors.append(str(e))

        result.completed_at = datetime.utcnow()
        return result

    def sync_jobs(self, since: Optional[datetime] = None) -> SyncResult:
        """Sync postings from Lever."""
        result = SyncResult(data_type="jobs")
        result.started_at = datetime.utcnow()

        try:
            raw_postings = self._fetch_jobs_paginated(since)
            result.records_fetched = len(raw_postings)

            for raw in raw_postings:
                try:
                    transformed = self.transform_job(raw)
                    result.records.append(transformed)
                except Exception as e:
                    result.records_failed += 1
                    result.errors.append(f"Transform error for posting {raw.get('id')}: {str(e)}")

            result.status = "completed"

        except Exception as e:
            result.status = "failed"
            result.errors.append(str(e))

        result.completed_at = datetime.utcnow()
        return result

    def test_connection(self) -> tuple[bool, str]:
        """Test Lever API connection."""
        try:
            response = self._make_request("GET", f"{self.base_url}/postings", params={"limit": 1})
            if response is not None:
                return True, "Successfully connected to Lever"
            return False, "Unable to connect to Lever API"
        except Exception as e:
            return False, f"Connection failed: {str(e)}"
