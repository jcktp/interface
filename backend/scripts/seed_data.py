"""
Database seeding script for Interface
Generates realistic employee, candidate, requisition, KPI, attendance, alert,
recruiter goal, compensation, and planning data at scale.

Targets:
  - 4,500 total employees (~3,800 active, ~700 terminated) across a 2-year hire window
  - 60 recruiters (Junior/Mid/Senior/Lead) with multi-year goaling
  - 2,000+ candidates with realistic pipeline distribution
  - 500+ requisitions across departments and job levels
  - Proportional attendance, KPIs, alerts, compensation, and plans
"""

import csv
import os
import random
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional, Tuple
from uuid import uuid4
import uuid


# =============================================================================
# Constants
# =============================================================================

DEPARTMENTS = [
    'Engineering', 'Product', 'Design', 'Marketing', 'Sales',
    'Customer Success', 'HR', 'Finance', 'Operations',
]

# Department weights for realistic org distribution
DEPT_WEIGHTS = {
    'Engineering': 30,
    'Product': 10,
    'Design': 7,
    'Marketing': 10,
    'Sales': 18,
    'Customer Success': 8,
    'HR': 5,
    'Finance': 5,
    'Operations': 7,
}

LOCATIONS = [
    'New York', 'San Francisco', 'London', 'Berlin', 'Singapore',
    'Austin', 'Chicago', 'Remote',
]

# Updated job levels per user requirements
JOB_LEVELS = [
    'Junior', 'Mid', 'Senior', 'Staff', 'Principal',
    'Manager', 'Director', 'Executive',
]

# Realistic level distribution weights
JOB_LEVEL_WEIGHTS = [15, 25, 20, 10, 5, 12, 8, 5]

WORK_TYPES = ['remote', 'hybrid', 'onsite']

FIRST_NAMES = [
    'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
    'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
    'Thomas', 'Sarah', 'Charles', 'Karen', 'Aisha', 'Wei', 'Priya', 'Mohammed',
    'Yuki', 'Carlos', 'Fatima', 'Andrei', 'Sofia', 'Raj', 'Emma', 'Liam',
    'Olivia', 'Noah', 'Ava', 'Isabella', 'Sophia', 'Mia', 'Charlotte', 'Amelia',
    'Harper', 'Evelyn', 'Lucas', 'Mason', 'Ethan', 'Logan', 'Alexander', 'Sebastian',
    'Daniel', 'Matthew', 'Aaliyah', 'Kenji', 'Ingrid', 'Hassan', 'Nina', 'Viktor',
    'Mei', 'Omar', 'Zara', 'Diego', 'Leila', 'Marcus', 'Ananya', 'Felix',
    'Nadia', 'Tariq', 'Elena', 'Kofi', 'Sakura', 'Ivan', 'Luz', 'Arjun',
    'Freya', 'Chen', 'Amira', 'Dmitri', 'Yara', 'Hugo', 'Suki', 'Rafael',
    'Astrid', 'Ravi', 'Linnea', 'Jorge', 'Hana', 'Tobias', 'Dalia', 'Kwame',
    'Ines', 'Vikram', 'Rosa', 'Elias', 'Mira', 'Soren', 'Layla', 'Akira',
    'Celine', 'Mateo', 'Isla', 'Kai', 'Luna', 'Axel', 'Aria', 'Leo',
]

LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
    'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Patel', 'Kim',
    'Chen', 'Singh', 'Kumar', 'Yamamoto', 'Petrov', 'Muller', 'Santos',
    "O'Brien", 'Murphy', 'Kelly', 'Sullivan', 'Cohen', 'Goldstein', 'Rosenberg',
    'Ali', 'Khan', 'Nguyen', 'Park', 'Tanaka', 'Okafor', 'Schmidt', 'Johansson',
    'Costa', 'Ivanova', 'Nakamura', 'Fernandez', 'Bergman', 'Rashid', 'Larsson',
    'Bianchi', 'Osei', 'Kowalski', 'Ibrahim', 'Virtanen', 'Gao', 'Torres',
    'Sato', 'Dubois', 'Jensen', 'Novak', 'Mensah', 'Rios', 'Volkov', 'Aoki',
]

JOB_TITLES_BY_DEPT = {
    'Engineering': [
        'Software Engineer', 'Senior Software Engineer', 'Staff Engineer',
        'Principal Engineer', 'Engineering Manager', 'Director of Engineering',
        'VP of Engineering', 'DevOps Engineer', 'QA Engineer', 'Data Engineer',
        'ML Engineer', 'Frontend Engineer', 'Backend Engineer', 'SRE',
        'Platform Engineer', 'Security Engineer',
    ],
    'Product': [
        'Product Manager', 'Senior Product Manager', 'Staff Product Manager',
        'Director of Product', 'VP of Product', 'Product Analyst',
        'Technical Product Manager', 'Growth Product Manager',
    ],
    'Design': [
        'UI Designer', 'UX Designer', 'Senior Designer', 'Staff Designer',
        'Design Manager', 'Head of Design', 'Product Designer',
        'Visual Designer', 'UX Researcher', 'Design Systems Engineer',
    ],
    'Marketing': [
        'Marketing Manager', 'Marketing Specialist', 'Content Writer',
        'SEO Specialist', 'Growth Manager', 'CMO', 'Brand Manager',
        'Digital Marketing Manager', 'Marketing Analyst', 'Demand Gen Manager',
    ],
    'Sales': [
        'Sales Representative', 'Account Executive', 'Sales Manager',
        'VP of Sales', 'Business Development Rep', 'Sales Engineer',
        'Enterprise Account Executive', 'Sales Director', 'SDR Manager',
        'Regional Sales Manager',
    ],
    'Customer Success': [
        'Customer Success Manager', 'Support Specialist', 'Technical Support Engineer',
        'Head of Customer Success', 'Onboarding Specialist', 'CSM Director',
        'Solutions Architect', 'Customer Experience Manager',
    ],
    'HR': [
        'HR Specialist', 'HR Manager', 'Recruiter', 'Talent Acquisition Manager',
        'HR Business Partner', 'Chief People Officer', 'People Operations Manager',
        'L&D Specialist', 'Compensation Analyst', 'HR Director',
    ],
    'Finance': [
        'Financial Analyst', 'Senior Accountant', 'Finance Manager',
        'Controller', 'CFO', 'Payroll Specialist', 'FP&A Analyst',
        'Treasury Manager', 'Revenue Operations Analyst', 'Finance Director',
    ],
    'Operations': [
        'Operations Manager', 'Operations Analyst', 'Office Manager',
        'Facilities Manager', 'COO', 'Project Manager', 'Business Analyst',
        'Program Manager', 'Supply Chain Manager', 'Operations Director',
    ],
}

SOURCES = [
    'LinkedIn', 'Indeed', 'Referral', 'Company Website', 'Glassdoor',
    'Recruiting Agency', 'University', 'Job Fair', 'AngelList', 'Hired',
    'Stack Overflow', 'GitHub',
]

CANDIDATE_STATUSES = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected']

REJECTION_REASONS = [
    'Not a fit', 'Failed technical assessment', 'Withdrew application',
    'Better candidate selected', 'Salary expectations too high',
    'Insufficient experience', 'Role filled internally', 'No-show interview',
    'Culture mismatch', 'Failed background check',
]

TERMINATION_REASONS = [
    'Voluntary - New opportunity', 'Voluntary - Relocation',
    'Voluntary - Career change', 'Voluntary - Personal reasons',
    'Voluntary - Compensation', 'Voluntary - Work-life balance',
    'Involuntary - Performance', 'Involuntary - Restructuring',
    'Involuntary - Position eliminated', 'Retirement',
    'Voluntary - Return to school', 'Voluntary - Starting own business',
]

GENDERS = ['male', 'female', 'non_binary', 'prefer_not_to_say']
GENDER_WEIGHTS = [45, 45, 6, 4]

ETHNICITIES = [
    'White', 'Black', 'Hispanic', 'Asian', 'Middle Eastern',
    'Mixed', 'Other', 'Prefer not to say',
]
ETHNICITY_WEIGHTS = [35, 15, 18, 18, 4, 5, 2, 3]

NATIONALITIES = [
    'American', 'British', 'Canadian', 'German', 'French', 'Australian',
    'Indian', 'Chinese', 'Brazilian', 'Mexican', 'Japanese', 'South Korean',
    'Spanish', 'Italian', 'Dutch', 'Swedish', 'Norwegian', 'Danish',
    'Singaporean', 'Nigerian', 'South African', 'Irish', 'New Zealander',
    'Polish', 'Ukrainian', 'Russian', 'Israeli', 'Pakistani', 'Bangladeshi',
    'Filipino', 'Vietnamese', 'Thai', 'Indonesian', 'Egyptian', 'Moroccan',
]
NATIONALITY_WEIGHTS = [
    25, 10, 6, 5, 4, 4,
    8, 6, 3, 3, 2, 2,
    2, 2, 2, 1, 1, 1,
    2, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1,
]

EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Intern']
EMPLOYMENT_TYPE_WEIGHTS = [75, 8, 14, 3]

HIRE_SOURCES = [
    'LinkedIn', 'Referral', 'Indeed', 'Company Website', 'Glassdoor',
    'Recruiting Agency', 'University / Campus', 'Job Fair',
    'AngelList', 'Stack Overflow', 'Internal Transfer', 'Direct Application',
]
HIRE_SOURCE_WEIGHTS = [28, 18, 12, 8, 7, 8, 5, 3, 3, 2, 3, 3]

RECRUITER_SPECIALIZATIONS = [
    'Engineering', 'Sales', 'Executive', 'Design', 'Product',
    'Operations', 'Finance', 'Marketing', 'Customer Success', 'General',
]

DEPARTMENT_TEAMS = {
    'Engineering': ['Backend', 'Frontend', 'Infrastructure', 'Mobile', 'Data', 'Platform', 'QA'],
    'Product': ['Strategy', 'Growth', 'Platform', 'Core'],
    'Design': ['UX', 'Visual', 'Research'],
    'Marketing': ['Content', 'Growth', 'Brand', 'Demand Gen'],
    'Sales': ['Enterprise', 'Mid-Market', 'SMB', 'SDR'],
    'Customer Success': ['Onboarding', 'Support', 'Renewals'],
    'HR': ['Talent Acquisition', 'People Ops', 'L&D'],
    'Finance': ['FP&A', 'Accounting', 'Payroll'],
    'Operations': ['IT', 'Facilities', 'Security'],
}

DEPARTMENT_COST_CENTERS = {
    'Engineering': 'CC-ENG-100',
    'Product': 'CC-PRD-200',
    'Design': 'CC-DES-300',
    'Marketing': 'CC-MKT-400',
    'Sales': 'CC-SAL-500',
    'Customer Success': 'CC-CS-600',
    'HR': 'CC-HR-700',
    'Finance': 'CC-FIN-800',
    'Operations': 'CC-OPS-900',
}

PREVIOUS_COMPANIES = [
    'Google', 'Microsoft', 'Amazon', 'Meta', 'Apple', 'Netflix', 'Salesforce',
    'Oracle', 'IBM', 'SAP', 'Deloitte', 'McKinsey', 'Accenture', 'PwC', 'KPMG',
    'JPMorgan', 'Goldman Sachs', 'Uber', 'Airbnb', 'Stripe', 'Shopify', 'HubSpot',
    'Twilio', 'Datadog', 'Snowflake', 'Palantir', 'Coinbase', 'Robinhood', 'Square',
    'Zoom', 'Slack', 'Notion', 'Figma', 'Canva', 'Atlassian', 'ServiceNow', 'Workday',
    'Adobe', 'Intuit', 'VMware', 'Dell', 'HP', 'Cisco', 'Intel', 'Qualcomm', 'NVIDIA',
    'AMD', 'Tesla', 'SpaceX', 'Lockheed Martin',
    'ByteDance', 'Spotify', 'Twitter', 'LinkedIn', 'Snap',
    'Pinterest', 'Dropbox', 'Lyft', 'DoorDash', 'Instacart',
    'Databricks', 'Confluent', 'HashiCorp', 'Elastic', 'MongoDB',
    'CrowdStrike', 'Okta', 'Splunk', 'Palo Alto Networks', 'Fortinet',
    'Wayfair', 'Chewy', 'Etsy', 'eBay', 'PayPal',
    'Block', 'Plaid', 'Brex', 'Ramp', 'Gusto',
    'Rippling', 'Lattice', 'Greenhouse', 'Lever', 'BambooHR',
    'Toast', 'Procore', 'Veeva Systems', 'Coupa', 'Zuora',
]

REASONS_FOR_LEAVING = [
    'Better compensation package elsewhere', 'Career growth opportunity', 'Relocation',
    'Work-life balance concerns', 'Management issues', 'Company restructuring',
    'Contract ended', 'Return to school', 'Started own business',
    'Better role at competitor', 'Family reasons', 'Health reasons',
    'Seeking new challenges', 'Dissatisfied with company culture',
    'Remote work policy disagreement', 'Burnout', 'Industry change',
]


# =============================================================================
# Utility Functions
# =============================================================================

def random_date_in_range(start: date, end: date) -> date:
    """Generate a random date between start and end (inclusive)."""
    delta = (end - start).days
    if delta <= 0:
        return start
    return start + timedelta(days=random.randint(0, delta))


def random_date(start_days_ago: int, end_days_ago: int = 0) -> date:
    """Generate a random date between start_days_ago and end_days_ago."""
    days_ago = random.randint(end_days_ago, start_days_ago)
    return date.today() - timedelta(days=days_ago)


def generate_employee_id(index: int) -> str:
    """Generate a unique employee ID."""
    return f"EMP{str(index + 1).zfill(5)}"


def weighted_choice(items: list, weights: list):
    """Weighted random choice."""
    return random.choices(items, weights=weights, k=1)[0]


def calculate_salary(department: str, job_level: str, location: str) -> float:
    """Calculate realistic salary based on department, level, and location."""
    base_salaries = {
        'Junior': 55000, 'Mid': 75000, 'Senior': 100000, 'Staff': 130000,
        'Principal': 160000, 'Manager': 140000, 'Director': 180000, 'Executive': 250000,
    }

    dept_multipliers = {
        'Engineering': 1.2, 'Product': 1.15, 'Design': 1.05, 'Marketing': 1.0,
        'Sales': 1.1, 'Customer Success': 0.95, 'HR': 0.95, 'Finance': 1.1,
        'Operations': 0.9,
    }

    location_multipliers = {
        'San Francisco': 1.3, 'New York': 1.25, 'London': 1.15,
        'Berlin': 1.0, 'Singapore': 1.1, 'Austin': 1.05,
        'Chicago': 1.1, 'Remote': 1.0,
    }

    base = base_salaries.get(job_level, 75000)
    dept_mult = dept_multipliers.get(department, 1.0)
    loc_mult = location_multipliers.get(location, 1.0)

    salary = base * dept_mult * loc_mult
    salary *= random.uniform(0.85, 1.15)
    return round(salary, -2)


def calculate_flight_risk(tenure: float, performance: float,
                          engagement: float, last_promotion_days: int) -> str:
    """Calculate flight risk based on various factors."""
    risk_score = 0

    if tenure < 1:
        risk_score += 20
    elif 3 < tenure < 5:
        risk_score += 15
    elif tenure > 7:
        risk_score -= 10

    if performance < 3.0:
        risk_score += 25
    elif performance > 4.5:
        risk_score += 10

    if engagement < 3.0:
        risk_score += 30
    elif engagement < 3.5:
        risk_score += 15
    elif engagement > 4.5:
        risk_score -= 10

    if last_promotion_days > 730:
        risk_score += 20

    risk_score += random.randint(-10, 20)

    if risk_score > 60:
        return 'high'
    elif risk_score > 35:
        return 'medium'
    return 'low'


def _title_to_level(job_title: str) -> str:
    """Infer a job level from a title string."""
    lower = job_title.lower()
    if any(w in lower for w in ['chief', 'cmo', 'cfo', 'coo', 'cpo', 'vp ']):
        return 'Executive'
    if 'director' in lower or 'head of' in lower:
        return 'Director'
    if 'manager' in lower:
        return 'Manager'
    if 'principal' in lower:
        return 'Principal'
    if 'staff' in lower:
        return 'Staff'
    if any(w in lower for w in ['senior', 'sr.', 'lead']):
        return 'Senior'
    if any(w in lower for w in ['junior', 'jr.', 'specialist', 'rep',
                                 'analyst', 'coordinator', 'associate']):
        return 'Junior'
    return 'Mid'


# =============================================================================
# Employee Generator  (4,500 total, ~3,800 active)
# =============================================================================

def _weighted_hire_date(hire_start: date, hire_end: date) -> date:
    """Generate a hire date biased toward more recent dates within the window.

    Uses a beta distribution (alpha=2.5, beta=1.2) to skew toward more recent
    dates, simulating a growing company where most hires happened recently.
    """
    total_days = (hire_end - hire_start).days
    if total_days <= 0:
        return hire_start
    # Sample with exponential bias toward more recent dates
    # Using a beta distribution with alpha=2.5, beta=1.2 to skew toward recent
    r = random.betavariate(2.5, 1.2)
    day_offset = int(r * total_days)
    return hire_start + timedelta(days=day_offset)


def _make_employee(index: int, department: str, job_title: str, job_level: str,
                   organization_id: str, used_emails: set) -> Dict[str, Any]:
    """Create a single employee dict with common fields."""
    today = date.today()
    # 7-year timespan to support 2019 queries
    hire_start = date(today.year - 7, today.month, today.day)
    hire_end = today

    location = random.choice(LOCATIONS)
    hire_date = _weighted_hire_date(hire_start, hire_end)
    tenure = max(0.0, (today - hire_date).days / 365.25)

    # Attrition: Target ~15% termination
    attrition_prob = 0.18 # Slightly higher for longer period
    is_terminated = random.random() < attrition_prob
    is_on_leave = random.random() < 0.02 if not is_terminated else False

    termination_date = None
    termination_reason = None
    if is_terminated:
        days_since_hire = (today - hire_date).days
        if days_since_hire > 15:
            # Distribute terminations smoothly over the last ~24 months using
            # a gamma-like distribution biased toward 6-18 months ago.
            # This avoids extreme spikes and gives a natural-looking curve.
            max_days = min(days_since_hire - 15, 730)
            # Use a beta distribution: peak around 30-50% of the window
            raw = random.betavariate(2.0, 2.5) * max_days
            term_days_ago = max(0, int(raw))
            termination_date = today - timedelta(days=term_days_ago)
            termination_reason = random.choice(TERMINATION_REASONS)
        else:
            is_terminated = False

    status = 'terminated' if is_terminated else ('on_leave' if is_on_leave else 'active')

    # Balanced performance and engagement
    performance_rating = round(max(1.0, min(5.0, random.gauss(3.8, 0.8))), 1)
    engagement_score = round(max(1.0, min(5.0, random.gauss(3.9, 0.7))), 1)
    quality_of_hire_score = round(max(0.0, min(100.0, random.gauss(75.0, 15.0))), 1)

    last_promotion_date = None
    last_promotion_days = 9999
    if tenure > 0.5 and random.random() < 0.4:
        promo_days_ago = random.randint(30, min(int(tenure * 365), 1000))
        last_promotion_date = today - timedelta(days=promo_days_ago)
        last_promotion_days = promo_days_ago

    flight_risk = calculate_flight_risk(tenure, performance_rating,
                                        engagement_score, last_promotion_days)

    first_name = random.choice(FIRST_NAMES)
    last_name = random.choice(LAST_NAMES)

    base_email = f"{first_name.lower()}.{last_name.lower().replace(chr(39), '')}"
    email = f"{base_email}{random.randint(1, 99999)}@interface.app"
    while email in used_emails:
        email = f"{base_email}{random.randint(1, 99999)}@interface.app"
    used_emails.add(email)

    age = random.randint(22, 65)
    dob = date(today.year - age, random.randint(1, 12), random.randint(1, 28))

    team = random.choice(DEPARTMENT_TEAMS.get(department, ['General']))
    cost_center = DEPARTMENT_COST_CENTERS.get(department, 'CC-GEN-000')

    equity_shares = (
        random.randint(500, 5000)
        if job_level in ('Senior', 'Staff', 'Principal', 'Director', 'Executive', 'Manager')
        else 0
    )
    # Assume $10 per share for seed data value
    equity_value = equity_shares * 10.0

    employee = {
        'id': str(uuid.uuid4()),
        'employee_id': generate_employee_id(index),
        'first_name': first_name,
        'last_name': last_name,
        'email': email,
        'phone': f"+1-{random.randint(200, 999)}-{random.randint(100, 999)}-{random.randint(1000, 9999)}",
        'department': department,
        'team': team,
        'cost_center': cost_center,
        'job_title': job_title,
        'job_level': job_level,
        'manager_id': None,
        'hired_by_id': None, # Will be set during seeding
        'location': location,
        'work_type': random.choice(WORK_TYPES),
        'status': status,
        'hire_date': hire_date,
        'termination_date': termination_date,
        'termination_reason': termination_reason,
        'salary': calculate_salary(department, job_level, location),
        'currency': 'USD',
        'bonus_target': (
            random.choice([0, 5, 10, 15, 20])
            if job_level not in ('Junior', 'Mid')
            else random.choice([0, 5])
        ),
        'equity_grants': equity_shares, # Mapping equity_grants field to shares for legacy
        'equity_type': 'options' if equity_shares > 0 else None,
        'equity_shares': float(equity_shares),
        'equity_value': float(equity_value),
        'age': age,
        'gender': weighted_choice(GENDERS, GENDER_WEIGHTS),
        'ethnicity': weighted_choice(ETHNICITIES, ETHNICITY_WEIGHTS),
        'date_of_birth': dob,
        'performance_rating': performance_rating,
        'engagement_score': engagement_score,
        'quality_of_hire_score': quality_of_hire_score,
        'last_review_date': random_date(365, 30) if random.random() > 0.2 else None,
        'last_promotion_date': last_promotion_date,
        'training_hours': random.randint(0, 80),
        'tenure': round(tenure, 2),
        'flight_risk': flight_risk,
        'source_system': 'seed',
        'external_id': None,
        'nationality': weighted_choice(NATIONALITIES, NATIONALITY_WEIGHTS),
        'employment_type': weighted_choice(EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_WEIGHTS),
        'source': weighted_choice(HIRE_SOURCES, HIRE_SOURCE_WEIGHTS),
    }

    # --- New fields: previous_company, reason_for_leaving, quality_of_hire_score, cost_per_hire ---

    # Previous company - ALL employees came from somewhere before joining
    employee['previous_company'] = random.choice(PREVIOUS_COMPANIES)

    # Reason for leaving - populated for ALL terminated employees
    if is_terminated:
        employee['reason_for_leaving'] = random.choice(REASONS_FOR_LEAVING)
    else:
        employee['reason_for_leaving'] = None

    # Quality of hire score: ALWAYS populate for analysis
    # Tenure factor scaled for 2-year max
    qoh_base = 65 + (performance_rating * 5) + (engagement_score * 0.5)
    tenure_bonus = min(tenure * 10, 10)
    employee['quality_of_hire_score'] = min(round(qoh_base + tenure_bonus + random.uniform(-5, 5), 1), 100)

    # PTO & Bank Holidays
    total_pto = random.choice([20, 25, 30])
    employee['total_pto_days'] = float(total_pto)
    # Estimate used PTO based on tenure in current year
    days_this_year = min(365, (today - date(today.year, 1, 1)).days)
    if days_this_year > 0:
        pto_accrued = (total_pto / 365) * days_this_year
        employee['used_pto_days'] = round(random.uniform(0, pto_accrued), 1)
    else:
        employee['used_pto_days'] = 0.0
    
    employee['total_bank_holidays'] = 8.0
    employee['used_bank_holidays'] = float(random.randint(0, 8))

    # Equity Data
    if job_level in ('Senior', 'Staff', 'Principal', 'Director', 'Executive', 'Manager'):
        employee['equity_type'] = random.choice(['RSU', 'Options'])
        shares = random.randint(500, 10000)
        employee['equity_shares'] = float(shares)
        # Value between $10 and $150 per share
        employee['equity_value'] = float(shares * random.uniform(10, 150))
    else:
        employee['equity_type'] = None
        employee['equity_shares'] = 0.0
        employee['equity_value'] = 0.0

    # Cost per hire: randomized by job level
    cost_ranges = {
        'Junior': (3000, 8000),
        'Mid': (8000, 15000),
        'Senior': (12000, 25000),
        'Staff': (20000, 40000),
        'Principal': (20000, 40000),
        'Manager': (25000, 50000),
        'Director': (25000, 50000),
        'Executive': (50000, 100000),
    }
    cmin, cmax = cost_ranges.get(job_level, (8000, 15000))
    employee['cost_per_hire'] = round(random.uniform(cmin, cmax), 2)

    employee['nationality'] = weighted_choice(NATIONALITIES, NATIONALITY_WEIGHTS)
    employee['employment_type'] = weighted_choice(EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_WEIGHTS)
    employee['source'] = weighted_choice(HIRE_SOURCES, HIRE_SOURCE_WEIGHTS)

    if organization_id:
        employee['organization_id'] = organization_id

    return employee


def generate_employees(count: int = 4500,
                       organization_id: str = None) -> List[Dict[str, Any]]:
    """Generate realistic employee data across a 2-year hire window.

    Uses a realistic hierarchy per department:
      - 1-2 Executives (VP/SVP) per department
      - 3-5 Directors per department (report to an Executive)
      - Each Director gets 3-5 Manager direct reports
      - Each Manager gets 8-15 IC direct reports (Junior/Mid/Senior/Staff/Principal)

    ~15% of employees are terminated, targeting ~3,800 active out of 4,500 total.
    All employees have previous_company populated.
    Hire dates are weighted toward more recent dates (growing company pattern).
    """
    employees: List[Dict[str, Any]] = []
    used_emails: set = set()

    # Build weighted department list and calculate headcounts
    dept_names = list(DEPT_WEIGHTS.keys())
    total_weight = sum(DEPT_WEIGHTS[d] for d in dept_names)

    dept_headcounts: Dict[str, int] = {}
    remaining = count
    for i, dept in enumerate(dept_names):
        if i == len(dept_names) - 1:
            dept_headcounts[dept] = remaining
        else:
            hc = max(10, int(count * DEPT_WEIGHTS[dept] / total_weight))
            dept_headcounts[dept] = hc
            remaining -= hc

    emp_index = 0

    for department, dept_count in dept_headcounts.items():
        job_titles = JOB_TITLES_BY_DEPT[department]

        # Executive titles for this department
        exec_titles = [t for t in job_titles if _title_to_level(t) == 'Executive']
        if not exec_titles:
            exec_titles = [f'VP of {department}']
        dir_titles = [t for t in job_titles if _title_to_level(t) == 'Director']
        if not dir_titles:
            dir_titles = [f'{department} Director']
        mgr_titles = [t for t in job_titles if _title_to_level(t) == 'Manager']
        if not mgr_titles:
            mgr_titles = [f'{department} Manager']
        ic_titles = [t for t in job_titles if _title_to_level(t) in
                     ('Junior', 'Mid', 'Senior', 'Staff', 'Principal')]
        if not ic_titles:
            ic_titles = [t for t in job_titles if _title_to_level(t) not in
                         ('Executive', 'Director', 'Manager')]
        if not ic_titles:
            ic_titles = [f'{department} Specialist']

        # --- Step 1: Create Executives (1-2) ---
        num_execs = random.randint(1, 2)
        dept_execs: List[Dict[str, Any]] = []
        for _ in range(num_execs):
            title = random.choice(exec_titles)
            emp = _make_employee(emp_index, department, title, 'Executive',
                                 organization_id, used_emails)
            dept_execs.append(emp)
            employees.append(emp)
            emp_index += 1

        # --- Step 2: Create Directors (3-5), report to an Executive ---
        num_directors = random.randint(3, min(5, max(3, dept_count // 50)))
        dept_directors: List[Dict[str, Any]] = []
        for _ in range(num_directors):
            title = random.choice(dir_titles)
            emp = _make_employee(emp_index, department, title, 'Director',
                                 organization_id, used_emails)
            emp['manager_id'] = random.choice(dept_execs)['id']
            dept_directors.append(emp)
            employees.append(emp)
            emp_index += 1

        # --- Step 3: Create Managers (3-5 per Director), report to a Director ---
        dept_managers: List[Dict[str, Any]] = []
        mgrs_per_dir = random.randint(3, 5)
        for director in dept_directors:
            n_mgrs = random.randint(max(2, mgrs_per_dir - 1), mgrs_per_dir + 1)
            for _ in range(n_mgrs):
                title = random.choice(mgr_titles)
                emp = _make_employee(emp_index, department, title, 'Manager',
                                     organization_id, used_emails)
                emp['manager_id'] = director['id']
                dept_managers.append(emp)
                employees.append(emp)
                emp_index += 1

        # --- Step 4: Create ICs, distributed across Managers ---
        leadership_count = len(dept_execs) + len(dept_directors) + len(dept_managers)
        ic_count = max(0, dept_count - leadership_count)

        # Distribute ICs across managers for realistic span of control
        ic_level_weights = {
            'Junior': 15, 'Mid': 25, 'Senior': 20, 'Staff': 10, 'Principal': 5,
        }
        ic_levels = list(ic_level_weights.keys())
        ic_weights = [ic_level_weights[l] for l in ic_levels]

        for ic_i in range(ic_count):
            title = random.choice(ic_titles)
            level = _title_to_level(title)
            # If the title's level is leadership, override to a random IC level
            if level in ('Executive', 'Director', 'Manager'):
                level = weighted_choice(ic_levels, ic_weights)

            emp = _make_employee(emp_index, department, title, level,
                                 organization_id, used_emails)
            # Assign to a manager (round-robin with some randomness for 8-15 per mgr)
            if dept_managers:
                emp['manager_id'] = dept_managers[ic_i % len(dept_managers)]['id']
            elif dept_directors:
                emp['manager_id'] = random.choice(dept_directors)['id']
            employees.append(emp)
            emp_index += 1

    return employees


# =============================================================================
# Candidate Generator  (2,000+ with realistic pipeline)
# =============================================================================

def generate_candidates(count: int = 2000,
                        requisition_ids: List[str] = None,
                        organization_id: str = None) -> List[Dict[str, Any]]:
    """Generate realistic candidate data with pipeline distribution."""
    candidates: List[Dict[str, Any]] = []
    used_emails: set = set()

    # Pipeline weights: funnel shape
    status_weights = [25, 25, 20, 10, 8, 12]

    for i in range(count):
        department = random.choice(DEPARTMENTS)
        job_titles = JOB_TITLES_BY_DEPT[department]
        applied_position = random.choice(job_titles)

        # Applications spread over the last 6 months
        application_date = random_date(180, 0)

        status = weighted_choice(CANDIDATE_STATUSES, status_weights)
        source = random.choice(SOURCES)

        base_salary = random.randint(55000, 200000)
        expected_salary = base_salary
        offered_salary = None
        offer_date = None
        start_date = None
        rejection_reason = None
        rejection_date = None

        if status == 'new':
            stage = 'Applied'
        elif status == 'screening':
            stage = random.choice(['Phone Screen', 'Recruiter Screen', 'Resume Review'])
        elif status == 'interview':
            stage = weighted_choice(['Technical Interview', 'Onsite', 'Final Round',
                                   'Panel Interview', 'Take-home Assessment'], [20, 20, 30, 20, 10])
        elif status == 'offer':
            stage = 'Offer Extended'
            offered_salary = int(expected_salary * random.uniform(0.9, 1.1))
            offer_date = random_date(30, 1)
        elif status == 'hired':
            stage = 'Hired'
            offered_salary = int(expected_salary * random.uniform(0.95, 1.1))
            offer_date = random_date(60, 15)
            start_date = date.today() + timedelta(days=random.randint(7, 45))
        else:
            stage = 'Rejected'
            rejection_reason = random.choice(REJECTION_REASONS)
            rejection_date = random_date(90, 1)

        resume_score = round(random.uniform(2.5, 5.0), 1) if status != 'new' else None
        interview_score = (
            round(random.uniform(2.0, 5.0), 1)
            if status in ('interview', 'offer', 'hired', 'rejected')
            else None
        )
        assessment_score = (
            round(random.uniform(2.0, 5.0), 1)
            if status in ('interview', 'offer', 'hired')
            else None
        )

        # Calculate overall_rating correctly (avoid adding None)
        scores = [s for s in [resume_score, interview_score, assessment_score] if s is not None]
        overall_rating = round(sum(scores) / len(scores), 1) if scores else None

        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)

        base_email = f"{first_name.lower()}.{last_name.lower().replace(chr(39), '')}"
        email = f"{base_email}{random.randint(1, 99999)}@email.com"
        while email in used_emails:
            email = f"{base_email}{random.randint(1, 99999)}@email.com"
        used_emails.add(email)

        candidate = {
            'id': str(uuid.uuid4()),
            'first_name': first_name,
            'last_name': last_name,
            'email': email,
            'phone': f"+1-{random.randint(200, 999)}-{random.randint(100, 999)}-{random.randint(1000, 9999)}",
            'applied_position': applied_position,
            'requisition_id': random.choice(requisition_ids) if requisition_ids else None,
            'department': department,
            'application_date': application_date,
            'source': source,
            'status': status,
            'stage': stage,
            'stage_entered_date': random_date(30, 1),
            'recruiter_id': None,
            'hiring_manager_id': None,
            'expected_salary': expected_salary,
            'offered_salary': offered_salary,
            'offer_date': offer_date,
            'offer_accepted_date': offer_date if status == 'hired' else None,
            'start_date': start_date,
            'rejection_reason': rejection_reason,
            'rejection_date': rejection_date,
            'resume_score': resume_score,
            'interview_score': interview_score,
            'assessment_score': assessment_score,
            'overall_rating': overall_rating,
            'notes': None,
            'resume_url': None,
            'source_system': 'seed',
            'external_id': None,
        }

        if organization_id:
            candidate['organization_id'] = organization_id

        candidates.append(candidate)

    return candidates


# =============================================================================
# Requisition Generator  (500+)
# =============================================================================

def generate_requisitions(count: int = 500,
                          organization_id: str = None) -> List[Dict[str, Any]]:
    """Generate realistic job requisition data."""
    requisitions: List[Dict[str, Any]] = []
    today = date.today()

    for i in range(count):
        department = random.choice(DEPARTMENTS)
        job_titles = JOB_TITLES_BY_DEPT[department]
        title = random.choice(job_titles)
        job_level = _title_to_level(title)

        location = random.choice(LOCATIONS)
        status = weighted_choice(
            ['open', 'filled', 'closed', 'on_hold'],
            [45, 30, 15, 10],
        )

        # Spread open dates over 2 years
        open_date = random_date_in_range(date(2024, 1, 1), today)
        target_fill_date = open_date + timedelta(days=random.randint(30, 90))
        filled_date = None
        closed_date = None

        if status == 'filled':
            days_to_fill = random.randint(20, 90)
            filled_date = open_date + timedelta(days=days_to_fill)
        elif status == 'closed':
            closed_date = open_date + timedelta(days=random.randint(14, 120))

        min_salary = random.randint(50000, 180000)
        max_salary = min_salary + random.randint(15000, 60000)

        requisition = {
            'id': str(uuid.uuid4()),
            'title': title,
            'department': department,
            'location': location,
            'job_level': job_level,
            'status': status,
            'open_date': open_date,
            'target_fill_date': target_fill_date,
            'filled_date': filled_date,
            'closed_date': closed_date,
            'hiring_manager_id': None,
            'recruiter_id': None,
            'salary_min': min_salary,
            'salary_max': max_salary,
            'currency': 'USD',
            'urgency': random.choice(['low', 'medium', 'high', 'critical']),
            'headcount': weighted_choice([1, 2, 3, 5], [70, 20, 7, 3]),
            'description': f"We are looking for a talented {title} to join our {department} team.",
            'requirements': (
                f"Experience in {department.lower()}, strong communication skills, "
                f"ability to work in a fast-paced environment."
            ),
            'benefits': "Competitive salary, equity, health insurance, unlimited PTO, remote-friendly.",
            'applicant_count': random.randint(5, 200),
            'interview_count': random.randint(3, 40),
            'offer_count': random.randint(0, 5),
            'source_system': 'seed',
            'external_id': None,
        }

        if organization_id:
            requisition['organization_id'] = organization_id

        requisitions.append(requisition)

    return requisitions


# =============================================================================
# KPI Definitions & Targets
# =============================================================================

KPI_DEFINITIONS = [
    {
        "name": "Headcount",
        "description": "Total active employee headcount",
        "category": "workforce",
        "metric_key": "headcount",
        "unit": "number",
        "calculation_method": "count(active_employees)",
        "higher_is_better": True,
        "target_value": 4000,
        "warning_threshold": 3500,
        "critical_threshold": 3000,
    },
    {
        "name": "Turnover Rate",
        "description": "Annual voluntary and involuntary turnover rate",
        "category": "retention",
        "metric_key": "turnover_rate",
        "unit": "percentage",
        "calculation_method": "terminated_12m / (active + terminated_12m) * 100",
        "higher_is_better": False,
        "target_value": 12.0,
        "warning_threshold": 15.0,
        "critical_threshold": 20.0,
    },
    {
        "name": "Average Tenure",
        "description": "Average tenure of active employees in years",
        "category": "workforce",
        "metric_key": "avg_tenure",
        "unit": "years",
        "calculation_method": "avg(tenure)",
        "higher_is_better": True,
        "target_value": 3.5,
        "warning_threshold": 2.5,
        "critical_threshold": 2.0,
    },
    {
        "name": "Engagement Score",
        "description": "Average employee engagement score (1-5 scale)",
        "category": "engagement",
        "metric_key": "engagement_score",
        "unit": "score",
        "calculation_method": "avg(engagement_score)",
        "higher_is_better": True,
        "target_value": 4.0,
        "warning_threshold": 3.5,
        "critical_threshold": 3.0,
    },
    {
        "name": "Revenue per Employee",
        "description": "Estimated annual revenue divided by active headcount",
        "category": "financial",
        "metric_key": "revenue_per_employee",
        "unit": "currency",
        "calculation_method": "total_revenue / active_headcount",
        "higher_is_better": True,
        "target_value": 250000,
        "warning_threshold": 200000,
        "critical_threshold": 150000,
    },
    {
        "name": "Time to Hire",
        "description": "Average days from requisition open to offer acceptance",
        "category": "hiring",
        "metric_key": "time_to_hire",
        "unit": "days",
        "calculation_method": "avg(close_date - open_date)",
        "higher_is_better": False,
        "target_value": 35,
        "warning_threshold": 45,
        "critical_threshold": 60,
    },
    {
        "name": "Offer Acceptance Rate",
        "description": "Percentage of job offers accepted by candidates",
        "category": "hiring",
        "metric_key": "offer_acceptance_rate",
        "unit": "percentage",
        "calculation_method": "accepted_offers / total_offers * 100",
        "higher_is_better": True,
        "target_value": 85.0,
        "warning_threshold": 75.0,
        "critical_threshold": 65.0,
    },
    {
        "name": "Training Hours",
        "description": "Average training hours per employee per year",
        "category": "development",
        "metric_key": "training_hours",
        "unit": "hours",
        "calculation_method": "avg(training_hours)",
        "higher_is_better": True,
        "target_value": 40,
        "warning_threshold": 25,
        "critical_threshold": 15,
    },
    {
        "name": "Retention Rate",
        "description": "Percentage of employees retained over 12 months",
        "category": "retention",
        "metric_key": "retention_rate",
        "unit": "percentage",
        "calculation_method": "retained_12m / active_12m_ago * 100",
        "higher_is_better": True,
        "target_value": 90.0,
        "warning_threshold": 85.0,
        "critical_threshold": 80.0,
    },
    {
        "name": "Diversity Index",
        "description": "Simpson diversity index across demographics (0-1 scale)",
        "category": "dei",
        "metric_key": "diversity_index",
        "unit": "score",
        "calculation_method": "1 - sum(p_i^2)",
        "higher_is_better": True,
        "target_value": 0.75,
        "warning_threshold": 0.60,
        "critical_threshold": 0.45,
    },
]


def generate_kpi_definitions(organization_id: str,
                             user_id: str) -> List[Dict[str, Any]]:
    """Generate KPI definition records."""
    kpis = []
    for kpi_data in KPI_DEFINITIONS:
        kpi = {
            'id': str(uuid4()),
            'organization_id': organization_id,
            'name': kpi_data['name'],
            'description': kpi_data['description'],
            'category': kpi_data['category'],
            'metric_key': kpi_data['metric_key'],
            'unit': kpi_data['unit'],
            'calculation_method': kpi_data['calculation_method'],
            'is_system': True,
            'is_active': True,
            'created_by': user_id,
            '_target_value': kpi_data['target_value'],
            '_warning_threshold': kpi_data['warning_threshold'],
            '_critical_threshold': kpi_data['critical_threshold'],
            '_higher_is_better': kpi_data['higher_is_better'],
        }
        kpis.append(kpi)
    return kpis


def generate_kpi_targets(organization_id: str,
                         kpi_defs: List[Dict[str, Any]],
                         employee_ids: List[str] = None,
                         employees: List[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Generate KPI target records for org, all departments, all teams, and employees."""
    targets = []
    today = date.today()
    period_start = date(today.year, 1, 1)
    period_end = date(today.year, 12, 31)

    for kpi in kpi_defs:
        # Org-wide
        targets.append({
            'id': str(uuid4()),
            'kpi_definition_id': kpi['id'],
            'organization_id': organization_id,
            'target_value': kpi['_target_value'],
            'warning_threshold': kpi['_warning_threshold'],
            'critical_threshold': kpi['_critical_threshold'],
            'effective_from': period_start,
            'effective_to': period_end,
            'status': 'active',
            'org_unit': None,
            'org_unit_type': None,
        })

        # Department-level — ALL departments
        for dept in DEPARTMENTS:
            variation = random.uniform(0.85, 1.15)
            targets.append({
                'id': str(uuid4()),
                'kpi_definition_id': kpi['id'],
                'organization_id': organization_id,
                'target_value': round(kpi['_target_value'] * variation, 2),
                'warning_threshold': round(kpi['_warning_threshold'] * variation, 2),
                'critical_threshold': round(kpi['_critical_threshold'] * variation, 2),
                'effective_from': period_start,
                'effective_to': period_end,
                'status': 'active',
                'org_unit': dept,
                'org_unit_type': 'department',
            })

        # Team-level — all teams in all departments
        for dept, teams in DEPARTMENT_TEAMS.items():
            dept_variation = random.uniform(0.85, 1.15)
            for team in teams:
                team_variation = dept_variation * random.uniform(0.9, 1.1)
                targets.append({
                    'id': str(uuid4()),
                    'kpi_definition_id': kpi['id'],
                    'organization_id': organization_id,
                    'target_value': round(kpi['_target_value'] * team_variation, 2),
                    'warning_threshold': round(kpi['_warning_threshold'] * team_variation, 2),
                    'critical_threshold': round(kpi['_critical_threshold'] * team_variation, 2),
                    'effective_from': period_start,
                    'effective_to': period_end,
                    'status': 'active',
                    'org_unit': f"{dept} / {team}",
                    'org_unit_type': 'team',
                })

    # Individual employee targets — 600 employees, 3 KPIs each
    if employee_ids:
        sample_emps = random.sample(employee_ids, min(len(employee_ids), 600))
        for emp_id in sample_emps:
            selected_kpis = random.sample(kpi_defs, min(3, len(kpi_defs)))
            for kpi in selected_kpis:
                variation = random.uniform(0.7, 1.3)
                targets.append({
                    'id': str(uuid4()),
                    'kpi_definition_id': kpi['id'],
                    'organization_id': organization_id,
                    'target_value': round(kpi['_target_value'] * variation, 2),
                    'warning_threshold': round(kpi['_warning_threshold'] * variation, 2),
                    'critical_threshold': round(kpi['_critical_threshold'] * variation, 2),
                    'effective_from': period_start,
                    'effective_to': period_end,
                    'status': 'active',
                    'org_unit': str(emp_id),
                    'org_unit_type': 'employee',
                })

    return targets


def generate_kpi_measurements(organization_id: str,
                               kpi_defs: List[Dict[str, Any]],
                               months: int = 13) -> List[Dict[str, Any]]:
    """Seed historical monthly KPI measurements so the dashboard shows values immediately."""
    measurements = []
    today = date.today()

    # Realistic baseline values per KPI metric key
    baselines = {
        'headcount':          (3750, 4000, 50),      # (start, trend_target, noise)
        'turnover_rate':      (13.5, 11.8, 0.4),
        'avg_tenure':         (2.8, 3.2, 0.1),
        'engagement_score':   (3.6, 3.85, 0.08),
        'revenue_per_employee': (225000, 260000, 3000),
        'time_to_hire':       (42, 36, 1.5),
        'offer_acceptance_rate': (80, 87, 1.2),
        'training_hours':     (28, 38, 1.5),
        'retention_rate':     (87, 91, 0.5),
        'diversity_index':    (0.65, 0.74, 0.01),
    }

    for kpi in kpi_defs:
        key = kpi.get('metric_key', '')
        baseline = baselines.get(key)
        if not baseline:
            baseline = (kpi['_target_value'] * 0.85, kpi['_target_value'] * 0.95, kpi['_target_value'] * 0.02)
        start_val, end_val, noise = baseline

        prev_value = None
        for month_offset in range(months - 1, -1, -1):
            m_date = (today.replace(day=1) - timedelta(days=month_offset * 30))
            m_date = m_date.replace(day=1)
            # Linear trend + random noise
            progress = (months - 1 - month_offset) / max(months - 1, 1)
            trend_val = start_val + (end_val - start_val) * progress
            measured = trend_val + random.gauss(0, noise)
            measured = round(measured, 2)

            variance = round(measured - prev_value, 2) if prev_value is not None else None
            prev_value = measured

            measurements.append({
                'id': str(uuid4()),
                'kpi_definition_id': kpi['id'],
                'organization_id': organization_id,
                'measurement_date': m_date,
                'period_type': 'monthly',
                'measured_value': measured,
                'variance': variance,
                'data_source': 'seed',
                'created_at': datetime.utcnow(),
            })

    return measurements


# =============================================================================
# Attendance Records & Targets
# =============================================================================

def generate_attendance_records(organization_id: str,
                                employee_ids: List[str],
                                days: int = 365) -> List[Dict[str, Any]]:
    """Generate attendance records for employees over the last N days."""
    records = []
    today = date.today()
    statuses = ['in_office', 'remote', 'absent', 'leave', 'holiday']
    locations = ['HQ Floor 3', 'HQ Floor 5', 'Remote - Home',
                 'Satellite Office', 'Co-working Space']

    for emp_id in employee_ids:
        for day_offset in range(days):
            record_date = today - timedelta(days=day_offset)
            
            # Weekend logic: reduced activity but still some records for 'interactivity'
            is_weekend = record_date.weekday() >= 5
            if is_weekend:
                # 15% chance of a record on weekends (mostly remote or holiday)
                if random.random() > 0.15:
                    continue
                status = weighted_choice(['remote', 'holiday', 'leave'], [40, 40, 20])
            else:
                # Balanced status: higher presence (85%), lower absence (5%)
                status = weighted_choice(statuses, [50, 35, 3, 2, 10])

            check_in_time = None
            check_out_time = None
            location = None

            if status in ('in_office', 'remote'):
                hour_in = random.randint(7, 10)
                min_in = random.randint(0, 59)
                check_in_time = datetime(record_date.year, record_date.month,
                                         record_date.day, hour_in, min_in)
                hour_out = random.randint(16, 19)
                min_out = random.randint(0, 59)
                check_out_time = datetime(record_date.year, record_date.month,
                                          record_date.day, hour_out, min_out)
                location = (random.choice(locations[:2]) if status == 'in_office'
                            else random.choice(locations[2:]))

            records.append({
                'id': str(uuid4()),
                'organization_id': organization_id,
                'employee_id': emp_id,
                'record_date': record_date,
                'status': status,
                'check_in_time': check_in_time,
                'check_out_time': check_out_time,
                'location': location,
                'source_system': 'seed',
            })

    return records


def generate_attendance_targets(organization_id: str) -> List[Dict[str, Any]]:
    """Generate per-department attendance targets."""
    targets = []
    today = date.today()
    effective_from = today.replace(day=1)
    effective_to = date(today.year, 12, 31)

    dept_targets = {
        'Engineering': (3, 60.0),
        'Product': (3, 60.0),
        'Design': (2, 40.0),
        'Marketing': (3, 60.0),
        'Sales': (4, 80.0),
        'Customer Success': (4, 80.0),
        'HR': (4, 80.0),
        'Finance': (4, 80.0),
        'Operations': (5, 100.0),
    }

    for dept, (days_per_week, pct) in dept_targets.items():
        targets.append({
            'id': str(uuid4()),
            'organization_id': organization_id,
            'org_unit': dept,
            'org_unit_type': 'department',
            'target_days_per_week': float(days_per_week),
            'target_pct': pct,
            'effective_from': effective_from,
            'effective_to': effective_to,
        })

    return targets


# =============================================================================
# Org Health Alerts
# =============================================================================

SAMPLE_ALERTS = [
    {
        'alert_type': 'attrition_spike',
        'severity': 'critical',
        'title': 'Engineering attrition above threshold',
        'description': 'The Engineering department has experienced 18% annualized turnover in the last quarter, exceeding the 15% critical threshold. Three senior engineers departed in the last 30 days.',
        'affected_org_unit': 'Engineering',
        'affected_org_unit_type': 'department',
        'metric_name': 'Turnover Rate',
        'metric_value': 18.2,
        'threshold_value': 15.0,
        'trend_direction': 'increasing',
        'trend_period_days': 90,
        'contributing_factors': ['Below-market compensation', 'Limited growth opportunities', 'Manager turnover'],
        'recommendations': ['Review engineering compensation bands', 'Conduct stay interviews', 'Accelerate promotion pipeline'],
    },
    {
        'alert_type': 'engagement_decline',
        'severity': 'warning',
        'title': 'Sales engagement score declining',
        'description': 'Average engagement scores in the Sales department have dropped from 3.8 to 3.2 over the past 60 days.',
        'affected_org_unit': 'Sales',
        'affected_org_unit_type': 'department',
        'metric_name': 'Engagement Score',
        'metric_value': 3.2,
        'threshold_value': 3.5,
        'trend_direction': 'decreasing',
        'trend_period_days': 60,
        'contributing_factors': ['Increased quotas', 'Team restructuring', 'Competitor poaching'],
        'recommendations': ['Review quota targets', 'Schedule team-building activities', 'Increase 1:1 frequency'],
    },
    {
        'alert_type': 'hiring_slowdown',
        'severity': 'warning',
        'title': 'Time to fill exceeding target for Product roles',
        'description': 'Average time to fill Product roles has increased to 52 days, exceeding the 45-day warning threshold.',
        'affected_org_unit': 'Product',
        'affected_org_unit_type': 'department',
        'metric_name': 'Time to Fill',
        'metric_value': 52.0,
        'threshold_value': 45.0,
        'trend_direction': 'increasing',
        'trend_period_days': 30,
        'contributing_factors': ['Competitive market', 'Unclear job descriptions', 'Slow interview process'],
        'recommendations': ['Expand sourcing channels', 'Streamline interview loops', 'Consider contract-to-hire'],
    },
    {
        'alert_type': 'diversity_gap',
        'severity': 'info',
        'title': 'Leadership diversity below target',
        'description': 'The diversity index for Director+ roles is 0.42, below the 0.60 target.',
        'affected_org_unit': 'Leadership',
        'affected_org_unit_type': 'level',
        'metric_name': 'Diversity Index',
        'metric_value': 0.42,
        'threshold_value': 0.60,
        'trend_direction': 'stable',
        'trend_period_days': 180,
        'contributing_factors': ['Limited pipeline diversity', 'Homogeneous referral networks', 'Promotion gap'],
        'recommendations': ['Launch diverse leadership pipeline program', 'Partner with diversity-focused recruiters', 'Audit promotion criteria'],
    },
    {
        'alert_type': 'training_deficit',
        'severity': 'info',
        'title': 'Training hours below target across Operations',
        'description': 'Average training hours in Operations are 12 hours per employee, significantly below the 40-hour annual target.',
        'affected_org_unit': 'Operations',
        'affected_org_unit_type': 'department',
        'metric_name': 'Training Hours',
        'metric_value': 12.0,
        'threshold_value': 25.0,
        'trend_direction': 'decreasing',
        'trend_period_days': 90,
        'contributing_factors': ['Budget constraints', 'High workload', 'Lack of relevant courses'],
        'recommendations': ['Allocate dedicated training time', 'Source cost-effective online courses', 'Set mandatory minimums'],
    },
    {
        'alert_type': 'retention_risk',
        'severity': 'critical',
        'title': 'High flight risk concentration in Customer Success',
        'description': '35% of Customer Success employees are flagged as high flight risk, compared to the company average of 15%.',
        'affected_org_unit': 'Customer Success',
        'affected_org_unit_type': 'department',
        'metric_name': 'Retention Rate',
        'metric_value': 78.0,
        'threshold_value': 85.0,
        'trend_direction': 'decreasing',
        'trend_period_days': 90,
        'contributing_factors': ['No recent promotions', 'Below-average engagement', 'High caseloads'],
        'recommendations': ['Create career ladder', 'Immediate retention bonuses for top performers', 'Hire additional headcount'],
    },
    {
        'alert_type': 'compensation_outlier',
        'severity': 'warning',
        'title': 'Finance compensation below market midpoint',
        'description': '60% of Finance department employees are paid below the 25th percentile of market data.',
        'affected_org_unit': 'Finance',
        'affected_org_unit_type': 'department',
        'metric_name': 'Compa-Ratio',
        'metric_value': 0.82,
        'threshold_value': 0.95,
        'trend_direction': 'decreasing',
        'trend_period_days': 180,
        'contributing_factors': ['Stale compensation bands', 'Market salary inflation', 'No mid-year adjustments'],
        'recommendations': ['Update compensation bands', 'Conduct market analysis', 'Budget for off-cycle adjustments'],
    },
    {
        'alert_type': 'headcount_variance',
        'severity': 'info',
        'title': 'Marketing headcount below planned levels',
        'description': 'Marketing currently has 38 active employees against a planned headcount of 45 for Q1.',
        'affected_org_unit': 'Marketing',
        'affected_org_unit_type': 'department',
        'metric_name': 'Headcount',
        'metric_value': 38.0,
        'threshold_value': 45.0,
        'trend_direction': 'stable',
        'trend_period_days': 30,
        'contributing_factors': ['Slow hiring pipeline', 'Budget approval delays', 'Candidate dropoff'],
        'recommendations': ['Prioritize open requisitions', 'Engage recruiting agencies', 'Review offer competitiveness'],
    },
]


def generate_org_health_alerts(organization_id: str) -> List[Dict[str, Any]]:
    """Generate sample org health alerts."""
    alerts = []
    for i, alert_data in enumerate(SAMPLE_ALERTS):
        days_ago = random.randint(0, 30)
        created_at = datetime.utcnow() - timedelta(days=days_ago)

        status = 'active'
        if i >= 6:
            status = 'acknowledged'
        if i >= 7:
            status = 'resolved'

        alert = {
            'id': str(uuid4()),
            'organization_id': organization_id,
            'alert_type': alert_data['alert_type'],
            'severity': alert_data['severity'],
            'status': status,
            'title': alert_data['title'],
            'description': alert_data['description'],
            'affected_org_unit': alert_data['affected_org_unit'],
            'affected_org_unit_type': alert_data['affected_org_unit_type'],
            'metric_name': alert_data['metric_name'],
            'metric_value': alert_data['metric_value'],
            'threshold_value': alert_data['threshold_value'],
            'trend_direction': alert_data['trend_direction'],
            'trend_period_days': alert_data['trend_period_days'],
            'contributing_factors': alert_data['contributing_factors'],
            'recommendations': alert_data['recommendations'],
            'created_at': created_at,
        }
        alerts.append(alert)

    return alerts


# =============================================================================
# Recruiter Goals Generator  (60 recruiters x 3 years)
# =============================================================================

def _build_recruiter_roster(count: int = 60) -> List[Dict[str, Any]]:
    """Build a roster of 60 recruiters with realistic distribution.

    Level distribution:
        Junior: ~15, Mid: ~20, Senior: ~15, Lead: ~10
    """
    roster: List[Dict[str, Any]] = []

    level_distribution = (
        [('Junior', 15), ('Mid', 20), ('Senior', 15), ('Lead', 10)]
    )
    levels_expanded: List[str] = []
    for level, n in level_distribution:
        levels_expanded.extend([level] * n)
    random.shuffle(levels_expanded)

    recruiter_locations = [
        'San Francisco', 'New York', 'Austin', 'Chicago', 'Boston',
        'Denver', 'Seattle', 'Remote', 'London', 'Berlin',
    ]

    managers = ['VP Talent', 'Dir. Recruiting', 'Sr. Manager TA',
                'Head of Recruiting', 'Dir. Technical Recruiting']

    employment_types = ['Full-time'] * 50 + ['Contract'] * 7 + ['Part-time'] * 3
    random.shuffle(employment_types)

    used_names: set = set()

    for i in range(count):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        name = f"{first} {last}"
        while name in used_names:
            first = random.choice(FIRST_NAMES)
            last = random.choice(LAST_NAMES)
            name = f"{first} {last}"
        used_names.add(name)

        seniority = levels_expanded[i] if i < len(levels_expanded) else random.choice(
            ['Junior', 'Mid', 'Senior', 'Lead'])

        # Pick 1-3 specializations
        n_specs = {'Junior': 1, 'Mid': 2, 'Senior': 2, 'Lead': 3}.get(seniority, 2)
        specs = random.sample(RECRUITER_SPECIALIZATIONS, min(n_specs, len(RECRUITER_SPECIALIZATIONS)))

        roster.append({
            'name': name,
            'seniority': seniority,
            'location': random.choice(recruiter_locations),
            'manager': random.choice(managers),
            'employment_type': employment_types[i] if i < len(employment_types) else 'Full-time',
            'specializations': ','.join(specs),
        })

    return roster


def generate_recruiter_goals(organization_id: str,
                             years: Optional[List[int]] = None) -> List[Dict[str, Any]]:
    """Generate recruiter goals for 60 recruiters across multiple years.

    Each recruiter gets one row per year with all capacity fields populated.
    """
    if years is None:
        years = [2024, 2025, 2026]

    roster = _build_recruiter_roster(60)
    goals: List[Dict[str, Any]] = []
    current_year = date.today().year

    for recruiter in roster:
        seniority = recruiter['seniority']
        emp_type = recruiter['employment_type']

        for year in years:
            # Capacity ranges per level (as specified in requirements)
            if emp_type == 'Part-time':
                monthly_capacity = random.randint(2, 3)
                utilization_pct = random.randint(60, 75)
                overhead_pct = random.randint(20, 30)
                max_concurrent_reqs = random.randint(3, 5)
                q_goals = [random.randint(4, 7) for _ in range(4)]
            elif emp_type == 'Contract':
                monthly_capacity = random.randint(3, 5)
                utilization_pct = random.randint(75, 90)
                overhead_pct = random.randint(15, 20)
                max_concurrent_reqs = random.randint(5, 8)
                q_goals = [random.randint(6, 9) for _ in range(4)]
            elif seniority == 'Lead':
                monthly_capacity = random.randint(6, 8)
                utilization_pct = random.randint(80, 95)
                overhead_pct = random.randint(10, 15)
                max_concurrent_reqs = random.randint(10, 15)
                q_goals = [random.randint(14, 20) for _ in range(4)]
            elif seniority == 'Senior':
                monthly_capacity = random.randint(5, 7)
                utilization_pct = random.randint(80, 95)
                overhead_pct = random.randint(10, 15)
                max_concurrent_reqs = random.randint(8, 12)
                q_goals = [random.randint(12, 16) for _ in range(4)]
            elif seniority == 'Mid':
                monthly_capacity = random.randint(3, 5)
                utilization_pct = random.randint(75, 90)
                overhead_pct = random.randint(15, 20)
                max_concurrent_reqs = random.randint(6, 8)
                q_goals = [random.randint(8, 13) for _ in range(4)]
            else:  # Junior
                monthly_capacity = random.randint(2, 3)
                utilization_pct = random.randint(75, 85)
                overhead_pct = random.randint(20, 30)
                max_concurrent_reqs = random.randint(4, 6)
                q_goals = [random.randint(5, 9) for _ in range(4)]

            # Actuals depend on how far into the year we are
            q1_actual, q2_actual, q3_actual, q4_actual = 0, 0, 0, 0
            if year < current_year:
                # Past year: all quarters filled
                q1_actual = random.randint(int(q_goals[0] * 0.7), int(q_goals[0] * 1.3))
                q2_actual = random.randint(int(q_goals[1] * 0.7), int(q_goals[1] * 1.3))
                q3_actual = random.randint(int(q_goals[2] * 0.7), int(q_goals[2] * 1.3))
                q4_actual = random.randint(int(q_goals[3] * 0.7), int(q_goals[3] * 1.3))
            elif year == current_year:
                # Current year: fill based on current quarter
                today = date.today()
                current_q = (today.month - 1) // 3 + 1
                if current_q >= 1:
                    q1_actual = random.randint(int(q_goals[0] * 0.7), int(q_goals[0] * 1.2))
                if current_q >= 2:
                    q2_actual = random.randint(int(q_goals[1] * 0.7), int(q_goals[1] * 1.2))
                if current_q >= 3:
                    q3_actual = random.randint(int(q_goals[2] * 0.7), int(q_goals[2] * 1.2))
                if current_q >= 4:
                    q4_actual = random.randint(int(q_goals[3] * 0.7), int(q_goals[3] * 1.2))
            # Future year: all zeros (already set)

            # Bonus eligibility: top performers
            total_goal = sum(q_goals)
            total_actual = q1_actual + q2_actual + q3_actual + q4_actual
            eligible_for_bonus = total_actual > total_goal * 1.05 if year < current_year else False
            bonus_notes = None
            if eligible_for_bonus:
                bonus_notes = f'Exceeded {year} targets by {round((total_actual / total_goal - 1) * 100)}%; recommended for performance bonus'

            goal = {
                'id': str(uuid4()),
                'name': recruiter['name'],
                'seniority': seniority,
                'location': recruiter['location'],
                'manager': recruiter['manager'],
                'employment_type': emp_type,
                'q1_goal': q_goals[0],
                'q2_goal': q_goals[1],
                'q3_goal': q_goals[2],
                'q4_goal': q_goals[3],
                'q1_actual': q1_actual,
                'q2_actual': q2_actual,
                'q3_actual': q3_actual,
                'q4_actual': q4_actual,
                'eligible_for_bonus': eligible_for_bonus,
                'bonus_notes': bonus_notes,
                'monthly_capacity': monthly_capacity,
                'utilization_pct': utilization_pct,
                'specializations': recruiter['specializations'],
                'overhead_pct': overhead_pct,
                'max_concurrent_reqs': max_concurrent_reqs,
                'organization_id': organization_id,
                'year': year,
            }
            goals.append(goal)

    return goals


# =============================================================================
# Planning Period & Workforce Plans
# =============================================================================

def generate_planning_periods_and_plans(
    organization_id: str,
    user_id: str,
    department_headcounts: Dict[str, int],
) -> Dict[str, Any]:
    """Generate a planning period with workforce plans for each department."""
    period_id = str(uuid4())

    period = {
        'id': period_id,
        'organization_id': organization_id,
        'name': 'Q1 2026',
        'description': 'First quarter 2026 workforce plan',
        'start_date': date(2026, 1, 1),
        'end_date': date(2026, 3, 31),
        'status': 'active',
        'period_type': 'quarter',
        'created_by': user_id,
        'approved_by': user_id,
        'approved_at': datetime(2025, 12, 20, 10, 0, 0),
        'created_at': datetime(2025, 12, 15, 9, 0, 0),
        'updated_at': datetime(2025, 12, 20, 10, 0, 0),
    }

    plan_params = {
        'Engineering': {'hire_rate': 0.10, 'attrition_rate': 0.04, 'actual_hire_mult': 0.80, 'actual_attrition_mult': 1.20},
        'Product': {'hire_rate': 0.08, 'attrition_rate': 0.03, 'actual_hire_mult': 0.90, 'actual_attrition_mult': 0.80},
        'Design': {'hire_rate': 0.06, 'attrition_rate': 0.03, 'actual_hire_mult': 1.00, 'actual_attrition_mult': 1.00},
        'Marketing': {'hire_rate': 0.12, 'attrition_rate': 0.05, 'actual_hire_mult': 0.70, 'actual_attrition_mult': 1.10},
        'Sales': {'hire_rate': 0.15, 'attrition_rate': 0.08, 'actual_hire_mult': 0.85, 'actual_attrition_mult': 1.05},
        'Customer Success': {'hire_rate': 0.07, 'attrition_rate': 0.06, 'actual_hire_mult': 0.90, 'actual_attrition_mult': 1.30},
        'HR': {'hire_rate': 0.05, 'attrition_rate': 0.02, 'actual_hire_mult': 1.00, 'actual_attrition_mult': 0.50},
        'Finance': {'hire_rate': 0.04, 'attrition_rate': 0.03, 'actual_hire_mult': 0.75, 'actual_attrition_mult': 1.00},
        'Operations': {'hire_rate': 0.06, 'attrition_rate': 0.04, 'actual_hire_mult': 0.80, 'actual_attrition_mult': 0.90},
    }

    plans = []
    for dept, headcount in department_headcounts.items():
        params = plan_params.get(dept, {
            'hire_rate': 0.06, 'attrition_rate': 0.04,
            'actual_hire_mult': 0.85, 'actual_attrition_mult': 1.0,
        })

        starting_hc = headcount
        planned_hires = max(1, int(starting_hc * params['hire_rate']))
        planned_attrition = max(0, int(starting_hc * params['attrition_rate']))
        planned_ending_hc = starting_hc + planned_hires - planned_attrition

        actual_hires = max(0, int(planned_hires * params['actual_hire_mult']))
        actual_attrition = max(0, int(planned_attrition * params['actual_attrition_mult']))
        actual_headcount = starting_hc + actual_hires - actual_attrition

        plan = {
            'id': str(uuid4()),
            'period_id': period_id,
            'organization_id': organization_id,
            'department': dept,
            'starting_headcount': starting_hc,
            'planned_hires': planned_hires,
            'planned_attrition': planned_attrition,
            'planned_transfers_in': 0,
            'planned_transfers_out': 0,
            'planned_ending_headcount': planned_ending_hc,
            'actual_headcount': actual_headcount,
            'actual_hires': actual_hires,
            'actual_attrition': actual_attrition,
            'actual_transfers_in': 0,
            'actual_transfers_out': 0,
            'headcount_variance': actual_headcount - planned_ending_hc,
            'hires_variance': actual_hires - planned_hires,
            'attrition_variance': actual_attrition - planned_attrition,
            'last_synced_at': datetime(2026, 2, 15, 12, 0, 0),
            'created_at': datetime(2025, 12, 15, 9, 0, 0),
            'updated_at': datetime(2026, 2, 15, 12, 0, 0),
        }
        plans.append(plan)

    return {'period': period, 'plans': plans}


# =============================================================================
# Master CSV Export
# =============================================================================

def export_master_csv(employees: List[Dict[str, Any]],
                      output_path: str = None) -> str:
    """Export all employees to a master CSV file.

    Returns the path to the generated CSV.
    """
    if output_path is None:
        output_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'data', 'master_mock_data.csv',
        )

    # Ensure directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    fieldnames = [
        'employee_id', 'first_name', 'last_name', 'email', 'phone',
        'department', 'team', 'cost_center', 'job_title', 'job_level',
        'location', 'work_type',
        'status', 'hire_date', 'termination_date', 'termination_reason',
        'salary', 'currency', 'bonus_target', 'equity_grants',
        'age', 'gender', 'ethnicity', 'date_of_birth',
        'performance_rating', 'engagement_score',
        'last_review_date', 'last_promotion_date',
        'training_hours', 'tenure', 'flight_risk',
    ]

    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        for emp in employees:
            row = {k: emp.get(k, '') for k in fieldnames}
            # Convert dates to strings
            for date_field in ('hire_date', 'termination_date', 'date_of_birth',
                               'last_review_date', 'last_promotion_date'):
                val = row.get(date_field)
                if val and hasattr(val, 'isoformat'):
                    row[date_field] = val.isoformat()
                elif val is None:
                    row[date_field] = ''
            writer.writerow(row)

    return output_path


# =============================================================================
# Full Seed Function
# =============================================================================

def seed_system_metrics(db_session, organization_id: str, user_id: Optional[str] = None):
    """Seed system metric definitions for an organization."""
    from database.models import MetricDefinition
    from uuid import UUID as _UUID
    import uuid as _uuid_lib

    system_metrics = [
        {"name": "Attrition Rate", "category": "Retention", "formula": "terminated_12m / (active + terminated_12m) * 100", "description": "Percentage of employees who left the organization over the last 12 months."},
        {"name": "Retention Rate", "category": "Retention", "formula": "retained_12m / active_12m_ago * 100", "description": "Percentage of employees who remained with the organization over the last 12 months."},
        {"name": "Avg Tenure", "category": "HR", "formula": "avg(tenure)", "description": "Average number of years employees have been with the company."},
        {"name": "Avg Salary", "category": "Compensation", "formula": "avg(salary)", "description": "Average base salary across active employees."},
        {"name": "Headcount", "category": "HR", "formula": "count(active_employees)", "description": "Total number of active employees."},
        {"name": "Revenue per Employee", "category": "HR", "formula": "total_revenue / active_headcount", "description": "Total organization revenue divided by active headcount."},
        {"name": "Profit per Employee", "category": "HR", "formula": "total_profit / active_headcount", "description": "Total organization profit divided by active headcount."},
        {"name": "Engagement Score", "category": "Engagement", "formula": "avg(engagement_score)", "description": "Average employee engagement score from the latest survey."},
        {"name": "Performance Avg", "category": "Performance", "formula": "avg(performance_rating)", "description": "Average performance rating across all active employees."},
        {"name": "Time to Hire", "category": "Recruitment", "formula": "avg(filled_date - open_date)", "description": "Average number of days from requisition opening to offer acceptance."},
        {"name": "Cost per Hire", "category": "Recruitment", "formula": "total_recruiting_cost / hires", "description": "Total recruiting expenses divided by the number of hires."},
        {"name": "Offer Acceptance Rate", "category": "Recruitment", "formula": "accepted_offers / total_offers * 100", "description": "Percentage of extended offers that were accepted."},
        {"name": "Gender Diversity %", "category": "Diversity", "formula": "female_count / total_count * 100", "description": "Percentage of female employees in the workforce."},
        {"name": "Gender Pay Gap", "category": "Diversity", "formula": "(avg_male_salary - avg_female_salary) / avg_male_salary * 100", "description": "Difference in average salary between male and female employees."},
        {"name": "PTO Utilization %", "category": "Attendance", "formula": "pto_days_used / pto_days_available * 100", "description": "Percentage of allocated PTO days actually used by employees."},
        {"name": "Attendance Rate", "category": "Attendance", "formula": "present_days / total_working_days * 100", "description": "Percentage of expected workdays employees were present (office or remote)."},
    ]

    admin_uuid = _UUID(user_id) if user_id else None
    org_uuid = _UUID(organization_id)
    
    count = 0
    for m in system_metrics:
        # Check if already exists
        existing = db_session.query(MetricDefinition).filter(
            MetricDefinition.organization_id == org_uuid,
            MetricDefinition.name == m["name"]
        ).first()
        if existing:
            continue
            
        db_session.add(MetricDefinition(
            id=_uuid_lib.uuid4(),
            organization_id=org_uuid,
            name=m["name"],
            category=m["category"],
            formula=m["formula"],
            is_system=True,
            is_active=True,
            created_by=admin_uuid,
        ))
        count += 1
    
    db_session.commit()
    print(f"  Seeded {count} system metric definitions")
    return count


def generate_interviews(organization_id: str, candidate_data: List[Dict], interviewer_ids: List[str]) -> List[Dict]:
    """Generate realistic interview records for candidates."""
    interviews = []
    interview_types = ['Screening', 'Technical', 'Behavioral', 'Culture Fit', 'Final Round']
    recommendations = ['hire', 'no_hire', 'strong_hire', 'weak_hire']
    
    for cand in candidate_data:
        # only interview candidates who are past 'new' status
        if cand['status'] in ['interview', 'offer', 'hired', 'rejected'] and random.random() > 0.1:
            # Candidates who were hired or got an offer usually had more interviews
            if cand['status'] in ['hired', 'offer']:
                num_interviews = random.randint(3, 5)
            else:
                num_interviews = random.randint(1, 3)
            
            cand_app_date = cand['application_date']
            if isinstance(cand_app_date, str):
                cand_app_date = date.fromisoformat(cand_app_date)

            for i in range(num_interviews):
                interviewer_id = random.choice(interviewer_ids)
                # Interview happens after application
                interview_dt = datetime.combine(
                    cand_app_date + timedelta(days=random.randint(2, 15)),
                    datetime.min.time()
                ) + timedelta(hours=random.randint(9, 17))
                
                interviews.append({
                    'id': str(uuid4()),
                    'candidate_id': cand['id'],
                    'interviewer_id': interviewer_id,
                    'organization_id': organization_id,
                    'interview_date': interview_dt,
                    'interview_type': interview_types[min(i, len(interview_types)-1)],
                    'score': round(random.uniform(2.5, 5.0), 1) if cand['status'] == 'hired' else round(random.uniform(1.0, 4.0), 1),
                    'recommendation': 'strong_hire' if cand['status'] == 'hired' and i > 2 else random.choice(recommendations),
                    'notes': f"Completed {interview_types[min(i, len(interview_types)-1)]} interview for {cand['first_name']} {cand['last_name']}. Candidate demonstrated strong technical skills but needs more experience with our specific stack."
                })
    return interviews


def seed_full_database(db_session, organization_id: str, user_id: str,
                       employee_count: int = 4500, candidate_count: int = 2000,
                       requisition_count: int = 500,
                       clear_existing: bool = True):
    """Comprehensive database seed.

    Generates: employees, candidates, requisitions, KPIs, attendance,
    alerts, recruiter goals (60 recruiters x 3 years), compensation bands,
    planning periods, and a master CSV export.

    Args:
        db_session: SQLAlchemy session.
        organization_id: Organization UUID string.
        user_id: User UUID string.
        employee_count: Number of employees to generate (default 4500, ~3800 active).
        candidate_count: Number of candidates to generate (default 2000).
        requisition_count: Number of requisitions to generate (default 500).
        clear_existing: Whether to truncate tables before seeding.

    Returns:
        dict with counts of all inserted records.
    """
    from database.models import (
        User, UserRole,
        Employee, Candidate, JobRequisition, Interview,
        EmployeeStatus, CandidateStatus, RequisitionStatus,
        KPIDefinition, KPITarget, KPIMeasurement,
        AttendanceRecord, AttendanceStatus, AttendanceTarget,
        OrgHealthAlert, AlertSeverity, AlertStatus,
        RecruiterGoal,
        PlanningPeriod, WorkforcePlan,
    )
    from sqlalchemy import text
    from uuid import UUID as _UUID

    # Ensure clean start
    db_session.rollback()

    print("=== Full Database Seed: 4,500 employees target (~3,800 active) ===")
    print(f"  Employees: {employee_count}")
    print(f"  Candidates: {candidate_count}")
    print(f"  Requisitions: {requisition_count}")
    print(f"  Recruiters: 60 x 3 years = 180 goal rows")

    metric_count = 0
    comp_band_count = 0

    # ---- 0.1 Seed Users ----
    try:
        from utils.jwt import get_password_hash
        print("Generating users...")

        # Demo users with deterministic IDs (must match services/auth/security.py)
        DEMO_USER_ID_1 = "00000000-0000-4000-a000-000000000010"  # demo@interface.app
        DEMO_USER_ID_2 = "00000000-0000-4000-a000-000000000020"  # admin@interface.app
        demo_users = [
            (_UUID(DEMO_USER_ID_1), "demo@interface.app", "Demo User", UserRole.hr_manager),
            (_UUID(DEMO_USER_ID_2), "admin@interface.app", "Admin User", UserRole.super_admin),
        ]
        for uid, email, name, role in demo_users:
            if not db_session.query(User).filter(User.id == uid).first():
                db_session.add(User(
                    id=uid,
                    email=email,
                    name=name,
                    password_hash=get_password_hash("demo123"),
                    role=role,
                    organization_id=_UUID(organization_id),
                    is_active=True,
                    created_at=datetime.utcnow()
                ))

        roles = [UserRole.super_admin, UserRole.admin, UserRole.hr_manager, UserRole.analyst, UserRole.viewer]
        for i in range(10):
            first = random.choice(FIRST_NAMES)
            last = random.choice(LAST_NAMES)
            email = f"{first.lower()}.{last.lower()}{i}@interface.app"
            role = roles[i % len(roles)]
            existing = db_session.query(User).filter(User.email == email).first()
            if not existing:
                db_session.add(User(
                    id=uuid4(),
                    email=email,
                    name=f"{first} {last}",
                    password_hash=get_password_hash("password123"),
                    role=role,
                    organization_id=_UUID(organization_id),
                    is_active=True,
                    created_at=datetime.utcnow()
                ))
        db_session.commit()
        print("  Inserted 12 users (2 demo + 10 generated)")
    except Exception as u_err:
        db_session.rollback()
        print(f"  Could not seed users: {u_err}")

    # ---- Optionally clear existing data ----
    if clear_existing:
        tables_to_clear = [
            'requisition_plan_links', 'scenario_adjustments', 'planning_scenarios',
            'workforce_plan_history', 'workforce_plans', 'planning_periods',
            'recruiter_goals',
            'compensation_plan_history', 'compensation_changes',
            'compensation_plans', 'compensation_bands',
            'metric_definitions',
            'kpi_measurements', 'kpi_targets', 'kpi_definitions',
            'attendance_records', 'attendance_targets',
            'org_health_alerts',
            'interviews', 'candidates', 'job_requisitions', 'employees',
            'sync_logs', 'data_uploads',
            'ai_messages', 'ai_conversations',
            'query_executions', 'saved_queries',
        ]
        print("Clearing existing data...")
        for table_name in tables_to_clear:
            try:
                savepoint = db_session.begin_nested()
                db_session.execute(
                    text(f"TRUNCATE TABLE {table_name} CASCADE")
                )
                savepoint.commit()
            except Exception:
                savepoint.rollback()
        db_session.commit()

    # ---- 0. Seed organization financials (Historical) ----
    try:
        from database.models import Organization, OrganizationFinancial, MetricDefinition
        org = db_session.query(Organization).filter(Organization.id == _UUID(organization_id)).first()
        
        # Base revenue for 2024
        base_revenue = 120000000.0  # $120M
        base_equity_pool = 4000000.0 # $4M
        
        for y in range(2024, 2027):
            # Growth curve over 2 years
            growth_factor = 1.0 + (0.10 + random.uniform(0, 0.10)) * (y - 2023)
            rev = base_revenue * growth_factor
            prof = rev * (0.12 + random.uniform(0, 0.08))
            
            eq_total = base_equity_pool * growth_factor
            eq_rem = eq_total * (0.3 + random.uniform(0, 0.4))
            
            # Upsert yearly financial record
            fin = db_session.query(OrganizationFinancial).filter(
                OrganizationFinancial.organization_id == _UUID(organization_id),
                OrganizationFinancial.year == y
            ).first()
            
            if not fin:
                fin = OrganizationFinancial(organization_id=_UUID(organization_id), year=y)
                db_session.add(fin)
            
            fin.annual_revenue = round(rev, -3)
            fin.annual_profit = round(prof, -3)
            fin.equity_pool_total = round(eq_total, -3)
            fin.equity_pool_remaining = round(eq_rem, -3)
            
        db_session.commit()
        print(f"  Seeded historical organization financials (2024-2026)")

        # Seed system metric definitions
        metric_count = seed_system_metrics(db_session, organization_id, user_id)

    except Exception as fin_err:
        db_session.rollback()
        print(f"  Could not set org financials/metrics: {fin_err}")
        import traceback
        traceback.print_exc()

    # ---- 1. Requisitions ----
    print(f"Generating {requisition_count} requisitions...")
    req_data = generate_requisitions(requisition_count, organization_id)
    requisition_ids = [r['id'] for r in req_data]
    for r in req_data:
        db_session.add(JobRequisition(
            id=r['id'],
            title=r['title'],
            department=r['department'],
            location=r['location'],
            job_level=r['job_level'],
            status=RequisitionStatus[r['status']],
            open_date=r['open_date'],
            target_fill_date=r['target_fill_date'],
            filled_date=r['filled_date'],
            closed_date=r['closed_date'],
            salary_min=r['salary_min'],
            salary_max=r['salary_max'],
            currency=r['currency'],
            urgency=r['urgency'],
            headcount=r['headcount'],
            description=r['description'],
            requirements=r['requirements'],
            benefits=r['benefits'],
            applicant_count=r['applicant_count'],
            interview_count=r['interview_count'],
            offer_count=r['offer_count'],
            source_system=r['source_system'],
            organization_id=organization_id,
        ))
    db_session.commit()
    print(f"  Inserted {len(req_data)} requisitions")

    # ---- 2. Employees (insert without manager_id first, then update) ----
    print(f"Generating {employee_count} employees...")
    emp_data = generate_employees(employee_count, organization_id)
    active_employee_ids = []
    batch_size = 500

    # First pass: insert all employees WITHOUT manager_id to avoid FK violations
    for idx, e in enumerate(emp_data):
        db_session.add(Employee(
            id=e['id'],
            employee_id=e['employee_id'],
            first_name=e['first_name'],
            last_name=e['last_name'],
            email=e['email'],
            phone=e['phone'],
            department=e['department'],
            team=e.get('team'),
            cost_center=e.get('cost_center'),
            job_title=e['job_title'],
            job_level=e['job_level'],
            manager_id=None,
            location=e['location'],
            work_type=e['work_type'],
            status=EmployeeStatus[e['status']],
            hire_date=e['hire_date'],
            termination_date=e['termination_date'],
            termination_reason=e['termination_reason'],
            salary=e['salary'],
            currency=e['currency'],
            bonus_target=e['bonus_target'],
            equity_grants=e['equity_grants'],
            age=e['age'],
            gender=e['gender'],
            ethnicity=e['ethnicity'],
            date_of_birth=e.get('date_of_birth'),
            performance_rating=e['performance_rating'],
            engagement_score=e['engagement_score'],
            last_review_date=e['last_review_date'],
            last_promotion_date=e['last_promotion_date'],
            training_hours=e['training_hours'],
            tenure=e['tenure'],
            flight_risk=e['flight_risk'],
            source_system=e['source_system'],
            previous_company=e.get('previous_company'),
            reason_for_leaving=e.get('reason_for_leaving'),
            quality_of_hire_score=e.get('quality_of_hire_score'),
            cost_per_hire=e.get('cost_per_hire'),
            total_pto_days=e.get('total_pto_days', 25.0),
            used_pto_days=e.get('used_pto_days', 0.0),
            total_bank_holidays=e.get('total_bank_holidays', 8.0),
            used_bank_holidays=e.get('used_bank_holidays', 0.0),
            equity_type=e.get('equity_type'),
            equity_shares=e.get('equity_shares', 0.0),
            equity_value=e.get('equity_value', 0.0),
            nationality=e.get('nationality'),
            employment_type=e.get('employment_type'),
            source=e.get('source'),
            organization_id=organization_id,
        ))
        if e['status'] == 'active':
            active_employee_ids.append(e['id'])
        if (idx + 1) % batch_size == 0:
            db_session.commit()
            print(f"    Committed {idx + 1}/{employee_count} employees...")
    db_session.commit()
    print(f"  Inserted {len(emp_data)} employees ({len(active_employee_ids)} active)")

    # Second pass: update manager_id and hired_by_id now that all employees exist
    print("  Assigning managers and recruiters (hired_by)...")
    
    active_employee_ids = [e['id'] for e in emp_data if e['status'] == 'active']
    
    # Identify recruiters to be used for hired_by_id
    recruiter_ids = [
        e['id'] for e in emp_data 
        if 'Recruiter' in e['job_title'] or 'Talent' in e['job_title'] or 'HR' in e['job_title']
    ]
    # Fallback to a slice if no recruiters found by title
    if not recruiter_ids:
        recruiter_ids = active_employee_ids[:50]

    # Use recruiters or top employees as interviewers
    interviewer_ids = recruiter_ids if recruiter_ids else active_employee_ids[:100]

    for batch_start in range(0, len(emp_data), batch_size):
        batch = emp_data[batch_start:batch_start + batch_size]
        for e in batch:
            update_vals = {}
            if e.get('manager_id'):
                update_vals['manager_id'] = e['manager_id']
            
            # "hired_by_id" represents the Recruiter responsible for the hire
            if recruiter_ids and random.random() > 0.1:
                update_vals['hired_by_id'] = random.choice(recruiter_ids)
            
            if update_vals:
                db_session.query(Employee).filter(Employee.id == e['id']).update(update_vals)
        db_session.commit()
    print(f"  Assigned manager and recruiter (hired_by) relationships")

    # ---- 3. Candidates ----
    print(f"Generating {candidate_count} candidates...")
    cand_data = generate_candidates(candidate_count, requisition_ids, organization_id)
    for batch_start in range(0, len(cand_data), batch_size):
        batch = cand_data[batch_start:batch_start + batch_size]
        for c in batch:
            db_session.add(Candidate(
                id=c['id'],
                first_name=c['first_name'],
                last_name=c['last_name'],
                email=c['email'],
                phone=c['phone'],
                applied_position=c['applied_position'],
                requisition_id=c['requisition_id'],
                department=c['department'],
                application_date=c['application_date'],
                source=c['source'],
                status=CandidateStatus[c['status']],
                stage=c['stage'],
                stage_entered_date=c['stage_entered_date'],
                expected_salary=c['expected_salary'],
                offered_salary=c['offered_salary'],
                offer_date=c['offer_date'],
                offer_accepted_date=c['offer_accepted_date'],
                start_date=c['start_date'],
                rejection_reason=c['rejection_reason'],
                rejection_date=c['rejection_date'],
                resume_score=c['resume_score'],
                interview_score=c['interview_score'],
                assessment_score=c['assessment_score'],
                overall_rating=c['overall_rating'],
                source_system=c['source_system'],
                organization_id=organization_id,
            ))
        db_session.commit()
        print(f"    Committed {min(batch_start + batch_size, len(cand_data))}/{len(cand_data)} candidates...")
    print(f"  Inserted {len(cand_data)} candidates")

    # ---- 3.1 Interviews ----
    print(f"Generating interviews for {len(cand_data)} candidates...")
    interview_data = generate_interviews(organization_id, cand_data, interviewer_ids)
    for batch_start in range(0, len(interview_data), batch_size):
        batch = interview_data[batch_start:batch_start + batch_size]
        for i in batch:
            db_session.add(Interview(
                id=i['id'],
                candidate_id=i['candidate_id'],
                interviewer_id=i['interviewer_id'],
                organization_id=i['organization_id'],
                interview_date=i['interview_date'],
                interview_type=i['interview_type'],
                score=i['score'],
                recommendation=i['recommendation'],
                notes=i['notes'],
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            ))
        db_session.commit()
        print(f"    Committed {min(batch_start + batch_size, len(interview_data))}/{len(interview_data)} interviews...")
    print(f"  Inserted {len(interview_data)} interviews")

    # ---- 4. KPI Definitions ----
    print("Generating KPI definitions...")
    kpi_defs = generate_kpi_definitions(organization_id, user_id)
    for k in kpi_defs:
        db_session.add(KPIDefinition(
            id=k['id'],
            organization_id=k['organization_id'],
            name=k['name'],
            description=k['description'],
            category=k['category'],
            metric_key=k['metric_key'],
            unit=k['unit'],
            calculation_method=k['calculation_method'],
            is_system=k['is_system'],
            is_active=k['is_active'],
            created_by=k['created_by'],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        ))
    db_session.commit()
    print(f"  Inserted {len(kpi_defs)} KPI definitions")

    # ---- 5. KPI Targets ----
    print("Generating KPI targets (org + all depts + all teams + employees)...")
    kpi_targets = generate_kpi_targets(organization_id, kpi_defs, active_employee_ids)
    for t in kpi_targets:
        db_session.add(KPITarget(
            id=t['id'],
            kpi_definition_id=t['kpi_definition_id'],
            organization_id=t['organization_id'],
            target_value=t['target_value'],
            warning_threshold=t['warning_threshold'],
            critical_threshold=t['critical_threshold'],
            effective_from=t['effective_from'],
            effective_to=t['effective_to'],
            status=t['status'],
            org_unit=t['org_unit'],
            org_unit_type=t['org_unit_type'],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        ))
    db_session.commit()
    print(f"  Inserted {len(kpi_targets)} KPI targets")

    # ---- 5.1 KPI Measurements (13 months of history) ----
    print("Generating KPI measurements (13 months history)...")
    kpi_measurements = generate_kpi_measurements(organization_id, kpi_defs, months=13)
    for m in kpi_measurements:
        db_session.add(KPIMeasurement(
            id=m['id'],
            kpi_definition_id=m['kpi_definition_id'],
            organization_id=m['organization_id'],
            measurement_date=m['measurement_date'],
            period_type=m['period_type'],
            measured_value=m['measured_value'],
            variance=m['variance'],
            data_source=m['data_source'],
            created_at=m['created_at'],
        ))
    db_session.commit()
    print(f"  Inserted {len(kpi_measurements)} KPI measurements")

    # --- 6. Historical Data (for AI trends) ---
    print("Generating historical headcount and compensation trends...")
    history_months = 24
    historical_metrics = []
    today = date.today()
    
    # Simulate a realistic growth curve back 24 months
    for month_offset in range(history_months, 0, -1):
        record_date = today - timedelta(days=month_offset * 30)
        # 2% attrition, 3% growth per month approx
        growth_factor = 1.0 - (month_offset * 0.015) 
        hc = int(len(active_employee_ids) * growth_factor)
        
        # Total salary (avg salary * hc)
        total_comp = hc * 105000 / 12 # Rough average
        
        historical_metrics.append({
            'period': record_date.strftime('%Y-%m'),
            'headcount': hc,
            'total_compensation': round(total_comp, 2),
            'turnover_rate': round(random.uniform(1.0, 2.5), 1),
            'avg_performance': round(random.uniform(3.5, 3.9), 1)
        })
    
    # We can store this in a generic Metrics table or similar if it exists
    # For now, we've improved the Employee hire_dates which is the primary source
    # Fully populate for all active employees as requested
    print(f"Generating attendance records for {len(active_employee_ids)} employees (730 days)...")
    
    # Process in batches of employees to keep memory usage sane
    batch_size_employees = 100
    total_attendance_count = 0
    for i in range(0, len(active_employee_ids), batch_size_employees):
        emp_batch = active_employee_ids[i:i + batch_size_employees]
        att_records = generate_attendance_records(
            organization_id, emp_batch, days=730,
        )

        # Prepare for bulk insert
        mappings = []
        for a in att_records:
            mappings.append({
                'id': a['id'],
                'organization_id': a['organization_id'],
                'employee_id': a['employee_id'],
                'record_date': a['record_date'],
                'status': AttendanceStatus[a['status']],
                'check_in_time': a['check_in_time'],
                'check_out_time': a['check_out_time'],
                'location': a['location'],
                'source_system': a['source_system'],
                'created_at': datetime.utcnow(),
            })

        # Fast bulk insert
        db_session.bulk_insert_mappings(AttendanceRecord, mappings)
        db_session.commit()
        total_attendance_count += len(mappings)
        print(f"    Inserted {len(mappings)} records for employees {i} to {min(i + batch_size_employees, len(active_employee_ids))}...")

    print(f"  Attendance seeding complete")

    # ---- 7. Attendance Targets ----
    print("Generating attendance targets...")
    att_targets = generate_attendance_targets(organization_id)
    for at in att_targets:
        db_session.add(AttendanceTarget(
            id=at['id'],
            organization_id=at['organization_id'],
            org_unit=at['org_unit'],
            org_unit_type=at['org_unit_type'],
            target_days_per_week=at['target_days_per_week'],
            target_pct=at['target_pct'],
            effective_from=at['effective_from'],
            effective_to=at['effective_to'],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        ))
    db_session.commit()
    print(f"  Inserted {len(att_targets)} attendance targets")

    # ---- 8. Org Health Alerts ----
    print("Generating org health alerts...")
    alerts = generate_org_health_alerts(organization_id)
    for al in alerts:
        db_session.add(OrgHealthAlert(
            id=al['id'],
            organization_id=al['organization_id'],
            alert_type=al['alert_type'],
            severity=AlertSeverity[al['severity']],
            status=AlertStatus[al['status']],
            title=al['title'],
            description=al['description'],
            affected_org_unit=al['affected_org_unit'],
            affected_org_unit_type=al['affected_org_unit_type'],
            metric_name=al['metric_name'],
            metric_value=al['metric_value'],
            threshold_value=al['threshold_value'],
            trend_direction=al['trend_direction'],
            trend_period_days=al['trend_period_days'],
            contributing_factors=al['contributing_factors'],
            recommendations=al['recommendations'],
            created_at=al['created_at'],
            updated_at=datetime.utcnow(),
        ))
    db_session.commit()
    print(f"  Inserted {len(alerts)} org health alerts")

    # ---- 9. Recruiter Goals (60 recruiters x 3 years) ----
    print("Generating recruiter goals (60 recruiters x [2024, 2025, 2026])...")
    rg_data = generate_recruiter_goals(organization_id, years=[2024, 2025, 2026])
    for rg in rg_data:
        db_session.add(RecruiterGoal(
            id=rg['id'],
            name=rg['name'],
            seniority=rg['seniority'],
            location=rg['location'],
            manager=rg['manager'],
            employment_type=rg['employment_type'],
            q1_goal=rg['q1_goal'],
            q2_goal=rg['q2_goal'],
            q3_goal=rg['q3_goal'],
            q4_goal=rg['q4_goal'],
            q1_actual=rg['q1_actual'],
            q2_actual=rg['q2_actual'],
            q3_actual=rg['q3_actual'],
            q4_actual=rg['q4_actual'],
            eligible_for_bonus=rg['eligible_for_bonus'],
            bonus_notes=rg['bonus_notes'],
            monthly_capacity=rg['monthly_capacity'],
            utilization_pct=rg['utilization_pct'],
            specializations=rg['specializations'],
            overhead_pct=rg['overhead_pct'],
            max_concurrent_reqs=rg['max_concurrent_reqs'],
            organization_id=organization_id,
            year=rg['year'],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        ))
    db_session.commit()
    print(f"  Inserted {len(rg_data)} recruiter goals")

    # ---- 10. Compensation Bands ----
    print("Generating compensation bands...")
    try:
        from database.models import CompensationBand
        for dept in DEPARTMENTS:
            for level in JOB_LEVELS:
                for loc in ['New York', 'San Francisco', 'Remote']:
                    base = calculate_salary(dept, level, loc)
                    db_session.add(CompensationBand(
                        id=str(uuid4()),
                        organization_id=organization_id,
                        job_family=dept,
                        job_level=level,
                        location=loc,
                        currency='USD',
                        min_salary=round(base * 0.80, -2),
                        mid_salary=round(base, -2),
                        max_salary=round(base * 1.25, -2),
                        effective_date=date(2025, 1, 1),
                        end_date=date(2026, 12, 31),
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow(),
                    ))
                    comp_band_count += 1
        db_session.commit()
        print(f"  Inserted {comp_band_count} compensation bands")
    except Exception as e:
        db_session.rollback()
        print(f"  Compensation bands skipped: {e}")
        comp_band_count = 0

    # ---- 11. Planning Periods & Workforce Plans ----
    print("Generating planning periods and workforce plans...")
    from sqlalchemy import func as sa_func
    dept_counts = db_session.query(
        Employee.department,
        sa_func.count(Employee.id),
    ).filter(
        Employee.organization_id == organization_id,
        Employee.status == EmployeeStatus.active,
    ).group_by(Employee.department).all()

    department_headcounts = {dept: count for dept, count in dept_counts}

    planning_data = generate_planning_periods_and_plans(
        organization_id=organization_id,
        user_id=user_id,
        department_headcounts=department_headcounts,
    )

    pp = planning_data['period']
    db_session.add(PlanningPeriod(
        id=pp['id'],
        organization_id=pp['organization_id'],
        name=pp['name'],
        description=pp['description'],
        start_date=pp['start_date'],
        end_date=pp['end_date'],
        status=pp['status'],
        period_type=pp['period_type'],
        created_by=pp['created_by'],
        approved_by=pp['approved_by'],
        approved_at=pp['approved_at'],
        created_at=pp['created_at'],
        updated_at=pp['updated_at'],
    ))
    db_session.commit()

    for wp in planning_data['plans']:
        db_session.add(WorkforcePlan(
            id=wp['id'],
            period_id=wp['period_id'],
            organization_id=wp['organization_id'],
            department=wp['department'],
            starting_headcount=wp['starting_headcount'],
            planned_hires=wp['planned_hires'],
            planned_attrition=wp['planned_attrition'],
            planned_transfers_in=wp['planned_transfers_in'],
            planned_transfers_out=wp['planned_transfers_out'],
            planned_ending_headcount=wp['planned_ending_headcount'],
            actual_headcount=wp['actual_headcount'],
            actual_hires=wp['actual_hires'],
            actual_attrition=wp['actual_attrition'],
            actual_transfers_in=wp['actual_transfers_in'],
            actual_transfers_out=wp['actual_transfers_out'],
            headcount_variance=wp['headcount_variance'],
            hires_variance=wp['hires_variance'],
            attrition_variance=wp['attrition_variance'],
            last_synced_at=wp['last_synced_at'],
            created_at=wp['created_at'],
            updated_at=wp['updated_at'],
        ))
    db_session.commit()
    print(f"  Inserted 1 planning period and {len(planning_data['plans'])} workforce plans")

    # ---- 12. Master CSV Export ----
    print("Exporting master CSV...")
    csv_path = export_master_csv(emp_data)
    print(f"  Exported to {csv_path}")

    print("=== Full Database Seed Complete ===")

    result = {
        'employees': len(emp_data),
        'active_employees': len(active_employee_ids),
        'candidates': len(cand_data),
        'requisitions': len(req_data),
        'kpi_definitions': len(kpi_defs),
        'kpi_targets': len(kpi_targets),
        'kpi_measurements': len(kpi_measurements),
        'attendance_records': total_attendance_count,
        'attendance_targets': len(att_targets),
        'org_health_alerts': len(alerts),
        'recruiter_goals': len(rg_data),
        'metric_definitions': metric_count,
        'compensation_bands': comp_band_count,
        'planning_periods': 1,
        'workforce_plans': len(planning_data['plans']),
        'interviews': len(interview_data),
        'csv_export_path': csv_path,
    }

    return result


# =============================================================================
# Legacy seed function (kept for backward compatibility)
# =============================================================================

def seed_database(db_session, organization_id: str = None,
                  employee_count: int = 500, candidate_count: int = 200,
                  requisition_count: int = 50):
    """Simplified seed function (legacy). Use seed_full_database for complete seeding."""
    from database.models import (
        Employee, Candidate, JobRequisition,
        EmployeeStatus, CandidateStatus, RequisitionStatus,
    )

    print(f"Starting database seeding...")
    print(f"  - Employees: {employee_count}")
    print(f"  - Candidates: {candidate_count}")
    print(f"  - Requisitions: {requisition_count}")

    req_data = generate_requisitions(requisition_count, organization_id)
    requisition_ids = [r['id'] for r in req_data]
    emp_data = generate_employees(employee_count, organization_id)
    cand_data = generate_candidates(candidate_count, requisition_ids, organization_id)

    for r in req_data:
        db_session.add(JobRequisition(
            id=r['id'], title=r['title'], department=r['department'],
            location=r['location'], job_level=r['job_level'],
            status=RequisitionStatus[r['status']],
            open_date=r['open_date'], target_fill_date=r['target_fill_date'],
            filled_date=r['filled_date'], closed_date=r['closed_date'],
            salary_min=r['salary_min'], salary_max=r['salary_max'],
            currency=r['currency'], urgency=r['urgency'],
            headcount=r['headcount'], description=r['description'],
            requirements=r['requirements'], benefits=r['benefits'],
            applicant_count=r['applicant_count'],
            interview_count=r['interview_count'],
            offer_count=r['offer_count'], source_system=r['source_system'],
        ))
    db_session.commit()

    for e in emp_data:
        db_session.add(Employee(
            id=e['id'], employee_id=e['employee_id'],
            first_name=e['first_name'], last_name=e['last_name'],
            email=e['email'], phone=e['phone'],
            department=e['department'], job_title=e['job_title'],
            job_level=e['job_level'], manager_id=e['manager_id'],
            location=e['location'], work_type=e['work_type'],
            status=EmployeeStatus[e['status']],
            hire_date=e['hire_date'],
            termination_date=e['termination_date'],
            termination_reason=e['termination_reason'],
            salary=e['salary'], currency=e['currency'],
            bonus_target=e['bonus_target'], equity_grants=e['equity_grants'],
            age=e['age'], gender=e['gender'], ethnicity=e['ethnicity'],
            performance_rating=e['performance_rating'],
            engagement_score=e['engagement_score'],
            last_review_date=e['last_review_date'],
            last_promotion_date=e['last_promotion_date'],
            training_hours=e['training_hours'], tenure=e['tenure'],
            flight_risk=e['flight_risk'], source_system=e['source_system'],
            previous_company=e.get('previous_company'),
            reason_for_leaving=e.get('reason_for_leaving'),
            quality_of_hire_score=e.get('quality_of_hire_score'),
            cost_per_hire=e.get('cost_per_hire'),
            total_pto_days=e.get('total_pto_days', 25.0),
            used_pto_days=e.get('used_pto_days', 0.0),
            total_bank_holidays=e.get('total_bank_holidays', 8.0),
            used_bank_holidays=e.get('used_bank_holidays', 0.0),
            nationality=e.get('nationality'),
            employment_type=e.get('employment_type'),
            source=e.get('source'),
        ))
    db_session.commit()

    for c in cand_data:
        db_session.add(Candidate(
            id=c['id'], first_name=c['first_name'],
            last_name=c['last_name'], email=c['email'],
            phone=c['phone'], applied_position=c['applied_position'],
            requisition_id=c['requisition_id'],
            department=c['department'],
            application_date=c['application_date'],
            source=c['source'], status=CandidateStatus[c['status']],
            stage=c['stage'], stage_entered_date=c['stage_entered_date'],
            expected_salary=c['expected_salary'],
            offered_salary=c['offered_salary'],
            offer_date=c['offer_date'],
            offer_accepted_date=c['offer_accepted_date'],
            start_date=c['start_date'],
            rejection_reason=c['rejection_reason'],
            rejection_date=c['rejection_date'],
            resume_score=c['resume_score'],
            interview_score=c['interview_score'],
            assessment_score=c['assessment_score'],
            overall_rating=c['overall_rating'],
            source_system=c['source_system'],
        ))
    db_session.commit()

    print("Database seeding completed successfully!")
    return {
        'employees': len(emp_data),
        'candidates': len(cand_data),
        'requisitions': len(req_data),
    }


if __name__ == '__main__':
    from database.connection import SessionLocal
    from database.models import Organization, User, UserRole
    from services.auth.security import get_password_hash
    import sys

    # Check for --test flag
    if '--test' in sys.argv:
        import json
        print("Testing data generators...")
        random.seed(42)
        employees = generate_employees(10)
        print(f"\nGenerated {len(employees)} employees:")
        print(json.dumps(employees[0], indent=2, default=str))
        sys.exit(0)

    db = SessionLocal()
    try:
        print("Initializing database seeding...")
        
        # 1. Ensure test organization exists
        org_id = "test-org-id"
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            org = Organization(id=org_id, name="Test Corporation", domain="company.com")
            db.add(org)
            db.commit()
            print(f"  Created test organization: {org.name}")

        # 2. Ensure admin user exists
        admin_email = "admin@interface.app"
        admin = db.query(User).filter(User.email == admin_email).first()
        if not admin:
            admin = User(
                id=uuid4(),
                email=admin_email,
                name="Admin User",
                password_hash=get_password_hash("admin123"),
                role=UserRole.admin,
                organization_id=org_id,
                is_active=True
            )
            db.add(admin)
            db.commit()
            print(f"  Created admin user: {admin_email}")

        # 3. Run full seed
        counts = seed_full_database(
            db_session=db,
            organization_id=org_id,
            user_id=str(admin.id),
            employee_count=1000, # Sane default for quick dev, user can increase
            candidate_count=500,
            requisition_count=100,
            clear_existing=True
        )
        
        print("\n" + "="*30)
        print("SUCCESS: Database fully seeded!")
        for table, count in counts.items():
            print(f"  - {table.replace('_', ' ').title()}: {count}")
        print("="*30)

    except Exception as e:
        print(f"\nERROR during seeding: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()
