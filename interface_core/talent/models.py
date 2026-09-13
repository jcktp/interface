from datetime import date
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel,ConfigDict,Field,model_validator

class TalentInput(BaseModel):
    model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
    recruiter: str=Field(default='',max_length=120)
    hiring_manager: str=Field(default='',max_length=120)
    source: str=Field(default='',max_length=160)
    job_id: str=Field(default='',max_length=160)
    job_title: str=Field(default='',max_length=120)
    location: str=Field(default='',max_length=120)
    applied_date: date | None=None
    hired_date: date | None=None
    quality_score: Decimal | None=Field(default=None,ge=0,le=100,decimal_places=2)
    assessed_on: date | None=None
    score_basis: str=Field(default='',max_length=1000)
    performance_rating: Decimal | None=Field(default=None,ge=1,le=5,decimal_places=2)
    engagement_score: Decimal | None=Field(default=None,ge=0,le=100,decimal_places=2)
    cost_per_hire: Decimal | None=Field(default=None,ge=0,max_digits=12,decimal_places=2)
    currency: Literal['EUR','USD','GBP']='EUR'
    version: int=Field(default=0,ge=0)

    @model_validator(mode='after')
    def valid(self):
        if self.applied_date and self.hired_date and self.hired_date<self.applied_date:raise ValueError('Hiring decision cannot precede application date')
        if self.quality_score is not None and (not self.assessed_on or not self.score_basis):raise ValueError('Quality score needs assessment date and scoring basis')
        if self.assessed_on and self.assessed_on>date.today():raise ValueError('Assessment date cannot be in the future')
        return self

class CSVPreview(BaseModel):
    model_config=ConfigDict(extra='forbid')
    content: str=Field(max_length=2_000_000)
    mapping: dict[str,str]=Field(default_factory=dict)
    mode: Literal['create_only','upsert']='create_only'

class HireAccept(BaseModel):
    model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
    name: str=Field(min_length=1,max_length=120)
    email: str=Field(min_length=3,max_length=254)
    hire_date: date
    hired_date: date | None=None
    department: str=Field(default='',max_length=120)
    recruiter: str=Field(default='',max_length=120)
    version: int=Field(ge=1)
