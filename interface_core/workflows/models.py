from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class LeaveCreate(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    start_date: date
    end_date: date
    kind: Literal['annual', 'personal', 'sick'] = 'annual'
    note: str = Field(default='', max_length=1000)

    @model_validator(mode='after')
    def dates(self):
        if self.end_date < self.start_date or (self.end_date - self.start_date).days > 366:
            raise ValueError('Choose an ordered date range of at most 367 calendar days')
        return self


class LeaveTransition(BaseModel):
    model_config = ConfigDict(extra='forbid')
    action: Literal['approve', 'reject', 'cancel']
    version: int = Field(ge=1)


class TaskCreate(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    person_id: str
    title: str = Field(min_length=1, max_length=240)
    due_date: date


class TaskTransition(BaseModel):
    model_config = ConfigDict(extra='forbid')
    status: Literal['open', 'done']
    version: int = Field(ge=1)


class LeaveAmend(BaseModel):
    model_config=ConfigDict(extra="forbid")
    end_date: date
    version: int=Field(ge=1)
