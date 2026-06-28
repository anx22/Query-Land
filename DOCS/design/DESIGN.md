---
name: Editorial Tech
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#5b4137'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f1f1f1'
  outline: '#8f7065'
  outline-variant: '#e4beb1'
  surface-tint: '#a73a00'
  primary: '#a73a00'
  on-primary: '#ffffff'
  primary-container: '#ff5c00'
  on-primary-container: '#521800'
  inverse-primary: '#ffb59a'
  secondary: '#5f5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e5e2e1'
  on-secondary-container: '#656464'
  tertiary: '#5e5e5e'
  on-tertiary: '#ffffff'
  tertiary-container: '#939292'
  on-tertiary-container: '#2b2b2b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbce'
  primary-fixed-dim: '#ffb59a'
  on-primary-fixed: '#370e00'
  on-primary-fixed-variant: '#802a00'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474646'
  tertiary-fixed: '#e4e2e2'
  tertiary-fixed-dim: '#c7c6c6'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#464747'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display-lg:
    fontFamily: Literata
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Literata
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Literata
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: Literata
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.08em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Literata
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.2'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  bento-gap: 16px
---

> **Implementierungsstand (B-1…B-7, umgesetzt):** Das System ist im Code verdrahtet — Literata/Inter/
> JetBrains Mono via `next/font`, Serif-Headlines, Mono-Messwerte (`tabular-nums`), Wortmarke `Query-Land.`
> mit orangem Bindestrich/Punkt, Papier-Grain-Overlay, Aktiv-Punkt-Nav, per-Screen Höhenlinien-Header
> (`<HeroBand>`), Favicon (`app/icon.svg`). **Token-Quelle bleibt `apps/web/src/app/globals.css`** (warme
> Paper-&-Ink-Werte, s. u.). Marken-Direction & Assets: `brand-identity.md` + `/brand/`.

## Brand & Style
The design system embodies a sophisticated fusion of high-end editorial aesthetics and precision technology. It is designed for SEO professionals and marketers who value both deep analytical clarity and a premium, curated experience. The personality is authoritative yet vibrant—balancing the scholarly weight of a broadsheet newspaper with the sleek, high-performance feel of a modern developer tool.

The visual style leverages **Minimalism** with a heavy emphasis on **High-Contrast** accents. It utilizes generous whitespace to reduce cognitive load during complex data analysis, while incorporating "haptic" digital textures—such as subtle grain and noise—to provide a tactile, physical quality to the interface. The goal is to make data feel like a high-end print publication: permanent, credible, and meticulously crafted.

## Colors
The palette is built on a foundation of "Paper and Ink." **Implemented (warm) values govern — `globals.css`:**
background `#fcfcfb`, ink `#211b17`, hairline `#e8dfd6`, primary `#ff5c00` (the cool `#F9F9F9/#121212/#E5E5E5`
below are the original cooler reference). A subtle fractal-noise overlay (~4%) adds print tactility. 

**Accent Orange (#FF5C00):** This is used sparingly but aggressively for primary calls to action, critical data highlights, and editorial accents. It represents the "High-Tech" energy within the "Editorial" structure.
**Deep Charcoal (#121212):** Used for primary typography and iconography to ensure maximum legibility and a grounded, authoritative feel.
**Hairline Greys (#E5E5E5):** Used for structural dividers to maintain an airy, open layout without losing the grid definition.

## Typography
The typography strategy creates a clear tension between the "Editorial" (Literata) and the "Tech" (Inter). 

- **Literata** is used for all headlines and narrative elements. It should feel bold and prestigious. Use orange accents for specific words within Literata strings to highlight key SEO terminology.
- **Inter** handles the functional heavy lifting. It is used for UI labels, body copy, and navigation to ensure clarity.
- **JetBrains Mono** is introduced for raw data points, URLs, and technical parameters (like meta tags or status codes) to provide a "calculated" feel.

Strict attention should be paid to vertical rhythm. Headlines should have generous top-margin to allow the serif letterforms to breathe.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy inspired by print broadsheets. The central content area is constrained to 1280px on desktop to ensure line lengths remain readable.

- **Bento-Style Data Cards:** Metrics are grouped into a modular grid. Each card (bento box) should have a consistent 16px or 24px internal padding.
- **Hairline Dividers:** Instead of heavy shadows, use 0.5px to 1px borders in #E5E5E5 to separate sections.
- **The Columnar Rule:** On desktop, use a 12-column grid. SEO metrics and graphs should span 3, 4, 6, or 12 columns to maintain alignment with the editorial structure.
- **Whitespace:** Use "intentional voids." If a data visualization is high-density, surround it with a minimum of 40px of whitespace to elevate its importance.

## Elevation & Depth
This design system avoids heavy shadows and traditional skeuomorphism in favor of **Tonal Layers** and **Low-Contrast Outlines**.

- **Surface Levels:** The base layer is #F9F9F9 with a noise texture. Secondary panels or "Bento" cards use a pure #FFFFFF background to subtly lift them from the base.
- **Hairlines:** Depth is defined by 0.5pt-1pt solid borders. This creates a "technical drawing" or "architectural blueprint" aesthetic.
- **Haptic Feedback:** Interactive elements (like buttons) may use a very slight, sharp 2px shadow on hover to simulate a physical press, but the default state remains flat and graphic.
- **Glassmorphism:** Use sparingly for floating navigation bars or search overlays. Apply a high blur (30px) and a subtle grain filter to the backdrop to maintain the tactile editorial feel.

## Shapes
The shape language is disciplined and architectural. 

- **Corners:** Use **Soft (0.25rem)** roundedness for standard UI elements like inputs and buttons. Large data cards (Bento boxes) should use **rounded-lg (0.5rem)** to feel modern but not overly playful.
- **Icons:** Use ultra-thin, "oneline" icons with a 1px stroke. Icons should never be filled; they should feel like technical annotations on a manuscript.
- **Interactive States:** High-contrast color fills (Orange) should be used for selection states rather than complex shape changes.

## Components
- **Buttons:** Primary buttons are solid #FF5C00 with white Inter SemiBold text. Secondary buttons are ghost-style with a 1px #121212 border. No heavy rounding; stick to 4px corners.
- **Bento Cards:** White backgrounds, 1px grey borders, and a specific "Metric Header" using `label-caps` in the top left and an "Insight Icon" in the top right.
- **Data Tables:** High-end editorial style. No vertical lines. 1px horizontal hairlines between rows. The header row uses `label-caps` with a slightly darker background (#F1F1F1).
- **Input Fields:** Minimalist under-line style or a very thin 1px border. Focus state is a simple change to #FF5C00 border color.
- **Navigation:** A minimalist sidebar or top-bar with plenty of negative space. Use `body-sm` for links, moving to `Inter Medium` with an orange dot indicator for the active state.
- **SEO Badges:** Small, rectangular chips with `data-mono` text. Use low-saturation background tints (e.g., a very pale orange) to keep them secondary to the main content.