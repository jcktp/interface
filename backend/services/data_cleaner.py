"""
Data Cleaning Service

Provides comprehensive data cleaning and validation
for HR data imports (CSV, Excel).

Features:
- Automatic type detection
- Missing value handling
- Date standardization
- Email validation
- Duplicate removal
- Column name normalization
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
import re
from datetime import datetime


class DataCleaner:
    """
    Comprehensive data cleaning for HR datasets.

    Supports:
    - Employee data
    - Candidate data
    - Requisition data
    - Custom datasets
    """

    def __init__(self):
        self.changes_log = []
        self.quality_report = {}

        # Standard column mappings
        self.column_mappings = {
            'first name': 'first_name',
            'firstname': 'first_name',
            'last name': 'last_name',
            'lastname': 'last_name',
            'employee id': 'employee_id',
            'employeeid': 'employee_id',
            'emp id': 'employee_id',
            'hire date': 'hire_date',
            'hiredate': 'hire_date',
            'start date': 'hire_date',
            'termination date': 'termination_date',
            'term date': 'termination_date',
            'job title': 'job_title',
            'jobtitle': 'job_title',
            'position': 'job_title',
            'dept': 'department',
        }

        # Department standardization
        self.department_mappings = {
            'eng': 'Engineering',
            'engineering': 'Engineering',
            'tech': 'Engineering',
            'product': 'Product',
            'pm': 'Product',
            'design': 'Design',
            'ux': 'Design',
            'ui': 'Design',
            'marketing': 'Marketing',
            'mktg': 'Marketing',
            'sales': 'Sales',
            'hr': 'Human Resources',
            'human resources': 'Human Resources',
            'people': 'Human Resources',
            'finance': 'Finance',
            'fin': 'Finance',
            'accounting': 'Finance',
            'ops': 'Operations',
            'operations': 'Operations',
            'legal': 'Legal',
            'cs': 'Customer Success',
            'customer success': 'Customer Success',
            'support': 'Customer Success',
        }

    def clean(
        self,
        df: pd.DataFrame,
        rules: Optional[List[str]] = None
    ) -> pd.DataFrame:
        """
        Apply cleaning rules to DataFrame.

        Args:
            df: Input DataFrame
            rules: List of rules to apply (applies all if None)

        Returns:
            Cleaned DataFrame
        """
        self.changes_log = []
        cleaned = df.copy()

        # Default rules
        default_rules = [
            'normalize_columns',
            'trim_whitespace',
            'lowercase_emails',
            'standardize_dates',
            'standardize_departments',
            'remove_duplicates',
            'handle_missing',
            'validate_data'
        ]

        rules_to_apply = rules or default_rules

        for rule in rules_to_apply:
            if rule == 'normalize_columns':
                cleaned = self._normalize_columns(cleaned)
            elif rule == 'trim_whitespace':
                cleaned = self._trim_whitespace(cleaned)
            elif rule == 'lowercase_emails':
                cleaned = self._lowercase_emails(cleaned)
            elif rule == 'standardize_dates':
                cleaned = self._standardize_dates(cleaned)
            elif rule == 'standardize_departments':
                cleaned = self._standardize_departments(cleaned)
            elif rule == 'remove_duplicates':
                cleaned = self._remove_duplicates(cleaned)
            elif rule == 'handle_missing':
                cleaned = self._handle_missing(cleaned)
            elif rule == 'validate_data':
                cleaned = self._validate_data(cleaned)
            elif rule == 'remove_special_chars':
                cleaned = self._remove_special_chars(cleaned)

        return cleaned

    def _normalize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Normalize column names to snake_case"""
        original_cols = df.columns.tolist()

        # Convert to lowercase and replace spaces/special chars
        new_cols = []
        for col in df.columns:
            new_col = col.lower().strip()
            new_col = re.sub(r'[^\w\s]', '', new_col)
            new_col = re.sub(r'\s+', '_', new_col)

            # Apply standard mappings
            if new_col in self.column_mappings:
                new_col = self.column_mappings[new_col]

            new_cols.append(new_col)

        df.columns = new_cols

        changed = sum(1 for o, n in zip(original_cols, new_cols) if o != n)
        if changed > 0:
            self.changes_log.append(f"Normalized {changed} column names")

        return df

    def _trim_whitespace(self, df: pd.DataFrame) -> pd.DataFrame:
        """Remove leading/trailing whitespace from string columns"""
        string_cols = df.select_dtypes(include=['object']).columns
        for col in string_cols:
            df[col] = df[col].apply(lambda x: x.strip() if isinstance(x, str) else x)

        self.changes_log.append(f"Trimmed whitespace in {len(string_cols)} columns")
        return df

    def _lowercase_emails(self, df: pd.DataFrame) -> pd.DataFrame:
        """Convert email columns to lowercase"""
        email_cols = [col for col in df.columns if 'email' in col.lower()]

        for col in email_cols:
            original = df[col].copy()
            df[col] = df[col].apply(lambda x: x.lower() if isinstance(x, str) else x)
            changed = (original != df[col]).sum()
            if changed > 0:
                self.changes_log.append(f"Lowercased {changed} emails in {col}")

        return df

    def _standardize_dates(self, df: pd.DataFrame) -> pd.DataFrame:
        """Convert date columns to standard format"""
        date_cols = [col for col in df.columns if 'date' in col.lower()]

        for col in date_cols:
            try:
                df[col] = pd.to_datetime(df[col], errors='coerce')
                df[col] = df[col].dt.strftime('%Y-%m-%d')
                self.changes_log.append(f"Standardized dates in {col}")
            except Exception:
                pass

        return df

    def _standardize_departments(self, df: pd.DataFrame) -> pd.DataFrame:
        """Standardize department names"""
        if 'department' not in df.columns:
            return df

        original = df['department'].copy()

        def standardize(dept):
            if not isinstance(dept, str):
                return dept
            dept_lower = dept.lower().strip()
            return self.department_mappings.get(dept_lower, dept.title())

        df['department'] = df['department'].apply(standardize)
        changed = (original != df['department']).sum()

        if changed > 0:
            self.changes_log.append(f"Standardized {changed} department names")

        return df

    def _remove_duplicates(self, df: pd.DataFrame) -> pd.DataFrame:
        """Remove duplicate rows"""
        original_count = len(df)

        # Identify ID column
        id_cols = ['employee_id', 'id', 'emp_id', 'candidate_id']
        id_col = next((col for col in id_cols if col in df.columns), None)

        if id_col:
            df = df.drop_duplicates(subset=[id_col], keep='first')
        else:
            df = df.drop_duplicates(keep='first')

        removed = original_count - len(df)
        if removed > 0:
            self.changes_log.append(f"Removed {removed} duplicate rows")

        return df

    def _handle_missing(self, df: pd.DataFrame) -> pd.DataFrame:
        """Handle missing values"""
        # Count missing before
        missing_before = df.isnull().sum().sum()

        # Numeric columns: fill with median
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            median_val = df[col].median()
            df[col] = df[col].fillna(median_val)

        # String columns: fill with 'Unknown' or empty
        string_cols = df.select_dtypes(include=['object']).columns
        for col in string_cols:
            if 'name' in col.lower() or 'email' in col.lower():
                continue  # Don't fill name/email fields
            df[col] = df[col].fillna('')

        missing_after = df.isnull().sum().sum()
        filled = missing_before - missing_after

        if filled > 0:
            self.changes_log.append(f"Filled {filled} missing values")

        return df

    def _validate_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Validate and clean data values"""
        # Validate emails
        if 'email' in df.columns:
            email_pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
            invalid_emails = ~df['email'].str.match(email_pattern, na=False)
            invalid_count = invalid_emails.sum()
            if invalid_count > 0:
                self.changes_log.append(f"Found {invalid_count} invalid emails")

        # Validate salary (positive numbers)
        if 'salary' in df.columns:
            df['salary'] = pd.to_numeric(df['salary'], errors='coerce')
            df.loc[df['salary'] < 0, 'salary'] = np.nan

        # Validate ratings (0-5 range)
        rating_cols = [col for col in df.columns if 'rating' in col.lower() or 'score' in col.lower()]
        for col in rating_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            df.loc[df[col] < 0, col] = np.nan
            df.loc[df[col] > 5, col] = 5

        return df

    def _remove_special_chars(self, df: pd.DataFrame) -> pd.DataFrame:
        """Remove non-printable and special characters"""
        string_cols = df.select_dtypes(include=['object']).columns

        for col in string_cols:
            if col in ['email', 'phone']:
                continue
            df[col] = df[col].apply(
                lambda x: re.sub(r'[^\x20-\x7E]', '', str(x)) if isinstance(x, str) else x
            )

        self.changes_log.append("Removed special characters")
        return df

    def get_changes_log(self) -> List[str]:
        """Return log of changes made"""
        return self.changes_log

    def get_quality_report(
        self,
        original_df: pd.DataFrame,
        cleaned_df: pd.DataFrame
    ) -> Dict[str, Any]:
        """Generate data quality report"""
        return {
            'original_rows': len(original_df),
            'cleaned_rows': len(cleaned_df),
            'rows_removed': len(original_df) - len(cleaned_df),
            'original_columns': len(original_df.columns),
            'cleaned_columns': len(cleaned_df.columns),
            'missing_values_before': int(original_df.isnull().sum().sum()),
            'missing_values_after': int(cleaned_df.isnull().sum().sum()),
            'changes_made': self.changes_log,
            'completeness_score': round((1 - cleaned_df.isnull().sum().sum() / cleaned_df.size) * 100, 1)
        }
