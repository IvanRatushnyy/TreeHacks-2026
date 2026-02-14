# API Keys & Secrets

No secrets in the repo. Use `.env` (copy from `.env.example`) or, in production, AWS Secrets Manager.

## Required by feature

| Key / Env var | Used in step | Purpose |
|---------------|--------------|---------|
| (none for Step 1–2) | — | App runs without any keys. |
| `CLAUDE_API_KEY` | LLM | **Primary** — Anthropic Claude for clinical validation. |
| `OPENAI_API_KEY` | LLM | **Fallback** when Claude key not set. |
| Bedrock (AWS creds) | LLM | Optional; set `LLM_PROVIDER=bedrock`. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | S3 / Secrets | For S3 and optional Secrets Manager. |
| `SAGING_S3_BUCKET` | S3 | Bucket name for records. |

PII and Voice are integrated in-app on the same EC2 (no separate service URLs).

## Optional: AWS Secrets Manager

If you set `USE_AWS_SECRETS=1` and `SAGING_SECRETS_NAME=<secret-name>`, the app can load a JSON secret from AWS and use it for these keys (overriding env). The secret should be a JSON object with keys like `OPENEVIDENCE_API_KEY`, etc.

For the hackathon, `.env` is enough; Secrets Manager is for production or later.
