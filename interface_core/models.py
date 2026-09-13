"""Explicit public directory contracts; no private HR data."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class PersonInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    title: str = Field(default="", max_length=120)
    department: str = Field(default="", max_length=120)
    preferred_name: str = Field(default="", max_length=120)
    status: Literal["active", "inactive"] = "active"

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return value.lower()


class PersonUpdate(PersonInput):
    version: int = Field(ge=1)


class Person(PersonUpdate):
    id: str
    created_at: str
    updated_at: str


class PeoplePage(BaseModel):
    items: list[Person]
    total: int
    limit: int
    offset: int


class SelfProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    preferred_name: str = Field(max_length=120)
    version: int = Field(ge=1)
