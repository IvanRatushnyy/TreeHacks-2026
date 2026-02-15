# Hexi — AI Nurse Copilot 🏥

<p align="center">
  <img src="frontend/public/hexi-logo.png" alt="Hexi Logo" width="120" />
</p>

**Hexi** is an AI-powered nurse copilot that helps healthcare professionals gather complete patient information through intelligent questioning. Built at TreeHacks 2026.

## ✨ Features

- **🌐 3D Knowledge Globe** — Interactive visualization showing what's known (green) vs. unknown (red) about a patient
- **📄 Document Analysis** — Upload PDFs/text files and automatically extract known patient information
- **🎤 Voice Input** — Real-time speech-to-text for hands-free documentation
- **💬 Smart Questioning** — AI suggests the most important questions to ask based on clinical context
- **📊 NCLEX-Aligned** — Question patterns based on nursing case study frameworks
- **📋 PDF Export** — Generate professional reports from conversations

## 🏗️ Architecture

```
TreeHacks-2026/
├── frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── KnowledgeGlobe.jsx    # 3D globe visualization
│   │   │   ├── HexiCore.jsx          # Animated hexagon core
│   │   │   ├── InputArea.jsx         # Chat/voice input
│   │   │   ├── TranscriptionStream.jsx
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   └── useVoiceSession.js    # Voice recording hook
│   │   ├── api.js                    # API client
│   │   └── App.jsx                   # Main application
│   └── md/                           # Design system docs
├── saging-api/        # FastAPI backend
│   └── app/
│       ├── main.py                   # API endpoints
│       ├── biomcp_client.py          # Clinical patterns & scenarios
│       ├── llm.py                    # LLM integration
│       └── prompts.py                # System prompts
├── mimic-mcp/         # MIMIC database MCP server
└── backend/           # Additional backend services
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- OpenAI API key (for LLM features)

### 1. Clone & Setup

```bash
git clone https://github.com/IvanRatushnyy/TreeHacks-2026.git
cd TreeHacks-2026
```

### 2. Start the Backend

```bash
cd saging-api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Set your API keys
export OPENAI_API_KEY="your-key-here"
export ANTHROPIC_API_KEY="your-key-here"

# Run the server
./run.sh
# Or manually:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/knowledge-gaps` | POST | Detect knowledge gaps from transcript/document |
| `/api/chat/complete` | POST | Complete a chat session with summary |
| `/api/clinical/validate` | POST | Validate clinical snippet and suggest follow-ups |
| `/api/documents/analyze` | POST | Analyze uploaded document for gaps |
| `/api/workflow/next-question` | POST | Get AI-suggested next question |
| `/api/tts` | POST | Text-to-speech (OpenAI voices) |

### Knowledge Gaps API

```bash
curl -X POST http://localhost:8000/api/knowledge-gaps \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Patient is a 16-year-old with type 1 diabetes who fainted at school",
    "symptoms": ["syncope", "diabetes"],
    "file_content": "Optional uploaded document text"
  }'
```

Response includes:
- `gaps[]` — Array of questions with `filled` status (green/red on globe)
- `filled_count` — Number of known items
- `next_question` — Suggested next question to ask

## 🧠 Clinical Scenarios

Hexi supports intelligent questioning for various clinical presentations:

| Scenario | Keywords Detected |
|----------|-------------------|
| Diabetic Hypoglycemia | diabetes, hypoglycemia, syncope, gym |
| Chest Pain | chest pain, cardiac, angina |
| Preeclampsia | pregnant, headache, hypertension |
| Pediatric Anaphylaxis | child, allergic, hives, epipen |
| Syncope | faint, passed out, collapsed |

## 🎨 Design System

The UI follows a medical-professional aesthetic:

- **Primary Blue**: `#134074` — Trust, professionalism
- **Accent Red**: `#DC2626` — Unknown/gaps (action needed)
- **Accent Green**: `#22C55E` — Known/filled information
- **Font**: Inter (body), DM Sans (display)

See [frontend/md/](frontend/md/) for full design documentation.

## 🔧 Development

### Frontend Dev Server

```bash
cd frontend && npm run dev
```

### Backend with Hot Reload

```bash
cd saging-api && uvicorn app.main:app --reload --port 8000
```

### Run Both

```bash
# Terminal 1
cd saging-api && ./run.sh

# Terminal 2  
cd frontend && npm run dev
```

## 📦 Tech Stack

**Frontend:**
- React 18 + Vite
- Canvas API (3D globe rendering)
- Web Speech API (voice input)
- jsPDF + html2canvas (PDF export)

**Backend:**
- FastAPI (Python)
- Anthropic Claude / OpenAI GPT
- Pydantic for validation

## 🏆 TreeHacks 2026

Built with ❤️ at Stanford TreeHacks 2026.

**Team:**
- Ivan Ratushnyy

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.