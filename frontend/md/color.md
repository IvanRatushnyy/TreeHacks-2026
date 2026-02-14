# Design Document: Color Palette & Gradient Strategy

## 1. The Palette (CSS Variables)

```css
:root {
  /* Core Palette */
  --regal-navy: #134074;
  --oxford-navy: #13315c;
  --prussian-blue: #0b2545;
  --powder-blue: #8da9c4;
  --mint-cream: #eef4ed; /* Main Background */

  /* Semantic Mappings */
  --bg-app: var(--mint-cream);
  --bg-card: #ffffff;
  --text-primary: var(--prussian-blue);
  --text-secondary: var(--oxford-navy);
  --accent-interactive: var(--regal-navy);
  
  /* The "Hexi" Gradient Definition */
  /* A deep, oceanic transition representing depth of knowledge */
  --hexi-gradient-idle: linear-gradient(135deg, var(--powder-blue), var(--mint-cream));
  --hexi-gradient-active: linear-gradient(135deg, var(--regal-navy), var(--oxford-navy), var(--prussian-blue));
}