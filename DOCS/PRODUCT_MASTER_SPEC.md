# Internal SEO Operating System — Master Spec

> **Status:** Source of Truth (Produkt/Scope) · **Scope:** eigene Web-Properties (< 5k URLs, voller Repo-Zugriff)
> Wahrheitsebene fürs Produkt. Detail-Nahtstellen der Architektur: [`../ARCHITECTURE.md`](../ARCHITECTURE.md).
> Aktueller Baustand: [`../ROADMAP.md`](../ROADMAP.md). Die Implementierung ist die Detailebene.
> Lesereihenfolge: §1 → §2 → §6 → §7 → §10.

---

## §1 — Mission & Produktkern

**Mission:** Ein internes SEO Operating System für eigene Webplattformen, das technische Qualität,
organische Sichtbarkeit, Content-Potenziale, Link-Autorität und AI-Visibility in **einem
entscheidungsfähigen Workflow** vereint — und Erkenntnisse nicht nur misst, sondern bis in den eigenen
Quellcode hinein in umsetzbare, validierbare Arbeit übersetzt.

**Produktjob (ein Satz):** „Erkenne technische, inhaltliche, linkbezogene und AI-bezogene Wachstumshebel
auf meinen Plattformen, bewerte ihren Business-Impact, verankere sie im konkreten Quellcode und führe
mich in klarer Reihenfolge durch Umsetzung und Validierung."

**Der strukturelle Vorteil (warum Eigenbau statt Semrush-Abo):** Die Referenz-Tools (→ §A.4) sind
**externe Beobachter** fremder Domains und tragen ~70 % ihrer Komplexität nur, um fremde Daten zu
*schätzen*. Dieses Tool optimiert **eigene** Properties und hat dadurch zwei Hebel, die kein Markt-Tool
strukturell haben kann:
1. **Ground Truth statt Schätzung** — GSC, eigener Crawl, GA4/Matomo, Serverlogs liefern echte Werte.
2. **Voller Repo-Zugriff** — jede Beobachtung lässt sich auf das verursachende Template/Component
   zurückführen (→ §4.3). Ein Fix an *einer* Source-Stelle korrigiert *alle* betroffenen URLs.

Produktkern: **First-Party-Tiefe + Codebase-Verankerung.** Es ist ein umfangreiches, konkurrenzfähiges
SEO-Tool mit Semrush-/Ahrefs-DNA — nicht reduziert, sondern für die eigene Datenlage *präziser*.

---

## §2 — Produktprinzipien (bindend)

Jede Implementierungsentscheidung wird gegen diese Leitplanken geprüft.

- **§2.1 First-party before third-party.** GSC, GA4/Matomo, Logs, eigener Crawl schlagen jede generische
  Schätzung. Drittquellen sind optional und ergänzend.
- **§2.2 Action over dashboards.** Jedes Modul gibt **Maßnahmen** aus (→ §6), nicht nur Metriken.
- **§2.3 Evidence-first.** Keine Empfehlung ohne belegende Quelle und Validierungsmetrik.
- **§2.4 Source-anchored.** Wo eine Beobachtung einer Code-Ursache zuordenbar ist, trägt die Opportunity
  den Repo-Anker (→ §4.3). Fix am Template schlägt Fix an der Einzel-URL.
- **§2.5 Keyword-set over vanity index.** Projektspezifischer Visibility-Index auf dem eigenen Keyword-Set.
- **§2.6 Provider-Abstraktion.** Kein Kernmodul hängt hart an einem Datenanbieter (→ §4.2).
- **§2.7 Source-Confidence-Klassen.** Jede Datenquelle trägt eine Vertrauensklasse: **A** eigene Daten ·
  **B** Google/eigene API · **C** beobachtete SERP · **D** Drittanbieter-Schätzung · **E** LLM. **E gilt
  nie als Evidenz** (die harte Firewall → `../ARCHITECTURE.md` §1).
- **§2.8 LLM erklärt, misst nicht.** Sprachmodelle formulieren Empfehlungen, übernehmen nie die Primärmessung.
- **§2.9 Agent-ready by design.** UI und Agent konsumieren denselben API-Kern (→ §4.4).
- **§2.10 Asynchrone Validierung.** GSC-Feedback hat 3–14 Tage Latenz; Validierung ist scheduler-/tagebasiert.
- **§2.11 Business-gewichtete Priorisierung.** Eine Money-Page zählt mehr als tausend Archivseiten (→ §6.4).

---

## §3 — Systemüberblick

**Datenfluss:** Quellen → Ingestion (normalisiert, Confidence-getaggt) → Module (analysieren) →
Opportunities (priorisiert, source-anchored) → Umsetzung (UI/Ticket/PR) → Validierung (asynchron) →
zurück in den Bestand.

**Schichten:** Raw → Normalized → Analytical → Opportunity → Presentation (UI + MCP). Raw und Normalized
bleiben getrennt gespeichert (§2.7, §7).

**Zwei Bürger gleichen Rangs:** das schlanke **UI** (Übersicht, Boards, Reports) und der **Agent über
MCP** (read-first, schreibt nur über Freigabe, → §4.4). Beide sprechen denselben internen API-Kern.

---

## §4 — Querliegende Schichten

Vier Schichten, die keinem einzelnen Modul gehören; in der Foundation-Welle gebaut, von allen genutzt.

- **§4.1 Foundation** — Multi-Project, Rollen/Auth (SSO-fähig), Background-Jobs, Observability,
  Error-Tracking, Audit-Logs, Feature-Flags.
- **§4.2 Ingestion & Connectors** — einheitliches Interface je Connector
  (`source_type · auth_config · fetch() · normalize() · validate() · quota_status() · freshness()`).
  Primärquellen (A/B): GSC, URL Inspection, PageSpeed/Lighthouse, GA4/Matomo, Logs, Sitemap, robots.txt,
  eigener Crawler. Optionale Quellen (C/D): SERP-, Backlink-, Keyword-Provider. Naht Stub→Real:
  `../ARCHITECTURE.md` §2.
- **§4.3 Source Map** *(der differenzierende Layer)* — bildet eigene URLs auf ihren Quellcode ab
  (`url → template/component → repo_pfad`), Deploy-Marker, Pre-Merge-Gate (CI crawlt geänderte Templates,
  difft gegen Baseline → SEO-Regression = failing check). Schreibaktionen bleiben reviewpflichtig (§4.4).
- **§4.4 Agent / MCP Layer** — Read-first-Kontext für Codex/Agenten. Tools u. a. `get_url_dossier`,
  `list_opportunities`, `explain_opportunity`, `create_dev_ticket`, `propose_fix_pr`,
  `validate_implemented_fix`. Guardrails: Agent liest zuerst; jede Antwort referenziert Evidenz; alles
  Schreibende läuft über Freigabe.

---

## §5 — Die 7 Module

Jedes Modul: **Zweck · Kann · Grenze · Liefert.** Querschichten aus §4 werden vorausgesetzt.

**M1 — Project Control.** Kontext, gegen den alle Module arbeiten: Projekte, Scopes
(Domain/Subdomain/Folder), Märkte, Zielseiten, Wettbewerber-/Keyword-Sets, **Business-Wert pro
URL-Gruppe** (Input für §6.4), Frequenzen, Datenquellen. *Grenze:* reiner Kontext, keine Analyse.

**M2 — Crawl & Health.** Technisches Rückgrat: Crawl-Orchestrierung (vier Discovery-Quellen), Scopes,
optionales JS-Rendering **pro Projekt-Flag**, Prüfregeln (HTTP-Status, Redirects, Canonicals, Meta/Robots,
Titles/Headings, Links, Structured Data, hreflang, Duplicate/Thin, Mixed Content), **Core Web Vitals**
(LCP/CLS/INP/TTFB via PSI/Lighthouse), Health Score, **Crawl-Diff**, Indexierbarkeits-Pipeline,
Orphan-Erkennung, interner Linkgraph. *Grenze:* Vollcrawl bei < 5k URLs, kein Sampling.

**M3 — Keyword & Rank Intelligence.** Steuerung über ein kuratiertes Keyword-Universum: Keyword-Bibliothek
(GSC-Queries, Rankings, Business-Keywords, Cluster), Intent-Klassifikation, Brand/Non-Brand, URL-Mapping,
Rank-Tracking, SERP-Snapshots/-Features, **projektspezifischer Visibility-Index**, SERP-Diffs,
Kannibalisierung. *Grenze:* keine globale Keyword-DB; Fremddaten nur C/D, markiert.

**M4 — Content & Opportunity Engine.** Der ROI-Moment: GSC-getriebene Search-Performance-Intelligence
(Query-Page-Matrix, CTR-/Position-/Impression-Gap, Decay, Gewinner/Verlierer), Content-Inventar & -Decay,
Refresh-Kandidaten, Content-Gap, interne Linkvorschläge, Briefing-Generator. **Erzeugt die harten
Opportunity-Klassen:** technische Fixes · Low-Hanging Keywords · Kannibalisierung · Money-Pages ·
Internal-Link-Lücken · `aeo` (aus M7). *Grenze:* LLM erklärt, misst nicht.

**M5 — Backlink & Authority.** GSC-Link-Import als Primärquelle (Klasse B); optionaler Provider (D);
Referring Domains, Anchors, Target-URLs, New/Lost, Broken-Backlink-Targets, Authority-Verteilung/-Gaps,
Disavow-**Kandidaten** (nur manuell bestätigt). *Grenze:* kein globaler Backlink-Index; GSC liefert ~90 %
des Werts für eigene Seiten.

**M6 — Reporting & Alerts.** Report-Typen (Weekly Pulse, Technical Health, Search Performance, Content
Opportunity, Rank, Backlink, Regression …), Struktur (Summary · Wins · Losses · Critical · Opportunities ·
Completed · Validation · Next), Exporte (PDF/CSV/HTML), Versand (E-Mail/Slack), Alerts (traffic_drop,
ranking_drop, indexability_blocker, crawl_error_spike, high_value_url_issue …). *Grenze:* bündelt und
präsentiert, erzeugt keine neuen Empfehlungen.

**M7 — AI Visibility.** Pflicht, nicht Add-on: Prompt-/Citation-/Mention-Tracking, AI-Referral-Erfassung,
AEO/GEO-Content-Checks. *Grenze:* AI-Visibility-Metriken sind eigene Confidence (Klasse E), nie mit
Klasse-A-Daten vermischt; AEO-Checks dagegen sind Klasse A und speisen `aeo`-Opportunities
(→ `../ARCHITECTURE.md` §1).

---

## §6 — Die zentrale Einheit: Opportunity

Alle Module münden in **ein** Objekt. Wer es versteht, versteht das Produkt.

- **§6.1 Definition.** Beobachtung → Evidenz → Ursache → Priorität → Maßnahme → Validierung. Die
  kleinste umsetzbare und überprüfbare Arbeitseinheit.
- **§6.2 Felder.** `id · project_id · type · affected_urls/keywords/clusters · source_anchor · evidence[]
  · current_state · recommended_action · expected_impact · effort · confidence · business_value · priority
  · validation_metric · owner · status · created_at · updated_at · expires_at`.
- **§6.3 Evidenz-Paket.** Jede Evidenz: `source · source_confidence · metric · before_value ·
  current_value · time_window · affected_entity`. **Mindestens eine Evidenz Klasse A–C** pro Opportunity.
- **§6.4 Prioritätsformel.** `Priority = Impact × Confidence × Business Value × Urgency ÷ Effort`.
- **§6.5 Statusmodell & Validierungsloop.**
  `open → planned → in_progress → implemented → validated | reopened | dismissed | expired`. Beim Übergang
  auf `implemented` schedult das System einen asynchronen Re-Check (§2.10) und setzt selbst auf `validated`
  oder `reopened`. Single Source: `packages/domain-model/src/opportunities.ts`.
- **§6.6 Erster Generator.** Bewusst ein technischer Fix mit **binärer** Validierung (nicht indexiert →
  indexiert), um den Loop mit klarer Vorher/Nachher-Messung zu beweisen.

---

## §7 — Datenmodell

Kein 100-Tabellen-Schema — die richtigen ~26; alles andere sind Views/Joins/Derived Models. **Konkretes
Schema:** die versionierten Migrationen unter `../infra/db/postgres/`. Entitäten-Gruppen:

- **Kern:** `project · site · competitor · crawl_run · url · issue · keyword · keyword_group ·
  rank_snapshot · serp_snapshot · visibility_score · page_metric · content_recommendation · backlink ·
  ref_domain · integration_account · analytics_metric · report · alert`.
- **AI:** `ai_prompt · ai_answer_snapshot · aeo_assessment · proposal`.
- **Source-Map (§4.3):** `source_repo · template · url_template_map · deploy_marker · pr_check`.
- **Opportunity (§6):** `opportunity` + zugehörige `evidence`.

**Speicherprinzip:** Raw und Normalized getrennt; bei < 5k URLs liegt alles in Postgres (→ §9.2).

---

## §8 — KPIs

Sieben Kern-KPIs (die letzten beiden sind Welle-7-KPIs). Detailformeln im Code der zuständigen Module.

| KPI | Modul | Definition |
|---|---|---|
| Health Score | M2 | Gewichteter technischer Gesundheitswert aus Issues/Severity |
| Project Visibility | M3 | Sichtbarkeit auf dem eigenen Keyword-Set |
| Opportunity Score | §6 | Summe offenen, priorisierten Potenzials |
| Content Coverage | M4 | Abdeckung der Ziel-Themen/Intents durch performenden Content |
| Authority Delta | M5 | Veränderung der Link-Autorität über Zeit |
| AI Visibility Share *(W7)* | M7 | Anteil eigener Marke/URLs in getrackten AI-Antworten |
| AI Referral Impact *(W7)* | M7 | Beitrag von AI-Referrals zum organischen/Business-Outcome |

---

## §9 — Architektur & Stack

- **§9.1 Aufteilung.** TypeScript fürs Produkt, Python für Datenarbeit. Frontend Next.js/React; API in
  TypeScript; Worker (Crawling/Parsing/SERP). System of Record: **Postgres** (Neon prod, PGlite lokal).
- **§9.2 Bewusst weggelassen.** Bei < 5k URLs: **kein ClickHouse** (Postgres trägt die Historie), Object
  Storage optional, **Redis nur optional** (Postgres-Job-Queue genügt). Reaktivieren erst bei Bedarf.
- **§9.3 Provider-Abstraktion.** Connector-Interfaces, Quota-Awareness, Cache-Policies (§4.2, §2.6).

---

## §10 — Delivery-Wellen & Gates

Wellen statt Monsterprompt; Codex baut pro Welle **einen vertikalen Schnitt** (DB → API → Service → UI/MCP
→ Tests), kein isoliertes Modul. Alle sieben Wellen sind implementiert; verbleibende Härtung: `../ROADMAP.md`.

| Welle | Ziel | Go/No-Go-Gate |
|---|---|---|
| 1 · Foundation | Monorepo, Auth/Rollen, Projekte, Ingestion, Datenmodell, Jobs, Source-Map-Gerüst | Domain anlegen, Crawl starten, GSC verbinden |
| 2 · Audit Core | Crawler, Discovery, Issue-Engine, Health Score, Linkgraph, Indexierbarkeit, Web-Vitals | 95 % stabile Vollcrawls |
| 3 · Keyword Core | Keyword-Bibliothek, Rank-Tracking, Visibility-Index, SERP-Diffs | tägliche Verläufe, Export, Alerts |
| 4 · Opportunity Engine | Search-Performance, Opportunity-Klassen, Score, Evidenz, Validierungsloop | jede Empfehlung mit Evidenz + Score + Validierungsmetrik |
| 5 · Authority Layer | GSC-Link-Import, Ref-Domains, New/Lost, Authority-Gaps | neue/verlorene Links nachvollziehbar |
| 6 · Reporting Layer | Reports, PDF/CSV, E-Mail/Slack, Alerts | Wochenreport automatisiert |
| 7 · AI Layer | AI Visibility, AEO, MCP-Vollausbau | Agent beantwortet echte SEO-Fragen über eigene Daten |

**Reihenfolge-Begründung:** Audit ist das Rückgrat; Keyword/Rank baut darauf; Opportunity ist der
ROI-Moment; Authority/Reporting glänzen erst auf stabiler Datenbasis; AI zuletzt (sonst baut man auf Sand).

---

## §11 — Codex-Arbeitsweise

- **Master-Regel.** `PRODUCT_MASTER_SPEC.md` ist die Produkt-Wahrheitsebene; bei Konflikt gewinnt der
  Master. Nahtstellen/Guardrails: `../ARCHITECTURE.md`. Baustand: `../ROADMAP.md`.
- **Vertikaler Schnitt.** Nie „ein Modul" isoliert, sondern ein durchgehender Schnitt einer Welle.
- **Akzeptanzkriterien (jede Welle).** Keine Empfehlung ohne Evidenz (§2.3); keine Provider-Hardcodierung
  (§2.6); Raw/Normalized getrennt (§2.7); Jobs idempotent; Fehler sichtbar; Tests für Kernlogik; **alles
  Schreibende bleibt reviewpflichtig** (§4.4).

---

## §A — Anhang

### A.2 Eingeschränkt abbildbar (ehrliche Grenzen)
Globaler Backlink-Index · globale Keyword-DB · Traffic-Schätzung fremder Domains · historische
Sichtbarkeit fremder Domains · vollständige SERP-Abdeckung. Ohne lizenzierten Provider nie auf
Marktführer-Niveau — kein Makel, weil das Tool auf eigene Plattformen zielt (§1).

### A.3 Bewusste Entscheidungen
Web Vitals in Modul 2 (kein eigenes Modul). JS-Rendering als Projekt-Flag. Vollcrawl statt Sampling
(< 5k URLs). UI schlank, MCP gleichrangig. AI Visibility architektonisch ab W1, funktional ab W7.

### A.4 Referenz-Anker (DNA übernehmen, nicht klonen)
- **Semrush** — breiteste Suite; Site Audit, Position Tracking inkl. AI-Modi, AI-Visibility-Toolkit, API/MCP.
- **XOVI** — DACH; Advisor (priorisierte Aufgaben mit Erklärung); Monitoring-OVI als individueller Index.
- **Ahrefs** — tiefste Research-/Backlink-DNA; Site Audit (Health Score); priorisierte Opportunities; MCP.
- **Similarweb** — Brücke SEO ↔ Traffic ↔ AI-Discovery; Rank Tracker, Gen-AI/AEO-Module.

**Kernmuster (alle vier):** Projekt anlegen → Datenquellen verbinden → KPIs verdichten → Maßnahmen
priorisieren → reporten → automatisieren. **Nicht übernommen:** globale Massen-Indizes über fremde Domains.

### A.5 UX Navigation & Screens
Marke: **Query-Land** (Design: [`../design/brand-identity.md`](../design/brand-identity.md)).
**Hauptnavigation:** Übersicht · Projekte · Technical Audit · URL-Dossier · Keywords & Rankings ·
Content & Chancen · Backlinks · Reports · KI-Sichtbarkeit · Einstellungen.
**Schlüssel-Screens:** Übersicht (Visibility, Health, Top-Chancen — echte Daten) · URL-Dossier (eine URL
als vollständiges SEO-Objekt) · Content & Chancen (Opportunity Board mit Evidenz-/Validierungs-Drawer) ·
Technical Audit (Crawl-Runs, Indexierbarkeits-Funnel, Issue-Gruppen, Crawl-Diff) · Content Workspace.
**Erklär-Infrastruktur:** `/glossar` (Begriffe + Konfidenz-Legende, Quelle aller Tooltips) · `/kit`
(Komponenten-Showcase).

### A.6 Offene strategische Entscheidungen
Siehe [`../DECISIONS.md`](../DECISIONS.md) (Plattform-Typen, Competitor-Provider, Märkte, Agent-Mandat,
Mandanten-/GSC-Ownership).
