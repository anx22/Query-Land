# Plan 001 — `.env.example` auf `pglite:` korrigieren

- **Kategorie:** DX / Docs · **Aufwand:** S · **Risiko:** LOW · **Hängt ab von:** —
- **Geschrieben gegen Commit:** `ac6a800` (vor Umsetzung `git rev-parse --short HEAD` vergleichen;
  weicht `.env.example` Zeile 1 vom hier zitierten Stand ab → kurz prüfen, ob der Befund noch gilt).

## Kontext / Warum

`.env.example` Zeile 1 zeigt `DATABASE_URL=sqlite:data/seo-os.sqlite`. Der Stack nutzt jedoch Postgres
(Neon in prod) bzw. embedded PGlite lokal — **kein** SQLite. Der Parser akzeptiert das `sqlite:`-Präfix
nur aus Rückwärts-Kompatibilität und mappt es intern auf PGlite. Ein neuer Entwickler nimmt sonst
fälschlich SQLite an (falsches Tooling, falsches mentales Modell).

Beleg für das Mapping — `apps/api/src/db/index.ts` (um Zeile 26–38):
```ts
if (
  databaseUrl === "sqlite::memory:" || databaseUrl === ":memory:" ||
  databaseUrl === "memory" || databaseUrl === "pglite::memory:"
) {
  return { kind: "pglite", location: ":memory:" };
}
// ...
if (databaseUrl.startsWith("sqlite:")) {
  return { kind: "pglite", location: databaseUrl.slice("sqlite:".length) };
}
```

## Änderung

Nur **`.env.example`**, Zeile 1 ersetzen:

```
DATABASE_URL=pglite:data/seo-os.sqlite
# Hinweis: das "sqlite:"-Präfix wird aus Rückwärts-Kompatibilität ebenfalls akzeptiert
# (mappt intern auf PGlite, nicht auf echtes SQLite).
```

### Vorabprüfung (wichtig)

Bevor du `pglite:data/...` schreibst: prüfe in `apps/api/src/db/index.ts`, ob ein **Datei**-Präfix
`pglite:<path>` (nicht nur `pglite::memory:`) auf `{ kind: "pglite", location: <path> }` gemappt wird.
- Falls **ja** → wie oben schreiben.
- Falls **nein** (nur `sqlite:<path>` mappt Datei-Pfade) → `DATABASE_URL=sqlite:data/seo-os.sqlite`
  **belassen** und nur den erklärenden Kommentar darüber ergänzen. **NICHT** den Parser umbauen —
  das ist außerhalb dieses Plans. Dann kurz melden, dass der Parser nur `sqlite:` für Datei-Pfade kennt.

## Scope

- **In scope:** `.env.example`.
- **Explizit out of scope:** `apps/api/src/db/index.ts` (Parser), jede `.env`-Datei außerhalb des
  Beispiels, andere Doku (README erwähnt PGlite bereits korrekt).

## Verifikation (Done-Kriterien)

1. `grep DATABASE_URL .env.example` zeigt die neue `pglite:`-Zeile (bzw. bei nein-Fall den Kommentar).
2. `npm run typecheck` bleibt grün (keine Code-Änderung, muss unverändert durchlaufen).
3. Keine weitere Datei im Diff außer `.env.example`.

## Test-Plan

Kein automatisierter Test nötig (reine Doku/Beispiel-Datei). Manuelle Sichtprüfung genügt.

## Wartungshinweis

Wenn der DB-Treiber künftig echtes SQLite oder ein weiteres Schema unterstützt, diese Beispielzeile
mitpflegen. Der erklärende Kommentar verhindert, dass jemand das `sqlite:`-Alias „aufräumt", ohne die
Rückwärts-Kompatibilität (bestehende Skripte/Tests mit `sqlite::memory:`) zu bedenken.
