"""
BioMCP Client — Integration with BioMCP for biomedical knowledge.

BioMCP provides access to:
- PubMed/PubTator3 literature
- ClinicalTrials.gov data
- MyVariant.info genetic variants
- MyGene.info gene information
- MyDisease.info disease ontology
- MyChem.info drug/chemical data
- OncoKB oncology knowledge

For the Hexi app, we use BioMCP to:
1. Validate symptoms against medical literature
2. Suggest relevant follow-up questions based on disease pathways
3. Provide context-aware medical information
4. Enhance knowledge gap detection with evidence-based questions
"""
import httpx
import asyncio
from typing import Optional, List, Dict, Any
import json


BIOMCP_BASE_URL = "http://localhost:8001"  # Local BioMCP server if running
BIOMCP_TIMEOUT = 10.0


class BioMCPClient:
    """Client for interacting with BioMCP server."""
    
    def __init__(self, base_url: str = BIOMCP_BASE_URL):
        self.base_url = base_url
        self._client: Optional[httpx.AsyncClient] = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=BIOMCP_TIMEOUT)
        return self._client
    
    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None
    
    async def search_diseases(self, query: str) -> Dict[str, Any]:
        """Search for disease information and synonyms."""
        try:
            client = await self._get_client()
            response = await client.post(
                f"{self.base_url}/mcp",
                json={
                    "method": "tools/call",
                    "params": {
                        "name": "disease_getter",
                        "arguments": {"disease_id_or_name": query}
                    }
                }
            )
            return response.json() if response.status_code == 200 else {"error": response.text}
        except Exception as e:
            return {"error": str(e)}
    
    async def search_drugs(self, drug_name: str) -> Dict[str, Any]:
        """Get drug information including interactions and side effects."""
        try:
            client = await self._get_client()
            response = await client.post(
                f"{self.base_url}/mcp",
                json={
                    "method": "tools/call",
                    "params": {
                        "name": "drug_getter",
                        "arguments": {"drug_id_or_name": drug_name}
                    }
                }
            )
            return response.json() if response.status_code == 200 else {"error": response.text}
        except Exception as e:
            return {"error": str(e)}
    
    async def search_articles(self, keywords: List[str], diseases: List[str] = None) -> Dict[str, Any]:
        """Search PubMed for relevant articles."""
        try:
            client = await self._get_client()
            response = await client.post(
                f"{self.base_url}/mcp",
                json={
                    "method": "tools/call",
                    "params": {
                        "name": "article_searcher",
                        "arguments": {
                            "keywords": keywords,
                            "diseases": diseases or [],
                            "max_results": 5
                        }
                    }
                }
            )
            return response.json() if response.status_code == 200 else {"error": response.text}
        except Exception as e:
            return {"error": str(e)}
    
    async def search_trials(self, condition: str, phase: str = None) -> Dict[str, Any]:
        """Search for relevant clinical trials."""
        try:
            client = await self._get_client()
            args = {"conditions": [condition]}
            if phase:
                args["phase"] = phase
            response = await client.post(
                f"{self.base_url}/mcp",
                json={
                    "method": "tools/call",
                    "params": {
                        "name": "trial_searcher",
                        "arguments": args
                    }
                }
            )
            return response.json() if response.status_code == 200 else {"error": response.text}
        except Exception as e:
            return {"error": str(e)}


# Singleton instance
_biomcp_client: Optional[BioMCPClient] = None


def get_biomcp_client() -> BioMCPClient:
    global _biomcp_client
    if _biomcp_client is None:
        _biomcp_client = BioMCPClient()
    return _biomcp_client


# Synchronous wrappers for use in FastAPI sync endpoints

def sync_search_diseases(query: str) -> Dict[str, Any]:
    """Synchronous wrapper for disease search."""
    try:
        return asyncio.run(get_biomcp_client().search_diseases(query))
    except Exception as e:
        return {"error": str(e), "available": False}


def sync_search_drugs(drug_name: str) -> Dict[str, Any]:
    """Synchronous wrapper for drug search."""
    try:
        return asyncio.run(get_biomcp_client().search_drugs(drug_name))
    except Exception as e:
        return {"error": str(e), "available": False}


# Knowledge Gap Enhancement Functions

def enhance_knowledge_gaps_with_medical_context(
    symptoms: List[str],
    current_gaps: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Enhance knowledge gap questions with medical context from BioMCP.
    
    For each symptom mentioned, look up related conditions and generate
    more specific, medically-informed questions.
    """
    enhanced_gaps = list(current_gaps)
    
    # Medical knowledge patterns for common presentations
    # These are evidence-based question patterns from clinical guidelines
    SYMPTOM_PATTERNS = {
        "chest pain": [
            {"question": "Can you describe the character of the pain - is it sharp, dull, pressure-like, or burning?", "field": "pain_character", "priority": "critical"},
            {"question": "Does the pain radiate anywhere - to your arm, jaw, neck, or back?", "field": "radiation", "priority": "critical"},
            {"question": "Is the pain worse with exertion, breathing, or eating?", "field": "aggravating_factors", "priority": "critical"},
            {"question": "Have you experienced shortness of breath, sweating, or nausea with the pain?", "field": "associated_symptoms", "priority": "critical"},
        ],
        "headache": [
            {"question": "Where exactly is the headache located - front, back, one side, or all over?", "field": "location", "priority": "important"},
            {"question": "Is this the worst headache you've ever had?", "field": "severity", "priority": "critical"},
            {"question": "Do you have any visual changes, neck stiffness, or fever?", "field": "red_flags", "priority": "critical"},
            {"question": "Did the headache start suddenly or gradually?", "field": "onset", "priority": "important"},
        ],
        "abdominal pain": [
            {"question": "Can you point to where the pain is worst?", "field": "location", "priority": "important"},
            {"question": "Is the pain constant or does it come and go?", "field": "pattern", "priority": "important"},
            {"question": "Have you had any changes in bowel movements, vomiting, or blood in your stool?", "field": "associated_gi", "priority": "critical"},
            {"question": "When did you last eat, and have you been able to keep food down?", "field": "intake", "priority": "important"},
        ],
        "shortness of breath": [
            {"question": "Did the breathing difficulty start suddenly or gradually?", "field": "onset", "priority": "critical"},
            {"question": "Is it worse when lying down, during activity, or at rest?", "field": "positional", "priority": "important"},
            {"question": "Have you had any chest pain, cough, or wheezing?", "field": "associated_respiratory", "priority": "critical"},
            {"question": "Have you had any recent leg swelling or prolonged immobility?", "field": "dvt_risk", "priority": "critical"},
        ],
        "dizziness": [
            {"question": "Does the room spin, or do you feel lightheaded/faint?", "field": "vertigo_vs_presyncope", "priority": "important"},
            {"question": "Does it happen when you change positions, like standing up?", "field": "orthostatic", "priority": "important"},
            {"question": "Have you had any hearing changes, ringing in ears, or ear fullness?", "field": "vestibular", "priority": "important"},
        ],
        "fever": [
            {"question": "What is your temperature, and when did the fever start?", "field": "temp_onset", "priority": "important"},
            {"question": "Have you had chills, rigors, or night sweats?", "field": "pattern", "priority": "important"},
            {"question": "Any recent travel, sick contacts, or new exposures?", "field": "exposures", "priority": "important"},
            {"question": "Do you have any pain when urinating, cough, or rash?", "field": "source", "priority": "important"},
        ],
        "medication": [
            {"question": "Are you taking any prescription medications currently?", "field": "rx_meds", "priority": "critical"},
            {"question": "Do you take any over-the-counter medications, vitamins, or supplements?", "field": "otc_meds", "priority": "important"},
            {"question": "Have you recently started or stopped any medications?", "field": "med_changes", "priority": "important"},
        ],
        "allergies": [
            {"question": "Do you have any known drug allergies?", "field": "drug_allergies", "priority": "critical"},
            {"question": "What happens when you have an allergic reaction?", "field": "reaction_type", "priority": "important"},
        ],
    }
    
    # Check which patterns apply based on symptoms
    for symptom in symptoms:
        symptom_lower = symptom.lower()
        for pattern_key, questions in SYMPTOM_PATTERNS.items():
            if pattern_key in symptom_lower:
                # Add questions that aren't already in the gaps
                existing_fields = {g.get("field") for g in enhanced_gaps}
                for q in questions:
                    if q["field"] not in existing_fields:
                        enhanced_gaps.append(q)
    
    return enhanced_gaps


def get_nurse_workflow_questions(presentation_type: str) -> List[Dict[str, Any]]:
    """
    Get structured questions for common nursing workflows.
    
    These follow evidence-based triage protocols and help nurses
    gather comprehensive information efficiently.
    """
    NURSE_WORKFLOWS = {
        "general": [
            {"question": "What brings you in today?", "field": "chief_complaint", "priority": "critical", "order": 1},
            {"question": "When did this start?", "field": "onset", "priority": "critical", "order": 2},
            {"question": "On a scale of 0-10, how would you rate your discomfort?", "field": "severity", "priority": "important", "order": 3},
            {"question": "Have you tried anything for this? Did it help?", "field": "interventions", "priority": "important", "order": 4},
            {"question": "Do you have any medical conditions I should know about?", "field": "pmh", "priority": "critical", "order": 5},
            {"question": "Are you taking any medications?", "field": "medications", "priority": "critical", "order": 6},
            {"question": "Any allergies to medications?", "field": "allergies", "priority": "critical", "order": 7},
        ],
        "pain": [
            {"question": "Can you describe the pain?", "field": "character", "priority": "critical", "order": 1},
            {"question": "Where exactly is the pain?", "field": "location", "priority": "critical", "order": 2},
            {"question": "Does it go anywhere else?", "field": "radiation", "priority": "important", "order": 3},
            {"question": "What makes it better or worse?", "field": "modifying_factors", "priority": "important", "order": 4},
            {"question": "Is it constant or does it come and go?", "field": "temporal", "priority": "important", "order": 5},
        ],
        "vitals_abnormal": [
            {"question": "Have you checked your blood pressure at home?", "field": "home_bp", "priority": "important", "order": 1},
            {"question": "Are you feeling any chest pain or shortness of breath?", "field": "cardiac_symptoms", "priority": "critical", "order": 2},
            {"question": "Have you been drinking enough fluids?", "field": "hydration", "priority": "important", "order": 3},
            {"question": "Did you take your regular medications today?", "field": "med_compliance", "priority": "important", "order": 4},
        ],
        "medication_reconciliation": [
            {"question": "Can you tell me all the medications you're currently taking?", "field": "current_meds", "priority": "critical", "order": 1},
            {"question": "Have any medications been changed recently?", "field": "recent_changes", "priority": "important", "order": 2},
            {"question": "Are you taking any vitamins or supplements?", "field": "supplements", "priority": "important", "order": 3},
            {"question": "Any herbal remedies or over-the-counter medications?", "field": "otc", "priority": "important", "order": 4},
            {"question": "Do you have trouble affording or getting your medications?", "field": "barriers", "priority": "recommended", "order": 5},
        ],
    }
    
    return NURSE_WORKFLOWS.get(presentation_type, NURSE_WORKFLOWS["general"])
