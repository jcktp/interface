"""
Base provider class for HRIS/ATS integrations
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential


@dataclass
class SyncResult:
    """Result of a sync operation"""
    success: bool
    records_fetched: int = 0
    records_created: int = 0
    records_updated: int = 0
    records_failed: int = 0
    errors: List[str] = None
    data: List[Dict[str, Any]] = None

    def __post_init__(self):
        if self.errors is None:
            self.errors = []
        if self.data is None:
            self.data = []


@dataclass
class ConnectionConfig:
    """Configuration for API connection"""
    provider: str
    api_key: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    endpoint_url: Optional[str] = None
    subdomain: Optional[str] = None
    extra_config: Optional[Dict[str, Any]] = None


class BaseProvider(ABC):
    """
    Abstract base class for HRIS/ATS provider integrations.

    Each provider implementation handles:
    - Authentication (API key, OAuth, etc.)
    - Data fetching with pagination
    - Data transformation to standard format
    - Error handling and retries
    """

    def __init__(self, config: ConnectionConfig):
        self.config = config
        self.client = httpx.Client(timeout=30.0)
        self._access_token = config.access_token
        self._token_expires_at: Optional[datetime] = None

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Provider identifier"""
        pass

    @property
    @abstractmethod
    def base_url(self) -> str:
        """Base API URL"""
        pass

    @property
    @abstractmethod
    def supported_data_types(self) -> List[str]:
        """List of supported data types (employees, candidates, jobs, etc.)"""
        pass

    @abstractmethod
    def get_auth_headers(self) -> Dict[str, str]:
        """Get authentication headers for API requests"""
        pass

    @abstractmethod
    def transform_employee(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform provider-specific employee data to standard format"""
        pass

    @abstractmethod
    def transform_candidate(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform provider-specific candidate data to standard format"""
        pass

    def transform_job(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform provider-specific job data to standard format"""
        return raw_data

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict] = None,
        json_data: Optional[Dict] = None
    ) -> httpx.Response:
        """Make an authenticated API request with retry logic"""
        url = f"{self.base_url}{endpoint}"
        headers = self.get_auth_headers()

        response = self.client.request(
            method=method,
            url=url,
            headers=headers,
            params=params,
            json=json_data
        )
        response.raise_for_status()
        return response

    def fetch_employees(
        self,
        since: Optional[datetime] = None,
        page_size: int = 100
    ) -> SyncResult:
        """
        Fetch employees from the provider.
        Override in subclass if pagination differs.
        """
        result = SyncResult(success=False)

        try:
            employees = self._fetch_employees_paginated(since, page_size)
            result.data = [self.transform_employee(emp) for emp in employees]
            result.records_fetched = len(result.data)
            result.success = True
        except Exception as e:
            result.errors.append(str(e))

        return result

    def _fetch_employees_paginated(
        self,
        since: Optional[datetime] = None,
        page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """Fetch all employees with pagination. Override in subclass."""
        raise NotImplementedError("Subclass must implement _fetch_employees_paginated")

    def fetch_candidates(
        self,
        since: Optional[datetime] = None,
        page_size: int = 100
    ) -> SyncResult:
        """Fetch candidates from the provider."""
        result = SyncResult(success=False)

        try:
            candidates = self._fetch_candidates_paginated(since, page_size)
            result.data = [self.transform_candidate(c) for c in candidates]
            result.records_fetched = len(result.data)
            result.success = True
        except Exception as e:
            result.errors.append(str(e))

        return result

    def _fetch_candidates_paginated(
        self,
        since: Optional[datetime] = None,
        page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """Fetch all candidates with pagination. Override in subclass."""
        raise NotImplementedError("Subclass must implement _fetch_candidates_paginated")

    def fetch_jobs(
        self,
        since: Optional[datetime] = None,
        page_size: int = 100
    ) -> SyncResult:
        """Fetch job requisitions from the provider."""
        result = SyncResult(success=False)

        try:
            jobs = self._fetch_jobs_paginated(since, page_size)
            result.data = [self.transform_job(j) for j in jobs]
            result.records_fetched = len(result.data)
            result.success = True
        except Exception as e:
            result.errors.append(str(e))

        return result

    def _fetch_jobs_paginated(
        self,
        since: Optional[datetime] = None,
        page_size: int = 100
    ) -> List[Dict[str, Any]]:
        """Fetch all jobs with pagination. Override in subclass."""
        raise NotImplementedError("Subclass must implement _fetch_jobs_paginated")

    def test_connection(self) -> bool:
        """Test if the connection is valid"""
        try:
            self._make_request("GET", self._test_endpoint)
            return True
        except Exception:
            return False

    @property
    def _test_endpoint(self) -> str:
        """Endpoint to use for testing connection"""
        return "/me"

    def close(self):
        """Close the HTTP client"""
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
