"""Lattice Performance Management integration provider."""

from typing import Dict, List, Any, Optional
from datetime import datetime

from ..provider_base import BaseProvider, ConnectionConfig, SyncResult


class LatticeProvider(BaseProvider):
    """Lattice integration for employee data, reviews, and goals."""

    @property
    def provider_name(self) -> str:
        return "lattice"

    @property
    def base_url(self) -> str:
        return "https://api.latticehq.com/v1"

    @property
    def supported_data_types(self) -> List[str]:
        return ["employees", "reviews", "goals"]

    def get_auth_headers(self) -> Dict[str, str]:
        """Lattice uses Bearer token authentication."""
        if not self.config.api_key:
            return {}

        return {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def transform_employee(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform Lattice user/employee data to standard employee schema."""
        name = raw_data.get("name", "")
        name_parts = name.split(" ", 1) if name else ["", ""]
        first_name = name_parts[0] if len(name_parts) > 0 else ""
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        # Lattice may provide structured name fields
        if raw_data.get("firstName"):
            first_name = raw_data["firstName"]
        if raw_data.get("lastName"):
            last_name = raw_data["lastName"]

        department = raw_data.get("department", {})
        dept_name = department.get("name", "") if isinstance(department, dict) else str(department)

        manager = raw_data.get("manager", {})
        manager_name = ""
        if isinstance(manager, dict):
            manager_name = manager.get("name", "")
        elif isinstance(manager, str):
            manager_name = manager

        # Map Lattice status to our schema
        status_map = {
            "active": "active",
            "inactive": "terminated",
            "onLeave": "on_leave",
            "terminated": "terminated",
        }

        return {
            "first_name": first_name,
            "last_name": last_name,
            "email": raw_data.get("email", ""),
            "employee_id": str(raw_data.get("id", "")),
            "department": dept_name,
            "job_title": raw_data.get("jobTitle", raw_data.get("title", "")),
            "location": raw_data.get("location", {}).get("name", "") if isinstance(raw_data.get("location"), dict) else raw_data.get("location", ""),
            "manager": manager_name,
            "hire_date": self._parse_date(raw_data.get("startDate") or raw_data.get("hireDate")),
            "status": status_map.get(raw_data.get("status", "active"), "active"),
            "external_id": str(raw_data.get("id", "")),
            "source_system": "lattice",
            "raw_data": raw_data,
        }

    def transform_candidate(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Not applicable for Lattice - it's a performance management tool, not ATS."""
        return {}

    def transform_review(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform Lattice performance review to our schema."""
        reviewee = raw_data.get("reviewee", {})
        reviewer = raw_data.get("reviewer", {})

        return {
            "review_id": str(raw_data.get("id", "")),
            "employee_id": str(reviewee.get("id", "")) if isinstance(reviewee, dict) else "",
            "employee_name": reviewee.get("name", "") if isinstance(reviewee, dict) else "",
            "reviewer_name": reviewer.get("name", "") if isinstance(reviewer, dict) else "",
            "review_cycle": raw_data.get("reviewCycle", {}).get("name", "") if isinstance(raw_data.get("reviewCycle"), dict) else "",
            "status": raw_data.get("status", ""),
            "rating": raw_data.get("overallRating", raw_data.get("rating")),
            "submitted_at": self._parse_date(raw_data.get("submittedAt")),
            "created_at": self._parse_date(raw_data.get("createdAt")),
            "source_system": "lattice",
            "raw_data": raw_data,
        }

    def transform_goal(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform Lattice goal to our schema."""
        owner = raw_data.get("owner", {})

        return {
            "goal_id": str(raw_data.get("id", "")),
            "title": raw_data.get("title", raw_data.get("name", "")),
            "description": raw_data.get("description", ""),
            "owner_id": str(owner.get("id", "")) if isinstance(owner, dict) else "",
            "owner_name": owner.get("name", "") if isinstance(owner, dict) else "",
            "status": raw_data.get("status", ""),
            "progress": raw_data.get("percentComplete", raw_data.get("progress", 0)),
            "due_date": self._parse_date(raw_data.get("dueDate")),
            "created_at": self._parse_date(raw_data.get("createdAt")),
            "source_system": "lattice",
            "raw_data": raw_data,
        }

    def _parse_date(self, date_str: Any) -> Optional[str]:
        """Parse a date string, returning ISO format or None."""
        if not date_str:
            return None
        if isinstance(date_str, str):
            try:
                # Try ISO format
                dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                return dt.isoformat()
            except (ValueError, TypeError):
                return date_str
        return None

    def _fetch_employees_paginated(
        self, since: Optional[datetime] = None, page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """Fetch all employees from Lattice with pagination."""
        all_employees = []
        starting_after = None

        while True:
            params: Dict[str, Any] = {"limit": page_size}
            if starting_after:
                params["startingAfter"] = starting_after
            if since:
                params["updatedAfter"] = since.isoformat()

            response = self._make_request(
                "GET",
                "/users",
                params=params,
            )

            if not response or not isinstance(response, dict):
                break

            data = response.get("data", [])
            all_employees.extend(data)

            # Lattice uses cursor-based pagination
            if response.get("hasMore") and data:
                starting_after = data[-1].get("id")
            else:
                break

        return all_employees

    def _fetch_candidates_paginated(
        self, since: Optional[datetime] = None, page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """Not applicable for Lattice."""
        return []

    def _fetch_reviews_paginated(
        self, since: Optional[datetime] = None, page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """Fetch performance reviews from Lattice with pagination."""
        all_reviews = []
        starting_after = None

        while True:
            params: Dict[str, Any] = {"limit": page_size}
            if starting_after:
                params["startingAfter"] = starting_after
            if since:
                params["updatedAfter"] = since.isoformat()

            response = self._make_request(
                "GET",
                "/reviews",
                params=params,
            )

            if not response or not isinstance(response, dict):
                break

            data = response.get("data", [])
            all_reviews.extend(data)

            if response.get("hasMore") and data:
                starting_after = data[-1].get("id")
            else:
                break

        return all_reviews

    def _fetch_goals_paginated(
        self, since: Optional[datetime] = None, page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """Fetch goals from Lattice with pagination."""
        all_goals = []
        starting_after = None

        while True:
            params: Dict[str, Any] = {"limit": page_size}
            if starting_after:
                params["startingAfter"] = starting_after

            response = self._make_request(
                "GET",
                "/goals",
                params=params,
            )

            if not response or not isinstance(response, dict):
                break

            data = response.get("data", [])
            all_goals.extend(data)

            if response.get("hasMore") and data:
                starting_after = data[-1].get("id")
            else:
                break

        return all_goals

    def fetch_employees(
        self, since: Optional[datetime] = None, page_size: int = 100
    ) -> SyncResult:
        """Fetch employees from Lattice."""
        result = SyncResult(success=False)

        try:
            raw_employees = self._fetch_employees_paginated(since, page_size)
            result.data = [self.transform_employee(emp) for emp in raw_employees]
            result.records_fetched = len(result.data)
            result.success = True
        except Exception as e:
            result.errors.append(str(e))

        return result

    def sync_reviews(self, since: Optional[datetime] = None) -> SyncResult:
        """Sync performance reviews from Lattice."""
        result = SyncResult(success=False)

        try:
            raw_reviews = self._fetch_reviews_paginated(since)
            result.data = [self.transform_review(r) for r in raw_reviews]
            result.records_fetched = len(result.data)
            result.success = True
        except Exception as e:
            result.errors.append(str(e))

        return result

    def sync_goals(self, since: Optional[datetime] = None) -> SyncResult:
        """Sync goals from Lattice."""
        result = SyncResult(success=False)

        try:
            raw_goals = self._fetch_goals_paginated(since)
            result.data = [self.transform_goal(g) for g in raw_goals]
            result.records_fetched = len(result.data)
            result.success = True
        except Exception as e:
            result.errors.append(str(e))

        return result

    def test_connection(self) -> tuple[bool, str]:
        """Test Lattice API connection."""
        try:
            response = self._make_request(
                "GET",
                "/users",
                params={"limit": 1},
            )
            if response is not None:
                return True, "Successfully connected to Lattice"
            return False, "Unable to connect to Lattice API"
        except Exception as e:
            return False, f"Connection failed: {str(e)}"
