# Query-Land — Brand Identity & Design Directions

> **Zweck:** Den „Editorial Tech"-Nordstern aus `DESIGN.md` zu einer **unverkennbaren** Marken- und
> Design-Signatur schärfen — und die konkreten _Feinheiten_ festlegen, die Query-Land vom generischen
> SEO-SaaS (Ahrefs, Sistrix, Semrush) abheben.
>
> **Status:** Direction / Entwurf (2026-06-26). Visuelle Exploration via Magnific läuft begleitend
> (siehe §10). Umsetzung folgt iterativ, nachdem die Richtung an den Mockups validiert ist.
>
> **Wahrheitsebenen:** `DESIGN.md` (Token-Quelle „Editorial Tech") · `ux-ui-sprint.md` Teil 1–3
> (Voice, UI-Kit, Placement) · `globals.css` (Implementierungsstand).

---

## 0. Entscheidungen (verbindlich für dieses Dokument)

| Frage | Entscheidung | Konsequenz |
|---|---|---|
| Wortmarke | **Query-Land** (mit Bindestrich) | Bindestrich bleibt Code-/UI-weit; betont leise die Land-/Karten-Metapher |
| „Open"-Positionierung | **Dezenter Unterton** | „open" lebt in Belegbarkeit, Quell-Verknüpfung, Evidence-First — **kein** lautes Open-Source-Banner |
| Stilfamilie | **Editorial Tech** (Broadsheet × Devtool) | Serif-Headlines + Mono-Daten sind die Signatur, nicht eine Option |

---

## 1. Markenkern

**Positionierung:** Query-Land ist das SEO-Werkzeug, das **Sichtbarkeit belegbar** macht — jede Zahl
trägt ihre Quelle, jede Empfehlung ihre Evidenz. Wo andere Tools Dashboards mit Schätzwerten füllen,
zeigt Query-Land die **Beweiskette** (Beobachtung → Evidenz → Ursache → Maßnahme → Validierung).

**Charakter:** seriöser SEO-Berater mit Substanz, gerahmt von einer **leisen Land-/Karten-Metapher**.
Die Metapher lebt nur im _Rahmen_ (Claim, Hero, Empty-/Erfolgs-States, Glossar) — **nie** in Zahlen,
Status oder Validierung (Serious-Zonen-Regel, `ux-ui-sprint.md` Teil 1 §1).

**Persönlichkeit in drei Worten:** _belegbar · kartografisch · handwerklich._

**Namens-Bedeutung (Konzept-Anker):** „Query-Land" ist das **Land hinter der Suche** — der weite,
unübersichtliche Raum des World Wide Web, in dem jede:r gefunden werden _und_ sich zurechtfinden will.
Query-Land ist im digitalen Zeitalter das, was früher der **Navigator/Kartograf** war: es kartiert das
eigene Terrain, zeigt den Horizont (wohin Wachstum möglich ist) und führt zur **„guten Lage" — dem Land,
in das alle wollen** (Top-Positionen, Sichtbarkeit, Traffic). Bildwelt deshalb: **Entdeckung, Horizont,
neues Land, Höhenzüge** — bewusst **kein** Maritimes, **kein** Kompass-Klischee, **keine** Windrose.
Stattdessen ruhige, natürliche, minimale Landschaften (siehe §5.0 + §10).

**Der „open"-Unterton (dezent):**
- **Evidence-first als Transparenz-Signal** — die ConfidenceBadge an _jeder_ Kennzahl ist der sichtbarste
  Ausdruck von „offen": wir zeigen, _woher_ ein Wert kommt und wie sicher er ist (A–E).
- **Quell-Verknüpfung** (URL → Code-Stelle) macht Befunde nachprüfbar bis in den Quelltext.
- **Keine Black Box:** Methodik-Tooltips, offengelegte Score-Formeln (`Priorität = Impact × Konfidenz ×
  Business-Value ÷ Aufwand`), nachvollziehbare Funnels statt magischer Gesamtnoten.
- **Verbal nur ein Anker:** das Wort _„belegbar/Beleg"_ ist der Marken-Träger des Open-Gedankens.
  Kein „Open Source"-Wording in der Produkt-UI.

---

## 2. Wortmarke & Logo

### 2.1 Wortmarke `Query-Land`
- **Schrift:** Literata (Serif), Weight 700, `letter-spacing: -0.03em`. Die Serifen geben die
  „Broadsheet"-Prestige; der enge Satz die Devtool-Präzision.
- **Surgical-Orange-Akzent:** **genau eine** orange Geste pro Lockup. Empfohlen: der **Bindestrich**
  in `Query‑Land` orange (`--primary`), oder ein orange **Punkt** am Ende. Nie das ganze Wort orange.
- **Casing:** `Query-Land` (Titlecase, beide Wortteile groß). Nicht `query-land`, nicht `QueryLand`.

### 2.2 Kartografisches System — ein Terrain, drei Anwendungen
**Verbindliches Vokabular: `/brand/README.md`.** Das Marken-Bildsystem ist **ein** Terrain, dargestellt
in komplementären Ansichten (Assets unter `/brand/header/` + `/brand/guidelines/`; finale SVGs später
unter `/brand/logo/`):

- **Horizont** (Höhenzüge + aufgehende orange Sonne, Seitenansicht): **Hero/Overview-Header** →
  `header/horizon/`. Trägt das Namens-Konzept „neues Land/Horizont".
- **Ridges** (topografische **Höhenlinien-Bänder**, Landschaft als Konturlinien): **Unterseiten-Header** →
  `header/ridges/`.
- **Contours** (konzentrische Höhenlinien-Ringe + zentraler **Such-Fokuspunkt**, ein orange Ring):
  **Logomark / Daten-Textur**. Reduktion bis Favicon: innerster orange Ring + Punkt.

Alles dasselbe Land — Horizont von der Seite, Contours von oben (Grundprinzip:
`guidelines/cartographic-system.jpg`). Charcoal-1px, nie gefüllt, wie eine technische Zeichnung /
Survey-Map-Annotation. Je Mark eine **Mono/KO-Variante** (reines Charcoal) für einfarbige Einsätze.

- **Strichstärke:** 1px (bei kleinen Größen 1.25px für Optik).
- **Gefüllt:** nie. Das Mark bleibt eine Linienzeichnung — konsistent zur „oneline icon"-Regel.
- **Favicon:** der innerste orange Höhenring allein, auf Paper-Hintergrund.

### 2.3 Lockup-Regeln
- Horizontal: Mark links, Wortmarke rechts, optischer Abstand = Höhe eines `Q`.
- Sidebar-Variante (heute): nur Wortmarke + Eyebrow-Claim darüber. Mark ergänzt das, sobald finalisiert.
- **Schutzraum:** rundum mindestens `0.75 × cap-height` Freiraum.
- **Don'ts:** kein Schlagschatten, kein Verlauf, keine zweite Akzentfarbe, keine Outline auf dem Wort.

### 2.4 Claim / Tagline
- **Primär (Sidebar-Eyebrow):** „Sichtbarkeit, die sich belegen lässt."
- **Lang (Meta/Hero):** „SEO-Entscheidungen mit Beleg statt Bauchgefühl."
- Der Claim ist die **einzige** Stelle, an der Metapher und Nutzen sich berühren dürfen.

---

## 3. Farbe — „Paper & Ink"

Bestehende Tokens (`globals.css`) bleiben die Quelle; dieses Dokument schärft ihre _Rollen_.

### 3.1 Grundpalette
| Rolle | Token | Wert | Einsatz |
|---|---|---|---|
| Papier (Basis) | `--background` | `#fcfcfb` | App-Hintergrund + **Grain** (§7) |
| Oberfläche | `--surface` | `#ffffff` | Bento-Karten, hebt sich vom Papier ab |
| Papier gedämpft | `--surface-muted` | `#f4f1ed` | Tabellen-Header, ruhige Flächen |
| Tinte | `--ink` | `#211b17` | Primärtext, Headlines, Icons |
| Tinte gedämpft | `--muted` | `#766b62` | Sekundärtext, Achsen, Labels |
| Haarlinie | `--line` | `#e8dfd6` | **1px** Divider — die „Architektur" |
| **Brand-Orange** | `--primary` | `#ff5c00` | „Wir/CTA" — chirurgisch (§3.2) |
| Orange weich | `--primary-soft` | `#fff0e6` | aktive Nav, Chips, Hover |

> **Warmer Unterton statt Reinweiß:** Query-Land nutzt bewusst ein _papierwarmes_ Off-White
> (`#fcfcfb`, Tinte `#211b17`) statt des kalten `#F9F9F9/#121212` aus dem DESIGN.md-Frontmatter.
> Das ist die gewünschte Abweichung — wärmer = „Print/Manuskript", kälter = „Screen". **`globals.css`
> gewinnt.** Beim Re-Sync von DESIGN.md die warmen Werte übernehmen.

### 3.2 Das Orange-Prinzip (verbindlich)
**Brand-Orange `--primary` bedeutet immer „du/uns".** Erlaubt für: primäre CTA, aktive Nav, Kicker/Eyebrow,
Marke — **und in Charts ausschließlich für die eigene Serie / die aktive Auswahl.**
**Verboten:** Orange als generische Kategoriefarbe, als Daten-Semantik (kein „Warnung = orange") oder als
dritte Akzentfarbe. So liest sich Orange im ganzen Produkt eindeutig als „unsere Metrik".

### 3.3 Funktionale Skalen (nie Brand-Orange)
- **Konfidenz A–E** (`--conf-a..e`): Gesichert (grün) · Beobachtet (teal) · Gemessen SERP (amber) ·
  Geschätzt (slate) · KI-Hinweis (grau). Immer **Label + Punkt-Icon**, nie Farbe allein.
- **Kategorial** (Chancen-Typen, `--cat-*`): teal/olive/violett/indigo/braun/slate — meidet Grün/Rot/Orange.
- **Sequenziell** (Positions-Buckets gut→schwach): `#16794d → #4f9e6f → #b7791f → #5b6478 → #9aa0a6`.
- **Status:** Erfolg `--success` · Warnung `--warning` · Gefahr `--danger`.

---

## 4. Typografie — die Signatur

> **Dies ist der wichtigste Hebel für „unverkennbar".** Die _Spannung_ dreier Schriften — Serif für
> Erzählung, Sans für Funktion, Mono für Daten — _ist_ die Marke. Heute ist nur „Inter" benannt und
> fällt mangels Webfont auf System-Sans zurück; Headlines sind Sans, Datenwerte fett-Inter. Das macht
> Query-Land aktuell austauschbar. **Das Typo-Fundament ist der erste Umsetzungsschnitt (§9).**

### 4.1 Die drei Stimmen
| Schrift | Rolle | Wo |
|---|---|---|
| **Literata** (Serif) | Erzählung, Prestige | Alle Headlines (h1–h3), Hero, Sektions-Intros, Empty-States, Glossar-Begriffe |
| **Inter** (Sans) | Funktion, Klarheit | UI-Labels, Nav, Body-Copy, Buttons, Formulare, Tabellen-Text |
| **JetBrains Mono** | „kalkuliert", Daten | **Alle Metrik-Werte**, URLs, HTTP-Status (`200`/`301`/`noindex`), Meta-Tags, IDs, Code, Konfidenz-Buchstabe im Detail |

**Faustregel:** _Erzählung serif, Bedienung sans, Messwert mono._ Sobald eine Zahl eine **gemessene
Kennzahl** ist (Visibility 73, Position 4, 1.240 URLs), steht sie in Mono. Das ist die sofort
wiedererkennbare Geste — „die Zahlen sehen aus wie im Terminal, die Überschriften wie in der Zeitung".

### 4.2 Skala (aus DESIGN.md, verbindlich)
- `display-lg` Literata 700 / 48px / 1.1 / -0.02em
- `headline-lg` Literata 700 / 32px / 1.2 / -0.01em  (mobil 28px)
- `headline-md` Literata 600 / 24px / 1.3
- `headline-sm` Literata 600 / 20px / 1.4
- `body-lg/md/sm` Inter 400 / 18·16·14px
- `label-caps` Inter 600 / 12px / 0.08em / UPPERCASE  ← Bento-„Metric Header", Eyebrows
- `data-mono` JetBrains Mono 500 / 14px / 1.2  ← Werte, URLs, Codes

### 4.3 Editorial-Feinheiten
- **Orange-Akzentwort in Headlines:** in Literata-Strings darf **ein** SEO-Schlüsselwort orange gesetzt
  werden (z. B. „Finden Sie technische Probleme, die **Traffic** kosten."). Max. eins pro Headline.
- **Vertikaler Rhythmus:** Headlines bekommen großzügigen Top-Margin, damit die Serifen atmen.
- **Tabular numbers:** Mono-Werte mit `font-variant-numeric: tabular-nums` → Zahlen fluchten in Spalten.
- **Ziffern in DeltaChips & Achsen:** ebenfalls Mono/tabular, damit Trends ruhig wirken.

---

## 5. Signatur-„Feinheiten" (was Query-Land unverkennbar macht)

### 5.0 „New Horizon" — die Landschafts-Illustration (Marken-Bildwelt)
Die stärkste eigenständige Geste neben der Typografie: eine **minimale Natur-Landschaft als feine
1px-Linien-Illustration** im Header — sich überlagernde **Höhenzüge/Ridgelines, die zum Horizont
zurückweichen, mit einer kleinen aufgehenden orangen Sonne** über dem fernsten Kamm. Sie verkörpert das
Namens-Konzept (§1): _neues Land, neuer Horizont, die gute Lage voraus._

- **Einsatz:** Header von Overview/Hero, Login, Empty-States, Reports-Deckblatt, Marketing. **Nicht** in
  dichten Datenbereichen — sie rahmt, sie konkurriert nie mit Zahlen (Serious-Zone).
- **Stil:** Charcoal-1px-Linien auf Papier, **ein** orange Akzent (Sonne bzw. Höhenring). Sehr
  zurückhaltend, dekorativ, nie fotografisch, nie farbig gefüllt. Lesbarkeit der Headline hat Vorrang.
- **Zwei feste Anwendungen** (Vokabular: `/brand/README.md`):
  - **Horizont** (Höhenzüge + aufgehende Sonne) → **Hero/Overview** (`brand/header/horizon/`).
  - **Ridges** (topografische Höhenlinien-Bänder) → **Unterseiten** (`brand/header/ridges/`).
  - _Weitere Landschaften_ (Valley/Plateau/Dunes …) = **Asset-Extension für später**
    (`brand/illustration/landscapes/`).
- **Bezug zum Logomark:** dieselbe Linien-DNA wie das Contours-Mark (§2.2) — Mark = die Karte im Kleinen,
  Header = das Terrain im Großen. Ein konsistentes kartografisches System.

### 5.1 Detail-Signaturen
Diese Detail-Entscheidungen sind der eigentliche Markenkern — die Summe macht den Wiedererkennungswert.

1. **Mono-Messwerte.** Jede gemessene Kennzahl in JetBrains Mono, tabular. Der stärkste visuelle Tic.
2. **Serif-Headlines mit einem Orange-Wort.** Broadsheet-Geste, exakt dosiert.
3. **Evidence-Signatur.** ConfidenceBadge an _jeder_ Zahl — unser „open/belegbar"-Wasserzeichen.
4. **Haarlinien statt Schatten.** 1px `--line`-Divider, „technische Zeichnung / Blueprint" — keine
   weichen Box-Shadows zur Trennung. (Einzige Schatten: die eine große, sehr weiche Karten-Elevation.)
5. **Oneline-Icons.** 1px-Stroke, nie gefüllt — Icons als „Annotationen am Manuskript".
6. **Papier-Grain.** Sehr feine Noise-Textur auf dem Hintergrund gegen Screen-Müdigkeit, gibt „Print".
7. **Bento auf 12-Spalten.** Metriken als modulare Kacheln (3/4/6/12 Spalten), 16–24px Innen-Padding.
8. **Aktiv-Punkt statt Block.** Aktive Nav: orange **Punkt** + Inter Medium, kein vollflächiger Block.
9. **Mono-Microcopy für Technisches.** URLs, Status, Selektoren, Pfade immer Mono — nie im Fließtext-Sans.
10. **Kartografische Empty-States.** „Hier ist noch unerschlossenes Gebiet — starten Sie einen Crawl."
    Die Land-Metapher lebt _nur hier_ (und Hero/Erfolg/Glossar), mit dezentem Höhenlinien-Glyph.

> Test für „markengerecht": Ein Screenshot ohne Logo sollte an **Mono-Zahlen + Serif-Headline +
> Haarlinien + einem Orange-Akzent** als Query-Land erkennbar sein.

---

## 6. Layout, Form & Tiefe

- **Fixed Grid (Broadsheet):** zentraler Content max. ~1280px; 12-Spalten-Raster; Charts spannen 3/4/6/12.
- **Bento-Karten:** `--surface` weiß, 1px `--line`, Radius `1.5rem`, eine große weiche Elevation
  (`0 24px 80px rgba(77,47,23,.08)`) — sparsam, nur zum Abheben vom Papier.
- **Haarlinien-Divider:** 1px `--line` zwischen Sektionen/Tabellenzeilen; **keine** vertikalen Tabellenlinien.
- **Ecken:** Inputs/Buttons weich; Pills 999px; große Karten `1.5rem`. Diszipliniert, nie verspielt.
- **Intentional Voids:** dichte Visualisierungen mit ≥40px Whitespace umgeben → hebt ihre Bedeutung.
- **Tabellen:** editorial — Header `label-caps` auf `--surface-muted`, 1px horizontale Zeilen-Haarlinien.

---

## 7. Textur & Motion

- **Grain/Noise:** sehr feines SVG-/CSS-Noise-Overlay (~3–5% Opazität) auf `--background`. Zusätzlich der
  bestehende dezente Orange-Radial-Glow oben rechts (bleibt, sehr leise).
- **Glassmorphism:** nur für schwebende Leisten/Overlays (Sidebar-Backdrop, Command-Palette): hoher Blur
  (~24–30px) + Grain. Sparsam.
- **Haptik:** Buttons default flach/grafisch; auf Hover ein scharfer 2px-Schatten (simulierter „Druck").
- **Motion:** dezent, ≤300ms, `ease-out`; `prefers-reduced-motion` immer respektiert.

---

## 8. Voice (Verweis)
Tonalität, Serious-Zonen, Begriffe und das kontrollierte Metaphern-Vokabular sind in
`ux-ui-sprint.md` Teil 1 verbindlich geregelt. Branding-relevant hier nur: **belegbar** ist das
Marken-Wort; Metapher nur im Rahmen; Zahlen/Status/Validierung immer rein sachlich.

---

## 9. Umsetzungs-Lücke & Roadmap (Direction → Code)

Reihenfolge nach Sichtbarkeit/Aufwand. Jeder Schritt nutzt CSS-Tokens, kein Hardcoding.

| # | Schnitt | Aufwand | Wirkung |
|---|---|---|---|
| **B-1** | **Typo-Fundament**: Literata + Inter + JetBrains Mono via `next/font` in `layout.tsx`; CSS-Vars `--font-serif/-sans/-mono`; Headlines→Serif, `.metric-value`/Codes→Mono | **S–M** | **Höchste** — macht die Marke sichtbar |
| **B-2** | **Brand-Lockup**: Wortmarke in Literata, orange Bindestrich/Punkt; Eyebrow-Claim; (Logomark sobald aus Exploration finalisiert) | S | Hoch |
| **B-3** | **Mono-Daten-Pass**: alle gemessenen Kennzahlen (Metric-Cards, Tabellen, DeltaChip-Ziffern, Chart-Achsen) auf `data-mono` + `tabular-nums` | S–M | Hoch (Signatur) |
| **B-4** | **Editorial-Tabellen**: Header `label-caps`/`--surface-muted`, Zeilen-Haarlinien, keine Vertikalen | S | Mittel |
| **B-5** | **Grain-Overlay** + Aktiv-Punkt-Nav + Oneline-Icon-Audit | S | Mittel |
| **B-6** | **Logomark + Header-Illustration** finalisieren (aus §5.0/§10) → saubere **SVGs** (Layered-Ridges-Header, Höhenlinien-Mark), Favicon, Lockup; `/kit` „Brand"-Sektion | M | Mittel |
| **B-7** | **DESIGN.md-Resync**: warme Paper-&-Ink-Werte + Mono-Rolle in Frontmatter spiegeln | S (Doku) | Konsistenz |

**Gate je Schnitt:** Tokens via `var(--…)`; Orange nur „wir/CTA"; `/kit` zeigt den Zustand;
`npm run check` + `build:web` grün; A11y (Kontrast, Fokus, `reduced-motion`).

---

## 10. Visuelle Exploration (Magnific)

Design-Richtungen werden mit Magnific-Bild-AIs exploriert (nur **`gpt-2` @1k** für Typo/Linien-Layout und
**Nano Banana Pro** referenz-geführt für Stil-Konsistenz), um die Direction an konkreten Mockups zu
validieren, **bevor** Code entsteht.

### Runde 1 — Editorial-Tech-Fundament (validiert ✔)
1. **Wortmarke / Identity-Sheet** — `Query-Land.`-Lockup, oranger Bindestrich + Punkt, topografisches
   Höhenlinien-Logomark mit Such-Fokuspunkt (Terrain, **kein** Maritim/Kompass). _Trifft die Marke._
2. **Overview-Dashboard** — Serif-Hero „Sichtbarkeit, die sich **belegen** lässt", Mono-Metriken
   (`12_842`, `278_410`), Evidence-Pills, Hairline-Bento, Orange-Punkt-Nav. _Sehr nah am Soll._
3. **Technical-Audit-Screen** — Section-Treemap, Indexability-Funnel, Priority-Matrix (eigene Serie orange),
   Mono-Status (`200`/`301`/`noindex`). _Bestätigt die Datenflächen._

### Runde 2 — „New Horizon" Bildwelt (neue Direction, §5.0)
Aufbauend auf Runde-1-Dashboard als **Referenz** (Stil festhalten), Konzept _Query-Land = neues Land /
Horizont_ (kein Maritim/Kompass):
4. **Konzept-Sheet** mit 4 Landschafts-Motiven: _Layered Ridges · Terrain Contours · Open Plain/Trail ·
   New Land Vista_ (1px-Linien-Illustration, editorial).
5. **Header-Banner** `Query-Land.` über Höhenzügen mit aufgehender oranger Sonne + Mono-Tagline. _Hero-tauglich._
6. **Integrierte Dashboards** (referenz-geführt): Header-Band als (a) _Layered Ridges_ und (b)
   _Terrain Contours_ — dezent oben rechts, ohne Lesbarkeitsverlust. _Beide tragfähig._

**Zwischenstand / Empfehlung:**
- Editorial-Tech-Fundament ist bestätigt → **B-1 (Typo) priorisieren**.
- **Belegte Zuordnung (Vokabular `/brand/README.md`):** **Horizont** = Hero-Header · **Ridges** =
  Unterseiten-Header · **Contours** = Logomark/Daten-Textur. _Weitere Landschaften_ = Extension für später.

### Runde 3 — Base-Asset-Sets + Kit-Struktur (✔)
Pro Anwendung ein konsistentes Asset-Set + Grundprinzip-Blatt, einsortiert in das Brand-Kit auf
Repo-Ebene (**`/brand/`**, Format JPG; finale SVGs später). Struktur und Vokabular: **`/brand/README.md`**.

- `guidelines/cartographic-system.jpg` (**Grundprinzip**) · `guidelines/identity-sheet.jpg`
- `header/horizon/…` (Hero — Höhenzüge + Sonne) · `header/ridges/…` (Unterseiten — Höhenlinien-Bänder)
- `illustration/landscapes/…` (**Extension**, für später) · `reference/before-after-overview.jpg`

**Vorgehen:** Mockups sind _Orientierung_, nicht 1:1-Vorlage; verbindlich bleiben Tokens (`globals.css`)
und Voice (`ux-ui-sprint.md`). **Nächster Schritt (rote Linie):** zurück auf den Base-Plan — **B-1
(Typo-Fundament)** umsetzen; finale Logo-/Header-**SVGs** folgen danach.

---

## 11. Don'ts (Marken-Guardrails)
- Orange als Daten-/Kategoriefarbe oder zweite überall-Akzentfarbe.
- Metapher in Zahlen, Status, Filtern, Buttons, Fehlermeldungen.
- Headlines in Sans, Messwerte in proportionaler Sans (bricht die Signatur).
- Gefüllte Icons, weiche Schatten als primäre Trennung, mehr als eine Orange-Geste pro Headline/Lockup.
- „Open Source"-Banner / lautes Open-Wording (der Unterton trägt über Belegbarkeit, nicht über Lautstärke).
- Bau-/Roadmap-Sprache in der UI (`Welle`, `Slice`, `Stub`, `§x.y` …).
