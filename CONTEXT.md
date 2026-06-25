# CONTEXT

Dieses Dokument hält die Domain-Sprache und die Architektur-Erkenntnisse fest, damit zukünftige Reviews dieselben Namen für dieselben Seams verwenden.

## Domain glossary

### Foundation
Der Kern aus API, Datenbank (Postgres — Neon in Produktion, embedded PGlite lokal), Auth, Projects, Sites, Integrations, Jobs und Source Map. Foundation ist der Welle-1-Kontext, auf dem alle späteren Module aufbauen.

### Project
Eine eigene Webplattform oder Property, für die SEO-Daten gesammelt, bewertet und in Arbeit übersetzt werden.

### Site
Der crawlbare Scope innerhalb eines Project, z. B. Domain, Subdomain oder Folder. Site ist der direkte Scope für Crawl Runs, Technical Audit und Health Score.

### Technical Audit
Der Welle-2 Arbeitsbereich für Crawl Runs, URL Explorer, Indexability, Audit Issues und Health Score. Technical Audit ist die bevorzugte Seam für UI-Loading und serverseitige Audit-Workflows; neue webseitige Technical-Audit-Logik gehört unter `apps/web/src/features/technical-audit`.

### Crawl Engine
Der Worker- und API-Teil, der `crawl_seed` Jobs claimt, URLs entdeckt, Fetch Results persistiert, Indexability bewertet, Audit Issues schreibt, Health Scores berechnet und Crawl Runs abschließt.

### Crawl Run
Ein einzelner Crawl-Durchlauf für eine Site. Crawl Runs tragen Status, Trigger, Start-/Endzeit und Summary über Discovery, Fetches, Indexability, offene Issues und Health Score.

### Crawl Seed Job
Ein typed Job für den Start eines Crawl Run. Der Payload enthält mindestens `siteId` und `baseUrl`; `crawlRunId` ist vorhanden, wenn der Run bereits vor dem Job angelegt wurde. Legacy-/Worker-Helfer dürfen ohne `crawlRunId` starten; der Worker legt dann selbst einen Crawl Run an.

### URL Explorer
Die Technical-Audit-Read-Model-Sicht pro Discovered URL mit latest Fetch und latest Indexability. URL Explorer braucht serverseitige Pagination/Filter und später Source-Anchor-Daten.

### Audit Issue
Ein Technical-Audit-Befund aus einer Rule, Severity, URL und Message. Aktuell wird Lifecycle über `resolvedAt` abgebildet; die Domain-Sprache für `resolved` vs. `dismissed` ist noch zu schärfen.

### Health Score
Der Technical-Audit Score einer Site, berechnet aus offenen Audit Issues und Severity-Penalties.

### Source Map
Die Produkt-Seam für URL → Template/Komponente → Repo-Pfad. Ziel ist Source Anchoring: aus Symptomen auf vielen URLs soll eine Ursache in einer Datei werden.

### Backend Proxy Adapter
Der Next Route Adapter unter `/api/backend`. Er muss Pfad und Query-String unverändert an die interne API weitergeben, damit Browser-, Proxy- und direkte interne Calls dieselbe Interface-Semantik haben.

### Production Smoke Target
Für manuelle interne Logs, Browser Tests und Smoke Checks steht `https://queryland-mikadesign.vercel.app/` als Test-URL zur Verfügung.

## Architecture notes

- Technical Audit soll als tiefer Module wachsen: kleine Web-/API-Interfaces, viel Verhalten dahinter.
- Die Interface ist die Testoberfläche: Tests sollen bevorzugt Technical-Audit- und Crawl-Seed-Verhalten prüfen statt nur pass-through Helper.
- Crawl Seed Scheduling soll typed bleiben, aber rückwärtskompatibel zu Worker-Jobs ohne `crawlRunId` sein.
- Source Map ist noch zu flach: Listing reicht für Welle 1, aber URL→Source-Anchor-Auflösung ist der spätere Deepening-Zielpunkt.
