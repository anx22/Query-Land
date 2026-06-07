# SEO UI-Kit — Pattern- & Component-Katalog (Query-Land)

> **Status: Spezifikation** (noch nicht implementiert). Hier werden *alle* SEO-spezifischen UI-Patterns/Components präzise festgehalten, adaptiert auf unsere orange CI. Umsetzung erfolgt später schrittweise „aus dem Kit ins UI" (Roadmap Phase 2, v. a. UX-1/4/5/6/9).
>
> Verbindlich gekoppelt an: **`voice-and-microcopy.md`** (Ton, Serious-Zonen, Begriffe, Konfidenz) und **`../docs/UX_FLOWS.md`** (Schlüssel-Screens).
> Grundprinzip: SEO-Daten sind **Verlauf · Verteilung · Struktur/Beziehung · Triage · 360°-Objekt** — generische Tabellen/Cards bilden das schlecht ab; die folgenden Patterns sind der Qualitätshebel.

---

## 0. Nutzung & Geltung
- Jede Component-Spec enthält: **Zweck · Modul · Datenquelle (real) · Lib · Anatomie+CI · Interaktion · Serious-Zone-Regel · Aufwand**.
- **Serious-Zone-Regel (aus Voice-Guide):** Charts, Zahlen, Status, Konfidenz, Validierung, Fehler = **rein sachlich, keine Land-Metapher**. Metapher nur in Empty-/Erfolgs-/Hero-Rahmen.
- **Aufwand:** S (CSS/SVG, kein Lib) · M · L (Lib + Logik).

---

## 1. Chart-Bibliothek

**Entscheidung:** **Recharts** als Standard + **visx** (`@visx/*`) für Spezialfälle (Treemap, Netzwerk/Graph). Beide **MIT-Lizenz** (frei, inkl. kommerziell). Optional `d3-force`/`react-force-graph` (MIT) für den Crawl-Graph.

- **Warum Recharts:** deklarativ, deckt Line/Area/Bar/Scatter/Sparkline/Funnel ab, React-19-kompatibel (v2.15+/v3), akzeptiert **CSS-Variablen als Farbwerte** (`stroke="var(--primary)"`) → CI-Kohärenz ohne Hex-Duplikate.
- **Warum visx daneben:** Treemap (`@visx/hierarchy`) und Force-Graph sind in Recharts schwach/fehlend; visx gibt low-level SVG-Kontrolle.
- **Architektur-Regel (wichtig, App Router):** Charts sind **Client-Islands** (`"use client"`). Daten werden **im Server-Component geladen** (vorhandene `features/*/api.ts`) und als Props an die Chart-Insel übergeben. Bei Hydration-Problemen `next/dynamic` mit `ssr:false`. Immer `ResponsiveContainer`.
- **Bundle:** pro Chart-Component einzeln importieren; keine globale Chart-Bundle-Einbindung.
- **Reduced motion:** Animationen via `prefers-reduced-motion` deaktivierbar; Default-Animationsdauer ≤ 300 ms, dezent.

---

## 2. Design-Tokens & Farbsystem

### 2.1 Bestand (aus `globals.css`)
`--background #fcfcfb` · `--surface #fff` · `--surface-muted #f4f1ed` · `--ink #211b17` · `--muted #766b62` · `--line #e8dfd6` · **`--primary #ff5c00`** · `--primary-soft #fff0e6` · `--success #16794d` · `--warning #a05a00` · `--danger #b42318`. Radius: Karten 1.5rem, Pills 999px, Inputs 0.9rem. Font Inter. Schatten `0 24px 80px rgba(77,47,23,.08)`.

### 2.2 Orange-Prinzip (verbindlich)
**Brand-Orange `--primary` ist „Chrome + Wir".** Erlaubt für: primäre CTA, aktive Nav, Kicker, Marke — **und in Charts ausschließlich für die EIGENE Serie** (unsere Domain/Metrik = orange Hervorhebung). **Nie** als generische Kategorie-Farbe und **nie** als Daten-Semantik (kein „Warnung/Schätzung = orange"). So bedeutet Orange im Diagramm immer „du/uns" → markenkonsistent und lesbar.

### 2.3 Neue Tokens (Vorschlag — bei Umsetzung in `globals.css`)
**Konfidenz-Skala** (verfeinert `voice-and-microcopy.md` §5: D nutzt **Slate statt Orange**, damit Brand-Orange exklusiv bleibt). Immer mit Label + Icon (A11y, nie Farbe allein):
```
--conf-a:#16794d; --conf-a-soft:#e7f6ee;   /* A Gesichert     (eigene Daten)        */
--conf-b:#0e7c86; --conf-b-soft:#e2f4f5;   /* B Beobachtet    (Google/eigene API)   */
--conf-c:#b7791f; --conf-c-soft:#fbf0db;   /* C Gemessen SERP (beobachtete Suche)   */
--conf-d:#5b6478; --conf-d-soft:#edeff3;   /* D Geschätzt     (Drittanbieter)       */
--conf-e:#9aa0a6; --conf-e-soft:#f1f1f2;   /* E KI-Hinweis    (kein Beleg)          */
```
**Kategorial** (Opportunity-Typen / SERP-Features — meidet Grün/Rot/Orange wegen Semantik):
```
--cat-technical:#0e7c86;  --cat-keyword:#6f7d2e;  --cat-cannibal:#8a4f9e;
--cat-money:#4f56b5;      --cat-link:#9a6b4f;     --cat-aeo:#5b6478;
```
**Sequenziell (Positions-Buckets, gut→schwach):** `#16794d` (1–3) · `#4f9e6f` (4–10) · `#b7791f` (11–20, „Striking Distance") · `#5b6478` (21–50) · `#9aa0a6` (51–100).
**Serien:** eigene = `--primary`; Vergleich/Wettbewerb = `--muted` / `#9aa0a6` (neutral, nie orange).
**Chart-Chrome:** Achsen/Grid `--line`; Achsentext `--muted` 0.75rem; Tooltip = `.card`-Stil (weiß, Radius 1rem, Schatten); Tortenring-Innenradius 60 %.

### 2.4 `chartTheme.ts` (eine Quelle für JS-seitige Farben)
Ein kleines TS-Objekt spiegelt die Tokens (für Stellen, wo CSS-Var nicht greift), z. B. `confidence.A = "var(--conf-a)"`, `series.own = "var(--primary)"`, `categorical[type] = …`. Charts importieren nur daraus.

---

## 3. Primitive Components (cross-cutting)

### 3.1 KonfidenzBadge `<ConfidenceBadge level="A..E">`  · S · UX-9
- **Zweck:** Beleg-Stärke einer Zahl/Aussage sichtbar machen (unser Differenzierer „evidence-first").
- **Anatomie/CI:** Pill wie `.badge`, `background:var(--conf-x-soft)`, `color:var(--conf-x)`, Punkt-Icon (●) links + Klartext-Label („Gesichert" …). Größe wie `.status`.
- **Interaktion:** `ⓘ` → Tooltip mit Klasse-Buchstabe + Quelle + §-Bezug (nur hier, nicht in der Fläche).
- **Serious-Zone:** ja, rein sachlich. **A11y:** Icon+Text, nicht nur Farbe.

### 3.2 DeltaChip `<DeltaChip value="+12" dir="up|down|flat">` · S
- **Zweck:** Veränderung statt nackter Zahl (Position, Klicks, Domains).
- **CI:** ▲ `--success` / ▼ `--danger` / – `--muted`; kleines Pill, tabellenzeilen-tauglich. „up" ist nicht immer gut (Position!): Richtung **semantisch** parametrisieren (`goodWhen="down"` für Rankings → grün bei sinkender Zahl).
- **Serious-Zone:** ja.

### 3.3 Sparkline `<Sparkline data=[] />` · M (Recharts `<Line>` ohne Achsen) 
- **Zweck:** Mikro-Trend in Tabellenzeilen/Cards (Keyword-Position, Visibility je Site).
- **CI:** 1px Linie `--primary` (eigene Metrik), Höhe ~28px, keine Achsen/Grid, letzter Punkt als Dot. Tooltip optional.
- **Serious-Zone:** ja.

### 3.4 InfoTooltip / GlossarLink `<Term id="indexierbarkeit">Indexierbarkeit</Term>` · S · UX-9
- **Zweck:** Progressive Disclosure für Nicht-SEO-Nutzer.
- **CI:** Begriff mit dezent gepunkteter Unterstreichung (`--line`); Hover/Tap → Popover (`.card`-Stil, max 240px) mit 1-Satz-Definition + „Im Glossar ansehen →". Quelle der Texte = Glossar (single source).
- **A11y:** fokussierbar, `aria-describedby`, ESC schließt.

### 3.5 „Warum das zählt"-Zeile `<WhyItMatters>` · S · UX-9
- **CI:** kleine Zeile unter Kartentitel, `color:var(--muted)`, optional Glühbirnen-Glyph in `--primary`. Genau **ein** Nutzen-Satz.
- **Serious-Zone:** sachlicher Nutzen; hier ist dezente Land-Metapher ausnahmsweise ok, wenn keine Zahl drinsteht.

### 3.6 Inspector / Slide-over Drawer `<Inspector>` · M (Client) · UX-4/5
- **Zweck:** Detail aus jeder Tabellenzeile **ohne Kontextverlust** (GSC-URL-Inspection-Pattern).
- **CI:** rechts einfahrendes Panel, Breite `min(36rem,90vw)`, `--surface`, linke 1px `--line`, Radius links 1.5rem, Schatten; Overlay `rgba(33,27,23,.32)`. Kopf: Titel + ConfidenceBadge + Close. Body: Sektionen wie `.content-grid`.
- **Interaktion:** öffnet via Row-Click; URL-Sync (`?inspect=<id>`) für Deep-Link/Back; ESC/Overlay schließt; Fokus-Trap.

### 3.7 Facetten-Filter & Saved Views `<FilterBar> / <SavedViews>` · M
- **Zweck:** Power-User-Filterung (Ahrefs/Botify-Segmente) — Typ, Status, Severity, Impact/Effort, URL-Gruppe.
- **CI:** baut auf `.filter-row`; aktive Filter als entfernbare `.badge.primary`-Chips; „Ansicht speichern" persistiert Filter-Set (localStorage v1, später API). 
- **A11y:** jeder Chip Button mit „×".

### 3.8 Command-Palette `⌘K` `<CommandPalette>` · M (Client)
- **Zweck:** Sprung zu URL/Keyword/Modul/Chance — Profi-Tempo.
- **CI:** zentriertes Overlay-`.card`, Suchfeld wie `.search`, gruppierte Treffer; Tastatur-Navigation. Innovativ, optional (P2).

### 3.9 Bulk-Action-Toolbar `<BulkBar>` · S/M
- **Zweck:** Mehrfachauswahl in Tabellen (Issues resolven, Chancen Status setzen).
- **CI:** einschwebende Leiste unten, `--surface`, Schatten, „N ausgewählt" + Aktionen als `.button.secondary.compact`.

### 3.10 EmptyState `<EmptyState>` · S
- **Zweck:** Coaching + nächste Aktion.
- **CI:** zentrierte Karte, dezentes Glyph; **hier ist die Land-Metapher erlaubt** („Hier ist noch unerschlossenes Gebiet — starten Sie einen Crawl."). Primär-CTA `--primary`.

---

## 4. SEO-Chart-Patterns

### 4.1 Annotierte Trendkurve mit Event-Markern `<TrendChart>` · L · Recharts
- **Zweck:** Visibility/Rankings/Backlinks über Zeit — die Hero-Kurve (Sistrix-/GSC-Pattern).
- **Modul/Daten:** Overview, Keywords & Rank (`/projects/{id}/visibility` → `score`,`computedAt`), Backlinks (`backlink_snapshots`), Reports. Event-Marker: **Deploy-Marker** (`/projects/{id}/deploy-markers`) + (später) Google-Update-Liste.
- **Anatomie/CI:** `<AreaChart>` eigene Serie `stroke/fill:var(--primary)` (Fläche 8 % Opazität), Grid `--line`, Achsentext `--muted`; `<ReferenceLine>` vertikal je Event (`--ink` gestrichelt) mit kleinem Label-Tag; Vergleichsserien neutral grau. Tooltip `.card`-Stil mit Datum + Wert + DeltaChip.
- **Interaktion:** Zeitbereich-Umschalter (7/30/90/365 T) als SegmentedControl; Hover-Crosshair; Klick auf Marker → Drawer „Was geschah".
- **Serious-Zone:** ja. **Aufwand:** L.

### 4.2 Positions-Verteilungs-Histogramm `<PositionDistribution>` · M · Recharts `<BarChart>`
- **Zweck:** „Wo stehen wir" sofort; Striking-Distance sichtbar.
- **Daten:** Rank-Snapshots → Buckets 1–3/4–10/11–20/21–50/51–100.
- **CI:** Balken in der **sequenziellen Skala** (2.3); Bucket 11–20 trägt Label „Striking Distance" (Text, nicht Brand-Farbe). Y = Keyword-Anzahl. Klick auf Bucket → gefilterte Keyword-Tabelle.
- **Serious-Zone:** ja. **Aufwand:** M.

### 4.3 Diverging-Bar New/Lost `<NewLostChart>` · M · Recharts `<BarChart stackOffset="sign">`
- **Zweck:** Backlink-/Keyword-Gewinne vs. Verluste über Zeit (Ahrefs-Kalender).
- **Daten:** `backlinks/diff` bzw. Snapshot-Reihen.
- **CI:** Gewinne nach oben `--success`, Verluste nach unten `--danger`, Nulllinie `--ink`. Tooltip listet konkrete Domains/Keywords.
- **Serious-Zone:** ja. **Aufwand:** M.

### 4.4 Impact×Effort-Matrix (2×2 Bubble) `<PriorityMatrix>` · L · Recharts `<ScatterChart>`
- **Zweck:** Chancen-Triage — Quick Wins / Big Bets / Filler / Vermeiden. Bestes Bild für Laien **und** Profis.
- **Modul/Daten:** Chancen (`/projects/{id}/opportunities`): x=`effort` (1–5), y=`expectedImpact` (1–5), Größe=`businessValue`, Farbe=`type` (kategorial 2.3), Highlight-Rahmen `--primary` wenn ausgewählt.
- **CI:** vier Quadranten mit dezenten Hintergründen (`--surface-muted`), Quadranten-Labels in `--muted`; Achsentitel „Aufwand" / „Wirkung". Bubble-Hover → Tooltip mit Titel+Priorität+ConfidenceBadge; Klick → Evidence-Drawer (4.11). 
- **Serious-Zone:** ja (reine Daten). **Aufwand:** L.

### 4.5 Indexierbarkeits-Funnel `<IndexabilityFunnel>` · M · Recharts `<FunnelChart>` o. SVG
- **Zweck:** Wo verlieren wir URLs: Entdeckt → Gecrawlt → Indexierbar → (Indexiert).
- **Daten:** discovered_urls / fetch_results / indexability_assessments (aggregiert).
- **CI:** Stufen in sequenzieller Skala; Abfall-Delta je Stufe als DeltaChip (`--danger`); Klick auf Stufe → gefilterte URL-Liste. **„Warum das zählt"-Zeile** darunter.
- **Serious-Zone:** ja. **Aufwand:** M.

### 4.6 Health/Section-Treemap `<SectionTreemap>` · L · visx `@visx/hierarchy`
- **Zweck:** Website-Bereiche als Kacheln, eingefärbt nach Health/Indexierbarkeit (Botify/Lumar).
- **Daten:** discovered_urls nach Pfad-Segment gruppiert + Health/Issues je Segment.
- **CI:** Kachelgröße = URL-Anzahl, Farbe = Health (Grün→Amber→Slate, **funktional, nicht Brand**); Hover → Segment-Detail; Klick → URL Explorer gefiltert. Labels nur ab Mindestgröße.
- **Serious-Zone:** ja. **Aufwand:** L.

### 4.7 Site-Architektur-/Crawl-Graph `<CrawlGraph>` · L · visx + d3-force (oder react-force-graph)
- **Zweck:** Struktur, Crawl-Tiefe, **Orphans & Hubs** sichtbar (Screaming Frog/Sitebulb).
- **Daten:** internal_link_edges (Knoten=URLs, Kanten=Links), depth, Orphan-Flag.
- **CI:** Knoten neutral `--muted`, Orphans `--danger`-Ring, Tiefen-Hubs größer; eigene/aktive URL `--primary`. Zoom/Pan; Klick → URL-Inspector. **Performance-Hinweis:** Sampling/Cluster ab ~1–2k Knoten.
- **Serious-Zone:** ja. **Aufwand:** L (schwergewichtig — bewusst priorisieren).

### 4.8 Volume×Difficulty-Scatter `<KeywordOpportunityScatter>` · M · Recharts `<ScatterChart>`
- **Zweck:** leicht rankbare High-Volume-Keywords finden (Ahrefs).
- **Daten:** Keywords + Suchvolumen/Difficulty (sofern vorhanden; sonst aus Rank/Search-Performance ableiten). x=Difficulty, y=Volume, Farbe=Intent.
- **CI:** wie 4.4; „Sweet Spot" (hoch/leicht) dezent markiert. **Aufwand:** M.

### 4.9 Anchor-/Intent-Verteilungsbalken + SERP-Feature-Chips `<DistributionBar>` / `<SerpFeatureChips>` · S
- **Zweck:** Anchor-Mix, Intent-Mix, SERP-Features schnell erfassen.
- **CI:** horizontaler 100 %-Stacked-Bar (kategoriale Skala) mit Legende; Feature-Chips als kleine Icon-`.badge` (Featured Snippet, PAA, Image Pack, Video, Local Pack, Sitelinks). 
- **Serious-Zone:** ja. **Aufwand:** S (CSS-Bar) / Chips S.

### 4.10 Score-/Gauge-Dial `<ScoreGauge>` · M · Recharts `<RadialBarChart>` o. SVG-Arc
- **Zweck:** einzelne Kennzahl mit Skala: Health Score, Visibility-Index, (später) Authority/DR.
- **CI:** Halbkreis-Arc; Füllfarbe **funktional** nach Schwellen (Grün/Amber/Danger), nicht Brand; Zahl groß zentriert (`.metric-value`-Stil). Peer-/Vorwert als dünner Referenz-Tick.
- **Serious-Zone:** ja. **Aufwand:** M.

### 4.11 Evidence-Chain-Drawer `<EvidenceChain>` · M · Client (unser Differenzierer)
- **Zweck:** §6-Einheit greifbar: **Beobachtung → Evidenz → Ursache → Maßnahme → Validierung** inkl. Vorher/Nachher.
- **Daten:** Opportunity-Objekt (`evidence[]`, `currentState`, `recommendedAction`, `validationMetric`, Vorher/Nachher).
- **CI:** vertikale Timeline im Inspector (3.6); jede Evidenz-Karte mit ConfidenceBadge + Quelle + `before→current`; Validierungs-Schritt als Status. 
- **Serious-Zone:** ja, strikt. **Aufwand:** M.

### 4.12 AI „Share of Voice" + Citation-Matrix `<AiVisibilityPanel>` · M (innovativ/neu)
- **Zweck:** AEO — werden wir in LLM-Antworten zitiert? (Profound/Peec-Feld, noch unstandardisiert).
- **Daten:** ai_prompts × ai_answer_snapshots (`ourCited`, `brandMentioned`).
- **CI:** Gauge „Citation-Anteil" + Matrix Prompts (Zeilen) × „zitiert? ●/○" (Spalten/Status). **Pflicht-Hinweis** ConfidenceBadge **E (KI-Hinweis, kein Beleg)** + Klartext, dass dies **kein** Evidenz-Beleg ist.
- **Serious-Zone:** ja — besonders streng (Klasse E nie als Beweis). **Aufwand:** M.

---

## 5. Komposite Layouts

### 5.1 URL-Inspector 360° (UX-4)
Inspector-Drawer (3.6) mit Tabs/Sektionen: Identität+Quell-Verknüpfung · Fetch/Indexierbarkeit (+Historie als Mini-Timeline) · **GSC-Leistung** (Klicks/Impr./Position, Sparkline) · **Rankings/Queries** · interne Links (Inlinks/Outlinks) · **externe Links** (Backlinks auf URL) · Web Vitals · Issues · Chancen. Jede Zahl mit ConfidenceBadge.

### 5.2 Opportunity-Board (UX-5)
Oben **PriorityMatrix (4.4)** als visuelle Triage; darunter umschaltbar **Status-Kanban** (offen→in Arbeit→umgesetzt→validiert, Drag optional) **oder** Tabelle mit Facetten-Filter (3.7) + Sparkline + ConfidenceBadge; Zeilen-/Bubble-Klick → **Evidence-Chain-Drawer (4.11)**. Progressive Disclosure: Matrix für Einsteiger, Tabelle für Profis.

### 5.3 Technical Audit (UX-6)
**IndexabilityFunnel (4.5)** + **SectionTreemap (4.6)** als Überblick; **Issue-Groups** (nach Rule/Severity, mit Impact-Score, gruppiert/aufklappbar) statt flacher Tabelle; **Crawl-Compare/Diff** (zwei Runs: neu/entfernt/Statuswechsel, Diverging-Bar + Liste); optional **CrawlGraph (4.7)**.

### 5.4 Overview-Dashboard (UX-1)
**TrendChart (4.1, Visibility)** als Hero + **ScoreGauge (4.10, Health)** + **PositionDistribution (4.2)** + **Top-Chancen als Mini-Matrix** + Risiken (offene kritische Issues) + letzte Crawls/Reports. Nur echte Daten, keine Demo-Fixtures.

---

## 6. Mapping: Component → Modul → Roadmap → Lib → Aufwand

| Component | Modul | Roadmap | Lib | Aufwand |
|---|---|---|---|---|
| ConfidenceBadge, DeltaChip, WhyItMatters, Term/Tooltip, EmptyState | alle | UX-9/UX-3 | CSS | S |
| Sparkline | Keywords, Overview, Dossier | UX-1/UX-4 | Recharts | M |
| Inspector-Drawer | Dossier, Board | UX-4/UX-5 | Client | M |
| FilterBar/SavedViews, BulkBar | Board, Audit | UX-5/UX-6 | Client | M |
| Command-Palette | global | P2 | Client | M |
| TrendChart (+Events) | Overview, Rank, Backlinks | UX-1 | Recharts | L |
| PositionDistribution | Keywords & Rank | UX-1 | Recharts | M |
| NewLostChart | Backlinks | UX-4 | Recharts | M |
| PriorityMatrix | Chancen | UX-5 | Recharts | L |
| IndexabilityFunnel | Technical Audit | UX-6 | Recharts/SVG | M |
| SectionTreemap | Technical Audit | UX-6 | visx | L |
| CrawlGraph | Technical Audit | UX-6 (opt.) | visx/d3 | L |
| KeywordOpportunityScatter | Keywords | UX-5 | Recharts | M |
| DistributionBar / SerpFeatureChips | Backlinks, Keywords | UX-4 | CSS | S |
| ScoreGauge | Overview, Audit | UX-1 | Recharts | M |
| EvidenceChain | Chancen, Dossier | UX-5 | Client | M |
| AiVisibilityPanel | KI-Sichtbarkeit | (M6-Modul) | Recharts | M |

---

## 7. Implementierungs-Leitplanken
1. **Daten serverseitig laden, Charts als Client-Insel** mit Props (keine Daten-Fetches in Client-Charts).
2. **Farben über CSS-Variablen** (`var(--…)`) bzw. `chartTheme.ts`; nie Hex hartkodieren in Components.
3. **Brand-Orange nur als „wir/CTA"** — in Datenfarben verboten (außer eigene Serie/Auswahl-Highlight).
4. **Serious-Zone:** in/aus Charts, Zahlen, Status, Konfidenz keine Metapher/Spielfreude.
5. **Jede Kennzahl trägt eine ConfidenceBadge** (evidence-first als Signatur).
6. **A11y:** Farbe nie allein (Label/Icon dazu); Tastatur-Bedienung für Drawer/Palette/Filter; Tooltips fokussierbar; `prefers-reduced-motion` respektieren.
7. **No-Data/Loading/Error** je Chart definieren (skeleton + EmptyState mit nächster Aktion).
8. **Responsive:** `ResponsiveContainer`; unter 980px Charts volle Breite, Treemap/Graph ggf. durch Liste ersetzen.
9. **Dependency-Disziplin:** nur Recharts + visx (+ optional d3-force für Graph); alles MIT.
