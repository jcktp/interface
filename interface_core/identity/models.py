from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, SecretStr


class AccountCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    person_id: str
    role: Literal["admin", "employee"] = "employee"
    password: SecretStr | None = Field(default=None, min_length=12, max_length=256)


class Login(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(max_length=254)
    password: SecretStr = Field(min_length=1, max_length=256)


class PasswordChange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_password: SecretStr = Field(min_length=1, max_length=256)
    new_password: SecretStr = Field(min_length=12, max_length=256)


class AccountState(BaseModel):
    model_config = ConfigDict(extra="forbid")
    active: bool
