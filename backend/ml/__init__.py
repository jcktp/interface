"""
ML Models for Interface

This module contains machine learning models for:
- Employee attrition prediction (XGBoost + Random Forest ensemble)
- Headcount forecasting (Prophet)
- Attrition rate forecasting (Hybrid ARIMA + XGBoost)
- Recruiter capacity modeling (XGBoost regression)
"""

from .attrition_model import AttritionPredictor
from .forecasting import HeadcountForecaster, AttritionForecaster
from .recruiter_capacity import RecruiterCapacityModel

__all__ = [
    'AttritionPredictor',
    'HeadcountForecaster',
    'AttritionForecaster',
    'RecruiterCapacityModel'
]
