#!/usr/bin/env python3
"""
Generate realistic sample HR data for the Interface platform.
Produces three CSV files:
  - sample_employees.csv   (200 rows)
  - sample_candidates.csv  (80 rows)
  - sample_requisitions.csv (30 rows)

Data includes proper distributions and correlations:
  - Higher flight risk correlates with lower engagement
  - Terminated employees tend to have lower engagement/performance
  - Salary ranges are realistic per department/title seniority
  - Hire dates skew recent; tenure is derived from hire_date
"""

import csv
import random
import math
import os
from datetime import date, timedelta

random.seed(42)  # reproducibility

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ── helpers ──────────────────────────────────────────────────────────────────

def clamp(val, lo, hi):
    return max(lo, min(hi, val))

def normal_int(mu, sigma, lo, hi):
    return int(clamp(round(random.gauss(mu, sigma)), lo, hi))

def normal_float(mu, sigma, lo, hi, decimals=1):
    return round(clamp(random.gauss(mu, sigma), lo, hi), decimals)

def weighted_choice(options_weights):
    """options_weights: list of (option, weight)"""
    options, weights = zip(*options_weights)
    return random.choices(options, weights=weights, k=1)[0]

def random_date(start: date, end: date) -> date:
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, max(delta, 0)))

# ── name pools ───────────────────────────────────────────────────────────────

FIRST_NAMES_M = [
    "James", "Robert", "Michael", "William", "David", "Richard", "Joseph",
    "Thomas", "Christopher", "Charles", "Daniel", "Matthew", "Anthony",
    "Mark", "Steven", "Andrew", "Joshua", "Kenneth", "Kevin", "Brian",
    "George", "Timothy", "Ronald", "Edward", "Jason", "Jeffrey", "Ryan",
    "Jacob", "Gary", "Nicholas", "Eric", "Jonathan", "Stephen", "Larry",
    "Justin", "Scott", "Brandon", "Benjamin", "Samuel", "Raymond",
    "Gregory", "Frank", "Alexander", "Patrick", "Jack", "Dennis",
    "Jerry", "Tyler", "Aaron", "Nathan", "Henry", "Peter", "Adam",
    "Zachary", "Douglas", "Harold", "Carlos", "Gerald", "Sean", "Austin",
    "Kyle", "Dylan", "Caleb", "Noah", "Ethan", "Liam", "Mason",
    "Logan", "Aiden", "Lucas", "Elijah", "Oliver", "Connor", "Owen",
    "Raj", "Amit", "Vikram", "Sanjay", "Arjun", "Pradeep", "Wei",
    "Jun", "Hiroshi", "Takeshi", "Kenji", "Omar", "Hassan", "Ali",
    "Ahmed", "Diego", "Luis", "Carlos", "Miguel", "Pablo", "Andrei",
]

FIRST_NAMES_F = [
    "Mary", "Patricia", "Jennifer", "Linda", "Barbara", "Elizabeth",
    "Susan", "Jessica", "Sarah", "Karen", "Lisa", "Nancy", "Betty",
    "Margaret", "Sandra", "Ashley", "Dorothy", "Kimberly", "Emily",
    "Donna", "Michelle", "Carol", "Amanda", "Melissa", "Deborah",
    "Stephanie", "Rebecca", "Sharon", "Laura", "Cynthia", "Kathleen",
    "Amy", "Angela", "Shirley", "Anna", "Brenda", "Pamela", "Emma",
    "Nicole", "Helen", "Samantha", "Katherine", "Christine", "Debra",
    "Rachel", "Carolyn", "Janet", "Catherine", "Maria", "Heather",
    "Diane", "Ruth", "Julie", "Olivia", "Joyce", "Virginia", "Victoria",
    "Kelly", "Lauren", "Christina", "Joan", "Evelyn", "Judith", "Megan",
    "Andrea", "Cheryl", "Hannah", "Jacqueline", "Martha", "Gloria",
    "Priya", "Anita", "Sunita", "Meera", "Aisha", "Fatima", "Yuki",
    "Sakura", "Mei", "Ling", "Sofia", "Isabella", "Valentina", "Elena",
    "Natasha", "Olga", "Ingrid", "Astrid", "Freya", "Zara",
]

FIRST_NAMES_NB = [
    "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn",
    "Avery", "Skyler", "Dakota", "Reese", "Finley", "Rowan", "Sage",
    "Kai", "River", "Phoenix", "Blair", "Drew", "Emery",
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia",
    "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez",
    "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore",
    "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris",
    "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
    "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen",
    "Hill", "Flores", "Green", "Adams", "Nelson", "Baker", "Hall",
    "Rivera", "Campbell", "Mitchell", "Carter", "Roberts", "Gomez",
    "Phillips", "Evans", "Turner", "Diaz", "Parker", "Cruz", "Edwards",
    "Collins", "Reyes", "Stewart", "Morris", "Morales", "Murphy",
    "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper",
    "Peterson", "Bailey", "Reed", "Kelly", "Howard", "Ramos", "Kim",
    "Cox", "Ward", "Richardson", "Watson", "Brooks", "Chavez", "Wood",
    "James", "Bennett", "Gray", "Mendoza", "Ruiz", "Hughes", "Price",
    "Alvarez", "Castillo", "Sanders", "Patel", "Myers", "Long", "Ross",
    "Foster", "Jimenez", "Powell", "Jenkins", "Perry", "Russell",
    "Sullivan", "Bell", "Coleman", "Butler", "Henderson", "Barnes",
    "Gonzales", "Fisher", "Vasquez", "Simmons", "Graham", "Murray",
    "Ford", "Castro", "Chen", "Wang", "Zhang", "Liu", "Kumar",
    "Singh", "Sharma", "Gupta", "Tanaka", "Yamamoto", "Sato",
    "Schmidt", "Mueller", "Weber", "Fischer", "Novak", "Kowalski",
]

# ── department config ────────────────────────────────────────────────────────

DEPARTMENTS = {
    "Engineering": {
        "weight": 55,
        "titles": [
            ("Software Engineer", 0.30),
            ("Senior Software Engineer", 0.25),
            ("Staff Engineer", 0.10),
            ("Engineering Manager", 0.08),
            ("Principal Engineer", 0.05),
            ("DevOps Engineer", 0.07),
            ("QA Engineer", 0.05),
            ("Data Engineer", 0.05),
            ("Frontend Engineer", 0.05),
        ],
        "salary_range": (90000, 200000),
    },
    "Sales": {
        "weight": 35,
        "titles": [
            ("Account Executive", 0.30),
            ("Senior Account Executive", 0.15),
            ("Sales Development Representative", 0.20),
            ("Sales Manager", 0.10),
            ("VP of Sales", 0.03),
            ("Enterprise Account Executive", 0.10),
            ("Sales Operations Analyst", 0.07),
            ("Regional Sales Director", 0.05),
        ],
        "salary_range": (60000, 180000),
    },
    "Marketing": {
        "weight": 18,
        "titles": [
            ("Marketing Manager", 0.20),
            ("Content Strategist", 0.15),
            ("Marketing Coordinator", 0.20),
            ("Growth Marketing Manager", 0.15),
            ("Brand Manager", 0.10),
            ("SEO Specialist", 0.10),
            ("VP of Marketing", 0.05),
            ("Marketing Analyst", 0.05),
        ],
        "salary_range": (55000, 160000),
    },
    "Human Resources": {
        "weight": 12,
        "titles": [
            ("HR Generalist", 0.25),
            ("HR Manager", 0.15),
            ("Recruiter", 0.25),
            ("Senior Recruiter", 0.10),
            ("HR Business Partner", 0.10),
            ("Compensation Analyst", 0.08),
            ("VP of People", 0.04),
            ("HR Coordinator", 0.03),
        ],
        "salary_range": (50000, 150000),
    },
    "Finance": {
        "weight": 14,
        "titles": [
            ("Financial Analyst", 0.25),
            ("Senior Financial Analyst", 0.15),
            ("Accountant", 0.20),
            ("Controller", 0.10),
            ("FP&A Manager", 0.10),
            ("CFO", 0.02),
            ("Payroll Specialist", 0.10),
            ("Treasury Analyst", 0.08),
        ],
        "salary_range": (55000, 170000),
    },
    "Operations": {
        "weight": 14,
        "titles": [
            ("Operations Manager", 0.20),
            ("Operations Analyst", 0.20),
            ("Supply Chain Coordinator", 0.15),
            ("Business Operations Associate", 0.15),
            ("VP of Operations", 0.05),
            ("Facilities Manager", 0.10),
            ("Procurement Specialist", 0.10),
            ("Operations Director", 0.05),
        ],
        "salary_range": (50000, 155000),
    },
    "Product": {
        "weight": 16,
        "titles": [
            ("Product Manager", 0.30),
            ("Senior Product Manager", 0.20),
            ("Associate Product Manager", 0.15),
            ("VP of Product", 0.05),
            ("Product Analyst", 0.15),
            ("Technical Product Manager", 0.10),
            ("Product Operations Manager", 0.05),
        ],
        "salary_range": (75000, 190000),
    },
    "Customer Success": {
        "weight": 16,
        "titles": [
            ("Customer Success Manager", 0.30),
            ("Senior Customer Success Manager", 0.15),
            ("Customer Support Specialist", 0.20),
            ("Customer Success Director", 0.08),
            ("Technical Support Engineer", 0.12),
            ("Onboarding Specialist", 0.10),
            ("VP of Customer Success", 0.05),
        ],
        "salary_range": (50000, 150000),
    },
    "Legal": {
        "weight": 8,
        "titles": [
            ("Legal Counsel", 0.25),
            ("Senior Legal Counsel", 0.15),
            ("Paralegal", 0.25),
            ("General Counsel", 0.05),
            ("Compliance Officer", 0.15),
            ("Contract Manager", 0.15),
        ],
        "salary_range": (60000, 180000),
    },
    "Design": {
        "weight": 12,
        "titles": [
            ("UX Designer", 0.25),
            ("Senior UX Designer", 0.15),
            ("UI Designer", 0.15),
            ("Product Designer", 0.15),
            ("Design Manager", 0.10),
            ("UX Researcher", 0.10),
            ("Visual Designer", 0.05),
            ("VP of Design", 0.05),
        ],
        "salary_range": (65000, 170000),
    },
}

LOCATIONS = [
    ("San Francisco", 0.30),
    ("New York", 0.25),
    ("London", 0.15),
    ("Berlin", 0.10),
    ("Remote", 0.20),
]

ETHNICITIES = [
    ("White", 0.40),
    ("Asian", 0.22),
    ("Hispanic or Latino", 0.16),
    ("Black or African American", 0.12),
    ("Two or More Races", 0.06),
    ("Native Hawaiian or Pacific Islander", 0.02),
    ("American Indian or Alaska Native", 0.02),
]

EMPLOYMENT_TYPES = [
    ("full_time", 0.82),
    ("part_time", 0.08),
    ("contractor", 0.10),
]

# ── managers (pre-defined so we can reference them consistently) ─────────────

MANAGERS = [
    "Sarah Chen", "Michael Torres", "David Kim", "Jessica Patel",
    "Robert Garcia", "Amanda Williams", "Christopher Lee", "Emily Johnson",
    "Daniel Martinez", "Laura Thompson", "James Wilson", "Rachel Adams",
    "Thomas Brown", "Stephanie Clark", "Andrew Davis", "Nicole Scott",
    "Kevin Nguyen", "Maria Rodriguez", "Brian Mitchell", "Jennifer Hall",
]

DEPT_MANAGERS = {
    "Engineering": ["Sarah Chen", "Christopher Lee", "Kevin Nguyen", "Daniel Martinez"],
    "Sales": ["Michael Torres", "Robert Garcia", "Brian Mitchell", "Thomas Brown"],
    "Marketing": ["Amanda Williams", "Stephanie Clark"],
    "Human Resources": ["Jessica Patel", "Jennifer Hall"],
    "Finance": ["Laura Thompson", "Andrew Davis"],
    "Operations": ["James Wilson", "Nicole Scott"],
    "Product": ["Emily Johnson", "Rachel Adams"],
    "Customer Success": ["Maria Rodriguez", "Thomas Brown"],
    "Legal": ["David Kim"],
    "Design": ["Daniel Martinez", "Rachel Adams"],
}

COST_CENTERS = {
    "Engineering": ["CC-ENG-100", "CC-ENG-101", "CC-ENG-102"],
    "Sales": ["CC-SAL-200", "CC-SAL-201", "CC-SAL-202"],
    "Marketing": ["CC-MKT-300", "CC-MKT-301"],
    "Human Resources": ["CC-HR-400"],
    "Finance": ["CC-FIN-500", "CC-FIN-501"],
    "Operations": ["CC-OPS-600", "CC-OPS-601"],
    "Product": ["CC-PRD-700", "CC-PRD-701"],
    "Customer Success": ["CC-CS-800", "CC-CS-801"],
    "Legal": ["CC-LGL-900"],
    "Design": ["CC-DSN-1000", "CC-DSN-1001"],
}

# ── salary helpers ───────────────────────────────────────────────────────────

def title_salary_factor(title: str) -> float:
    """Return a multiplier (0-1 within department range) based on seniority."""
    title_lower = title.lower()
    if any(kw in title_lower for kw in ["vp", "director", "general counsel", "cfo"]):
        return random.uniform(0.75, 1.0)
    if any(kw in title_lower for kw in ["senior", "staff", "principal", "lead"]):
        return random.uniform(0.50, 0.85)
    if any(kw in title_lower for kw in ["manager", "controller"]):
        return random.uniform(0.45, 0.75)
    if any(kw in title_lower for kw in ["associate", "coordinator", "specialist", "representative"]):
        return random.uniform(0.0, 0.35)
    return random.uniform(0.15, 0.55)


# ════════════════════════════════════════════════════════════════════════════
#  EMPLOYEES
# ════════════════════════════════════════════════════════════════════════════

def generate_employees(n=200):
    rows = []
    used_emails = set()
    today = date(2025, 12, 1)  # reference date

    # Pre-decide who is terminated (~15%)
    terminated_indices = set(random.sample(range(n), int(n * 0.15)))
    # A few on leave (~4%)
    remaining = set(range(n)) - terminated_indices
    on_leave_indices = set(random.sample(list(remaining), int(n * 0.04)))

    for i in range(n):
        emp_id = f"EMP-{i+1:03d}"

        # Gender
        gender = weighted_choice([("male", 0.48), ("female", 0.46), ("non_binary", 0.06)])
        if gender == "male":
            first_name = random.choice(FIRST_NAMES_M)
        elif gender == "female":
            first_name = random.choice(FIRST_NAMES_F)
        else:
            first_name = random.choice(FIRST_NAMES_NB)

        last_name = random.choice(LAST_NAMES)

        # Ensure unique email
        base_email = f"{first_name.lower()}.{last_name.lower()}@company.com"
        email = base_email
        suffix = 2
        while email in used_emails:
            email = f"{first_name.lower()}.{last_name.lower()}{suffix}@company.com"
            suffix += 1
        used_emails.add(email)

        # Department (weighted)
        dept_items = [(d, info["weight"]) for d, info in DEPARTMENTS.items()]
        department = weighted_choice(dept_items)
        dept_info = DEPARTMENTS[department]

        # Job title (weighted within department)
        job_title = weighted_choice(dept_info["titles"])

        # Hire date: skewed toward recent years
        # Use exponential-ish: more weight on 2022-2025
        year_weights = [
            (2018, 5), (2019, 8), (2020, 10), (2021, 15),
            (2022, 20), (2023, 25), (2024, 30), (2025, 18),
        ]
        hire_year = weighted_choice(year_weights)
        hire_month = random.randint(1, 12)
        hire_day = random.randint(1, 28)
        hire_date = date(hire_year, hire_month, hire_day)
        if hire_date > today:
            hire_date = today - timedelta(days=random.randint(30, 180))

        # Status
        is_terminated = i in terminated_indices
        is_on_leave = i in on_leave_indices
        if is_terminated:
            status = "terminated"
            # Termination date: between hire_date + 90 days and today
            earliest_term = hire_date + timedelta(days=90)
            if earliest_term > today:
                earliest_term = hire_date + timedelta(days=30)
            termination_date = random_date(earliest_term, today).isoformat()
        elif is_on_leave:
            status = "on_leave"
            termination_date = ""
        else:
            status = "active"
            termination_date = ""

        # Tenure
        end = date.fromisoformat(termination_date) if termination_date else today
        tenure_years = round((end - hire_date).days / 365.25, 1)
        if tenure_years < 0:
            tenure_years = 0.1

        # Age
        age = normal_int(35, 9, 22, 62)

        # Ethnicity
        ethnicity = weighted_choice(ETHNICITIES)

        # Location
        location = weighted_choice(LOCATIONS)

        # Manager
        manager = random.choice(DEPT_MANAGERS[department])

        # Salary
        sal_lo, sal_hi = dept_info["salary_range"]
        factor = title_salary_factor(job_title)
        salary = int(sal_lo + factor * (sal_hi - sal_lo))
        # Round to nearest 500
        salary = round(salary / 500) * 500

        # Performance & engagement (correlated, and lower for terminated)
        if is_terminated:
            performance_rating = normal_float(2.8, 0.9, 1.0, 5.0)
            engagement_score = normal_float(2.5, 0.8, 1.0, 5.0)
        else:
            performance_rating = normal_float(3.5, 0.7, 1.0, 5.0)
            # Engagement correlates with performance
            engagement_base = 3.8 + 0.3 * (performance_rating - 3.5)
            engagement_score = normal_float(engagement_base, 0.5, 1.0, 5.0)

        # Flight risk (correlates with engagement)
        if engagement_score <= 2.5:
            flight_risk = weighted_choice([("high", 0.65), ("medium", 0.25), ("low", 0.10)])
        elif engagement_score <= 3.5:
            flight_risk = weighted_choice([("high", 0.15), ("medium", 0.55), ("low", 0.30)])
        else:
            flight_risk = weighted_choice([("high", 0.05), ("medium", 0.25), ("low", 0.70)])
        if is_terminated:
            flight_risk = ""  # n/a for terminated

        # Last promotion date
        if tenure_years >= 1.5 and random.random() < 0.55:
            promo_earliest = hire_date + timedelta(days=365)
            promo_latest = end - timedelta(days=90) if termination_date else today
            if promo_latest > promo_earliest:
                last_promotion_date = random_date(promo_earliest, promo_latest).isoformat()
            else:
                last_promotion_date = ""
        else:
            last_promotion_date = ""

        # Training hours
        if is_terminated:
            training_hours = normal_int(15, 12, 0, 60)
        else:
            training_hours = normal_int(35, 20, 0, 100)

        # Revenue contribution (Sales and Customer Success only)
        if department in ("Sales", "Customer Success") and status == "active":
            if "VP" in job_title or "Director" in job_title or "Manager" in job_title:
                revenue_contribution = random.randint(800000, 3000000)
            elif "Senior" in job_title or "Enterprise" in job_title:
                revenue_contribution = random.randint(400000, 1500000)
            else:
                revenue_contribution = random.randint(100000, 800000)
        else:
            revenue_contribution = ""

        # Cost center
        cost_center = random.choice(COST_CENTERS[department])

        # Employment type
        employment_type = weighted_choice(EMPLOYMENT_TYPES)

        rows.append({
            "employee_id": emp_id,
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "department": department,
            "job_title": job_title,
            "hire_date": hire_date.isoformat(),
            "termination_date": termination_date,
            "status": status,
            "manager": manager,
            "location": location,
            "salary": salary,
            "performance_rating": performance_rating,
            "engagement_score": engagement_score,
            "age": age,
            "gender": gender,
            "ethnicity": ethnicity,
            "tenure_years": tenure_years,
            "flight_risk": flight_risk,
            "last_promotion_date": last_promotion_date,
            "training_hours": training_hours,
            "revenue_contribution": revenue_contribution,
            "cost_center": cost_center,
            "employment_type": employment_type,
        })

    return rows


# ════════════════════════════════════════════════════════════════════════════
#  CANDIDATES
# ════════════════════════════════════════════════════════════════════════════

CANDIDATE_SOURCES = [
    ("LinkedIn", 0.30),
    ("Indeed", 0.15),
    ("Referral", 0.20),
    ("Company Website", 0.15),
    ("Recruiter", 0.12),
    ("Glassdoor", 0.08),
]

CANDIDATE_STATUSES_FLOW = [
    "new", "screening", "interview", "offer", "hired", "rejected",
]

CANDIDATE_STAGES = {
    "new": ["Application Received"],
    "screening": ["Resume Review", "Phone Screen"],
    "interview": ["Technical Interview", "Hiring Manager Interview", "Panel Interview", "Final Round"],
    "offer": ["Offer Extended", "Offer Negotiation"],
    "hired": ["Offer Accepted"],
    "rejected": ["Rejected - Resume", "Rejected - Phone Screen",
                  "Rejected - Technical", "Rejected - Culture Fit",
                  "Rejected - Candidate Withdrew", "Rejected - Compensation"],
}

REJECTION_REASONS = [
    "Insufficient experience",
    "Failed technical assessment",
    "Culture fit concerns",
    "Candidate withdrew",
    "Accepted another offer",
    "Compensation expectations too high",
    "Visa sponsorship required",
    "Overqualified",
    "Underqualified for role level",
    "Poor communication skills",
]

RECRUITER_NAMES = [
    "Jessica Patel", "Jennifer Hall", "Marcus Rivera", "Samantha Cho",
    "Tyler Brooks", "Priya Sharma",
]

APPLIED_POSITIONS = {
    "Engineering": [
        "Software Engineer", "Senior Software Engineer", "Staff Engineer",
        "DevOps Engineer", "Data Engineer", "Frontend Engineer",
    ],
    "Sales": [
        "Account Executive", "Sales Development Representative",
        "Enterprise Account Executive",
    ],
    "Marketing": ["Marketing Manager", "Content Strategist", "Growth Marketing Manager"],
    "Product": ["Product Manager", "Senior Product Manager", "Associate Product Manager"],
    "Design": ["UX Designer", "Product Designer", "UX Researcher"],
    "Customer Success": ["Customer Success Manager", "Technical Support Engineer"],
    "Finance": ["Financial Analyst", "Accountant"],
    "Human Resources": ["Recruiter", "HR Generalist"],
    "Operations": ["Operations Analyst", "Business Operations Associate"],
    "Legal": ["Legal Counsel", "Compliance Officer"],
}


def generate_candidates(n=80):
    rows = []
    used_emails = set()

    # Distribution of statuses
    status_weights = [
        ("new", 0.10),
        ("screening", 0.12),
        ("interview", 0.22),
        ("offer", 0.08),
        ("hired", 0.15),
        ("rejected", 0.33),
    ]

    for i in range(n):
        cand_id = f"CAND-{i+1:03d}"

        gender = weighted_choice([("male", 0.48), ("female", 0.46), ("non_binary", 0.06)])
        if gender == "male":
            first_name = random.choice(FIRST_NAMES_M)
        elif gender == "female":
            first_name = random.choice(FIRST_NAMES_F)
        else:
            first_name = random.choice(FIRST_NAMES_NB)
        last_name = random.choice(LAST_NAMES)

        base_email = f"{first_name.lower()}.{last_name.lower()}@email.com"
        email = base_email
        suffix = 2
        while email in used_emails:
            email = f"{first_name.lower()}.{last_name.lower()}{suffix}@email.com"
            suffix += 1
        used_emails.add(email)

        # Department and position
        dept_items = [(d, info["weight"]) for d, info in DEPARTMENTS.items()]
        department = weighted_choice(dept_items)
        applied_position = random.choice(APPLIED_POSITIONS[department])

        # Application date: last 6 months
        application_date = random_date(date(2025, 6, 1), date(2025, 12, 1))

        source = weighted_choice(CANDIDATE_SOURCES)
        status = weighted_choice(status_weights)
        stage = random.choice(CANDIDATE_STAGES[status])

        recruiter = random.choice(RECRUITER_NAMES)
        hiring_manager = random.choice(DEPT_MANAGERS[department])

        # Salary expectations
        sal_lo, sal_hi = DEPARTMENTS[department]["salary_range"]
        expected_salary = round(random.randint(sal_lo, sal_hi) / 1000) * 1000

        # Offered salary (only if offer or hired)
        offered_salary = ""
        offer_date = ""
        start_date = ""
        rejection_reason = ""

        if status in ("offer", "hired"):
            # Typically slightly below expected
            offered_salary = round(expected_salary * random.uniform(0.90, 1.05) / 1000) * 1000
            offer_date = random_date(application_date + timedelta(days=14),
                                     application_date + timedelta(days=60)).isoformat()
            if status == "hired":
                start_date = random_date(
                    date.fromisoformat(offer_date) + timedelta(days=14),
                    date.fromisoformat(offer_date) + timedelta(days=45)
                ).isoformat()

        if status == "rejected":
            rejection_reason = random.choice(REJECTION_REASONS)

        # Quality score: hired/offer candidates tend higher
        if status == "hired":
            quality_score = normal_float(4.2, 0.5, 2.0, 5.0)
        elif status == "offer":
            quality_score = normal_float(4.0, 0.5, 2.0, 5.0)
        elif status == "rejected":
            quality_score = normal_float(2.5, 0.8, 1.0, 5.0)
        else:
            quality_score = normal_float(3.3, 0.7, 1.0, 5.0)

        rows.append({
            "candidate_id": cand_id,
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "applied_position": applied_position,
            "department": department,
            "application_date": application_date.isoformat(),
            "source": source,
            "status": status,
            "stage": stage,
            "recruiter": recruiter,
            "hiring_manager": hiring_manager,
            "expected_salary": expected_salary,
            "offered_salary": offered_salary,
            "offer_date": offer_date,
            "start_date": start_date,
            "rejection_reason": rejection_reason,
            "quality_score": quality_score,
        })

    return rows


# ════════════════════════════════════════════════════════════════════════════
#  REQUISITIONS
# ════════════════════════════════════════════════════════════════════════════

REQ_STATUSES = [
    ("open", 0.40),
    ("filled", 0.30),
    ("closed", 0.15),
    ("on_hold", 0.15),
]

URGENCIES = [
    ("low", 0.15),
    ("medium", 0.40),
    ("high", 0.30),
    ("critical", 0.15),
]


def generate_requisitions(n=30):
    rows = []
    for i in range(n):
        req_id = f"REQ-{i+1:03d}"

        dept_items = [(d, info["weight"]) for d, info in DEPARTMENTS.items()]
        department = weighted_choice(dept_items)
        title = random.choice(APPLIED_POSITIONS[department])
        location = weighted_choice(LOCATIONS)
        status = weighted_choice(REQ_STATUSES)

        open_date = random_date(date(2025, 1, 1), date(2025, 11, 1))
        # Target fill: 30-90 days after open
        target_fill_date = open_date + timedelta(days=random.randint(30, 90))

        filled_date = ""
        if status == "filled":
            filled_date = random_date(
                open_date + timedelta(days=15),
                min(target_fill_date + timedelta(days=30), date(2025, 12, 1))
            ).isoformat()

        hiring_manager = random.choice(DEPT_MANAGERS[department])
        recruiter = random.choice(RECRUITER_NAMES)

        sal_lo, sal_hi = DEPARTMENTS[department]["salary_range"]
        # Provide a narrower band
        range_center = random.randint(sal_lo, sal_hi)
        salary_min = max(sal_lo, round((range_center - random.randint(10000, 25000)) / 1000) * 1000)
        salary_max = min(sal_hi, round((range_center + random.randint(10000, 25000)) / 1000) * 1000)
        if salary_min >= salary_max:
            salary_min, salary_max = salary_max - 15000, salary_max

        applicants = random.randint(5, 120)
        urgency = weighted_choice(URGENCIES)

        rows.append({
            "requisition_id": req_id,
            "title": title,
            "department": department,
            "location": location,
            "status": status,
            "open_date": open_date.isoformat(),
            "target_fill_date": target_fill_date.isoformat(),
            "filled_date": filled_date,
            "hiring_manager": hiring_manager,
            "recruiter": recruiter,
            "salary_min": salary_min,
            "salary_max": salary_max,
            "applicants": applicants,
            "urgency": urgency,
        })

    return rows


# ════════════════════════════════════════════════════════════════════════════
#  WRITE CSV
# ════════════════════════════════════════════════════════════════════════════

def write_csv(filepath, rows):
    if not rows:
        return
    fieldnames = list(rows[0].keys())
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Written {len(rows)} rows -> {filepath}")


def main():
    print("Generating Interface sample data...")
    print()

    employees = generate_employees(200)
    write_csv(os.path.join(OUTPUT_DIR, "sample_employees.csv"), employees)

    candidates = generate_candidates(80)
    write_csv(os.path.join(OUTPUT_DIR, "sample_candidates.csv"), candidates)

    requisitions = generate_requisitions(30)
    write_csv(os.path.join(OUTPUT_DIR, "sample_requisitions.csv"), requisitions)

    # Quick summary
    print()
    print("=== Employee Summary ===")
    dept_counts = {}
    status_counts = {}
    loc_counts = {}
    for e in employees:
        dept_counts[e["department"]] = dept_counts.get(e["department"], 0) + 1
        status_counts[e["status"]] = status_counts.get(e["status"], 0) + 1
        loc_counts[e["location"]] = loc_counts.get(e["location"], 0) + 1

    print(f"  Total: {len(employees)}")
    print(f"  By status: {dict(sorted(status_counts.items()))}")
    print(f"  By department: {dict(sorted(dept_counts.items()))}")
    print(f"  By location: {dict(sorted(loc_counts.items()))}")

    salaries = [e["salary"] for e in employees]
    print(f"  Salary range: ${min(salaries):,} - ${max(salaries):,}")
    print(f"  Avg salary: ${sum(salaries)//len(salaries):,}")

    perf = [e["performance_rating"] for e in employees]
    eng = [e["engagement_score"] for e in employees]
    print(f"  Avg performance: {sum(perf)/len(perf):.2f}")
    print(f"  Avg engagement: {sum(eng)/len(eng):.2f}")

    terminated = [e for e in employees if e["status"] == "terminated"]
    active = [e for e in employees if e["status"] == "active"]
    if terminated:
        print(f"  Terminated avg engagement: {sum(e['engagement_score'] for e in terminated)/len(terminated):.2f}")
    if active:
        print(f"  Active avg engagement: {sum(e['engagement_score'] for e in active)/len(active):.2f}")

    print()
    print("=== Candidate Summary ===")
    cand_status = {}
    for c in candidates:
        cand_status[c["status"]] = cand_status.get(c["status"], 0) + 1
    print(f"  Total: {len(candidates)}")
    print(f"  By status: {dict(sorted(cand_status.items()))}")

    print()
    print("=== Requisition Summary ===")
    req_status = {}
    for r in requisitions:
        req_status[r["status"]] = req_status.get(r["status"], 0) + 1
    print(f"  Total: {len(requisitions)}")
    print(f"  By status: {dict(sorted(req_status.items()))}")

    print()
    print("Done!")


if __name__ == "__main__":
    main()
