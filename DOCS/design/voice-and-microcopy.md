# Voice & Microcopy Guide — Query-Land

> Verbindliche Spec für den Microcopy/Voice-Reframe (Roadmap Phase 2, UX-3). Quelle: Quiz-Audit 2026-06-07 (3 Runden).
> Wahrheitsebene Produkt: `docs/PRODUCT_MASTER_SPEC.md`; UX-Soll: `docs/UX_FLOWS.md`.

## 1. Marke & Charakter

- **Name:** **Query-Land** (löst „AuraSEO"/„Internal SEO OS" ab).
- **Charakter:** seriöser SEO-Berater mit Substanz — plus eine **Land-/Karten-Metapher als Marken-Klammer** (leicht verspielt, nie albern).
- **Auflösung des Spannungsfelds „Pro vs. verspielt":**
  - **Substanz = streng sachlich:** Datenwerte, Tabellen-Labels, Zahlen, Status, Buttons, Fehlermeldungen. Hier **keine** Metapher, kein Wortspiel.
  - **Metapher = Marken-Klammer:** nur in Claim, Sektions-Intros (Hero), Empty-States, Erfolgsmeldungen, Glossar. **Max. eine** Metapher-Geste pro Screen.
- **Claim (Sidebar-Eyebrow/Tagline):** Nutzen-Claim, z. B. **„Sichtbarkeit, die sich belegen lässt."** (Alternativen: „SEO-Entscheidungen mit Beleg statt Bauchgefühl.")

### Serious-Zonen — Metapher & Spielfreude zurückhalten (verbindlich, hat Vorrang)
Wo es um **harte Kennzahlen und Wahrheitsaussagen über die Website** geht, ist der Ton **rein professionell** — keine Metapher, kein Augenzwinkern, keine „Gebiete/Terrain"-Sprache. Diese Regel hat **Vorrang vor der Marken-Klammer**:
- **Konfidenz/Evidenz** und deren Begründung.
- **Alle Kennzahlen/KPIs:** Visibility-Index, Health Score, Rankings/Positionen, Klicks/Impressionen, Follow-Ratio, Priorität/Score.
- **Validierung & Vorher/Nachher** (z. B. „indexierbar → nicht indexierbar").
- **Status & Übergänge** von Chancen/Issues, Audit-Befunde, Diffs.
- **Fehler-, Warn- und Validierungsmeldungen.**

**Faustregel:** Sobald eine Zahl, ein Status oder eine belegte Aussage im Spiel ist → sachlich. Die Metapher lebt nur im **Rahmen** (Claim, Hero-Intro, Empty-/Erfolgs-State, Glossar), **nie im Inhalt**. Im Zweifel: Metapher weglassen.

### Kontrolliertes Metaphern-Vokabular (sparsam einsetzen)
| Metapher | Bedeutung | Erlaubt in |
|---|---|---|
| Terrain / Gebiet | eigene Website / URL-Bestand | Hero, Empty-State |
| erkunden / kartieren | crawlen / auditieren | Empty-State, Erfolg |
| Karte | Übersicht / Dossier | Hero |
| blinde Flecken | Orphan-/nicht indexierbare URLs | Empty-State, „Warum"-Zeile |
| Routen | interne Verlinkung | „Warum"-Zeile |

**Guardrail:** Metapher nie in Zahlen, Status-Badges, Filter-Labels, Buttons. Im Zweifel sachlich.

## 2. Zielgruppe & Erklärtiefe

- **Gemischt, gestuft (Progressive Disclosure):** Profi-Tiefe als Standard, Einsteiger-Hilfen nicht-invasiv darüber.
- **Drei Erklär-Mechaniken (beschlossen):**
  1. **Tooltips/Info-Icons (ⓘ)** an Fachbegriffen → 1-Satz-Definition.
  2. **„Warum das zählt"-Zeile** je Modul/Karte → ein Satz Nutzen/Wirkung.
  3. **Zentrales Glossar** (eigene Seite); Tooltips verlinken dorthin.
  - *(Aufklappbare „Mehr erfahren"-Accordions bewusst nicht.)*
- **Inline-Erklär-Priorität (Tooltip + „Warum"):** Konfidenz/Evidenz · Opportunity & Priorität · Indexierbarkeit & Crawl · Visibility-Index & Rankings. Rest deckt das Glossar.

## 3. Tonalität & Anrede

- **Ton:** sachlich-präziser Berater — kompetent, klar, vertrauenswürdig; kurze, aktive Sätze; Nutzen vor Mechanik.
- **Anrede:** **neutral-imperativ** in Buttons/Labels (kein direktes Ansprechen), **„Sie"** in Fließtexten/Hilfen. Kein „Du".
- **Hero-Regel:** beschreibt **Nutzen/Ergebnis**, nicht die Bauphase. (Schlecht: „Welle-2 UI-Slice … Worker folgt." Gut: „Finden und priorisieren Sie technische Probleme, die organischen Traffic kosten.")

## 4. Sprache & Begriffe

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

## 5. Konfidenz/Evidenz-Darstellung

**Klartext-Label + Farbe** statt Buchstabe; Buchstabe A–E + §-Bezug nur im Tooltip/Detail.

| Klasse | Klartext-Label | Farbe | Quelle (Tooltip) |
|---|---|---|---|
| A | Gesichert | 🟢 grün | Eigene Daten (Crawl, Logs, CMS, GA4, Lighthouse) |
| B | Beobachtet | 🟢 teal | Google/eigene API (GSC, PageSpeed) |
| C | Gemessen (SERP) | 🟡 gelb | Beobachtete Suchergebnisse |
| D | Geschätzt | ◆ slate | Drittanbieter-Schätzung |
| E | KI-Hinweis (kein Beleg) | ⚪ grau | LLM-Interpretation — nie als Evidenz |

> Exakte Farbwerte/Tokens (inkl. `--conf-*`) und alle Visualisierungen: **`seo-ui-kit.md`**. Brand-Orange ist bewusst **kein** Konfidenz-Wert (bleibt „wir/CTA").

## 6. Wortverbote in nutzersichtbarer Copy

Diese Bau-/Roadmap-Sprache erscheint **nie** in der UI (nur in Code/Docs):
`Welle` / `Wave`, `Slice`, `Stub`, `v0`, `§x.y`, `SQLite` / `API` (als Selbstzweck), `Contracts`, `connector_sync`, `Foundation(-State)`, „Worker folgt", „noch Demo-Modul", hartkodierte Daten/Versionen.

## 7. Vorher / Nachher (Referenzbeispiele)

| Ort | Vorher | Nachher |
|---|---|---|
| Technical-Audit-Hero | „Welle-2 UI-Slice: Die Seite liest … aus SQLite/API. Der Worker folgt …" | „Technische SEO-Analyse — finden und priorisieren Sie Crawl-, Index- und Performance-Probleme, die organischen Traffic kosten." |
| Sidebar-Tagline | „Internal SEO OS · First-party, source-anchored SEO Workflows." | „Query-Land — Sichtbarkeit, die sich belegen lässt." |
| Empty-State (URL-Dossier) | „Noch keine Discovered URLs für die ausgewählte Site." | „Hier ist noch unerschlossenes Gebiet. Starten Sie einen Crawl im Technical Audit, um diese URLs zu kartieren." |
| Opportunity-Karte | „opportunity · technical_fix" | „Optimierungschance · Technischer Fix" + Konfidenz-Badge „🟢 Gesichert ⓘ" |
| Confidence | „Klasse E · §2.3/§2.7" | „⚪ KI-Hinweis (kein Beleg)" mit Tooltip zur Begründung |

## 8. Schreibregeln (Kurz)
1. Nutzen zuerst, Mechanik später. 2. Aktiv, kurz, konkret. 3. Ein Fachbegriff pro Satz, sonst Tooltip. 4. **Serious-Zonen (Kennzahlen, Status, Konfidenz, Validierung, Fehler) immer rein sachlich — Professionalität vor Metapher (§1).** 5. Konsistente Begriffe laut §4. 6. Keine Bau-Sprache (§6). 7. Max. eine Metapher-Geste pro Screen, nur im Rahmen, nie im Inhalt.
