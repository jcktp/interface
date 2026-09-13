CREATE TABLE employment_records (
    person_id TEXT PRIMARY KEY REFERENCES people(id),
    hire_date TEXT NOT NULL,
    end_date TEXT,
    previous_company TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE financial_periods (
    id TEXT PRIMARY KEY,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    currency TEXT NOT NULL,
    revenue_minor INTEGER NOT NULL,
    profit_minor INTEGER NOT NULL,
    UNIQUE(start_date,end_date,currency)
);
CREATE TABLE workforce_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    target_headcount INTEGER NOT NULL,
    annual_cost_minor INTEGER NOT NULL,
    months INTEGER NOT NULL,
    currency TEXT NOT NULL,
    created_at TEXT NOT NULL
);
