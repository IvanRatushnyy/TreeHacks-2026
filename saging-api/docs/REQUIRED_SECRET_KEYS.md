# Required Keys (for AWS Secrets Manager or .env)

Use one JSON secret in **AWS Secrets Manager** with these keys. PII and Voice are integrated in-app on the same EC2 (no separate URLs).

## Keys in the secret (JSON)

| Key | Description | Dummy / Example |
|-----|-------------|------------------|
| `CLAUDE_API_KEY` | **Primary LLM** for clinical validation (Anthropic) | Set your key from console.anthropic.com |
| `OPENAI_API_KEY` | **Fallback LLM** when Claude key is missing | `sk-dummy-...` or key from platform.openai.com |
| `SAGING_S3_BUCKET` | S3 bucket name for records (created by setup script) | e.g. `saging-records-abc123def456` |

LLM order in the app: **Claude → OpenAI → Bedrock**.

## AWS credentials (not in Secrets Manager for the app)

Set these in **environment** (e.g. `.env` or EC2 task env) when running the API:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (e.g. `us-east-1`)

On EC2 you can attach an **IAM role** instead of keys.

## After creating the secret

1. In AWS Console → Secrets Manager → open your secret (`saging-api-secrets` or your name).
2. Edit and set `CLAUDE_API_KEY` (and optionally `OPENAI_API_KEY` as fallback).
3. In the app: set `USE_AWS_SECRETS=1` and `SAGING_SECRETS_NAME=<your-secret-name>`.
