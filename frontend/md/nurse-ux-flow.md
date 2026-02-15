# Hexi Nurse UX Flow

## Overview

Hexi is designed for **nurses** who need to efficiently gather patient information during intake. The interface uses a voice-first approach with visual feedback through an animated hexagon and 3D knowledge globe.

## User Experience Philosophy

### 1. **Voice-First, Zero Friction**
- Nurse taps the hexagon once to start listening
- Natural conversation flow - no buttons to click for each question
- Real-time transcription shows what's being captured
- Visual feedback through the pulsing hexagon confirms recording

### 2. **Intelligent Gap Detection**
The globe appears automatically when there's information still needed:
- **Critical (Red)** - Safety-critical info (allergies, medications, red flag symptoms)
- **Important (Amber)** - Standard documentation (onset, severity, duration)
- **Recommended (Blue)** - Best practice info (family history, lifestyle factors)

### 3. **Progressive Disclosure**
- Start simple: "What brings you in today?"
- Globe reveals what's missing as conversation progresses
- Each answered question darkens the globe (visual progress)
- Hexagon syncs with globe darkness (satisfaction indicator)

## Typical Nurse Workflow

### Step 1: Patient Arrives
```
Nurse: [Taps hexagon] "Hi, I'm going to be asking you some questions today. 
       What brings you in?"
Patient: "I've been having headaches for the past week."
```

### Step 2: Globe Appears
The AI detects knowledge gaps based on the chief complaint:
- Location of headaches (critical for differential)
- Severity scale (documentation requirement)
- Associated symptoms (red flags like vision changes, neck stiffness)
- Medication use (potential causes/treatments tried)
- Allergies (before any treatment)

### Step 3: Targeted Follow-ups
Nurse can either:
- **Continue naturally** - AI tracks what's covered
- **Tap a globe marker** - Hexi speaks the question aloud
- **Review transcript** - See what's been captured

### Step 4: Completion
- Globe fully darkens when all critical gaps are filled
- Hexagon shows full context (dark gradient)
- AI offers: "We have the information we need. Anything else?"

## Voice Interaction Patterns

### Natural Prompts (AI Speaks These)
Rather than clinical jargon, Hexi uses conversational language:

| Clinical Term | Hexi Says |
|---------------|-----------|
| Onset | "When did this first start?" |
| Character | "Can you describe what it feels like?" |
| Severity | "On a scale of 0 to 10, how bad is it?" |
| Aggravating factors | "What makes it worse?" |
| Alleviating factors | "Anything that helps?" |
| Associated symptoms | "Any other symptoms along with it?" |

### Acknowledgment Phrases
After each response, brief acknowledgment:
- "Got it."
- "Okay, thanks."
- "I've noted that."
- "That's helpful."

### Transition Phrases
Moving between topics:
- "Now let's talk about your medications..."
- "A few more questions about..."
- "Last thing I need to know..."

## Mobile vs Desktop

### Mobile (Single Panel)
- Hexagon centered
- Globe appears below hexagon
- Swipe up for full transcript
- Input area at bottom

### Desktop (Two Panels)
- Left: Hexagon + Globe (visual status)
- Right: Full transcript + Input
- Real-time sync between panels

## Key Design Principles

1. **Never Block Workflow**
   - No mandatory clicking between questions
   - Voice continues to transcribe even while viewing globe
   - Errors don't interrupt the session

2. **Progressive Intelligence**
   - Start with general questions
   - Get more specific based on responses
   - Adapt priority based on red flags detected

3. **Trust but Verify**
   - Show what was captured in transcript
   - Allow manual corrections
   - Never auto-submit clinical data

4. **Calm Technology**
   - Subtle animations (breathing hexagon)
   - Muted colors that don't distract
   - Sound design: gentle, professional

## Technical Integration

### Backend API Endpoints

1. **`/api/knowledge-gaps`** - Analyze transcript, return missing info
2. **`/api/workflow/next-question`** - Get optimal next question
3. **`/api/clinical/validate`** - Real-time validation during speech
4. **`/api/chat/complete`** - Generate summary and remaining gaps

### BioMCP Integration (Future)
- Disease-specific question patterns
- Drug interaction awareness
- Evidence-based follow-up questions
- Clinical trial eligibility screening

## Accessibility

- **Voice output** for visually impaired users
- **High contrast mode** for low vision
- **Keyboard navigation** for mobility issues
- **Clear visual feedback** for hearing impaired
