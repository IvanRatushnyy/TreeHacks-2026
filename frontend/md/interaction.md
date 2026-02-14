**Purpose:** The central interaction document. This details the Voice Input and the Reactive Hexagon.

```markdown
# Design Document: Hexi Core Interaction (Voice & Visualization)

## 1. The Component: `<HexiCore />`
The centerpiece of the UI. A large, SVG-based Hexagon that acts as the microphone trigger and system status indicator.

## 2. States & Animation

### **State A: Idle (The "Breathing" Ghost)**
* **Visual:** A hexagon outline with a very faint, semi-transparent fill (`--powder-blue` at 10% opacity).
* **Icon:** A microphone icon floats in the center, 50% opacity.
* **Animation:** A slow CSS `scale` transform (0.98 to 1.02) over 4 seconds. "Breathing."

### **State B: Listening (Voice Input Active)**
* **Trigger:** User presses and holds the hexagon.
* **Visual:** The hexagon fill opacity increases. The microphone icon becomes solid white.
* **Animation:** The border pulses rapidly in time with voice amplitude (if possible) or a faster sine wave (0.5s duration).

### **State C: Context Filling (The "Zero Trust" Validation)**
* **Concept:** As data is ingested and verified, the hexagon "fills up" with knowledge.
* **Visual:** * The hexagon is divided into 6 internal triangles (sectors). 
    * The gradient (`--hexi-gradient-active`) is masked.
    * As the user speaks and the AI identifies missing unstructured data (e.g., "Patient mentions fatigue..."), distinct sectors of the hexagon snap from "Light" to "Dark Gradient."
    * **Effect:** It looks like a vessel filling with liquid logic.
    * *Transitions:* Use `transition: fill 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);` for a "pop-in" mechanical feel.

## 3. Implementation Details (React/CSS)
* **Structure:** SVG with `<path>` elements for each of the 6 sectors.
* **Logic:** * `completenessScore` (0-100) drives the opacity/fill of the sectors.
    * `isListening` (boolean) drives the pulse animation.
* **Feedback:** When the AI detects a "gap" in the profile, a small sector flashes Red (error state) before turning to Blue (asking for clarification).

## 4. Agent Instructions for Hexi
> Build this as a standalone component.
> Use `framer-motion` for the layout transitions if available.
> The gradient must be "Flat," meaning no blurs at the edges of the hexagon. Sharp, geometric lines.
> **Voice Trigger:** The user clicks/taps the center. The hexagon expands slightly (`scale: 1.1`) to indicate it is ready to receive input.