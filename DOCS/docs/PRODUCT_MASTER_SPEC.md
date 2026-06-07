# Internal SEO Operating System — Master Spec

> **Status:** Source of Truth · **Version:** 1.0 · **Scope:** Owned Web Properties (< 5k URLs/Property, voller Repo-Zugriff)
> Diese Datei ist die oberste Wahrheitsebene. Jede Child-Spec (`/specs/*.md`) verfeinert sie, widerspricht ihr nie. Bei Konflikt gewinnt der Master.
> Lesereihenfolge für Implementierung: §1 → §2 → §6 → §7 → §10 → zuständige Child-Spec.

---

## Inhaltsschichten

| § | Schicht | Frage, die sie beantwortet |
|---|---------|----------------------------|
| 1 | Mission & Produktkern | *Wozu existiert das Tool?* |
| 2 | Produktprinzipien | *Welche Leitplanken gelten in jeder Entscheidung?* |
| 3 | Systemüberblick | *Wie hängt alles zusammen?* |
| 4 | Querliegende Schichten | *Was nutzen alle Module gemeinsam?* |
| 5 | Die 7 Module | *Was kann das Tool, und warum?* |
| 6 | Die zentrale Einheit: Opportunity | *Worum dreht sich der ganze Output?* |
| 7 | Datenmodell | *Welche Entitäten gibt es?* |
| 8 | KPIs | *Woran misst sich Erfolg?* |
| 9 | Architektur & Stack | *Womit wird gebaut?* |
| 10 | Delivery-Wellen & Gates | *In welcher Reihenfolge, mit welchen Stopps?* |
| 11 | Repo-Struktur & Spec-Index | *Wo liegt was, und was muss jede Child-Spec enthalten?* |
| 12 | Codex-Arbeitsweise | *Wie arbeitet der Coding-Agent gegen diese Spec?* |
| A | Anhang | Offene Entscheidungen · Non-Goals · Changelog · Referenz-Anker |

---

## §1 — Mission & Produktkern

### 1.1 Mission
Ein internes SEO Operating System für eigene Webplattformen, das technische Qualität, organische Sichtbarkeit, Content-Potenziale, Link-Autorität und AI-Visibility in **einem entscheidungsfähigen Workflow** vereint — und Erkenntnisse nicht nur misst, sondern bis in den eigenen Quellcode hinein in umsetzbare, validierbare Arbeit übersetzt.

### 1.2 Produktjob (ein Satz)
> „Erkenne technische, inhaltliche, linkbezogene und AI-bezogene Wachstumshebel auf meinen Plattformen, bewerte ihren Business-Impact, verankere sie im konkreten Quellcode und führe mich in klarer Reihenfolge durch Umsetzung und Validierung."

### 1.3 Der strukturelle Vorteil
Die Referenz-Tools (→ §A.4) sind **externe Beobachter** fremder Domains. Sie tragen 70 % ihrer Komplexität nur, um fremde Daten zu *schätzen* (globale Keyword-/Backlink-Indizes, Traffic-Approximation). Dieses Tool optimiert **eigene** Properties und hat dadurch zwei Hebel, die kein Markt-Tool strukturell haben kann:

1. **Ground Truth statt Schätzung** — GSC, eigener Crawl, GA4/Matomo, Serverlogs liefern echte Werte, keine Approximation.
2. **Voller Repo-Zugriff** — jede Beobachtung lässt sich auf das verursachende Template/Component im Quellcode zurückführen (→ §4.3). Ein Fix an *einer* Source-Stelle korrigiert *alle* betroffenen URLs.

Daraus folgt der Produktkern: **First-Party-Tiefe + Codebase-Verankerung**. Wettbewerbs-Benchmarking und AI-Visibility ergänzen, ersetzen diesen Kern aber nicht.

### 1.4 Was es ausdrücklich IST
Ein umfangreiches, konkurrenzfähiges SEO-Tool mit Semrush-/XOVI-/Ahrefs-/Similarweb-DNA, zugeschnitten auf eigene Plattformen. Voller Funktionsumfang über alle SEO-Disziplinen — nicht reduziert, sondern für die eigene Datenlage *präziser*.

---

## §2 — Produktprinzipien

Diese Prinzipien sind **bindend**. Jede Implementierungsentscheidung wird gegen sie geprüft. Sie werden in den Modulen nicht erneut erklärt, sondern referenziert (`→ §2.x`).

- **§2.1 First-party before third-party.** Für eigene Seiten schlagen GSC, GA4/Matomo, Serverlogs und eigener Crawl jede generische Schätzung. Drittquellen sind optional und ergänzend.
- **§2.2 Action over dashboards.** Jedes Modul gibt **Maßnahmen** aus (→ §6), nicht nur Metriken. Eine Metrik ohne abgeleitete Handlung ist unvollständig.
- **§2.3 Evidence-first.** Keine Empfehlung ohne mindestens eine belegende Quelle und ohne Validierungsmetrik (→ §6.3, §6.5).
- **§2.4 Source-anchored.** Wo eine Beobachtung einer Code-Ursache zuordenbar ist, trägt die Opportunity den Repo-Anker (→ §4.3). Fix am Template schlägt Fix an der Einzel-URL.
- **§2.5 Keyword-set over vanity index.** Ein projektspezifischer Visibility-Index auf dem eigenen Keyword-Set steuert besser als ein globaler Marketing-Score (→ §5.3).
- **§2.6 Provider-Abstraktion.** Kein Kernmodul hängt hart an einem Datenanbieter. Drittquellen kommen über Connector-Interfaces mit Quota-Awareness und Cache-Policy (→ §4.2).
- **§2.7 Source-Confidence-Klassen.** Jede Datenquelle trägt eine Vertrauensklasse: **A** = eigene Daten · **B** = Google/eigene API · **C** = beobachtete SERP · **D** = Drittanbieter-Schätzung · **E** = LLM-Interpretation. E gilt nie als Evidenz.
- **§2.8 LLM erklärt, misst nicht.** Sprachmodelle formulieren Empfehlungen und Briefings (→ §5.4), übernehmen aber nie die Primärmessung.
- **§2.9 Agent-ready by design.** Jede Funktion ist später maschinenlesbar abrufbar (→ §4.4). UI und Agent konsumieren denselben API-Kern.
- **§2.10 Asynchrone Validierung.** SEO-Feedback (GSC) hat 3–14 Tage Latenz. Validierung ist scheduler-basiert und tagebasiert, nie echtzeitnah (→ §6.5).
- **§2.11 Business-gewichtete Priorisierung.** Eine problematische Money-Page zählt mehr als tausend irrelevante Archivseiten (→ §6.4).

---

## §3 — Systemüberblick

### 3.1 Datenfluss (eine Zeile)
**Quellen → Ingestion (normalisiert, Confidence-getaggt) → Module (analysieren) → Opportunities (priorisiert, source-anchored) → Umsetzung (UI/Ticket/PR) → Validierung (asynchron) → zurück in den Bestand.**

### 3.2 Schichtenmodell der Daten
`Raw Layer → Normalized Layer → Analytical Layer → Opportunity Layer → Presentation Layer (UI + MCP)`
Rohdaten und normalisierte Daten bleiben **getrennt** gespeichert (→ §2.7, §7).

### 3.3 Zwei Bürger gleichen Rangs
Das System hat **zwei** Konsumenten ab Tag 1: das schlanke **UI** (Übersicht, Boards, Reports) und der **Agent über MCP** (read-first, schreibt nur über Freigabe, → §4.4). Beide sprechen denselben internen API-Kern. Das UI ist die Übersichtsfläche; die eigentliche Umsetzungsarbeit läuft agentisch im Repo (→ §4.3, §2.4).

---

## §4 — Querliegende Schichten

Diese vier Schichten gehören keinem einzelnen Modul. Sie werden in der Foundation-Welle gebaut (→ §10) und von allen Modulen genutzt.

### 4.1 Foundation
Multi-Project, Rollen/Auth (SSO-fähig), Background-Jobs, Observability, Error-Tracking, Audit-Logs, Feature-Flags. Begründung: Ohne sauberes Betriebsfundament versinkt jedes SEO-Modul im Betriebschaos.

### 4.2 Ingestion & Connectors
Einheitliche, modulare Datenaufnahme. Jeder Connector implementiert dasselbe Interface (→ `specs/integrations.md`):
`source_type · auth_config · fetch() · normalize() · validate() · quota_status() · freshness()`
Primärquellen (Klasse A/B): GSC API, URL Inspection API, PageSpeed Insights, Lighthouse/Lighthouse CI, GA4/Matomo, Serverlogs, Sitemap, robots.txt, eigener Crawler, CMS/API. Optionale Quellen (C/D): SERP-Provider, Backlink-Provider, Keyword-Provider. **Regel:** Rohdaten getrennt von normalisierten Daten; jede Quelle trägt ihre Confidence-Klasse (→ §2.7).

### 4.3 Source Map *(der differenzierende Layer)*
Bildet eigene URLs auf ihren Quellcode ab. Begründung: Erst die Code-Verankerung verwandelt „Symptom auf N URLs" in „eine Ursache an einer Datei" (→ §1.3, §2.4).
- **`url → template/component → repo_pfad`** als gerichtete Zuordnung, gepflegt aus Routing-Konfiguration, Build-Manifest oder heuristischem Matching.
- **Deploy-Marker:** jede Auslieferung wird zeitlich markiert, damit Crawl-Diffs und GSC-Deltas einem Deploy zugeordnet werden können.
- **Pre-Merge-Gate:** ein CI-Hook crawlt im PR geänderte Templates/Routes und difft gegen die Baseline, bevor gemergt wird (→ `specs/source-map.md`, `specs/crawl-engine.md`). SEO-Regression = failing check.
- **Guardrail:** Schreibaktionen (PRs, CMS-Änderungen) bleiben reviewpflichtig (→ §4.4, §12.4).

### 4.4 Agent / MCP Layer
Read-only-Kontext für Codex und spätere Agenten, ab V1 vorhanden. Tools (high-level): `get_project_summary · get_url_dossier · list_opportunities · get_keyword_cluster · get_crawl_issues · get_content_brief · explain_opportunity · create_dev_ticket · propose_fix_pr · validate_implemented_fix`. Guardrails: Agent liest zuerst; jede Antwort referenziert Evidenz-Objekte; keine Empfehlung ohne Validierungsmetrik; alles Schreibende läuft über Freigabe.

---

## §5 — Die 7 Module

Jedes Modul: **Zweck (warum)** · **Kann (was)** · **Grenze/Non-Scope** · **Liefert** (Opportunities/Daten). Querschichten aus §4 werden vorausgesetzt, nicht wiederholt. Performance/Web-Vitals ist bewusst Teil von Modul 2 (kein eigenes Modul, → §A.3).

### Modul 1 — Project Control
**Zweck:** Liefert den Kontext, gegen den alle anderen Module arbeiten. Ohne sauberen Scope keine sinnvolle Priorisierung.
**Kann:** Projekte, Domains/Subdomains/Folder-Scopes, Märkte (Land/Sprache/Device/Suchmaschine), Zielseiten, Wettbewerber-Sets, Keyword-Sets, URL-Tags, **Business-Wert pro URL/URL-Gruppe** (Input für §6.4), Crawl-/Report-Frequenzen, Datenquellen-Verknüpfung, Zugriffsrechte.
**Grenze:** Keine Analyse, keine Empfehlung — reiner Kontext und Scope.
**Liefert:** Scope-Definitionen für Crawl, GSC-Auswertung, SERP-Tracking, Reports.
→ `specs/project-control.md`

### Modul 2 — Crawl & Health
**Zweck:** Das technische Rückgrat. Ohne belastbaren Crawl keine seriösen Aufgaben, Scores oder Priorisierung.
**Kann:** Crawl-Orchestrierung mit vier Discovery-Quellen (Start-URL, interne Links, XML-Sitemaps, verbundene First-Party-Quellen); Scopes (Domain/Subdomain/Folder); optionales JS-Rendering **pro Projekt-Flag** (nicht als Default, → §A.3); Prüfregeln über HTTP-Status, Redirects, Canonicals, Meta/X-Robots, robots.txt, Sitemaps, Titles/Meta/Headings, interne/externe Links, Broken Links, Images/Alt, Structured Data, hreflang, Pagination, Duplicate/Thin-Indikatoren, Mixed Content/HTTPS; **Core Web Vitals & Performance-Basiswerte** (LCP/CLS/INP/TTFB via PSI/Lighthouse, → §A.3); Health Score; **Crawl-Diff** zwischen Läufen und gegen Deploy-Marker (→ §4.3); Indexierbarkeits-Pipeline (gefunden → abrufbar → renderbar → nicht blockiert → Canonical konsistent → verlinkt → bei Google bekannt → rankt → erzeugt Klicks); Orphan-/Deep-URL-Erkennung; interner Linkgraph (Inlinks/Outlinks, Crawl-Tiefe, Hub-/Orphan-Pages, Anchor-Texte, Link-Equity-Approximation).
**Grenze:** Bei < 5k URLs **Vollcrawl** — kein Sampling nötig (→ §9.2). Kein Crawl fremder Domains außer im erlaubten, ratenbegrenzten Rahmen für Wettbewerbskontext (→ Modul 4).
**Liefert:** Technische Issues (severity-gewichtet), Health Score, Crawl-Historie/-Diff, Indexierbarkeits-Blocker, interne Linkchancen → alle als Opportunities (§6).
→ `specs/crawl-engine.md`, `specs/issue-rules.md`

### Modul 3 — Keyword & Rank Intelligence
**Zweck:** Steuerung über ein relevantes, kuratiertes Keyword-Universum statt kosmetischer Datenmasse (→ §2.5).
**Kann:** Keyword-Bibliothek aus GSC-Queries, bestehenden Rankings, manuellen Business-Keywords, Wettbewerberlücken (aus lizenzierten Quellen, optional), Themenclustern; Keyword-/Topic-Clustering; Intent-Klassifikation (informational/commercial/transactional/navigational/local/comparison/problem-solving); Brand/Non-Brand; Funnel-Stage; URL-Mapping; Rank-Tracking definierter Sets (täglich/wöchentlich, Land/Sprache/Device/Suchmaschine); SERP-Snapshots inkl. SERP-Features; **projektspezifischer Visibility-Index** (eigener „Monitoring-OVI", → `specs/visibility-index.md`); SERP-Diffs; Kannibalisierungs-Erkennung; Wettbewerber-Erkennung in der SERP.
**Grenze:** Keine globale Milliarden-Keyword-DB in V1 (→ §A.2). Fremddaten nur Klasse C/D, klar markiert.
**Liefert:** Keyword-Cluster, Visibility-Verläufe, SERP-Diffs, Ranking-Gewinne/-Verluste, Kannibalisierungs-Kandidaten → Opportunities (§6).
→ `specs/keyword-intelligence.md`, `specs/rank-tracking.md`, `specs/visibility-index.md`

### Modul 4 — Content & Opportunity Engine
**Zweck:** Der ROI-Moment. Hier wird aus Messung konkrete, priorisierte Arbeit (→ §2.2). Übersetzt GSC-Performance, SERP-Kontext, Crawl- und Source-Map-Signale in Maßnahmen.
**Kann:** GSC-getriebene Search-Performance-Intelligence (Query-Page-Matrix, Brand/Non-Brand-, Device-, Country-Splits, CTR-Gap, Position-Gap, Impression-Gap, Traffic-Decay, Gewinner/Verlierer); Content-Inventar & -Decay; Refresh-Kandidaten; Content-Gap; Intent-Fit; Title/Snippet-Optimierung; interne Linkvorschläge; Briefing-Generator (target_topic, target_queries, intent, current_performance, competitor_patterns, recommended_sections, internal_links, schema, title/meta-direction, validation_metric). **Erzeugt die fünf harten Opportunity-Klassen:** technische Fixes · Low-Hanging Keywords · Kannibalisierung · unterperformende Money-Pages · Internal-Link-Lücken.
**Grenze:** LLM erklärt/formuliert, misst nicht (→ §2.8). Jede Empfehlung trägt Evidenz + Score + Validierungsmetrik.
**Liefert:** Die priorisierten Opportunities (§6) und Content-Briefings.
→ `specs/content-opportunities.md`

### Modul 5 — Backlink & Authority
**Zweck:** Autoritätssignale der eigenen Domains in die Priorisierung einbinden — right-sized auf eigene Properties.
**Kann:** GSC-Link-Import als Primärquelle (Klasse B); optionaler Backlink-Provider (Klasse D); Referring Domains, Anchor-Texte, Target-URLs, New/Lost (wöchentliche Prüfung), Broken-Backlink-Targets, Link-Intersect (optional), Authority-Verteilung auf eigene URLs, Authority-Gaps wichtiger URLs, Disavow-**Kandidaten** (nur als manuell bestätigter Sonderfall).
**Grenze:** Kein globaler Backlink-Index, kein Ahrefs-Niveau bei Fremddomains (→ §A.2). Keine automatische Disavow-Logik. GSC-Links liefern ~90 % des Werts für eigene Seiten.
**Liefert:** Linkprofil, Broken-Backlink-Fixes, Link-Reclamation- und Outreach-Kandidaten, Authority-Gaps → Opportunities (§6).
→ `specs/backlink-intelligence.md`

### Modul 6 — Reporting & Alerts
**Zweck:** SEO-Steuerung ohne Dashboard-Rauschen; management- und entscheidungstauglich.
**Kann:** Report-Typen (Weekly Pulse, Technical Health, Search Performance, Content Opportunity, Rank Tracking, Competitor Movement, Indexability, Backlink/Authority, Performance-Regression); Report-Struktur (Summary · Key Wins · Key Losses · Critical Issues · Top Opportunities · Completed Actions · Validation Results · Next Actions); Exporte (PDF/CSV); Versand (E-Mail/Slack); Alerts (traffic_drop, impression_drop, ranking_drop, indexability_blocker, crawl_error_spike, canonical_change, robots_change, sitemap_error, performance_regression, high_value_url_issue, competitor_gain, serp_intent_shift).
**Grenze:** Reports bündeln und präsentieren — sie erzeugen keine neuen Empfehlungen (die kommen aus §6/Modul 4).
**Liefert:** Reports, Alerts, Entscheidungsvorlagen.
→ `specs/reporting-alerting.md`

### Modul 7 — AI Visibility
**Zweck:** Pflicht, nicht Add-on. Die Referenz-Tools shippen das alle; Sichtbarkeit verlagert sich messbar in AI-Antworten (→ §A.4). Architektonisch ab Tag 1 vorbereitet, funktional erst nach Welle 4 live (→ §10).
**Kann:** Prompt-Tracking, Citation-Tracking, Mention-Tracking, AI-Referral-Erfassung (AI-Traffic aus Analytics), AEO/GEO-orientierte Content-Checks; Sampling- und Auditability-Logik.
**Grenze:** AI-Visibility-Metriken sind 2026 noch instabil — als eigene Confidence behandeln, nicht mit Klasse-A-Daten vermischen. Keine Primärmessung durch LLM (→ §2.8).
**Liefert:** AI-Visibility-Share, AI-Referral-Impact (→ §8), AEO-Opportunities (§6).
→ `specs/ai-visibility.md`

---

## §6 — Die zentrale Einheit: Opportunity

Alle Module münden in **ein** Objekt. Wer dieses Objekt versteht, versteht das Produkt.

### 6.1 Definition
Eine Opportunity verbindet: **Beobachtung → Evidenz → Ursache → Priorität → Maßnahme → Validierung.** Sie ist nicht Keyword, URL oder Score, sondern die *kleinste umsetzbare und überprüfbare Arbeitseinheit*.

### 6.2 Datenfelder (verbindlich)
`id · project_id · type · affected_urls · affected_keywords · affected_clusters · source_anchor (repo_pfad/template, optional) · evidence (Liste) · current_state · recommended_action · expected_impact · effort · confidence · business_value · priority · validation_metric · owner · status · created_at · updated_at · expires_at`

### 6.3 Evidenz-Paket
Jede Evidenz: `source · source_confidence (§2.7) · metric · before_value · current_value · time_window · affected_entity`. **Mindestens eine Evidenz Klasse A–C pro Opportunity** (§2.3).

### 6.4 Prioritätsformel (high-level)
`Priority = Impact × Confidence × Business Value × Urgency ÷ Effort`
Business Value kommt aus Modul 1 (→ §2.11). Konkrete Gewichtung in `specs/content-opportunities.md`.

### 6.5 Statusmodell & Validierungsloop
`open → planned → in_progress → implemented → validated | reopened | dismissed | expired`
Beim Übergang auf `implemented` schedult das System automatisch einen Re-Check nach n Tagen (GSC-Delta, Crawl-Recheck, Position-Delta — asynchron, §2.10) und setzt selbst auf `validated` oder `reopened`. Confidence-Scores werden über die Zeit aus echten Outcomes kalibriert.

### 6.6 Erster Generator (Welle-4-Start)
Bewusst ein **technischer Fix mit binärer Validierung** (z. B. Indexierungs-Blocker: war nicht indexiert → ist indexiert), nicht CTR-Gap. Begründung: beweist den Validierungsloop mit klarer Vorher/Nachher-Messung.

---

## §7 — Datenmodell

Kein 100-Tabellen-Schema zu Beginn — die **richtigen ~26**. Alles andere sind Views, Joins, Derived Models.

### 7.1 Kern-Entitäten (aus den Referenz-Mustern)
`project · site · competitor · crawl_run · url · issue · issue_instance · keyword · keyword_group · rank_snapshot · serp_snapshot · visibility_score · page_metric · content_recommendation · backlink · ref_domain · link_event · integration_account · analytics_metric · report · alert`

### 7.2 AI-Entitäten
`ai_prompt · ai_mention · ai_citation · ai_referral`

### 7.3 Source-Map-Entitäten *(neu, §4.3)*
`source_repo · template · url_template_map · deploy_marker · pr_check`

### 7.4 Opportunity-Entität
`opportunity` (Felder → §6.2) plus `evidence` (Felder → §6.3) als zugehörige Tabelle.

### 7.5 Speicherprinzip
Raw und Normalized getrennt (§2.7, §3.2). Bei < 5k URLs liegt **alles in Postgres**, inkl. Crawl-/SERP-/GSC-Historie (→ §9.2, §A.1-Fix 3).

---

## §8 — KPIs

Sieben Kern-KPIs, abgeleitet aus den Referenz-Mustern. Die letzten beiden sind **Welle-7-KPIs** (erst mit Modul 7 belastbar).

| KPI | Quelle (Modul) | Definition (high-level) |
|-----|----------------|--------------------------|
| Health Score | M2 | Gewichteter technischer Gesundheitswert aus Issues/Severity. |
| Project Visibility | M3 | Sichtbarkeit auf dem eigenen Keyword-Set (Visibility-Index, `specs/visibility-index.md`). |
| Opportunity Score | §6 | Summe offenen, priorisierten Potenzials (Prioritätsformel §6.4). |
| Content Coverage | M4 | Abdeckung der Ziel-Themen/Intents durch performenden Content. |
| Authority Delta | M5 | Veränderung der Link-Autorität über Zeit. |
| AI Visibility Share *(W7)* | M7 | Anteil eigener Marke/URLs in getrackten AI-Antworten. |
| AI Referral Impact *(W7)* | M7 | Beitrag von AI-Referrals zu organischem/Business-Outcome. |

Detailformeln je KPI: in der zuständigen Child-Spec.

---

## §9 — Architektur & Stack

### 9.1 Aufteilung
TypeScript fürs Produkt, Python für Datenarbeit. Frontend: Next.js/React (schlank, → §3.3). API-Gateway: TypeScript **oder** FastAPI. Worker (Python): Crawling, Parsing, SERP-/Backlink-Jobs. System of Record: **Postgres**.

### 9.2 Bewusst weggelassen (Fix gegenüber Upload, §A.1)
Bei < 5k URLs/Property: **kein ClickHouse** (Postgres trägt die Historie), **Object Storage optional** (Roh-HTML kann auf Disk/in Postgres), **Redis nur optional** (Postgres-basierte Job-Queue genügt bei dieser Last). Reaktivieren, sobald eine Property die Größenordnung sprengt — nicht vorher.

### 9.3 Provider-Abstraktion
Connector-Interfaces, Quota-Awareness, Cache-Policies (§4.2, §2.6). Niemals Produktlogik an einen einzelnen Datenanbieter löten.

---

## §10 — Delivery-Wellen & Gates

Wellen statt Monsterprompt (spart Tokens, erzwingt harte Gates). Querschichten §4 entstehen in Welle 1. **Codex baut pro Welle einen vertikalen Schnitt, kein isoliertes Modul** (→ §12.2).

| Welle | Ziel | Ergebnis | Go/No-Go-Gate |
|-------|------|----------|---------------|
| 1 · Foundation | Monorepo, Auth/Rollen, Projekte, Ingestion-Gerüst, Datenmodell, Job-System, Observability, **Source-Map-Grundgerüst** (§4.3) | lauffähige Grundplattform | Domain anlegen, Crawl starten, GSC/GA4 verbinden |
| 2 · Audit Core | Crawler, URL-Discovery, Issue-Engine, Health Score, interner Linkgraph, Indexierbarkeits-Pipeline, Web-Vitals | technisches Audit nutzbar | 95 % stabile Vollcrawls auf eigenen Sites |
| 3 · Keyword Core | Keyword-Bibliothek, Rank-Tracking definierter Sets, Visibility-Index, SERP-Snapshots/-Diffs | SEO-Monitoring nutzbar | tägliche Verläufe, Export, Alerts |
| 4 · Opportunity Engine | Search-Performance-Intelligence, fünf Opportunity-Klassen, Prioritätsscore, Evidenz, Validierungsloop, **Source-Anchoring** | Maßnahmen statt Messwerte | jede Empfehlung mit Evidenz + Score + Validierungsmetrik; erster Generator (§6.6) validiert real |
| 5 · Authority Layer | GSC-Link-Import, Ref-Domain-Modell, New/Lost, Broken Targets, Authority-Gaps | Linkmodul nutzbar | neue/verlorene Links nachvollziehbar |
| 6 · Reporting Layer | Dashboards, PDF/CSV, E-Mail/Slack, Executive Reports, Alerts | management-tauglich | Wochenreport automatisiert |
| 7 · AI Layer | AI Visibility, Prompt/Citation/Mention/Referral-Tracking, AEO, MCP-Vollausbau | future-ready | Agent beantwortet echte SEO-Fragen über eigene Daten |

**Reihenfolge-Begründung:** Audit ist das Rückgrat (ohne Crawl keine Aufgaben). Keyword/Rank baut darauf. Opportunity ist der ROI-Moment. Authority und Reporting glänzen erst auf stabiler Datenbasis (Backlinks ohne Projektkontext sind Lärm; Reports ohne Priorisierung sind Deko). AI gehört fest in den Plan, aber nicht in Sprint eins — sonst baut man auf Sand.

---

## §11 — Repo-Struktur & Spec-Index

### 11.1 Struktur
```
/apps/web · /apps/api
/services/crawler · /services/ranker · /services/recommendation-engine · /services/reporting-worker · /services/ai-visibility-worker
/packages/ui · /packages/domain-model · /packages/shared-config
/docs/PRODUCT_MASTER_SPEC.md  (inkl. KPIs §8, Referenz-Anker §A.4, UX-Navigation §A.5)
/specs/*.md  (Index → §11.2)
/prompts/codex-*.md  (eine Datei pro Welle)
/openapi/internal-api.yaml
/infra/docker-compose.yml · /infra/terraform/
```

### 11.2 Spec-Index — was jede Child-Spec enthalten muss
Jede Child-Spec folgt demselben Template (Purpose · Scope · Non-Scope · Data Sources · Entities · Processing Pipeline · Scoring/Classification · API Endpoints · UI Screens · States · Error Handling · Observability · Acceptance Tests · Future Extensions · Cross-Refs). Übersicht:

| Datei | Verfeinert Modul/Schicht | Kerninhalt |
|-------|--------------------------|------------|
| `project-control.md` | M1 | Projekt-/Scope-/Business-Value-Modell |
| `integrations.md` | §4.2 | Connector-Interface, Quota, Cache, Confidence |
| `source-map.md` | §4.3 | URL→Template→Repo-Mapping, Deploy-Marker, Pre-Merge-Gate |
| `crawl-engine.md` | M2 | Crawl-Queue, Discovery, Rendering-Flag, Job-States, Diff |
| `issue-rules.md` | M2 | Regelkatalog, Severity-Logik, JSON-Schema, Testfälle |
| `keyword-intelligence.md` | M3 | Keyword-Universum, Clustering, Intent, Gap |
| `rank-tracking.md` | M3 | Snapshots, SERP-Speicherung, Diffs, Worker-Design |
| `visibility-index.md` | M3 | Formel, Gewichtungen, Beispielrechnungen |
| `content-opportunities.md` | M4, §6 | Opportunity-Klassen, Score-Modell, Briefing, Validierung |
| `backlink-intelligence.md` | M5 | Linkdatenmodell, Authority, Lost/New, Risk |
| `reporting-alerting.md` | M6 | Report-Typen, Alert-Logik, Export, Versand |
| `ai-visibility.md` | M7 | Prompt/Citation/Mention/Referral, Sampling, Auditability |
| `security-privacy.md` | §4.1 | Auth, Rollen, Audit-Logs, Datenschutz |
| `observability-sre.md` | §4.1 | Logging, Tracing, Error-Tracking, Job-Monitoring |

---

## §12 — Codex-Arbeitsweise

### 12.1 Master-Regel
Jedes Modul wird **spec-first** gebaut: erst die zuständige Child-Spec lesen/schärfen, dann implementieren. `PRODUCT_MASTER_SPEC.md` ist die Wahrheitsebene; bei Konflikt gewinnt der Master.

### 12.2 Vertikaler Schnitt
Codex baut nie „ein Modul" isoliert, sondern einen durchgehenden Schnitt einer Welle (DB-Schema → API → Service/Pipeline → minimaler UI-/MCP-Output → Tests). Begründung: schneller Zwischenerfolg, früher Beweis, dass das Schema trägt.

### 12.3 Prompt-Muster (pro Welle, nicht Monsterprompt)
> „Nutze `PRODUCT_MASTER_SPEC.md` als Wahrheitsebene und `specs/<spec>.md` als Detailebene. Implementiere nur den Scope von Welle X. Lege alle Annahmen offen. Schreibe Tests zuerst. Verändere keine API-Verträge außerhalb des Scopes. Erzeuge DB-Schema/Migrationen, API-Routen, Services/Pipelines, UI-States, Beispiel-Fixtures. Dokumentiere Failure Modes und Migrationsschritte."

### 12.4 Akzeptanzkriterien (gelten in jeder Welle)
Keine Empfehlung ohne Evidenz (§2.3). Keine Provider-Hardcodierung (§2.6). Raw/Normalized getrennt (§2.7). Jobs idempotent. Fehler sichtbar (§4.1). Tests für Kernlogik. **Agent liest zuerst; alles Schreibende (PRs, CMS, Deployments) bleibt reviewpflichtig** (§4.4).

---

## §A — Anhang

### A.1 Changelog: stillschweigend gefixte Inkonsistenzen
1. **Modulzahl vereinheitlicht.** Erstes Dokument: 16 Module; Upload-Dokument: teils „6 Module", teils 7 (Reporting & Agent vs. Reporting + AI getrennt). → Vereinheitlicht auf **7 sichtbare Module** + 4 Querschichten (§4/§5); Agent/MCP ist Querschicht, kein in Reporting gefaltetes Modul.
2. **Performance/Web Vitals** war mal eigenes Modul, mal „Core-Performance-Basiswert". → Fest in **Modul 2** verortet (§A.3).
3. **ClickHouse/Redis/Object Storage** waren als „optional ab Größe" geführt. → Bei < 5k URLs **explizit weggelassen** (§9.2); reaktivierbar bei Bedarf.
4. **Traffic-/Marktintelligenz** war als nachzubauender Clickstream beschrieben. → Für eigene Seiten **First-Party (GA4/Matomo/Logs)** als Quelle; Clickstream-Nachbau gestrichen (§2.1, §5/M4).
5. **Source-Map/Codebase-Layer** fehlte in beiden Dokumenten vollständig. → Als Querschicht **ergänzt** (§4.3) — der eigentliche Differenzierer (§1.3).
6. **JS-Rendering** war gleichrangiger Crawl-Modus. → Auf **Projekt-Flag** zurückgestuft (§A.3, M2), da pro URL 10–50× teurer.
7. **Disavow** war teils automatisierbar angedeutet. → Nur **manuell bestätigter Sonderfall** (M5).

### A.2 Eingeschränkt abbildbar (ehrliche Grenzen)
Vollständiger globaler Backlink-Index · globale Keyword-Datenbank · Traffic-Schätzung fremder Domains · historische Sichtbarkeit fremder Domains · vollständige SERP-Abdeckung aller Länder/Devices. Diese erreichen **ohne lizenzierten Provider nie** Marktführer-Niveau — und das ist kein Makel, weil das Tool auf eigene Plattformen zielt (§1.3).

### A.3 Bewusste Entscheidungen
Web Vitals in Modul 2 (kein eigenes Modul). JS-Rendering als Projekt-Flag. Vollcrawl statt Sampling (< 5k URLs). UI schlank, MCP gleichrangig (§3.3). AI Visibility architektonisch ab W1, funktional ab W7.

### A.4 Referenz-Anker

> DNA übernehmen, nicht 1:1 klonen.

| Anker | Stärke / übernommenes Muster |
|-------|------------------------------|
| Semrush | Breiteste Suite; Site Audit (JS-Rendering, Scopes, Recrawl); Position Tracking inkl. AI-Modi; On Page SEO Checker; AI-Visibility-Toolkit; API/MCP (read-only Projektdaten). |
| XOVI | DACH-Modell; Advisor (priorisierte Aufgaben mit Erklärung); Monitoring-OVI als individueller Sichtbarkeitsindex; Onpage→Aufgaben; Reporting-Templates; XOVI AI. |
| Ahrefs | Tiefste Research-/Backlink-DNA; Site Audit (170+ Checks, Health Score); Opportunities (Content+Link+Technik priorisiert); API v3/MCP/Connect. |
| Similarweb | Brücke SEO ↔ Traffic-Intelligence ↔ AI-Discovery; Site Audit (eigener Bot, Sitemaps/robots/GA4/GSC); Rank Tracker (Kannibalisierung, 5 Wettbewerber); Gen-AI/AEO-Module; MCP. |

**Übernommenes Kernmuster (alle vier):** Projekt anlegen → Datenquellen verbinden → (externe Indizes optional) → KPIs verdichten → Maßnahmen priorisieren → reporten → automatisieren.

**Bewusst NICHT übernommen:** Globale Massen-Indizes (Keyword/Backlink/Traffic über fremde Domains) als Kernfeature — nicht ohne lizenzierten Provider erreichbar und für eigene Properties unnötig (→ §A.2).

### A.5 UX Navigation & Screens

> UI schlank; MCP gleichrangig (§3.3). Marke: **Query-Land**.

**Hauptnavigation:** Übersicht · Projekte · Technical Audit · URL-Dossier · Keywords & Rankings · Content & Chancen · Backlinks · Reports · KI-Sichtbarkeit · Einstellungen

**Schlüssel-Screens:**
- **Übersicht** — Visibility-Verlauf, Health Score, Positions-Verteilung, Top-Chancen, offene Risiken, letzte Crawls/Reports. (Echte Daten, keine Demo-Fixtures.)
- **URL-Dossier** — eine URL als vollständiges SEO-Objekt: Crawlstatus, Indexierbarkeit, GSC-Leistung, Rankings, Queries, interne/externe Links, Content-Fit, Performance, Issues, Chancen, Quell-Verknüpfung, Historie.
- **Content & Chancen (Opportunity Board)** — priorisierte Maßnahmen, Filter (Typ/Projekt/URL-Gruppe/Impact/Aufwand/Status), Evidenz-Drawer, Validierungs-Drawer.
- **Technical Audit** — Crawl-Runs, Indexierbarkeits-Funnel, Issue-Gruppen, URL-Explorer, Crawl-Diff.
- **Content Workspace** — ausstehend (Scope-Entscheidung): Chancen, Briefings, Refresh-Kandidaten, interne Linkvorschläge, Snippet-Vorschläge.

**Erklär-Infrastruktur:**
- **`/glossar`** — Begriffsliste + Konfidenz-Legende; einzige Quelle für alle Tooltips.
- **`/kit`** — Showcase aller geteilten Komponenten in allen Zuständen (Abnahme + lebende Doku).

### A.6 Offene Entscheidungen (vor/während Welle 1 zu klären)
- Plattform-Typen im Scope: Content, Shop, SaaS, Local, Misch?
- Competitor Intelligence: lizenzierter Provider ab V1 oder zunächst rein First-Party + eigener Crawl?
- Märkte: DACH + ein Referenzmarkt zuerst, oder international ab Tag 1?
- Agent-Mandat: nur lesen/empfehlen, oder später auch Tickets/PRs/CMS auslösen (§4.4-Guardrail bleibt)?
