# Component-Placement — wo die Kit-Komponenten in Query-Land sitzen

> Begleitdokument zu **`seo-ui-kit.md`**. Legt pro Screen/Sektion fest, welche Komponente wohin gehört, aus welcher **echten** Datenquelle sie gespeist wird und ob sie **jetzt** oder **später** baubar ist. Grundlage: M0–M6 (alle Endpunkte vorhanden) + bekannte Lücken.

## Status-Legende
- ✅ **Jetzt** — Daten/Endpunkt existiert, rein UI-Arbeit.
- 🟡 **Bald** — kleiner Backend-Zusatz nötig (z. B. Aggregat-Endpoint, `?filter=`-Param).
- 🔭 **Zukunft** — neues Backend / Credentials / Daten fehlen (Crawl-Diff, Wettbewerber, echte Provider, Content-Fit).

---

## A. Global / auf jedem Screen
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

## B. Overview `/` (UX-1)
| Komponente | Sektion | Datenquelle | Status |
|---|---|---|---|
| **TrendChart** + Event-Marker | Hero: Visibility über Zeit | `/projects/{id}/visibility`; Marker: `/projects/{id}/deploy-markers` ✅, Google-Updates 🔭 | ✅ (Updates 🔭) |
| **ScoreGauge** | Health-Score | `…/health-scores` | ✅ |
| **PositionDistribution** | Rankings-Verteilung | rank_snapshots | ✅ |
| **PriorityMatrix (mini)** | Top-Chancen | `/projects/{id}/opportunities?limit=5` | ✅ |
| Risiken-Liste | offene kritische Issues | `…/audit-issues?status=open&severity=critical` | ✅ |
| Liste „letzte Crawls/Reports" | unten | `…/crawl-runs`, `/reports` | ✅ |
| KPI „organische Klicks/Impressionen" | Metric-Karte | **kein Aggregat-Endpoint** → Summe aus `search-performance` o. Platzhalter | 🟡 |

## C. Projects `/projects`
| Komponente | Sektion | Datenquelle | Status |
|---|---|---|---|
| Entity-Tabellen + Forms (Bestand) | Projekte/Sites | `/projects`,`/sites` | ✅ |
| **Sparkline** je Projekt/Site | Visibility-Mini-Trend | visibility_scores | ✅ |
| Markt-/Wettbewerber-Chips | Site-Config | markets ✅; Wettbewerber 🔭 | 🔭 (Wettbewerber) |
| ConfidenceBadge | (entfällt — Config, keine Messwerte) | — | — |

## D. Technical Audit `/technical-audit` (UX-6)
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

## E. URL Dossier `/url-dossier` (UX-4) — Inspector 360°
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

## F. Keywords & Rank `/keywords-rank`
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

## G. Chancen / Opportunity Board `/content-opportunities` (UX-5)
| Komponente | Sektion | Datenquelle | Status |
|---|---|---|---|
| **PriorityMatrix** (Impact×Effort) | oben (Triage) | `/opportunities` (impact/effort/businessValue/type) | ✅ |
| **Status-Kanban** | umschaltbar | opportunity.status + transitions | ✅ |
| Tabelle + FilterBar (Typ/Status/Impact/Effort) | umschaltbar | `…/opportunities` (`type`-Filter 0-Backend) | ✅ |
| **Evidence-Chain-Drawer** | Zeilen-/Bubble-Klick | evidence[], currentState, recommendedAction, validationMetric | ✅ |
| ConfidenceBadge + BulkBar | je Zeile / Auswahl | opportunity | ✅ |
| Search-Performance-Intelligence-Panel (Striking/CTR/Cannibal) | Sektion (Bestand) | `…/search-performance/intelligence` | ✅ |

## H. Backlinks `/backlinks` (UX-4-Bereich)
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

## I. Reports `/reports` (M5)
| Komponente | Sektion | Datenquelle | Status |
|---|---|---|---|
| Report-Liste + letzter Report (Abschnitte) | Hauptbereich | `/reports` | ✅ |
| Export-Buttons CSV/HTML/PDF | je Report | `…/export` | ✅ |
| Schedules + „Fällige ausführen" | Sektion | report-schedules | ✅ |
| Alert-Regeln + **AlertEvent-Liste** | Sektion | alert-rules / alert-events | ✅ |
| **ScoreGauge / Mini-TrendChart** (Metrik vs. Schwelle) | Alerts | alert_events-Verlauf | 🟡 |
| „Warum das zählt" (Schedules/Alerts) | je Karte | Copy | ✅ |

## J. AI Visibility / KI-Sichtbarkeit `/ai-visibility` (M6)
| Komponente | Sektion | Datenquelle | Status |
|---|---|---|---|
| **AiVisibilityPanel** (Share-of-Voice-Gauge + Citation-Matrix) | Hero | ai_prompts × ai_answer_snapshots | ✅ |
| **ScoreGauge** (AI-Visibility-Score) | Kopf | `…/ai-visibility` | ✅ |
| Prompts-Liste + Inspector (Antwort, zitierte Domains) | Sektion | ai snapshots | ✅ |
| AEO-Assessments + Score + Check-Details | Sektion | `…/aeo` | ✅ |
| Proposals-Liste + Accept/Reject (review-gated) | Sektion | proposals | ✅ |
| **ConfidenceBadge E** (Pflicht: „kein Beleg") | überall | LLM=E | ✅ |

## K. Settings `/settings`
| Komponente | Sektion | Datenquelle | Status |
|---|---|---|---|
| Connector-Karten + Status, Source-Map-Form/Tabelle, Pre-Merge-Gate | Bestand | integrations / source-map / pr-checks | ✅ |
| Quota/Freshness-Gauge je Connector | Connector-Karte | integration quota/freshness | 🟡 |
| AuthZ-/Rollen-UI | Sektion | WP-Z.1 | 🔭 |

## L. Neue Screens
| Screen | Komponenten | Status |
|---|---|---|
| **Glossar** `/glossar` (UX-9) | Term-Liste + Suche; Konfidenz-Legende; Quelle für alle Tooltips | ✅ |
| **Content Workspace** `/content-workspace` (UX-7) | Content-Score-Gauge, Brief-Editor, Term-Checkliste, Refresh-Kandidaten, interne Linkvorschläge | 🔭 (net-new Backend) |

---

## M. Rückwärts-Index — Komponente → Screens
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

## N. „Jetzt" vs. „Zukunft" — Rollup
**Sofort baubar (✅, reine UI auf vorhandenen Endpunkten):** alle Primitive (UX-9) · Overview-Kern (Trend/Gauge/Histogram/Matrix/Risiken) · Chancen-Board (Matrix/Kanban/Evidence/Filter) · Backlinks (Trend/NewLost/Distribution/Gauge) · Keywords (Histogram/Sparkline/Chips/Filter/Inspector) · URL-Dossier-Sektionen · AI-Panel · Audit-Funnel/Treemap/Issue-Groups/Graph · Reports-Bestand · Glossar.

**Kleiner Backend-Zusatz (🟡):** organische-Klicks-Aggregat (Overview) · `?pageUrl=`/`?targetUrl=`-Filter (Dossier) · per-URL Web-Vitals · Alert-Trend · Connector-Quota-Gauge · Keyword-Cluster-Größe.

**Zukunft (🔭, neues Backend/Credentials/Daten):** Crawl-Diff · Competitor-/Link-Intersect-Daten · echtes Keyword-Volumen/Difficulty · Authority/DR aus Drittquelle · Content-Fit · Content Workspace · Google-Update-Marker · AuthZ-UI · Google-Update-Feed.

> Konsequenz für die Reihenfolge: Der **gesamte sichtbare Qualitätssprung** (Overview, Chancen, Backlinks, Keywords, Audit-Überblick, AI) ist **ohne neues Backend** machbar — er hängt nur an UX-9 (Primitive) + Chart-Lib. Die 🔭-Punkte bleiben im Hintergrund-Backlog (Credentials/Worker/Wettbewerber).
