# Design Document: Typography System
**Primary Goal:** Dramatic contrast between "AI Intelligence" and "Medical Data."

**Font source:** We use only **Manrope** and **Space Grotesk** from Google Fonts. No other typefaces. Load via:
`https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap`

## 1. Font Families

### **Display & AI Voice: Space Grotesk**
* **Usage:** Logos, Headlines (H1-H3), and **AI Status Indicators** (e.g., "Analyzing unstructured data...", "Clarification needed").
* **Why:** It has a "tech/code" aesthetic without being a monospaced terminal font. It feels calculated.
* **Styling:** * Use tight letter-spacing (-0.02em) for large headers to mimic Swiss poster design.
    * Use lowercase for the logo (`hexi`) to feel approachable.

### **Body & Clinical Data: Manrope**
* **Usage:** Patient notes, test results, paragraphs, UI labels.
* **Why:** Highly readable sans-serif. Neutral but modern.
* **Styling:** * Use standard tracking.
    * High line-height (1.6) for readability of dense medical text.

## 2. Type Scale (Dramatic Contrast)
*Avoid incremental steps. Go big or go small.*

* **Hero/AI State:** 4rem (Space Grotesk, Weight 700)
* **Section Headers:** 2rem (Space Grotesk, Weight 500)
* **Body Text:** 1rem (Manrope, Weight 400)
* **Micro Labels:** 0.75rem (Manrope, Weight 600, Uppercase, Tracking +0.05em)

## 3. Agent Instructions for Typography
> **Rule:** Never mix fonts within a single sentence unless highlighting AI intervention.
> **Rule:** If the AI is asking a clarifying question (Zero Trust verification), render the question in **Space Grotesk** to distinguish it from the doctor's static notes.