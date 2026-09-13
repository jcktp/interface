from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class ConnectionInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=120)
    provider: Literal['slack', 'greenhouse']
    secret_env: str = Field(pattern=r'^INTERFACE_CONNECTOR_[A-Z0-9_]{1,80}$')
