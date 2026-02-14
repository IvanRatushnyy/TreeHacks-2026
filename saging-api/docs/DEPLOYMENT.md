# Deployment (simple demo)

## Option A: Single EC2 (straightforward)

1. **Launch EC2**: Amazon Linux 2 or Ubuntu, t3.micro or t3.small. Open port 8000 (or 80 → 8000) in security group.
2. **Install Docker** on the instance (or run with Python + venv).
3. **Build and run**:
   - Copy the `saging-api` folder to the instance (git clone or scp).
   - Set env: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, and optionally `USE_AWS_SECRETS=1`, `SAGING_SECRETS_NAME=saging-api-secrets`.
   - With Docker:
     ```bash
     docker build -t saging-api .
     docker run -p 8000:8000 --env-file .env saging-api
     ```
   - Or without Docker:
     ```bash
     python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
     .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
     ```
4. **Health**: `http://<EC2-public-IP>:8000/health` and `/docs`.

## Option B: AWS App Runner or ECS Fargate

- Build image and push to ECR, then create App Runner service or ECS task with env vars (or Secrets Manager). Same Dockerfile.

## Option C: Run locally (no EC2)

- For demo, run on your machine and expose with ngrok or similar: `uvicorn app.main:app --host 0.0.0.0 --port 8000`.

## Env on the server

- Either use **.env** file (with `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `OPENAI_API_KEY`, `SAGING_S3_BUCKET`, etc.).
- Or set **USE_AWS_SECRETS=1** and **SAGING_SECRETS_NAME=saging-api-secrets** and give the task/instance an IAM role that can read that secret; the app will load keys from Secrets Manager.

No EC2 is strictly required if you use App Runner or Lambda+API Gateway; EC2 is the most straightforward “one box” demo.
