# Entscheidungen (die großen Weichenstellungen)

> Nur strategische Produkt-/Architektur-Entscheidungen — kein Implementierungs-Log.
> Produkt-Kontext: [`PRODUCT_MASTER_SPEC.md`](./PRODUCT_MASTER_SPEC.md).

## DEC-001 — Plattform-Typen im Scope · akzeptiert
**Content + SaaS first** (Shop/Local später). Grund: Crawl-/Audit- und Source-Map-Annahmen bleiben einfacher.

## DEC-002 — Externe Provider (SERP/Backlinks/LLM) · offen
**Kein lizenzierter Provider** in den frühen Wellen; nur die Provider-**Abstraktion** bauen. Alle externen
Quellen laufen bis heute als deterministische **Stubs**; echte Credentials schalten den Live-Pfad
automatisch frei (Naht: `ARCHITECTURE.md` §2). Dies ist der Sammelpunkt für „Stub → echt".

## DEC-003 — Märkte · akzeptiert
**DACH zuerst.** Vereinfacht Sprache, SERP und Reporting.

## DEC-004 — Agent-Mandat · akzeptiert
**Read-only + Tickets** in Welle 1–3; **PR-Vorschläge** erst nach Source-Map-Validierung (Welle 4). Alles
Schreibende bleibt reviewpflichtig (Master §4.4).

## DEC-005 — Open-Source & Souveränität · Richtung gesetzt
**Open-source-first, selbst-hostbarer Foundation-Core** mit austauschbaren Provider-Adaptern. Hält
Daten/Evidenz/Connector-Verträge portabel; kein SaaS-Lock-in. Vor Produktions-Credentials/Hosting je ein
Dependency-/Lizenz-Review.

## DEC-006 — Crawl-Seed-Scheduling-Naht · im Code akzeptiert
UI-getriggerte Crawls nutzen **eine** Technical-Audit-Naht, die Crawl Run + typisierten `crawl_seed`-Job
zusammen anlegt. Worker-/Alt-Jobs dürfen `crawlRunId` weglassen (Worker legt den Run dann selbst an).
Konsequenz: `crawlRunId` nie global verpflichtend machen — nur für geplante Jobs.

## DEC-008 — Mandanten-/User-Trennung & GSC-Ownership · offen (wichtig)
**Ist-Zustand:** Die GSC-OAuth-**App** ist global (eine Google-Cloud-App; `GOOGLE_CLIENT_ID/SECRET`
identifizieren *die Anwendung* gegenüber Google — **keine** persönlichen Kontodaten). Die OAuth-**Tokens**
werden dagegen **pro Projekt** AES-256-GCM-verschlüsselt gespeichert: jedes Projekt verbindet sein eigenes
Google-Konto am Einwilligungs-Bildschirm und sieht nur seine eigene Property. Niemand nutzt fremde Tokens.
**Offen:** Das Modell ist projekt-, nicht login-user-basiert. Es fehlt echte Mandanten-/User-Isolation
(Wem „gehört" ein Connector? Rollen/Memberships?). **Optionen:** (a) Status quo (projekt-scoped,
Single-Org) · (b) User↔Projekt-Membership + Rollen · (c) volle Mehrmandanten-Architektur. **Zu entscheiden,
bevor** die App für externe/mehrere Nutzer geöffnet wird (dann auch Veröffentlichung/Verifizierung des
Google-Consent-Screens nötig). Setup-Anleitung: [`gsc-oauth-setup.md`](./gsc-oauth-setup.md).
