from datetime import date
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class EmploymentInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    hire_date: date
    end_date: date | None = None
    previous_company: str = Field(default='', max_length=160)
    version: int = Field(default=0, ge=0)

    @model_validator(mode='after')
    def dates(self):
        if self.end_date and self.end_date < self.hire_date:
            raise ValueError('End date cannot precede hire date')
        return self


Currency = Literal['EUR', 'USD', 'GBP']  # Explicit two-decimal currencies in this release.


class FinanceInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    start_date: date
    end_date: date
    currency: Currency = 'EUR'
    revenue: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    profit: Decimal = Field(max_digits=14, decimal_places=2)

    @model_validator(mode='after')
    def dates(self):
        if self.end_date < self.start_date:
            raise ValueError('End date cannot precede start date')
        return self


class PlanInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=120)
    target_headcount: int = Field(ge=0, le=1000000)
    annual_cost_per_employee: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    months: int = Field(ge=1, le=60)
    currency: Currency = 'EUR'


class FinanceUpdate(FinanceInput):
    version: int = Field(ge=1)


class PlanUpdate(PlanInput):
    version: int = Field(ge=1)
