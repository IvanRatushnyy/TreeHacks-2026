"""
DynamoDB: log summary/record pointers with masked patient reference.
Table expected: PK = session_id (or patient_id_masked), attributes = s3_key, created_at, etc.
"""
import hashlib
import time
from typing import Optional

from app.config import settings


def mask_patient_id(patient_id: Optional[str], session_id: str) -> str:
    """Return a masked identifier for DDB (no PHI). Use hash if no patient_id."""
    if (patient_id or "").strip():
        return "masked-" + hashlib.sha256((patient_id.strip() + session_id).encode()).hexdigest()[:16]
    return "masked-" + hashlib.sha256(session_id.encode()).hexdigest()[:16]


def put_summary_record(session_id: str, s3_key: str, patient_id: Optional[str] = None) -> bool:
    """
    Write a record to DDB pointing to the S3 file. Patient details stored masked only.
    Returns True if written, False if DDB not configured or on error.
    """
    if not settings.has_ddb():
        return False
    try:
        import boto3

        ddb = boto3.resource("dynamodb", region_name=settings.aws_region)
        table = ddb.Table(settings.saging_ddb_table)
        patient_masked = mask_patient_id(patient_id, session_id)
        now = str(int(time.time()))
        table.put_item(
            Item={
                "session_id": session_id,
                "patient_id_masked": patient_masked,
                "s3_key": s3_key,
                "created_at": now,
                "type": "summary",
            }
        )
        return True
    except Exception:
        return False
