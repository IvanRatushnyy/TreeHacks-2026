#!/usr/bin/env python3
"""
Create S3 bucket and Secrets Manager secret with dummy values.
Run with AWS credentials in env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION.

  export AWS_ACCESS_KEY_ID=...
  export AWS_SECRET_ACCESS_KEY=...
  export AWS_REGION=us-east-1
  python scripts/setup_aws.py

Optional: SAGING_SECRETS_NAME=my-secret BUCKET_NAME=saging-demo-myteam python scripts/setup_aws.py
"""
import json
import os
import sys
import uuid

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    print("Install boto3: pip install boto3", file=sys.stderr)
    sys.exit(1)


REGION = os.getenv("AWS_REGION", "us-east-1")
SECRET_NAME = os.getenv("SAGING_SECRETS_NAME", "saging-api-secrets")
BUCKET_PREFIX = "saging-records"


def make_bucket_name() -> str:
    custom = os.getenv("BUCKET_NAME", "").strip()
    if custom:
        return custom
    return f"{BUCKET_PREFIX}-{uuid.uuid4().hex[:12]}"


def get_dummy_secret_json(bucket_name: str) -> dict:
    """Keys the app reads. Put real values in AWS Console → Secrets Manager after creation."""
    return {
        "CLAUDE_API_KEY": "sk-ant-dummy-replace-in-console",
        "OPENAI_API_KEY": "sk-dummy-replace-in-console",
        "SAGING_S3_BUCKET": bucket_name,
    }


def create_bucket(s3, bucket_name: str) -> bool:
    try:
        if REGION == "us-east-1":
            s3.create_bucket(Bucket=bucket_name)
        else:
            s3.create_bucket(
                Bucket=bucket_name,
                CreateBucketConfiguration={"LocationConstraint": REGION},
            )
        print(f"Created S3 bucket: {bucket_name}")
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "BucketAlreadyOwnedByYou":
            print(f"S3 bucket already exists: {bucket_name}")
            return True
        print(f"S3 error: {e}", file=sys.stderr)
        return False


def create_secret(sm, bucket_name: str) -> bool:
    body = get_dummy_secret_json(bucket_name)
    try:
        sm.create_secret(
            Name=SECRET_NAME,
            Description="Saging API keys and config (replace dummy values in console)",
            SecretString=json.dumps(body, indent=2),
        )
        print(f"Created Secrets Manager secret: {SECRET_NAME}")
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceExistsException":
            print(f"Secret already exists: {SECRET_NAME}. Updating with dummy values.")
            try:
                sm.put_secret_value(
                    SecretId=SECRET_NAME,
                    SecretString=json.dumps(body, indent=2),
                )
                print("Secret updated.")
                return True
            except ClientError as e2:
                print(f"Update failed: {e2}", file=sys.stderr)
                return False
        print(f"Secrets Manager error: {e}", file=sys.stderr)
        return False


def main():
    if not os.getenv("AWS_ACCESS_KEY_ID") or not os.getenv("AWS_SECRET_ACCESS_KEY"):
        print("Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in the environment.", file=sys.stderr)
        sys.exit(1)

    bucket_name = make_bucket_name()
    s3 = boto3.client("s3", region_name=REGION)
    sm = boto3.client("secretsmanager", region_name=REGION)

    ok_bucket = create_bucket(s3, bucket_name)
    ok_secret = create_secret(sm, bucket_name)

    if ok_secret:
        print("\n--- Keys in secret (replace in AWS Console → Secrets Manager):")
        for k in get_dummy_secret_json(bucket_name):
            print(f"  {k}")
        print(f"\nTo use in app: USE_AWS_SECRETS=1 SAGING_SECRETS_NAME={SECRET_NAME}")

    sys.exit(0 if (ok_bucket and ok_secret) else 1)


if __name__ == "__main__":
    main()
