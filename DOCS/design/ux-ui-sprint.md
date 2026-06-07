# Großer UX/UI-Sprint — Query-Land

> **Ein** Dokument für den gesamten UX/UI-Sprint: Aufgaben + die drei Spec-Teile (Voice & Microcopy · UI-Kit · Component-Placement). Ersetzt die früheren Einzeldateien.
> Übergeordnete Roadmap/Phasen: `../tasks/roadmap.md`. Wahrheitsebenen: `../docs/PRODUCT_MASTER_SPEC.md`, UX-Soll `../docs/UX_FLOWS.md`.
> Status: Spezifikation + Aufgabenplan (Umsetzung folgt). Stand: 2026-06-07.

## Ziel
Das fertige Produkt (M0–M6) im UI **sichtbar, konsistent und markengerecht** machen: Marke „Query-Land", professioneller Berater-Ton mit dosierter Land-Metapher, SEO-Praktiker-Sprache, Progressive Disclosure für Nicht-SEO-Nutzer und SEO-spezifische Visualisierungen (Recharts + visx) statt generischer Tabellen. **Der gesamte sichtbare Qualitätssprung braucht kein neues Backend** — nur die Erklär-Primitive + Chart-Lib.

## Aufgaben

### Block 1 — UX-Reconciliation (P0, billig, höchste Sichtbarkeit)
Reihenfolge: **UX-9 → UX-3 → UX-2 → UX-1 → UX-8**.

| ID | Aufgabe | Aufwand |
|---|---|---|
| **UX-0** | **Chart-Lib-Spike** (zuerst, de-risk) — Recharts in diesem Repo verifizieren (Spec unten). | S–M |
| **UX-9** | Erklär-Infrastruktur: Tooltip/Info-Icon, `ConfidenceBadge` (Klartext+Farbe, A–E, Teil 1 §5 / Teil 2 §2.3), `DeltaChip`, „Warum das zählt"-Zeile, Glossar-Seite `/glossar` (Inhalt: **Glossar-Seed** unten). Chart-Lib kommt aus **UX-0**. | M |
| **UX-3** | Voice & Microcopy-Reframe strikt nach **Teil 1**: Dev-/Wellen-/§-/SQLite-Sprache raus, SEO-Nutzen rein; `app-shell` hartkodiertes „Welle 1"-Badge + Datum entfernen; Begriffe (Chance/Quell-Verknüpfung/Indexierbarkeit), Claim, Anrede. | S–M |
| **UX-2** | Nav-Metadaten: gebaute Module `planned`→`active`; `icon`-Feld rendern (Material Symbols) oder entfernen; toten `createPlannedModulePage` löschen. | S |
| **UX-1** | Overview-Neubau nach **Teil 3 §B**: TrendChart(Visibility)+Marker, ScoreGauge(Health), PositionDistribution, Top-Chancen-Matrix, Risiken, letzte Crawls/Reports; Demo-Fixtures raus. | M |
| **UX-8** | `UX_FLOWS.md` nachziehen: URL-Dossier in Nav-Zeile, Content-Workspace als ausstehend, Begriffe/Marke spiegeln. | S (Doku) |

### Block 2 — Screen-Tiefe (P1)
| ID | Aufgabe | Aufwand | Backend? |
|---|---|---|---|
| **UX-4** | URL-Dossier als Inspector-360° (Teil 3 §E): GSC-Leistung, Rankings/Queries, externe Links, Web-Vitals. Content-Fit später. | M | nein (opt. `?pageUrl=`/`?targetUrl=`) |
| **UX-5** | Opportunity-Board (Teil 3 §G): PriorityMatrix + Kanban + FilterBar (Typ 0-Backend) + Evidence-Chain-Drawer. | S+M | nein |
| **UX-6a** | Technical Audit: IndexabilityFunnel, SectionTreemap, Issue-Groups+Score (Teil 3 §D). | S–M | nein |
| **UX-6b** | Crawl-Diff (zwei Runs). | L | **ja** (Store+Route) |

### Block 3 — Scope-Entscheidung
| ID | Aufgabe | Aufwand |
|---|---|---|
| **UX-7** | Content Workspace (fehlt komplett, net-new): bauen (Briefings/Refresh/Snippet-/Linkvorschläge, eigener Screen + Backend) **oder** bewusst verschieben + in `UX_FLOWS.md` markieren. Entscheidung in `../tasks/decisions-backlog.md`. | XL |

**Sprint-Gate:** Marke/Voice, Navigation, Erklär-Hilfen, Overview/Board/Dossier/Audit spiegeln den realen Stand und die Specs unten; `npm run check` + `build:web` grün.

> **AuthZ (WP-Z.1)** und die strukturell geblockten Backend-GAPs liegen in `../tasks/roadmap.md` (nicht Teil dieses UX-Sprints).

## UX-0 — Chart-Lib-Spike (zuerst, vor allen Charts)
**Ziel:** den Chart-Stack in *diesem* Repo (Next 15 App Router, React 19) verifizieren, bevor Chart-Komponenten gebaut werden.
- **Installieren:** `recharts` (Default). `@visx/hierarchy` + `d3-force`/`react-force-graph` erst bei Bedarf in Block 2 (Treemap/Graph) — im Spike nur prüfen, ob installierbar; nicht produktiv einbinden.
- **Proof:** **eine** Client-Island (`"use client"`) bauen — z. B. Visibility-`AreaChart` oder `Sparkline` — mit **serverseitig geladenen** Daten (`/projects/{id}/visibility`) als Props (keine Fetches im Client-Chart).
- **Verifizieren:** keine SSR-/Hydration-Fehler; `ResponsiveContainer` funktioniert; Farben über `var(--primary)`/`chartTheme.ts`; `prefers-reduced-motion`; akzeptables Bundle-Delta; `build:web` grün.
- **Liefern:** `chartTheme.ts` (Token-Map), dokumentiertes Import-/Island-Muster, **Go/No-Go zu Recharts** (+ Notiz, ob visx für Block 2 nötig).
- **Gate:** Proof-Chart rendert mit echten Daten auf einem realen Screen; `npm run check` + `build:web` grün. **Aufwand: S–M.**

## Claim (Platzhalter) & Brand-Hinweis
- **Platzhalter-Claim (Phase 2):** „Sichtbarkeit, die sich belegen lässt." — bewusst vorläufig.
- **Sidebar-Markenname:** „Query-Land".
- **Brand-Rescoping verschoben:** vollständiges Rebranding (Wortmarke/Logo, `<title>`/Metadaten, Favicon, README, Paketnamen, Domain, finale Schreibweise) erfolgt **nach Phase 2** — in Phase 2 nur Sidebar-Name + Platzhalter-Claim.

## Glossar-Seed (Quelle für UX-9 Tooltips & `/glossar`)
Kurzdefinitionen im Berater-Ton (sachlich, ein Satz). Werden zur einzigen Quelle für Tooltips und Glossar-Seite.

| Begriff | Definition |
|---|---|
| Crawl | Automatisiertes Abrufen der Seiten einer Website, um Erreichbarkeit, Inhalte und Verlinkung zu erfassen. |
| Indexierbarkeit | Ob eine URL in den Suchindex aufgenommen werden darf (nicht durch robots/noindex/Canonical blockiert). |
| Health Score | Aggregierter technischer Gesundheitswert einer Site aus offenen Issues und deren Schwere. |
| Visibility-Index | Positionsgewichteter Sichtbarkeitswert über die getrackten Keywords (0–100). |
| Ranking / Position | Platz einer URL in den Suchergebnissen für ein Keyword (1 = oben). |
| Keyword / Intent | Suchbegriff samt dahinterliegender Absicht (informational, kommerziell, transaktional …). |
| SERP / SERP-Feature | Suchergebnisseite; Sonderelemente wie Featured Snippet, People-Also-Ask, Image Pack. |
| Striking Distance | Keywords knapp außerhalb der Top-10 (Position 11–20) — die günstigsten Hebel. |
| CTR-Gap | Abstand zwischen positionsüblicher und tatsächlicher Klickrate — Hinweis auf schwache Snippets. |
| Kannibalisierung | Mehrere eigene URLs konkurrieren um dasselbe Keyword. |
| Backlink | Link von einer fremden Website auf die eigene. |
| Verweisende Domain | Eindeutige Domain, von der mindestens ein Backlink stammt. |
| Follow / Nofollow | Ob ein Link Linkkraft weitergibt (follow) oder nicht (nofollow). |
| Follow-Ratio | Anteil der follow-Backlinks an allen Backlinks. |
| Authority | Grobe Stärke des Linkprofils als Vertrauensindikator. |
| Chance (Opportunity) | Zentrale Einheit: belegte Beobachtung → empfohlene Maßnahme → messbare Validierung. |
| Priorität | Rangwert einer Chance = Impact × Konfidenz × Business-Value ÷ Aufwand. |
| Evidenz / Konfidenz (A–E) | Beleg hinter einer Aussage und dessen Verlässlichkeit (A gesichert … E KI-Hinweis, kein Beleg). |
| Quell-Verknüpfung | Zuordnung einer URL zur verantwortlichen Code-/Template-Stelle. |
| Orphan-URL | Seite ohne interne eingehende Links — für Nutzer und Crawler schwer auffindbar. |
| Interne Verlinkung | Links zwischen eigenen Seiten; verteilen Relevanz und Auffindbarkeit. |
| Crawl-Diff | Vergleich zweier Crawls: neue/entfernte URLs und Statuswechsel. |
| Web Vitals (LCP/CLS/INP/TTFB) | Kern-Performance-Kennzahlen der Ladeerfahrung. |
| AEO | Answer Engine Optimization — Inhalte für Antwort-Engines/KI aufbereiten. |
| AI-Visibility / Citation | Ob die eigene Domain in LLM-Antworten genannt/zitiert wird (Konfidenz E — Signal, kein Beleg). |
| Report / Alert | Zusammenfassung von Kennzahlen über Zeit; Alert = Schwellwert-Auslöser. |


---

## Teil 1 — Voice & Microcopy


> Verbindliche Spec für den Microcopy/Voice-Reframe (Roadmap Phase 2, UX-3). Quelle: Quiz-Audit 2026-06-07 (3 Runden).
> Wahrheitsebene Produkt: `docs/PRODUCT_MASTER_SPEC.md`; UX-Soll: `docs/UX_FLOWS.md`.

### 1. Marke & Charakter

- **Name:** **Query-Land** (löst „AuraSEO"/„Internal SEO OS" ab).
- **Charakter:** seriöser SEO-Berater mit Substanz — plus eine **Land-/Karten-Metapher als Marken-Klammer** (leicht verspielt, nie albern).
- **Auflösung des Spannungsfelds „Pro vs. verspielt":**
  - **Substanz = streng sachlich:** Datenwerte, Tabellen-Labels, Zahlen, Status, Buttons, Fehlermeldungen. Hier **keine** Metapher, kein Wortspiel.
  - **Metapher = Marken-Klammer:** nur in Claim, Sektions-Intros (Hero), Empty-States, Erfolgsmeldungen, Glossar. **Max. eine** Metapher-Geste pro Screen.
- **Claim (Sidebar-Eyebrow/Tagline):** Nutzen-Claim, z. B. **„Sichtbarkeit, die sich belegen lässt."** (Alternativen: „SEO-Entscheidungen mit Beleg statt Bauchgefühl.")

#### Serious-Zonen — Metapher & Spielfreude zurückhalten (verbindlich, hat Vorrang)
Wo es um **harte Kennzahlen und Wahrheitsaussagen über die Website** geht, ist der Ton **rein professionell** — keine Metapher, kein Augenzwinkern, keine „Gebiete/Terrain"-Sprache. Diese Regel hat **Vorrang vor der Marken-Klammer**:
- **Konfidenz/Evidenz** und deren Begründung.
- **Alle Kennzahlen/KPIs:** Visibility-Index, Health Score, Rankings/Positionen, Klicks/Impressionen, Follow-Ratio, Priorität/Score.
- **Validierung & Vorher/Nachher** (z. B. „indexierbar → nicht indexierbar").
- **Status & Übergänge** von Chancen/Issues, Audit-Befunde, Diffs.
- **Fehler-, Warn- und Validierungsmeldungen.**

**Faustregel:** Sobald eine Zahl, ein Status oder eine belegte Aussage im Spiel ist → sachlich. Die Metapher lebt nur im **Rahmen** (Claim, Hero-Intro, Empty-/Erfolgs-State, Glossar), **nie im Inhalt**. Im Zweifel: Metapher weglassen.

#### Kontrolliertes Metaphern-Vokabular (sparsam einsetzen)
| Metapher | Bedeutung | Erlaubt in |
|---|---|---|
| Terrain / Gebiet | eigene Website / URL-Bestand | Hero, Empty-State |
| erkunden / kartieren | crawlen / auditieren | Empty-State, Erfolg |
| Karte | Übersicht / Dossier | Hero |
| blinde Flecken | Orphan-/nicht indexierbare URLs | Empty-State, „Warum"-Zeile |
| Routen | interne Verlinkung | „Warum"-Zeile |

**Guardrail:** Metapher nie in Zahlen, Status-Badges, Filter-Labels, Buttons. Im Zweifel sachlich.

### 2. Zielgruppe & Erklärtiefe

- **Gemischt, gestuft (Progressive Disclosure):** Profi-Tiefe als Standard, Einsteiger-Hilfen nicht-invasiv darüber.
- **Drei Erklär-Mechaniken (beschlossen):**
  1. **Tooltips/Info-Icons (ⓘ)** an Fachbegriffen → 1-Satz-Definition.
  2. **„Warum das zählt"-Zeile** je Modul/Karte → ein Satz Nutzen/Wirkung.
  3. **Zentrales Glossar** (eigene Seite); Tooltips verlinken dorthin.
  - *(Aufklappbare „Mehr erfahren"-Accordions bewusst nicht.)*
- **Inline-Erklär-Priorität (Tooltip + „Warum"):** Konfidenz/Evidenz · Opportunity & Priorität · Indexierbarkeit & Crawl · Visibility-Index & Rankings. Rest deckt das Glossar.

### 3. Tonalität & Anrede

- **Ton:** sachlich-präziser Berater — kompetent, klar, vertrauenswürdig; kurze, aktive Sätze; Nutzen vor Mechanik.
- **Anrede:** **neutral-imperativ** in Buttons/Labels (kein direktes Ansprechen), **„Sie"** in Fließtexten/Hilfen. Kein „Du".
- **Hero-Regel:** beschreibt **Nutzen/Ergebnis**, nicht die Bauphase. (Schlecht: „Welle-2 UI-Slice … Worker folgt." Gut: „Finden und priorisieren Sie technische Probleme, die organischen Traffic kosten.")

### 4. Sprache & Begriffe

- **Strategie:** Deutsch + etablierte SEO-Anglizismen.
- **Englisch bleibt** (Fachstandard): Crawl, Backlinks, Ranking(s), Visibility, Health Score, Reports, SERP, Keyword.
- **Eingedeutscht (beschlossen):**
  | Vorher | Nachher |
  |---|---|
  | Opportunity / Opportunities | **Chance / Optimierungschance(n)** |
  | Source Anchor | **Quell-Verknüpfung** (URL → Code-Stelle) |
  | Indexability | **Indexierbarkeit** |
- **Nav-/Modul-Labels (Deutsch + Anglizismen):**
  Übersicht · Projekte · Technical Audit · URL-Dossier · Keywords & Rankings · Content & Chancen · Backlinks · Reports · KI-Sichtbarkeit · Einstellungen.

### 5. Konfidenz/Evidenz-Darstellung

**Klartext-Label + Farbe** statt Buchstabe; Buchstabe A–E + §-Bezug nur im Tooltip/Detail.

| Klasse | Klartext-Label | Farbe | Quelle (Tooltip) |
|---|---|---|---|
| A | Gesichert | 🟢 grün | Eigene Daten (Crawl, Logs, CMS, GA4, Lighthouse) |
| B | Beobachtet | 🟢 teal | Google/eigene API (GSC, PageSpeed) |
| C | Gemessen (SERP) | 🟡 gelb | Beobachtete Suchergebnisse |
| D | Geschätzt | ◆ slate | Drittanbieter-Schätzung |
| E | KI-Hinweis (kein Beleg) | ⚪ grau | LLM-Interpretation — nie als Evidenz |

> Exakte Farbwerte/Tokens (inkl. `--conf-*`) und alle Visualisierungen: **Teil 2**. Brand-Orange ist bewusst **kein** Konfidenz-Wert (bleibt „wir/CTA").

### 6. Wortverbote in nutzersichtbarer Copy

Diese Bau-/Roadmap-Sprache erscheint **nie** in der UI (nur in Code/Docs):
`Welle` / `Wave`, `Slice`, `Stub`, `v0`, `§x.y`, `SQLite` / `API` (als Selbstzweck), `Contracts`, `connector_sync`, `Foundation(-State)`, „Worker folgt", „noch Demo-Modul", hartkodierte Daten/Versionen.

### 7. Vorher / Nachher (Referenzbeispiele)

| Ort | Vorher | Nachher |
|---|---|---|
| Technical-Audit-Hero | „Welle-2 UI-Slice: Die Seite liest … aus SQLite/API. Der Worker folgt …" | „Technische SEO-Analyse — finden und priorisieren Sie Crawl-, Index- und Performance-Probleme, die organischen Traffic kosten." |
| Sidebar-Tagline | „Internal SEO OS · First-party, source-anchored SEO Workflows." | „Query-Land — Sichtbarkeit, die sich belegen lässt." |
| Empty-State (URL-Dossier) | „Noch keine Discovered URLs für die ausgewählte Site." | „Hier ist noch unerschlossenes Gebiet. Starten Sie einen Crawl im Technical Audit, um diese URLs zu kartieren." |
| Opportunity-Karte | „opportunity · technical_fix" | „Optimierungschance · Technischer Fix" + Konfidenz-Badge „🟢 Gesichert ⓘ" |
| Confidence | „Klasse E · §2.3/§2.7" | „⚪ KI-Hinweis (kein Beleg)" mit Tooltip zur Begründung |

### 8. Schreibregeln (Kurz)
1. Nutzen zuerst, Mechanik später. 2. Aktiv, kurz, konkret. 3. Ein Fachbegriff pro Satz, sonst Tooltip. 4. **Serious-Zonen (Kennzahlen, Status, Konfidenz, Validierung, Fehler) immer rein sachlich — Professionalität vor Metapher (§1).** 5. Konsistente Begriffe laut §4. 6. Keine Bau-Sprache (§6). 7. Max. eine Metapher-Geste pro Screen, nur im Rahmen, nie im Inhalt.

---

## Teil 2 — UI-Kit (Komponenten, Charts, Tokens)


> **Status: Spezifikation** (noch nicht implementiert). Hier werden *alle* SEO-spezifischen UI-Patterns/Components präzise festgehalten, adaptiert auf unsere orange CI. Umsetzung erfolgt später schrittweise „aus dem Kit ins UI" (Roadmap Phase 2, v. a. UX-1/4/5/6/9).
>
> Verbindlich gekoppelt an: **Teil 1** (Ton, Serious-Zonen, Begriffe, Konfidenz) und **`../docs/UX_FLOWS.md`** (Schlüssel-Screens).
> Grundprinzip: SEO-Daten sind **Verlauf · Verteilung · Struktur/Beziehung · Triage · 360°-Objekt** — generische Tabellen/Cards bilden das schlecht ab; die folgenden Patterns sind der Qualitätshebel.

---

### 0. Nutzung & Geltung
- Jede Component-Spec enthält: **Zweck · Modul · Datenquelle (real) · Lib · Anatomie+CI · Interaktion · Serious-Zone-Regel · Aufwand**.
- **Serious-Zone-Regel (aus Voice-Guide):** Charts, Zahlen, Status, Konfidenz, Validierung, Fehler = **rein sachlich, keine Land-Metapher**. Metapher nur in Empty-/Erfolgs-/Hero-Rahmen.
- **Aufwand:** S (CSS/SVG, kein Lib) · M · L (Lib + Logik).

---

### 1. Chart-Bibliothek

**Entscheidung:** **Recharts** als Standard + **visx** (`@visx/*`) für Spezialfälle (Treemap, Netzwerk/Graph). Beide **MIT-Lizenz** (frei, inkl. kommerziell). Optional `d3-force`/`react-force-graph` (MIT) für den Crawl-Graph.

- **Warum Recharts:** deklarativ, deckt Line/Area/Bar/Scatter/Sparkline/Funnel ab, React-19-kompatibel (v2.15+/v3), akzeptiert **CSS-Variablen als Farbwerte** (`stroke="var(--primary)"`) → CI-Kohärenz ohne Hex-Duplikate.
- **Warum visx daneben:** Treemap (`@visx/hierarchy`) und Force-Graph sind in Recharts schwach/fehlend; visx gibt low-level SVG-Kontrolle.
- **Architektur-Regel (wichtig, App Router):** Charts sind **Client-Islands** (`"use client"`). Daten werden **im Server-Component geladen** (vorhandene `features/*/api.ts`) und als Props an die Chart-Insel übergeben. Bei Hydration-Problemen `next/dynamic` mit `ssr:false`. Immer `ResponsiveContainer`.
- **Bundle:** pro Chart-Component einzeln importieren; keine globale Chart-Bundle-Einbindung.
- **Reduced motion:** Animationen via `prefers-reduced-motion` deaktivierbar; Default-Animationsdauer ≤ 300 ms, dezent.

---

### 2. Design-Tokens & Farbsystem

#### 2.1 Bestand (aus `globals.css`)
`--background #fcfcfb` · `--surface #fff` · `--surface-muted #f4f1ed` · `--ink #211b17` · `--muted #766b62` · `--line #e8dfd6` · **`--primary #ff5c00`** · `--primary-soft #fff0e6` · `--success #16794d` · `--warning #a05a00` · `--danger #b42318`. Radius: Karten 1.5rem, Pills 999px, Inputs 0.9rem. Font Inter. Schatten `0 24px 80px rgba(77,47,23,.08)`.

#### 2.2 Orange-Prinzip (verbindlich)
**Brand-Orange `--primary` ist „Chrome + Wir".** Erlaubt für: primäre CTA, aktive Nav, Kicker, Marke — **und in Charts ausschließlich für die EIGENE Serie** (unsere Domain/Metrik = orange Hervorhebung). **Nie** als generische Kategorie-Farbe und **nie** als Daten-Semantik (kein „Warnung/Schätzung = orange"). So bedeutet Orange im Diagramm immer „du/uns" → markenkonsistent und lesbar.

#### 2.3 Neue Tokens (Vorschlag — bei Umsetzung in `globals.css`)
**Konfidenz-Skala** (verfeinert Teil 1 §5: D nutzt **Slate statt Orange**, damit Brand-Orange exklusiv bleibt). Immer mit Label + Icon (A11y, nie Farbe allein):
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

#### 2.4 `chartTheme.ts` (eine Quelle für JS-seitige Farben)
Ein kleines TS-Objekt spiegelt die Tokens (für Stellen, wo CSS-Var nicht greift), z. B. `confidence.A = "var(--conf-a)"`, `series.own = "var(--primary)"`, `categorical[type] = …`. Charts importieren nur daraus.

---

### 3. Primitive Components (cross-cutting)

#### 3.1 KonfidenzBadge `<ConfidenceBadge level="A..E">`  · S · UX-9
- **Zweck:** Beleg-Stärke einer Zahl/Aussage sichtbar machen (unser Differenzierer „evidence-first").
- **Anatomie/CI:** Pill wie `.badge`, `background:var(--conf-x-soft)`, `color:var(--conf-x)`, Punkt-Icon (●) links + Klartext-Label („Gesichert" …). Größe wie `.status`.
- **Interaktion:** `ⓘ` → Tooltip mit Klasse-Buchstabe + Quelle + §-Bezug (nur hier, nicht in der Fläche).
- **Serious-Zone:** ja, rein sachlich. **A11y:** Icon+Text, nicht nur Farbe.

#### 3.2 DeltaChip `<DeltaChip value="+12" dir="up|down|flat">` · S
- **Zweck:** Veränderung statt nackter Zahl (Position, Klicks, Domains).
- **CI:** ▲ `--success` / ▼ `--danger` / – `--muted`; kleines Pill, tabellenzeilen-tauglich. „up" ist nicht immer gut (Position!): Richtung **semantisch** parametrisieren (`goodWhen="down"` für Rankings → grün bei sinkender Zahl).
- **Serious-Zone:** ja.

#### 3.3 Sparkline `<Sparkline data=[] />` · M (Recharts `<Line>` ohne Achsen) 
- **Zweck:** Mikro-Trend in Tabellenzeilen/Cards (Keyword-Position, Visibility je Site).
- **CI:** 1px Linie `--primary` (eigene Metrik), Höhe ~28px, keine Achsen/Grid, letzter Punkt als Dot. Tooltip optional.
- **Serious-Zone:** ja.

#### 3.4 InfoTooltip / GlossarLink `<Term id="indexierbarkeit">Indexierbarkeit</Term>` · S · UX-9
- **Zweck:** Progressive Disclosure für Nicht-SEO-Nutzer.
- **CI:** Begriff mit dezent gepunkteter Unterstreichung (`--line`); Hover/Tap → Popover (`.card`-Stil, max 240px) mit 1-Satz-Definition + „Im Glossar ansehen →". Quelle der Texte = Glossar (single source).
- **A11y:** fokussierbar, `aria-describedby`, ESC schließt.

#### 3.5 „Warum das zählt"-Zeile `<WhyItMatters>` · S · UX-9
- **CI:** kleine Zeile unter Kartentitel, `color:var(--muted)`, optional Glühbirnen-Glyph in `--primary`. Genau **ein** Nutzen-Satz.
- **Serious-Zone:** sachlicher Nutzen; hier ist dezente Land-Metapher ausnahmsweise ok, wenn keine Zahl drinsteht.

#### 3.6 Inspector / Slide-over Drawer `<Inspector>` · M (Client) · UX-4/5
- **Zweck:** Detail aus jeder Tabellenzeile **ohne Kontextverlust** (GSC-URL-Inspection-Pattern).
- **CI:** rechts einfahrendes Panel, Breite `min(36rem,90vw)`, `--surface`, linke 1px `--line`, Radius links 1.5rem, Schatten; Overlay `rgba(33,27,23,.32)`. Kopf: Titel + ConfidenceBadge + Close. Body: Sektionen wie `.content-grid`.
- **Interaktion:** öffnet via Row-Click; URL-Sync (`?inspect=<id>`) für Deep-Link/Back; ESC/Overlay schließt; Fokus-Trap.

#### 3.7 Facetten-Filter & Saved Views `<FilterBar> / <SavedViews>` · M
- **Zweck:** Power-User-Filterung (Ahrefs/Botify-Segmente) — Typ, Status, Severity, Impact/Effort, URL-Gruppe.
- **CI:** baut auf `.filter-row`; aktive Filter als entfernbare `.badge.primary`-Chips; „Ansicht speichern" persistiert Filter-Set (localStorage v1, später API). 
- **A11y:** jeder Chip Button mit „×".

#### 3.8 Command-Palette `⌘K` `<CommandPalette>` · M (Client)
- **Zweck:** Sprung zu URL/Keyword/Modul/Chance — Profi-Tempo.
- **CI:** zentriertes Overlay-`.card`, Suchfeld wie `.search`, gruppierte Treffer; Tastatur-Navigation. Innovativ, optional (P2).

#### 3.9 Bulk-Action-Toolbar `<BulkBar>` · S/M
- **Zweck:** Mehrfachauswahl in Tabellen (Issues resolven, Chancen Status setzen).
- **CI:** einschwebende Leiste unten, `--surface`, Schatten, „N ausgewählt" + Aktionen als `.button.secondary.compact`.

#### 3.10 EmptyState `<EmptyState>` · S
- **Zweck:** Coaching + nächste Aktion.
- **CI:** zentrierte Karte, dezentes Glyph; **hier ist die Land-Metapher erlaubt** („Hier ist noch unerschlossenes Gebiet — starten Sie einen Crawl."). Primär-CTA `--primary`.

---

### 4. SEO-Chart-Patterns

#### 4.1 Annotierte Trendkurve mit Event-Markern `<TrendChart>` · L · Recharts
- **Zweck:** Visibility/Rankings/Backlinks über Zeit — die Hero-Kurve (Sistrix-/GSC-Pattern).
- **Modul/Daten:** Overview, Keywords & Rank (`/projects/{id}/visibility` → `score`,`computedAt`), Backlinks (`backlink_snapshots`), Reports. Event-Marker: **Deploy-Marker** (`/projects/{id}/deploy-markers`) + (später) Google-Update-Liste.
- **Anatomie/CI:** `<AreaChart>` eigene Serie `stroke/fill:var(--primary)` (Fläche 8 % Opazität), Grid `--line`, Achsentext `--muted`; `<ReferenceLine>` vertikal je Event (`--ink` gestrichelt) mit kleinem Label-Tag; Vergleichsserien neutral grau. Tooltip `.card`-Stil mit Datum + Wert + DeltaChip.
- **Interaktion:** Zeitbereich-Umschalter (7/30/90/365 T) als SegmentedControl; Hover-Crosshair; Klick auf Marker → Drawer „Was geschah".
- **Serious-Zone:** ja. **Aufwand:** L.

#### 4.2 Positions-Verteilungs-Histogramm `<PositionDistribution>` · M · Recharts `<BarChart>`
- **Zweck:** „Wo stehen wir" sofort; Striking-Distance sichtbar.
- **Daten:** Rank-Snapshots → Buckets 1–3/4–10/11–20/21–50/51–100.
- **CI:** Balken in der **sequenziellen Skala** (2.3); Bucket 11–20 trägt Label „Striking Distance" (Text, nicht Brand-Farbe). Y = Keyword-Anzahl. Klick auf Bucket → gefilterte Keyword-Tabelle.
- **Serious-Zone:** ja. **Aufwand:** M.

#### 4.3 Diverging-Bar New/Lost `<NewLostChart>` · M · Recharts `<BarChart stackOffset="sign">`
- **Zweck:** Backlink-/Keyword-Gewinne vs. Verluste über Zeit (Ahrefs-Kalender).
- **Daten:** `backlinks/diff` bzw. Snapshot-Reihen.
- **CI:** Gewinne nach oben `--success`, Verluste nach unten `--danger`, Nulllinie `--ink`. Tooltip listet konkrete Domains/Keywords.
- **Serious-Zone:** ja. **Aufwand:** M.

#### 4.4 Impact×Effort-Matrix (2×2 Bubble) `<PriorityMatrix>` · L · Recharts `<ScatterChart>`
- **Zweck:** Chancen-Triage — Quick Wins / Big Bets / Filler / Vermeiden. Bestes Bild für Laien **und** Profis.
- **Modul/Daten:** Chancen (`/projects/{id}/opportunities`): x=`effort` (1–5), y=`expectedImpact` (1–5), Größe=`businessValue`, Farbe=`type` (kategorial 2.3), Highlight-Rahmen `--primary` wenn ausgewählt.
- **CI:** vier Quadranten mit dezenten Hintergründen (`--surface-muted`), Quadranten-Labels in `--muted`; Achsentitel „Aufwand" / „Wirkung". Bubble-Hover → Tooltip mit Titel+Priorität+ConfidenceBadge; Klick → Evidence-Drawer (4.11). 
- **Serious-Zone:** ja (reine Daten). **Aufwand:** L.

#### 4.5 Indexierbarkeits-Funnel `<IndexabilityFunnel>` · M · Recharts `<FunnelChart>` o. SVG
- **Zweck:** Wo verlieren wir URLs: Entdeckt → Gecrawlt → Indexierbar → (Indexiert).
- **Daten:** discovered_urls / fetch_results / indexability_assessments (aggregiert).
- **CI:** Stufen in sequenzieller Skala; Abfall-Delta je Stufe als DeltaChip (`--danger`); Klick auf Stufe → gefilterte URL-Liste. **„Warum das zählt"-Zeile** darunter.
- **Serious-Zone:** ja. **Aufwand:** M.

#### 4.6 Health/Section-Treemap `<SectionTreemap>` · L · visx `@visx/hierarchy`
- **Zweck:** Website-Bereiche als Kacheln, eingefärbt nach Health/Indexierbarkeit (Botify/Lumar).
- **Daten:** discovered_urls nach Pfad-Segment gruppiert + Health/Issues je Segment.
- **CI:** Kachelgröße = URL-Anzahl, Farbe = Health (Grün→Amber→Slate, **funktional, nicht Brand**); Hover → Segment-Detail; Klick → URL Explorer gefiltert. Labels nur ab Mindestgröße.
- **Serious-Zone:** ja. **Aufwand:** L.

#### 4.7 Site-Architektur-/Crawl-Graph `<CrawlGraph>` · L · visx + d3-force (oder react-force-graph)
- **Zweck:** Struktur, Crawl-Tiefe, **Orphans & Hubs** sichtbar (Screaming Frog/Sitebulb).
- **Daten:** internal_link_edges (Knoten=URLs, Kanten=Links), depth, Orphan-Flag.
- **CI:** Knoten neutral `--muted`, Orphans `--danger`-Ring, Tiefen-Hubs größer; eigene/aktive URL `--primary`. Zoom/Pan; Klick → URL-Inspector. **Performance-Hinweis:** Sampling/Cluster ab ~1–2k Knoten.
- **Serious-Zone:** ja. **Aufwand:** L (schwergewichtig — bewusst priorisieren).

#### 4.8 Volume×Difficulty-Scatter `<KeywordOpportunityScatter>` · M · Recharts `<ScatterChart>`
- **Zweck:** leicht rankbare High-Volume-Keywords finden (Ahrefs).
- **Daten:** Keywords + Suchvolumen/Difficulty (sofern vorhanden; sonst aus Rank/Search-Performance ableiten). x=Difficulty, y=Volume, Farbe=Intent.
- **CI:** wie 4.4; „Sweet Spot" (hoch/leicht) dezent markiert. **Aufwand:** M.

#### 4.9 Anchor-/Intent-Verteilungsbalken + SERP-Feature-Chips `<DistributionBar>` / `<SerpFeatureChips>` · S
- **Zweck:** Anchor-Mix, Intent-Mix, SERP-Features schnell erfassen.
- **CI:** horizontaler 100 %-Stacked-Bar (kategoriale Skala) mit Legende; Feature-Chips als kleine Icon-`.badge` (Featured Snippet, PAA, Image Pack, Video, Local Pack, Sitelinks). 
- **Serious-Zone:** ja. **Aufwand:** S (CSS-Bar) / Chips S.

#### 4.10 Score-/Gauge-Dial `<ScoreGauge>` · M · Recharts `<RadialBarChart>` o. SVG-Arc
- **Zweck:** einzelne Kennzahl mit Skala: Health Score, Visibility-Index, (später) Authority/DR.
- **CI:** Halbkreis-Arc; Füllfarbe **funktional** nach Schwellen (Grün/Amber/Danger), nicht Brand; Zahl groß zentriert (`.metric-value`-Stil). Peer-/Vorwert als dünner Referenz-Tick.
- **Serious-Zone:** ja. **Aufwand:** M.

#### 4.11 Evidence-Chain-Drawer `<EvidenceChain>` · M · Client (unser Differenzierer)
- **Zweck:** §6-Einheit greifbar: **Beobachtung → Evidenz → Ursache → Maßnahme → Validierung** inkl. Vorher/Nachher.
- **Daten:** Opportunity-Objekt (`evidence[]`, `currentState`, `recommendedAction`, `validationMetric`, Vorher/Nachher).
- **CI:** vertikale Timeline im Inspector (3.6); jede Evidenz-Karte mit ConfidenceBadge + Quelle + `before→current`; Validierungs-Schritt als Status. 
- **Serious-Zone:** ja, strikt. **Aufwand:** M.

#### 4.12 AI „Share of Voice" + Citation-Matrix `<AiVisibilityPanel>` · M (innovativ/neu)
- **Zweck:** AEO — werden wir in LLM-Antworten zitiert? (Profound/Peec-Feld, noch unstandardisiert).
- **Daten:** ai_prompts × ai_answer_snapshots (`ourCited`, `brandMentioned`).
- **CI:** Gauge „Citation-Anteil" + Matrix Prompts (Zeilen) × „zitiert? ●/○" (Spalten/Status). **Pflicht-Hinweis** ConfidenceBadge **E (KI-Hinweis, kein Beleg)** + Klartext, dass dies **kein** Evidenz-Beleg ist.
- **Serious-Zone:** ja — besonders streng (Klasse E nie als Beweis). **Aufwand:** M.

---

### 5. Komposite Layouts

#### 5.1 URL-Inspector 360° (UX-4)
Inspector-Drawer (3.6) mit Tabs/Sektionen: Identität+Quell-Verknüpfung · Fetch/Indexierbarkeit (+Historie als Mini-Timeline) · **GSC-Leistung** (Klicks/Impr./Position, Sparkline) · **Rankings/Queries** · interne Links (Inlinks/Outlinks) · **externe Links** (Backlinks auf URL) · Web Vitals · Issues · Chancen. Jede Zahl mit ConfidenceBadge.

#### 5.2 Opportunity-Board (UX-5)
Oben **PriorityMatrix (4.4)** als visuelle Triage; darunter umschaltbar **Status-Kanban** (offen→in Arbeit→umgesetzt→validiert, Drag optional) **oder** Tabelle mit Facetten-Filter (3.7) + Sparkline + ConfidenceBadge; Zeilen-/Bubble-Klick → **Evidence-Chain-Drawer (4.11)**. Progressive Disclosure: Matrix für Einsteiger, Tabelle für Profis.

#### 5.3 Technical Audit (UX-6)
**IndexabilityFunnel (4.5)** + **SectionTreemap (4.6)** als Überblick; **Issue-Groups** (nach Rule/Severity, mit Impact-Score, gruppiert/aufklappbar) statt flacher Tabelle; **Crawl-Compare/Diff** (zwei Runs: neu/entfernt/Statuswechsel, Diverging-Bar + Liste); optional **CrawlGraph (4.7)**.

#### 5.4 Overview-Dashboard (UX-1)
**TrendChart (4.1, Visibility)** als Hero + **ScoreGauge (4.10, Health)** + **PositionDistribution (4.2)** + **Top-Chancen als Mini-Matrix** + Risiken (offene kritische Issues) + letzte Crawls/Reports. Nur echte Daten, keine Demo-Fixtures.

---

### 6. Mapping: Component → Modul → Roadmap → Lib → Aufwand

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

### 7. Implementierungs-Leitplanken
1. **Daten serverseitig laden, Charts als Client-Insel** mit Props (keine Daten-Fetches in Client-Charts).
2. **Farben über CSS-Variablen** (`var(--…)`) bzw. `chartTheme.ts`; nie Hex hartkodieren in Components.
3. **Brand-Orange nur als „wir/CTA"** — in Datenfarben verboten (außer eigene Serie/Auswahl-Highlight).
4. **Serious-Zone:** in/aus Charts, Zahlen, Status, Konfidenz keine Metapher/Spielfreude.
5. **Jede Kennzahl trägt eine ConfidenceBadge** (evidence-first als Signatur).
6. **A11y:** Farbe nie allein (Label/Icon dazu); Tastatur-Bedienung für Drawer/Palette/Filter; Tooltips fokussierbar; `prefers-reduced-motion` respektieren.
7. **No-Data/Loading/Error** je Chart definieren (skeleton + EmptyState mit nächster Aktion).
8. **Responsive:** `ResponsiveContainer`; unter 980px Charts volle Breite, Treemap/Graph ggf. durch Liste ersetzen.
9. **Dependency-Disziplin:** nur Recharts + visx (+ optional d3-force für Graph); alles MIT.

---

## Teil 3 — Component-Placement (wo sitzt was)


> Begleitdokument zu **Teil 2**. Legt pro Screen/Sektion fest, welche Komponente wohin gehört, aus welcher **echten** Datenquelle sie gespeist wird und ob sie **jetzt** oder **später** baubar ist. Grundlage: M0–M6 (alle Endpunkte vorhanden) + bekannte Lücken.

### Status-Legende
- ✅ **Jetzt** — Daten/Endpunkt existiert, rein UI-Arbeit.
- 🟡 **Bald** — kleiner Backend-Zusatz nötig (z. B. Aggregat-Endpoint, `?filter=`-Param).
- 🔭 **Zukunft** — neues Backend / Credentials / Daten fehlen (Crawl-Diff, Wettbewerber, echte Provider, Content-Fit).

---

### A. Global / auf jedem Screen
| Komponente | Platzierung | Datenquelle | Status |
|---|---|---|---|
| AppShell + Nav (Icons, deutsche Labels, „aktiv"-Status) | Sidebar | `module-routes.ts` | ✅ (UX-2) |
| Command-Palette ⌘K | global Overlay | Projekte/Sites/Keywords/URLs/Module | ✅ (P2) |
| Inspector-Drawer | aus jeder Tabellenzeile | je Kontext | ✅ |
| ConfidenceBadge | an **jeder** Kennzahl/Aussage | `sourceConfidence` der jeweiligen Daten | ✅ |
| Term/Tooltip + Glossar-Link | an Fachbegriffen | `/glossar` | ✅ (UX-9) |
| DeltaChip | überall wo Vorher/Nachher | Snapshot-Reihen | ✅ |
| „Warum das zählt"-Zeile | je Modul/Karte | statisch (Copy) | ✅ (UX-9) |
| EmptyState (Land-Metapher erlaubt) | leere Listen | — | ✅ |
| FilterBar / Saved Views, Bulk-Bar | Listen-Screens | jeweils | ✅ |

---

### B. Overview `/` (UX-1)
| Komponente | Sektion | Datenquelle | Status |
|---|---|---|---|
| **TrendChart** + Event-Marker | Hero: Visibility über Zeit | `/projects/{id}/visibility`; Marker: `/projects/{id}/deploy-markers` ✅, Google-Updates 🔭 | ✅ (Updates 🔭) |
| **ScoreGauge** | Health-Score | `…/health-scores` | ✅ |
| **PositionDistribution** | Rankings-Verteilung | rank_snapshots | ✅ |
| **PriorityMatrix (mini)** | Top-Chancen | `/projects/{id}/opportunities?limit=5` | ✅ |
| Risiken-Liste | offene kritische Issues | `…/audit-issues?status=open&severity=critical` | ✅ |
| Liste „letzte Crawls/Reports" | unten | `…/crawl-runs`, `/reports` | ✅ |
| KPI „organische Klicks/Impressionen" | Metric-Karte | **kein Aggregat-Endpoint** → Summe aus `search-performance` o. Platzhalter | 🟡 |

### C. Projects `/projects`
| Komponente | Sektion | Datenquelle | Status |
|---|---|---|---|
| Entity-Tabellen + Forms (Bestand) | Projekte/Sites | `/projects`,`/sites` | ✅ |
| **Sparkline** je Projekt/Site | Visibility-Mini-Trend | visibility_scores | ✅ |
| Markt-/Wettbewerber-Chips | Site-Config | markets ✅; Wettbewerber 🔭 | 🔭 (Wettbewerber) |
| ConfidenceBadge | (entfällt — Config, keine Messwerte) | — | — |

### D. Technical Audit `/technical-audit` (UX-6)
| Komponente | Sektion | Datenquelle | Status |
|---|---|---|---|
| **IndexabilityFunnel** | Überblick | discovered_urls / fetch_results / indexability | ✅ |
| **SectionTreemap** (Health je Pfad) | Überblick | discovered_urls (Pfad-Gruppierung) + Issues | ✅ |
| **Issue-Groups** (nach Rule/Severity + Impact-Score) | Hauptbereich | `…/audit-issues` | ✅ |
| **ScoreGauge** Health + DeltaChip ggü. letztem Run | Kopf | health_scores | ✅ |
| **CrawlGraph** (Orphans/Hubs) | optional | internal_link_edges (+orphan) | ✅ (L) |
| Web-Vitals-Karten | unten | `…/web-vitals` (site-skopiert) | ✅ (per-URL 🟡) |
| Inspector + Bulk-Bar (resolve/dismiss/reopen) | URL/Issue-Detail | crawl/issue-Stores | ✅ |
| **Crawl-Compare/Diff** (Diverging-Bar + Liste) | eigener Tab | **neuer Store+Route** | 🔭 (UX-6b) |

### E. URL Dossier `/url-dossier` (UX-4) — Inspector 360°
| Komponente | Sektion | Datenquelle | Status |
|---|---|---|---|
| Inspector-Layout / Tabs | ganzer Screen | — | ✅ |
| Identität + **Quell-Verknüpfung** | Kopf | source-map `resolveSourceAnchor` | ✅ |
| Fetch/Indexierbarkeit + **Mini-Timeline** | Sektion | fetch/indexability-Historie | ✅ |
| **GSC-Leistung** (Klicks/Impr./Pos.) + Sparkline | Sektion | `…/search-performance` (Filter `pageUrl`) | ✅ (🟡 `?pageUrl=`) |
| **Rankings/Queries** | Sektion | rank/search-performance | ✅ |
| interne Links (In/Out) | Sektion | link-graph | ✅ |
| **externe Links** (Backlinks auf URL) | Sektion | `/projects/{id}/backlinks` (Filter `targetUrl`) | ✅ (🟡 `?targetUrl=`) |
| Web Vitals (Site-Hinweis) | Sektion | web-vitals | 🟡 |
| Issues / Chancen | Sektion | crawl / opportunities | ✅ |
| **Content-Fit** | Sektion | — kein Endpoint | 🔭 |

### F. Keywords & Rank `/keywords-rank`
| Komponente | Sektion | Datenquelle | Status |
|---|---|---|---|
| **PositionDistribution** | Kopf | rank_snapshots | ✅ |
| **TrendChart** Visibility | Kopf | visibility_scores | ✅ |
| Keyword-Tabelle + **Sparkline** (Pos.-Trend) + DeltaChip | Hauptbereich | rank_snapshots-Historie | ✅ |
| Intent-Badges + **SERP-Feature-Chips** | je Zeile | keywords.intent; serp_snapshots.serpFeatures | ✅ |
| FilterBar (Intent/Brand/Markt) | Kopf | keyword-Filter | ✅ |
| Inspector (SERP-Diff, Rang-Historie) | Detail | `…/serp-diff`, rank-snapshots | ✅ |
| **KeywordOpportunityScatter** (Vol×Difficulty) | Analyse | Volumen/Difficulty fehlen → Proxy Pos×Impressionen aus search-perf ✅, echtes Vol/Diff 🔭 | 🟡/🔭 |
| Cluster-Treemap/Bubbles | Analyse | keyword_groups ✅; Volumen-Größe 🔭 | 🟡 |

### G. Chancen / Opportunity Board `/content-opportunities` (UX-5)
| Komponente | Sektion | Datenquelle | Status |
|---|---|---|---|
| **PriorityMatrix** (Impact×Effort) | oben (Triage) | `/opportunities` (impact/effort/businessValue/type) | ✅ |
| **Status-Kanban** | umschaltbar | opportunity.status + transitions | ✅ |
| Tabelle + FilterBar (Typ/Status/Impact/Effort) | umschaltbar | `…/opportunities` (`type`-Filter 0-Backend) | ✅ |
| **Evidence-Chain-Drawer** | Zeilen-/Bubble-Klick | evidence[], currentState, recommendedAction, validationMetric | ✅ |
| ConfidenceBadge + BulkBar | je Zeile / Auswahl | opportunity | ✅ |
| Search-Performance-Intelligence-Panel (Striking/CTR/Cannibal) | Sektion (Bestand) | `…/search-performance/intelligence` | ✅ |

### H. Backlinks `/backlinks` (UX-4-Bereich)
| Komponente | Sektion | Datenquelle | Status |
|---|---|---|---|
| **TrendChart** (Backlinks/Ref-Domains über Zeit) | Hero | backlink_snapshots | ✅ |
| **NewLostChart** (Diverging-Bar) | Sektion | `…/backlinks/diff` | ✅ |
| **DistributionBar** (Anchor-Mix) | Sektion | authority `topAnchors` | ✅ |
| **ScoreGauge** (Follow-Ratio/Authority) | Kopf | authority `followRatio`; DR 🔭 | ✅ (DR 🔭) |
| Ref-Domains-Tabelle + Sparkline + DeltaChip | Hauptbereich | referring-domains, snapshots | ✅ |
| ConfidenceBadge (Klasse B) | überall | backlink sourceConfidence | ✅ |
| Ref-Domain-Netzwerk (Graph-Variante) | optional | backlinks | 🟡 |
| **Link-Intersect / Competitor-Gap** | Analyse | kein fremdes Linkprofil | 🔭 |

### I. Reports `/reports` (M5)
| Komponente | Sektion | Datenquelle | Status |
|---|---|---|---|
| Report-Liste + letzter Report (Abschnitte) | Hauptbereich | `/reports` | ✅ |
| Export-Buttons CSV/HTML/PDF | je Report | `…/export` | ✅ |
| Schedules + „Fällige ausführen" | Sektion | report-schedules | ✅ |
| Alert-Regeln + **AlertEvent-Liste** | Sektion | alert-rules / alert-events | ✅ |
| **ScoreGauge / Mini-TrendChart** (Metrik vs. Schwelle) | Alerts | alert_events-Verlauf | 🟡 |
| „Warum das zählt" (Schedules/Alerts) | je Karte | Copy | ✅ |

### J. AI Visibility / KI-Sichtbarkeit `/ai-visibility` (M6)
| Komponente | Sektion | Datenquelle | Status |
|---|---|---|---|
| **AiVisibilityPanel** (Share-of-Voice-Gauge + Citation-Matrix) | Hero | ai_prompts × ai_answer_snapshots | ✅ |
| **ScoreGauge** (AI-Visibility-Score) | Kopf | `…/ai-visibility` | ✅ |
| Prompts-Liste + Inspector (Antwort, zitierte Domains) | Sektion | ai snapshots | ✅ |
| AEO-Assessments + Score + Check-Details | Sektion | `…/aeo` | ✅ |
| Proposals-Liste + Accept/Reject (review-gated) | Sektion | proposals | ✅ |
| **ConfidenceBadge E** (Pflicht: „kein Beleg") | überall | LLM=E | ✅ |

### K. Settings `/settings`
| Komponente | Sektion | Datenquelle | Status |
|---|---|---|---|
| Connector-Karten + Status, Source-Map-Form/Tabelle, Pre-Merge-Gate | Bestand | integrations / source-map / pr-checks | ✅ |
| Quota/Freshness-Gauge je Connector | Connector-Karte | integration quota/freshness | 🟡 |
| AuthZ-/Rollen-UI | Sektion | WP-Z.1 | 🔭 |

### L. Neue Screens
| Screen | Komponenten | Status |
|---|---|---|
| **Glossar** `/glossar` (UX-9) | Term-Liste + Suche; Konfidenz-Legende; Quelle für alle Tooltips | ✅ |
| **Content Workspace** `/content-workspace` (UX-7) | Content-Score-Gauge, Brief-Editor, Term-Checkliste, Refresh-Kandidaten, interne Linkvorschläge | 🔭 (net-new Backend) |

---

### M. Rückwärts-Index — Komponente → Screens
| Komponente | Eingesetzt in |
|---|---|
| ConfidenceBadge | Overview, Dossier, Keywords, Chancen, Backlinks, Reports, AI, (Audit) — **fast überall** |
| TrendChart | Overview, Keywords, Backlinks, (Reports) |
| ScoreGauge | Overview, Audit, Backlinks, Reports, AI |
| PositionDistribution | Overview, Keywords |
| PriorityMatrix | Chancen, Overview (mini) |
| Sparkline | Overview, Projects, Keywords, Backlinks |
| Inspector-Drawer | Dossier, Audit, Keywords, Chancen, Backlinks, AI |
| Evidence-Chain-Drawer | Chancen, Dossier |
| IndexabilityFunnel / SectionTreemap / CrawlGraph | Technical Audit |
| NewLostChart / DistributionBar | Backlinks (DistributionBar auch Keywords) |
| AiVisibilityPanel | AI Visibility |
| FilterBar/SavedViews, BulkBar, Command-Palette, EmptyState, Term/Tooltip, DeltaChip, WhyItMatters | global |

---

### N. „Jetzt" vs. „Zukunft" — Rollup
**Sofort baubar (✅, reine UI auf vorhandenen Endpunkten):** alle Primitive (UX-9) · Overview-Kern (Trend/Gauge/Histogram/Matrix/Risiken) · Chancen-Board (Matrix/Kanban/Evidence/Filter) · Backlinks (Trend/NewLost/Distribution/Gauge) · Keywords (Histogram/Sparkline/Chips/Filter/Inspector) · URL-Dossier-Sektionen · AI-Panel · Audit-Funnel/Treemap/Issue-Groups/Graph · Reports-Bestand · Glossar.

**Kleiner Backend-Zusatz (🟡):** organische-Klicks-Aggregat (Overview) · `?pageUrl=`/`?targetUrl=`-Filter (Dossier) · per-URL Web-Vitals · Alert-Trend · Connector-Quota-Gauge · Keyword-Cluster-Größe.

**Zukunft (🔭, neues Backend/Credentials/Daten):** Crawl-Diff · Competitor-/Link-Intersect-Daten · echtes Keyword-Volumen/Difficulty · Authority/DR aus Drittquelle · Content-Fit · Content Workspace · Google-Update-Marker · AuthZ-UI · Google-Update-Feed.

> Konsequenz für die Reihenfolge: Der **gesamte sichtbare Qualitätssprung** (Overview, Chancen, Backlinks, Keywords, Audit-Überblick, AI) ist **ohne neues Backend** machbar — er hängt nur an UX-9 (Primitive) + Chart-Lib. Die 🔭-Punkte bleiben im Hintergrund-Backlog (Credentials/Worker/Wettbewerber).
