# Saging API — Integration Backend for Hexi

FastAPI backend powering **Hexi**, the AI Nurse Copilot. Handles clinical knowledge gap detection, LLM integration, and document analysis.

## 🚀 Quick Start

```bash
cd saging-api
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Set API keys
export OPENAI_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"

# Run server
./run.sh
# Or: uvicorn app.main:app --reload --port 8000
```

- **API:** http://localhost:8000  
- **Swagger UI:** http://localhost:8000/docs  
- **ReDoc:** http://localhost:8000/redoc  
- **Health:** http://localhost:8000/health  

---

## 📡 Core API Endpoints

### Knowledge Gap Detection

The main endpoint for detecting what's known vs unknown about a patient.

```bash
POST /api/knowledge-gaps
Content-Type: application/json

{
  "transcript": "Patient conversation text...",
  "symptoms": ["chest pain", "diabetes"],
  "workflow": "general",
  "file_content": "Uploaded document text (optional)"
}
```

**Response:**
```json
{
  "gaps": [
    {
      "id": 1,
      "question": "What is the blood glucose reading?",
      "field": "blood_glucose_level",
      "priority": "critical",
      "filled": true,
      "topic": "Blood Glucose Level",
      "position": {"lat": 45.2, "lng": -120.5}
    }
  ],
  "filled_count": 3,
  "total_count": 12,
  "complete": false,
  "next_question": "Is the patient alert and oriented?"
}
```

- `filled: true` → **Green** marker (information known)
- `filled: false` → **Red** marker (information needed)

### Other Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat/complete` | POST | Summarize conversation session |
| `/api/clinical/validate` | POST | Get AI follow-up suggestions |
| `/api/workflow/next-question` | POST | Get best next question |
| `/api/documents/analyze` | POST | Analyze document for gaps |
| `/api/tts` | POST | Text-to-speech (OpenAI) |
| `/api/redact` | POST | Redact PII from text |

---

## 🧠 Clinical Scenario Detection

Automatically detects clinical presentation from keywords:

| Scenario | Keywords |
|----------|----------|
| `diabetic_hypoglycemia` | diabetes, insulin, hypoglycemia, syncope, gym |
| `chest_pain` | chest pain, cardiac, angina |
| `preeclampsia` | pregnant, headache, hypertension |
| `pediatric_anaphylaxis` | child, allergic, hives |
| `syncope` | faint, passed out, collapsed |

---

## 📁 Project Structure

```
saging-api/
├── app/
│   ├── main.py           # FastAPI endpoints
│   ├── biomcp_client.py  # Clinical patterns & scenarios
│   ├── llm.py            # LLM integration
│   ├── prompts.py        # System prompts
│   ├── config.py         # Settings
│   ├── pii.py            # PII redaction
│   └── tts.py            # Text-to-speech
├── requirements.txt
└── run.sh
```

---

## ⚙️ Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key (TTS, GPT) |
| `ANTHROPIC_API_KEY` | Anthropic API key (Claude) |
| `SAGING_S3_BUCKET` | S3 bucket for storage |
| `USE_AWS_SECRETS` | Set to `1` to use Secrets Manager |

---

## 🔧 AWS Setup (Optional)

1. **One-time setup** (creates S3 bucket + secret):
   ```bash
   export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_REGION=us-east-1
   python scripts/setup_aws.py
   ```
2. In **AWS Console → Secrets Manager**, update `saging-api-secrets` with real API keys.
3. Run with `USE_AWS_SECRETS=1`.

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for production deployment.

---

## 📝 Adding New Clinical Scenarios

Edit `app/biomcp_client.py`:

```python
CLINICAL_SCENARIO_PATTERNS = {
    "new_scenario": {
        "name": "New Scenario",
        "keywords": ["keyword1", "keyword2"],
        "questions": [
            {"question": "...", "field": "field_name", "priority": "critical"},
        ]
    }
}
```

Add answer patterns in `app/main.py`:

```python
answer_patterns = {
    "field_name": ["pattern1", "pattern2"],
}
```
