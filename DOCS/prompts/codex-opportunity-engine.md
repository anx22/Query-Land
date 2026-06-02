# Codex-Prompt — Welle: opportunity-engine

> Muster aus Master §12.3. Vor Nutzung: zuständige `specs/*.md` lesen.

Nutze `docs/PRODUCT_MASTER_SPEC.md` als Wahrheitsebene und die zugehörige(n) `specs/<spec>.md` als Detailebene.
Implementiere NUR den Scope dieser Welle (siehe Master §10, Tabelle).
- Lege alle Annahmen offen.
- Schreibe Tests zuerst.
- Verändere keine API-Verträge außerhalb des Scopes.
- Erzeuge DB-Schema/Migrationen, API-Routen, Services/Pipelines, UI-States, Beispiel-Fixtures.
- Dokumentiere Failure Modes und Migrationsschritte.

Akzeptanzkriterien (Master §12.4): keine Empfehlung ohne Evidenz · keine Provider-Hardcodierung · Raw/Normalized getrennt · Jobs idempotent · Fehler sichtbar · Tests für Kernlogik · Schreibaktionen reviewpflichtig.

Go/No-Go-Gate dieser Welle: siehe Master §10.
