from typing import Dict, List, Any, Optional
from datetime import datetime

from ..provider_base import BaseProvider, ConnectionConfig, SyncResult

class UKGProvider(BaseProvider):
    @property
    def provider_name(self) -> str:
        return "ukg"

    @property
    def base_url(self) -> str:
        return "https://api.ukg.com"

    @property
    def supported_data_types(self) -> List[str]:
        return ["employees"]

    def get_auth_headers(self) -> Dict[str, str]:
        return {}

    def transform_employee(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        return {}

    def transform_candidate(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        return {}

    def _fetch_employees_paginated(self, since: Optional[datetime] = None, page_size: int = 100) -> List[Dict[str, Any]]:
        return []

    def _fetch_candidates_paginated(self, since: Optional[datetime] = None, page_size: int = 100) -> List[Dict[str, Any]]:
        return []

    def _fetch_jobs_paginated(self, since: Optional[datetime] = None, page_size: int = 100) -> List[Dict[str, Any]]:
        return []
