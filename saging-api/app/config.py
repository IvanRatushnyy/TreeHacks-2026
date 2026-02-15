"""
Config from environment. No secrets in code — use .env or deployment env.
Load AWS secrets first via app.secrets.load_secrets_if_configured() if needed.
"""
from typing import List, Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Load from env; .env file optional. All secret keys optional (empty = feature off)."""

    app_name: str = "Saging API"
    env: str = "development"
    port: int = 8000

    # CORS
    cors_origins: str = "*"

    # PII: optional external service (teammate's model). If not set, use in-app fallback.
    pii_service_url: Optional[str] = None  # e.g. http://localhost:5001

    # Clinical validation LLM: Claude first, then OpenAI fallback, then Bedrock
    claude_api_key: Optional[str] = None   # CLAUDE_API_KEY in Secrets Manager
    openai_api_key: Optional[str] = None   # fallback when no Claude key
    llm_provider: str = "claude"           # "claude" | "openai" | "bedrock"

    # Step 7: S3
    aws_region: str = "us-east-1"
    saging_s3_bucket: Optional[str] = None
    # AWS credentials: use env AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY or IAM role

    # DynamoDB: optional table for logging summary/record pointers (masked patient → S3 file)
    saging_ddb_table: Optional[str] = None  # e.g. saging-summary-records

    # Optional: AWS Secrets Manager (loads JSON into env before this runs)
    use_aws_secrets: bool = False
    saging_secrets_name: Optional[str] = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

    @property
    def cors_origins_list(self) -> List[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def has_llm(self) -> bool:
        """True if we can call an LLM (Claude, OpenAI, or Bedrock)."""
        key_claude = (self.claude_api_key or "").strip()
        if key_claude and not key_claude.startswith("sk-ant-dummy"):
            return True
        key_openai = (self.openai_api_key or "").strip()
        if key_openai and not key_openai.startswith("sk-dummy"):
            return True
        if self.llm_provider == "bedrock":
            return True
        return False

    def has_s3(self) -> bool:
        return bool(self.saging_s3_bucket)

    def has_ddb(self) -> bool:
        return bool(self.saging_ddb_table)


# Singleton for import
settings = Settings()
