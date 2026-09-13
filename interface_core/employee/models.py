from datetime import date
from decimal import Decimal
from typing import Literal
import re
from pydantic import BaseModel, ConfigDict, Field, model_validator, field_validator

class Versioned(BaseModel):
    model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
    version: int=Field(default=0,ge=0)

class PersonalDetails(Versioned):
    phone: str=Field(default='',max_length=40)
    personal_email: str=Field(default='',max_length=254)
    address: str=Field(default='',max_length=500)
    date_of_birth: date | None=None
    emergency_name: str=Field(default='',max_length=120)
    emergency_relationship: str=Field(default='',max_length=80)
    emergency_phone: str=Field(default='',max_length=40)

    @model_validator(mode='after')
    def valid(self):
        if self.date_of_birth and self.date_of_birth>date.today(): raise ValueError('Birth date cannot be in the future')
        if self.personal_email and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',self.personal_email): raise ValueError('Enter a valid personal email')
        if bool(self.emergency_name)!=bool(self.emergency_phone): raise ValueError('Emergency contact needs both name and phone')
        return self

class BankDetails(Versioned):
    holder: str=Field(min_length=1,max_length=120)
    account_number: str=Field(min_length=5,max_length=34)
    bank_name: str=Field(min_length=1,max_length=120)
    format: Literal['iban','local']='iban'
    routing_code: str=Field(default='',max_length=40)

    @field_validator('account_number')
    @classmethod
    def normalize(cls,value):
        value=re.sub(r'\s','',value).upper()
        if not re.fullmatch(r'[A-Z0-9]{5,34}',value): raise ValueError('Use letters and digits only')
        return value

    @model_validator(mode='after')
    def valid(self):
        if self.format=='iban':
            number=self.account_number
            if not re.fullmatch(r'[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}',number): raise ValueError('Enter a valid IBAN')
            digits=''.join(str(ord(c)-55) if c.isalpha() else c for c in number[4:]+number[:4])
            if int(digits)%97!=1: raise ValueError('IBAN checksum is invalid')
        elif not self.routing_code: raise ValueError('Local accounts require a routing code')
        return self

class ContractDetails(Versioned):
    contract_type: Literal['permanent','fixed_term','contractor','internship']='permanent'
    weekly_hours: Decimal=Field(ge=0,le=80,decimal_places=2)
    annual_salary: Decimal=Field(ge=0,max_digits=14,decimal_places=2)
    currency: Literal['EUR','USD','GBP']='EUR'
    effective_date: date
    end_date: date | None=None
    probation_end: date | None=None
    notice_period: str=Field(default='',max_length=120)
    manager: str=Field(default='',max_length=120)
    location: str=Field(default='',max_length=120)
    terms: str=Field(default='',max_length=4000)

    @model_validator(mode='after')
    def valid(self):
        if self.end_date and self.end_date<self.effective_date: raise ValueError('Contract end precedes effective date')
        if self.probation_end and self.probation_end<self.effective_date: raise ValueError('Probation end precedes effective date')
        return self

class Allowance(Versioned):
    year: int=Field(ge=2000,le=2200)
    days: int=Field(ge=0,le=366)
