# Query-Land — Brand Kit

Heimat der **Marken-Assets** (Logo, Header-Illustrationen, Favicon, Wortmarke). Bewusst auf Repo-Ebene
neben `apps/`, `packages/`, `services/` — Brand-Assets sind Produkt-Assets, **keine** Dokumentation.

> **Design-Direction & Spec (Doku):** `DOCS/design/brand-identity.md` — Markenkern, Typografie, „New
> Horizon"-Bildwelt, Zwei-Logomark-System, Roadmap. Token-Quelle: `DOCS/design/DESIGN.md`.

## Struktur

```
brand/
  README.md            ← dieser Index
  exploration/         ← KI-Explorationsrunden (Referenz/Orientierung, kein Final-Artwork)
  logo/                ← finale Logomarks als SVG  (Ridges = primär, Contours = sekundär)   [geplant]
  header/              ← finale Header-Illustrationen als SVG                                 [geplant]
  favicon/             ← Favicon-Ableitungen (svg/ico/png)                                    [geplant]
```

**App-Einbindung:** die _final genutzten_ Assets werden nach `apps/web/public/brand/` gespiegelt
(von Next.js unter `/brand/...` ausgeliefert) und im Code per `--primary`/`currentColor` eingefärbt.
`brand/` bleibt die Quelle (inkl. Exploration); `public/brand/` enthält nur das produktiv Servierte.

## Direction (beschlossen)
- **Layered Ridges** — primäres Header-/Horizont-Motiv (Namens-Konzept „neues Land/Horizont").
- **Terrain Contours** — sekundäre analytische Variante + Brücke zum Logomark/Daten-Textur.
- **Wortmarke** `Query-Land.` (Literata, oranger Bindestrich/Punkt). **Orange `#ff5c00`** = „wir/CTA".

## Nächster Schritt
Finale **SVGs** (je ein Logomark Ridges + Contours, primäres Header-Band, Favicon) aus der Linien-DNA
der Exploration ableiten → `logo/` · `header/` · `favicon/` → nach `apps/web/public/brand/` → dann im
UI verdrahten (zusammen mit B-1 Typo-Fundament, siehe Spec §9).
