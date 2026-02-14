"""
Optional: load secrets from AWS Secrets Manager into os.environ before config is loaded.
Set USE_AWS_SECRETS=1 and SAGING_SECRETS_NAME=<name> to enable. Secret must be JSON.
"""
import json
import os
import logging

logger = logging.getLogger(__name__)


def load_secrets_if_configured() -> None:
    """If USE_AWS_SECRETS=1 and SAGING_SECRETS_NAME is set, fetch JSON secret and merge into os.environ."""
    if os.getenv("USE_AWS_SECRETS", "").strip() != "1":
        return
    name = os.getenv("SAGING_SECRETS_NAME", "").strip()
    if not name:
        return
    try:
        import boto3
        from botocore.exceptions import ClientError
    except ImportError:
        logger.warning("USE_AWS_SECRETS=1 but boto3 not installed; using env only.")
        return
    try:
        region = os.getenv("AWS_REGION", "us-east-1")
        client = boto3.client("secretsmanager", region_name=region)
        resp = client.get_secret_value(SecretId=name)
        raw = resp.get("SecretString") or ""
        data = json.loads(raw)
        for k, v in data.items():
            if isinstance(v, str) and k not in os.environ:
                os.environ[k] = v
        logger.info("Loaded secrets from AWS Secrets Manager: %s", name)
    except ClientError as e:
        logger.warning("Failed to load AWS secret %s: %s; using env only.", name, e)
    except Exception as e:
        logger.warning("Secrets load error: %s; using env only.", e)
