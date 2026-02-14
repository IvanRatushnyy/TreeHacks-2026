# Design Document: Brand Identity & General UI Guidelines
**Project Name:** Hexi
**Core Philosophy:** Zero Trust Architecture meets Swiss Style Precision.

## 1. Design Philosophy
We are rejecting the "generic AI" aesthetic (soft, blurry, purple/white gradients). instead, we are adopting a **Neo-Swiss** approach:
* **High Contrast & Precision:** Data must look rigorous. Use strict grid systems.
* **Flat Shading + Gradients:** Do not use gradients as background blur. Use gradients *inside* specific geometric shapes (flat shading) to signify depth and AI activity.
* **Asymmetry:** Avoid centered, predictable layouts. Use whitespace actively to guide the eye through patient profiles.

## 2. The "Hexi" Mascot & Logo
* **Concept:** A living, breathing geometric entity. It is not a cute robot; it is a highly advanced medical synthesizer.
* **Shape:** Hexagon.
* **Behavior:** It is the central anchor of the app. It does not sit in a corner; it floats within the grid, changing position based on context (e.g., center for intake, side-dock for analysis).

## 3. Layout & Grid
* **The Grid:** 12-column grid. All medical data cards must align perfectly to this grid.
* **Borders:** Use thin, sharp borders (1px solid var(--oxford-navy)) to define data zones. This reflects the "Zero Trust" nature—containers are secure and distinct.
* **Depth:** No drop shadows. Depth is achieved through color contrast (Dark Navy cards on Mint Cream backgrounds).

## 4. Icons
* **Standard:** Use **Google Material Symbols** (Material Icons) for all UI icons—actions, vitals, attachments, etc. Load via Google Fonts: `Material+Symbols+Outlined`.
* **Exception:** The Hexi logo and hexagon mascot remain custom SVG (brand identity).
* **Usage:** Prefer semantic icon names (e.g. `picture_as_pdf`, `attach_email`, `favorite`, `send`) for consistency and accessibility.

## 5. Agent Instructions for Layout
> When generating views:
> 1.  Start with the **Mint Cream** background.
> 2.  Use **Regal Navy** for the primary sidebar or navigation rail.
> 3.  Patient data cards should use **Manrope** and have high padding (comfort density).
> 4.  **Avoid rounding corners excessively.** Keep border-radius tight (e.g., 4px or 8px max) to maintain the "Swiss/Medical" precision.