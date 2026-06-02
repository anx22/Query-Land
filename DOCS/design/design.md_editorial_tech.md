# Design System: Editorial Tech

## 1. Brand Essence
AuraSEO balances technical complexity with the refined elegance of a high-end digital publication. The "High-Tech Editorial" aesthetic relies on architectural precision, sophisticated typography, and tactile interaction points.

---

## 2. Visual Foundation

### Typography
- **Primary Serif:** Literata. Used for headlines, key data points (scores), and editorial-style copy to provide a premium, intellectual feel.
- **UI Sans-Serif:** Inter / System Sans. Used for technical labels, high-density data tables, and navigation to ensure legibility in complex views.

### Color Palette
- **Primary Accent:** High-Contrast Orange (#FF5C00). Used for critical CTAs, active states, and focus accents.
- **Surface:** Off-white/Light Grey (#F9F9F9). Minimalist background to let content breathe.
- **Outlines:** Hairline Grey (#DADADA). 0.5px borders for structural definition without visual bulk.
- **Status Indicators:**
    - **Critical/High:** Vibrant Red (with light red containers).
    - **Warning/Medium:** Deep Amber/Orange.
    - **Safe/Low:** Slate Grey.

### Radii Strategy (The "Contrast" Rule)
- **Architectural Panels:** 4px rounding. Used for cards, containers, and main layout sections to reinforce structural precision.
- **Interactions:** Full rounding (Pill-style). Used for buttons, switches, toggles, and input fields to signal tactile clickability and an "Apple-like" feel.

---

## 3. Component Standards

### Technical Gauges
- Custom score visualizations featuring fine data markings, varying stroke weights, and precise Literata typography.
- **Accessibility:** Must include `role="progressbar"` and descriptive `aria-label` (e.g., "Health Score: 92 out of 100").

### Tables
- **High Density:** Clean rows with 0.5px hairline separators.
- **Semantics:** Use `scope="col"` and `scope="row"` for screen reader context.

### Navigation
- Fixed sidebar with a "hairline" right border.
- **Active State:** Subtle surface tint with a vertical orange accent bar for clear location signaling.

---

## 4. Accessibility (WCAG 2.1 AA)
- **Contrast:** Minimum 4.5:1 ratio for all functional text and status badges.
- **Focus:** High-contrast focus rings for all keyboard-interactive elements.
- **States:** Distinct visual treatments for Empty, Loading (crawling), and Error states.
