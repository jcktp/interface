from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session
import logging

from database.models import ApiConnection
from services.crud import ConnectionCRUD, SyncLogCRUD, EmployeeCRUD, CandidateCRUD, RequisitionCRUD
from .provider_base import ConnectionConfig, BaseProvider, SyncResult
from .providers import (
    BambooHRProvider,
    WorkdayProvider,
    GreenhouseProvider,
    LeverProvider,
    ADPProvider,
    SAPSuccessFactorsProvider,
    UKGProvider,
    PaylocityProvider,
    AshbyProvider,
)

logger = logging.getLogger(__name__)

class SyncService:
    PROVIDER_MAP = {
        "bamboohr": BambooHRProvider,
        "workday": WorkdayProvider,
        "greenhouse": GreenhouseProvider,
        "lever": LeverProvider,
        "adp": ADPProvider,
        "sap_successfactors": SAPSuccessFactorsProvider,
        "ukg": UKGProvider,
        "paylocity": PaylocityProvider,
        "ashby": AshbyProvider,
    }

    @staticmethod
    def run_sync(db: Session, connection_id: UUID) -> Dict[str, Any]:
        """
        Run a sync for the given connection.
        """
        # 1. Get connection details
        connection = ConnectionCRUD.get_by_id(db, connection_id)
        if not connection:
            logger.error(f"Connection {connection_id} not found")
            return {"status": "error", "message": "Connection not found"}

        # 2. Create sync log
        sync_log = SyncLogCRUD.create(db, connection_id, "full_sync")
        
        try:
            # 3. Initialize provider
            provider_class = SyncService.PROVIDER_MAP.get(connection.provider)
            if not provider_class:
                raise ValueError(f"Provider {connection.provider} not supported")

            # Decrypt secrets (placeholder)
            # In a real app, use a proper encryption service
            api_key = connection.api_key_encrypted if hasattr(connection, 'api_key_encrypted') else connection.api_key
            client_secret = connection.client_secret_encrypted if hasattr(connection, 'client_secret_encrypted') else connection.client_secret

            config = ConnectionConfig(
                provider=connection.provider,
                api_key=api_key,
                client_id=connection.client_id,
                client_secret=client_secret,
                endpoint_url=connection.endpoint_url,
                # extra_config could be stored in a JSON column if needed
            )

            provider = provider_class(config)

            # 4. Perform Sync
            total_fetched = 0
            total_created = 0
            total_updated = 0
            total_failed = 0
            errors = []

            # Sync Employees
            if "employees" in provider.supported_data_types:
                emp_result = provider.fetch_employees()
                if emp_result.success:
                    # Save employees
                    for emp_data in emp_result.data:
                        try:
                            # Check if exists
                            existing = EmployeeCRUD.get_by_employee_id(db, emp_data["employee_id"])
                            if existing:
                                EmployeeCRUD.update(db, existing.id, emp_data)
                                total_updated += 1
                            else:
                                EmployeeCRUD.create(db, emp_data)
                                total_created += 1
                        except Exception as e:
                            total_failed += 1
                            errors.append(f"Employee sync error: {str(e)}")
                    
                    total_fetched += emp_result.records_fetched
                else:
                    errors.extend(emp_result.errors)

            # Sync Candidates
            if "candidates" in provider.supported_data_types:
                cand_result = provider.fetch_candidates()
                if cand_result.success:
                    # Save candidates
                    for cand_data in cand_result.data:
                        try:
                            # Simple check by email for now
                            # In real app, use external_id if available
                            existing = None # Implementation of get_by_external_id needed, or email
                            # For now, just create new if email is unique
                            CandidateCRUD.create(db, cand_data)
                            total_created += 1
                        except Exception as e:
                            total_failed += 1
                            errors.append(f"Candidate sync error: {str(e)}")
                    
                    total_fetched += cand_result.records_fetched
                else:
                    errors.extend(cand_result.errors)

            # Sync Jobs/Requisitions
            if "jobs" in provider.supported_data_types:
                 job_result = provider.fetch_jobs()
                 if job_result.success:
                     for job_data in job_result.data:
                         try:
                             RequisitionCRUD.create(db, job_data)
                             total_created += 1
                         except Exception as e:
                             total_failed += 1
                             errors.append(f"Job sync error: {str(e)}")
                     total_fetched += job_result.records_fetched
                 else:
                     errors.extend(job_result.errors)

            # 5. Complete Log
            status = "completed" if not errors else "completed_with_errors"
            error_msg = "; ".join(errors) if errors else None
            
            SyncLogCRUD.complete(
                db, 
                sync_log.id, 
                status, 
                records_fetched=total_fetched,
                records_created=total_created,
                records_updated=total_updated,
                records_failed=total_failed,
                error_message=error_msg
            )

            # 6. Update Connection Status
            ConnectionCRUD.update_sync_status(
                db, 
                connection_id, 
                status, 
                records_synced=total_fetched + total_updated, # Just a rough metric
                error=error_msg
            )

            return {
                "status": status,
                "fetched": total_fetched,
                "created": total_created,
                "updated": total_updated,
                "failed": total_failed,
                "errors": errors
            }

        except Exception as e:
            logger.error(f"Sync failed: {e}")
            SyncLogCRUD.complete(db, sync_log.id, "failed", error_message=str(e))
            ConnectionCRUD.update_sync_status(db, connection_id, "error", error=str(e))
            return {"status": "error", "message": str(e)}
