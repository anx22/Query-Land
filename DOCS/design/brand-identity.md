# Query-Land — Brand & Design

> **Die einzige Brand-&-Design-Quelle.** Kanonische Tokens: `apps/web/src/app/globals.css` (die Datei
> gewinnt bei Konflikt) · Assets/Vokabular: `/brand/brand-kit.md`. Stilfamilie: **Editorial Tech**
> (Broadsheet × Devtool) — Serif-Headlines + Mono-Daten sind die Signatur.

## Verbindliche Entscheidungen
| Frage | Entscheidung |
|---|---|
| Wortmarke | **Query-Land** (Titlecase, mit Bindestrich) — nicht `query-land`, nicht `QueryLand` |
| „Open"-Positionierung | Dezenter Unterton über **Belegbarkeit**, kein lautes Open-Source-Banner |
| Stilfamilie | Editorial Tech: Serif (Literata) × Sans (Inter) × Mono (JetBrains Mono) |

## 1. Markenkern
**Positionierung:** Query-Land macht **Sichtbarkeit belegbar** — jede Zahl trägt ihre Quelle, jede
Empfehlung ihre Evidenz. Wo andere Tools Dashboards mit Schätzwerten füllen, zeigt Query-Land die
Beweiskette (Beobachtung → Evidenz → Ursache → Maßnahme → Validierung).

**Charakter:** seriöser SEO-Berater mit Substanz, gerahmt von einer **leisen Land-/Karten-Metapher**
(„das Land hinter der Suche", Horizont, neues Terrain). Die Metapher lebt nur im _Rahmen_ (Claim, Hero,
Empty-/Erfolgs-States, Glossar) — **nie** in Zahlen, Status oder Validierung. Persönlichkeit:
_belegbar · kartografisch · handwerklich._ Marken-Wort ist **„belegbar"**; kein „Open-Source"-Wording
in der Produkt-UI.

## 2. Wortmarke & Logo
- **Wortmarke `Query-Land`:** Literata 700, `letter-spacing: -0.03em`. **Genau eine** orange Geste pro
  Lockup (empfohlen: der Bindestrich orange, oder ein orange Punkt am Ende) — nie das ganze Wort orange.
- **Kartografisches Mark-System** (ein Terrain, drei Ansichten; Vokabular `/brand/brand-kit.md`):
  **Horizont** (Höhenzüge + orange Sonne) → Hero/Overview-Header · **Ridges** (Höhenlinien-Bänder) →
  Unterseiten-Header · **Contours** (konzentrische Ringe + Such-Fokuspunkt) → Logomark/Daten-Textur.
  Charcoal-1px, nie gefüllt, wie eine technische Zeichnung. Favicon = innerster orange Höhenring.
- **Lockup:** Mark links, Wortmarke rechts, Abstand = Höhe eines `Q`; Schutzraum ≥ `0.75 × cap-height`.
  Don'ts: kein Schatten, kein Verlauf, keine zweite Akzentfarbe, keine Outline.
- **Claim:** „Sichtbarkeit, die sich belegen lässt." (lang: „SEO-Entscheidungen mit Beleg statt
  Bauchgefühl.") — die einzige Stelle, an der Metapher und Nutzen sich berühren dürfen.

## 3. Farbe — „Paper & Ink"
Tokens aus `globals.css` sind die Quelle; hier ihre Rollen.

| Rolle | Token | Wert |
|---|---|---|
| Papier (Basis) | `--background` | `#fcfcfb` (warmes Off-White, bewusst nicht Reinweiß) |
| Oberfläche | `--surface` | `#ffffff` |
| Papier gedämpft | `--surface-muted` | `#f4f1ed` |
| Tinte / gedämpft | `--ink` / `--muted` | `#211b17` / `#766b62` |
| Haarlinie | `--line` | `#e8dfd6` (1px-Divider — die „Architektur") |
| **Brand-Orange** | `--primary` | `#ff5c00` |
| Orange weich | `--primary-soft` | `#fff0e6` |

**Orange-Prinzip (verbindlich):** `--primary` bedeutet immer „du/uns" — primäre CTA, aktive Nav,
Eyebrow, Marke, und in Charts nur die **eigene Serie / aktive Auswahl**. Verboten: Orange als
Kategoriefarbe, als Daten-Semantik („Warnung = orange") oder als dritte Akzentfarbe.

**Funktionale Skalen (nie Brand-Orange):** Konfidenz A–E (`--conf-a..e`, immer **Label + Punkt-Icon**,
nie Farbe allein) · Kategorial `--cat-*` (teal/olive/violett/…, meidet Grün/Rot/Orange) · Status
`--success`/`--warning`/`--danger`.

## 4. Typografie — die Signatur
> Der wichtigste Hebel für „unverkennbar": die Spannung dreier Schriften.

| Schrift | Rolle | Wo |
|---|---|---|
| **Literata** (Serif) | Erzählung, Prestige | Headlines h1–h3, Hero, Sektions-Intros, Empty-States, Glossar |
| **Inter** (Sans) | Funktion, Klarheit | UI-Labels, Nav, Body, Buttons, Formulare, Tabellentext |
| **JetBrains Mono** | Daten | **Alle Metrik-Werte**, URLs, HTTP-Status, Meta-Tags, IDs, Code |

**Faustregel:** _Erzählung serif, Bedienung sans, Messwert mono._ Sobald eine Zahl eine gemessene
Kennzahl ist (Visibility 73, Position 4), steht sie in Mono mit `tabular-nums` → Zahlen fluchten.

**Skala:** `display-lg` Literata 700/48 · `headline-lg` 700/32 · `headline-md` 600/24 · `headline-sm`
600/20 · `body` Inter 400/18·16·14 · `label-caps` Inter 600/12/0.08em/UPPERCASE · `data-mono`
JetBrains Mono 500/14. **Editorial-Feinheit:** max. **ein** SEO-Schlüsselwort pro Headline darf orange.

## 5. Signatur-Feinheiten (was Query-Land unverkennbar macht)
**„New Horizon"-Bildwelt:** minimale 1px-Linien-Landschaft im Header (Höhenzüge zum Horizont, kleine
aufgehende orange Sonne). Nur in rahmenden Zonen (Hero, Login, Empty-States, Reports-Deckblatt), **nie**
in dichten Datenbereichen. Dieselbe Linien-DNA wie das Contours-Logomark.

Die zehn Detail-Signaturen (die Summe macht den Wiedererkennungswert):
1. **Mono-Messwerte** (tabular) — der stärkste visuelle Tic.
2. **Serif-Headlines** mit exakt einem Orange-Wort.
3. **Evidence-Signatur:** ConfidenceBadge an _jeder_ Zahl — unser „belegbar"-Wasserzeichen.
4. **Haarlinien statt Schatten** (1px `--line`), „Blueprint"; einzige Elevation = eine weiche Karten-Schattierung.
5. **Oneline-Icons**, 1px-Stroke, nie gefüllt, `currentColor`.
6. **Papier-Grain** — sehr feine Noise-Textur (~3–5% Opazität) gegen Screen-Müdigkeit.
7. **Bento auf 12 Spalten** (Kacheln 3/4/6/12, 16–24px Padding).
8. **Aktiv-Punkt statt Block** in der Nav (orange Punkt + Inter Medium).
9. **Mono-Microcopy** für URLs/Status/Pfade — nie im Fließtext-Sans.
10. **Kartografische Empty-States** („noch unerschlossenes Gebiet — starten Sie einen Crawl.").

> Test: Ein Screenshot ohne Logo sollte an Mono-Zahlen + Serif-Headline + Haarlinien + einem
> Orange-Akzent als Query-Land erkennbar sein.

## 6. Layout, Form & Komponenten
- **Grid:** zentraler Content max. ~1280px, 12 Spalten; Charts spannen 3/4/6/12.
- **Bento-Karten:** `--surface` weiß, 1px `--line`, Radius ~`0.75rem`; „Metric Header" = `label-caps`
  oben links; sparsame weiche Elevation nur zum Abheben.
- **Tabellen:** editorial — Header `label-caps` auf `--surface-muted`, 1px horizontale Zeilen-Haarlinien,
  **keine** Vertikalen.
- **Buttons:** primär solid `--primary`/weiß, sekundär Ghost (1px-Rand); Hover = scharfer 2px-Schatten.
- **Inputs:** minimal, 1px-Rand, Fokus = `--primary`-Rand. **Ecken:** weich; Pills `999px`.
- **Motion:** dezent, ≤300ms, `ease-out`; `prefers-reduced-motion` immer respektiert.
- **Glassmorphism:** nur Sidebar-/Overlay-Backdrops (hoher Blur + Grain).

## 7. Voice
- **Marken-Wort:** _belegbar/Beleg_ trägt den „open"-Gedanken — verbal nur dieser eine Anker.
- **Serious-Zonen:** Zahlen, Status, Validierung, Filter, Fehlermeldungen sind **immer rein sachlich** —
  keine Metapher. Die Land-/Karten-Metapher lebt ausschließlich im Rahmen (Claim, Hero, Empty/Erfolg, Glossar).
- **Keine Bau-/Roadmap-Sprache in der UI** (`Welle`, `Slice`, `Stub`, `§x.y`).
- Methodik offenlegen statt verstecken: Konfidenz-Legende, Score-Formeln, nachvollziehbare Funnels
  statt magischer Gesamtnoten.

## 8. Umsetzungsstand
Editorial-Tech-Fundament ist umgesetzt: ✅ Typo (Literata/Inter/JetBrains Mono via `next/font`) ·
✅ Wortmarke-Lockup · ✅ Mono-Daten-Pass · ✅ Grain + Aktiv-Punkt-Nav · ✅ Favicon/Logomark
(`app/icon.svg`, Contours) + per-Screen Höhenlinien-Header (`<HeroBand>`) · Editorial-Tabellen laufen
per-Feature. **Offen:** finale Logo-/Header-**SVGs** (aktuell raster). Gate je Schnitt: Tokens via
`var(--…)`, Orange nur „wir/CTA", `npm run check` + `build:web` grün, A11y (Kontrast, Fokus,
`reduced-motion`).

## 9. Don'ts
- Orange als Daten-/Kategoriefarbe oder zweite überall-Akzentfarbe.
- Metapher in Zahlen, Status, Filtern, Buttons, Fehlermeldungen.
- Headlines in Sans, Messwerte in proportionaler Sans (bricht die Signatur).
- Gefüllte Icons; weiche Schatten als primäre Trennung; mehr als eine Orange-Geste pro Headline/Lockup.
- „Open Source"-Banner / lautes Open-Wording.
