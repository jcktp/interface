"""
BambooHR Integration Provider

BambooHR API Documentation: https://documentation.bamboohr.com/reference
Authentication: API Key (Basic Auth with API key as username)
"""

import base64
from typing import Dict, List, Any, Optional
from datetime import datetime, date

from ..provider_base import BaseProvider, ConnectionConfig, SyncResult


class BambooHRProvider(BaseProvider):
    """
    BambooHR HRIS Integration

    Supports:
    - Employee data (directory, details, custom fields)
    - Time off requests
    - Job information
    - Reports

    Authentication: API Key (Basic Auth format)
    Rate Limits: Generally permissive, but respect 429 responses
    """

    @property
    def provider_name(self) -> str:
        return "bamboohr"

    @property
    def base_url(self) -> str:
        subdomain = self.config.subdomain or self.config.extra_config.get("subdomain", "")
        return f"https://api.bamboohr.com/api/gateway.php/{subdomain}/v1"

    @property
    def supported_data_types(self) -> List[str]:
        return ["employees", "time_off", "job_info"]

    @property
    def _test_endpoint(self) -> str:
        return "/employees/directory"

    def get_auth_headers(self) -> Dict[str, str]:
        """BambooHR uses Basic Auth with API key as username"""
        api_key = self.config.api_key or ""
        credentials = base64.b64encode(f"{api_key}:x".encode()).decode()
        return {
            "Authorization": f"Basic {credentials}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }

    def _fetch_employees_paginated(
        self,
        since: Optional[datetime] = None,
        page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Fetch all employees from BambooHR.
        BambooHR returns all employees in a single request via the directory endpoint.
        """
        # Get employee directory (basic info for all employees)
        response = self._make_request("GET", "/employees/directory")
        directory = response.json()

        employees = directory.get("employees", [])

        # Optionally fetch detailed info for each employee
        detailed_employees = []
        for emp in employees:
            emp_id = emp.get("id")
            if emp_id:
                try:
                    # Fetch detailed employee data with all fields
                    detail_response = self._make_request(
                        "GET",
                        f"/employees/{emp_id}",
                        params={"fields": ",".join(self._employee_fields)}
                    )
                    detailed_employees.append(detail_response.json())
                except Exception:
                    # Fall back to directory data if detail fetch fails
                    detailed_employees.append(emp)

        return detailed_employees

    @property
    def _employee_fields(self) -> List[str]:
        """Standard fields to fetch for each employee"""
        return [
            "id", "employeeNumber", "firstName", "lastName", "displayName",
            "email", "workEmail", "workPhone", "mobilePhone",
            "department", "division", "jobTitle", "supervisor",
            "location", "hireDate", "terminationDate", "status",
            "payRate", "payType", "payPeriod",
            "dateOfBirth", "age", "gender", "ethnicity",
            "customPerformanceRating", "customEngagementScore"
        ]

    def transform_employee(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform BambooHR employee data to standard format"""

        def parse_date(date_str: Optional[str]) -> Optional[date]:
            if not date_str:
                return None
            try:
                return datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                return None

        def parse_salary(pay_rate: Any) -> Optional[float]:
            if pay_rate is None:
                return None
            try:
                # Remove currency symbols and commas
                cleaned = str(pay_rate).replace("$", "").replace(",", "").strip()
                return float(cleaned) if cleaned else None
            except ValueError:
                return None

        hire_date = parse_date(raw_data.get("hireDate"))
        tenure = None
        if hire_date:
            tenure = round((date.today() - hire_date).days / 365.25, 2)

        # Map status
        status_map = {
            "Active": "active",
            "Inactive": "terminated",
            "Leave": "on_leave"
        }
        status = status_map.get(raw_data.get("status", "Active"), "active")

        return {
            "employee_id": raw_data.get("employeeNumber") or str(raw_data.get("id")),
            "first_name": raw_data.get("firstName", ""),
            "last_name": raw_data.get("lastName", ""),
            "email": raw_data.get("workEmail") or raw_data.get("email", ""),
            "phone": raw_data.get("workPhone") or raw_data.get("mobilePhone"),
            "department": raw_data.get("department", ""),
            "job_title": raw_data.get("jobTitle", ""),
            "location": raw_data.get("location", ""),
            "status": status,
            "hire_date": hire_date,
            "termination_date": parse_date(raw_data.get("terminationDate")),
            "salary": parse_salary(raw_data.get("payRate")),
            "age": raw_data.get("age"),
            "gender": raw_data.get("gender"),
            "ethnicity": raw_data.get("ethnicity"),
            "tenure": tenure,
            "performance_rating": raw_data.get("customPerformanceRating"),
            "engagement_score": raw_data.get("customEngagementScore"),
            "source_system": "bamboohr",
            "external_id": str(raw_data.get("id")),
            "raw_data": raw_data
        }

    def transform_candidate(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """BambooHR is primarily HRIS, limited ATS functionality"""
        return {
            "first_name": raw_data.get("firstName", ""),
            "last_name": raw_data.get("lastName", ""),
            "email": raw_data.get("email", ""),
            "source_system": "bamboohr",
            "external_id": str(raw_data.get("id")),
            "raw_data": raw_data
        }

    def _fetch_candidates_paginated(
        self,
        since: Optional[datetime] = None,
        page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """BambooHR has limited ATS - returns empty for now"""
        # BambooHR's ATS module is separate and may not be available
        return []

    def _fetch_jobs_paginated(
        self,
        since: Optional[datetime] = None,
        page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """Fetch job listings if ATS module is enabled"""
        try:
            response = self._make_request("GET", "/applicant_tracking/jobs")
            return response.json().get("jobs", [])
        except Exception:
            return []
