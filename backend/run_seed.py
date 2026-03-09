"""
Database seeding script for Interface
Generates realistic employee, candidate, requisition, KPI, attendance, alert,
recruiter goal, compensation, and planning data at scale.
"""

import csv
import os
import random
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional, Tuple
from uuid import uuid4, UUID
import uuid
from sqlalchemy import text

# Import constants and helpers (copying them in for self-contained script if needed, 
# but usually we can import from the same file)

DEPARTMENTS = [
    'Engineering', 'Product', 'Design', 'Marketing', 'Sales',
    'Customer Success', 'HR', 'Finance', 'Operations',
]

LOCATIONS = [
    'New York', 'San Francisco', 'London', 'Berlin', 'Singapore',
    'Austin', 'Chicago', 'Remote',
]

def run_seed():
    from database.connection import SessionLocal, engine
    from database.models import Base, Organization, User, UserRole
    from utils.jwt import get_password_hash
    
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        print("🚀 Initializing functional database seeding...")
        
        # 1. Ensure test organization exists
        org_id = "00000000-0000-4000-a000-000000000001"
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            org = Organization(
                id=org_id, 
                name="Interface", 
                domain="interface.app",
                equity_pool_total=10000000.0,
                equity_pool_remaining=8500000.0
            )
            db.add(org)
            db.commit()
            print(f"  ✅ Created organization: Interface")
        else:
            org.name = "Interface"
            org.domain = "interface.app"
            org.equity_pool_total = 10000000.0
            org.equity_pool_remaining = 8500000.0
            db.commit()
            print(f"  ✅ Updated organization to: Interface")

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
            print(f"  ✅ Created admin user: {admin_email}")

        # 3. Import the heavy-duty seeding function
        # We define it here or import it if the file structure allows
        from scripts.seed_data import seed_full_database
        
        counts = seed_full_database(
            db_session=db,
            organization_id=org_id,
            user_id=str(admin.id),
            employee_count=1500, # Realistic sample size
            candidate_count=800,
            requisition_count=150,
            clear_existing=True
        )
        
        print("\n" + "="*40)
        print("🎉 SUCCESS: DATABASE FULLY FUNCTIONAL!")
        print("="*40)
        print(f"  - Employees: {counts.get('employees', 0)}")
        print(f"  - Candidates: {counts.get('candidates', 0)}")
        print(f"  - Requisitions: {counts.get('requisitions', 0)}")
        print(f"  - Interviews: {counts.get('interviews', 0)}")
        print("="*40)

    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    run_seed()
