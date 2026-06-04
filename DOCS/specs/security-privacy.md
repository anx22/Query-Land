# Module Spec: Security & Privacy

> Verfeinert: §4.1 (Foundation) · Master: `docs/PRODUCT_MASTER_SPEC.md` (bei Konflikt gewinnt der Master)
> Status: Welle-1 geschärft — Rollen-, Audit-, Secret- und lokaler Backend-Login-Grundregeln sind verbindlich.

## Purpose
Sicheres Betriebsfundament für alle Module.

## Scope
Auth (SSO-fähig), Rollen/Rechte, Audit-Logs, Datenschutz, Secret-Handling.

## Non-Scope
Keine SEO-Logik. Welle 1 implementiert noch keinen produktiven Identity Provider, liefert aber einen lokalen Backend-Login mit E-Mail/Passwort, Scrypt-Hashes, Bearer-Sessions, Rollen, Audit-Logs und sicheren Secret-Platzhaltern.

## Data Sources
Foundation, UI/API-Schreibaktionen, Connector-Konfigurationen.

## Entities
`user · session · role · audit_log · integration_account.auth_config · feature_flag`

## Processing Pipeline
1. `POST /auth/register` legt lokale Benutzer mit normalisierter E-Mail und Scrypt-Passwort-Hash an.
2. `POST /auth/login` erzeugt serverseitige Sessions; nur Token-Hashes werden gespeichert.
3. `GET /auth/session` löst Bearer-Tokens auf aktive Benutzer auf.
4. Rollen starten minimal mit `owner`, `editor`, `viewer`; schreibende Agent-/CMS-/PR-Aktionen bleiben reviewpflichtig.
5. Connector-Secrets werden nicht im Klartext in Fixtures abgelegt; `auth_config` ist ein verschlüsselbarer JSON-Platzhalter.
6. Datenschutzrelevante Rohdaten bleiben in `raw_events` separiert und werden nur kontrolliert normalisiert.

## Scoring / Classification
—

## API Endpoints
- `POST /auth/register` — lokalen Backend-Benutzer anlegen.
- `POST /auth/login` — Session-Token erzeugen.
- `GET /auth/session` — Bearer-Session validieren.
- `POST /auth/logout` — Session invalidieren.
- Spätere SSO-Erweiterung muss diese API-Pfade schützen/ergänzen, ohne den Contract zu brechen.
- Audit-/Feature-Flag-Tabellen sind im Foundation-Schema vorhanden.

## UI Screens
Auth-/Rollen-Settings. Welle 1 zeigt keine vollständige Admin-UI, aber die Foundation-Struktur ist vorbereitet.

## States
`role = owner | editor | viewer`; `user.status = active | disabled`; `audit_log.action` ist append-only. Schreibende Agent-Aktionen bleiben `proposed` bis Review/Freigabe.

## Error Handling
Fehlende Berechtigungen liefern 403; Secret-/Auth-Fehler werden ohne Secret-Werte geloggt. Audit-Logs dürfen keine Tokens oder personenbezogenen Rohdaten enthalten.

## Observability
Security-relevante Ereignisse werden strukturiert geloggt und mit Request-/Job-ID korreliert → `specs/observability-sre.md`.

## Open Source & Sovereignty Guardrails

- Foundation Core remains self-hostable: SQLite is the local runtime store and every persisted entity must keep a Postgres migration path.
- No mandatory proprietary SaaS dependency may be introduced for crawl runs, audit issues, source-map data, projects, users, sessions or jobs.
- Provider integrations stay behind replaceable adapters; `integration_account.auth_config` must remain a secret-safe placeholder until encrypted credential storage is implemented.
- Raw events and normalized SEO entities stay separated so exports, replays and provider replacement remain possible without data loss.
- Before production hardening, every new runtime dependency needs a license and supply-chain review; unknown or incompatible licenses block release.
- UI settings must expose the current sovereignty/readiness state so operators can see which guardrails are already met and which still require review.

## Acceptance Tests
Rollenbasierter Zugriff, Audit-Log aktiv. Welle 1 prüft Registrierung, Login, Session-Auflösung, Schema-Vorhandensein und dass Fixtures keine Secrets enthalten.

## Future Extensions
Feingranulare Mandantenrechte, SSO/OIDC, Token-Rotation und Field-Level-Encryption.

## Cross-Refs
§4.1, §12.4


## Foundation Security Matrix

| Pfadgruppe | Klasse lokal | Klasse Produktbetrieb | Rollenhinweis |
|---|---|---|---|
| `/health` | public | public/readiness-gated | keine sensiblen Details |
| `/auth/register`, `/auth/login` | public | public with rate-limit | Registrierung später ggf. owner-only invite |
| `/auth/session`, `/auth/logout` | authenticated | authenticated | aktiver Benutzer erforderlich |
| `/projects`, `/projects/{projectId}/sites` | local optional | authenticated | owner/editor schreiben, viewer lesen |
| `/integrations` | local optional | authenticated | owner/editor schreiben, viewer lesen |
| `/jobs` | local optional | authenticated | owner/editor starten, viewer lesen |
| `/source-map` | local optional | authenticated | read for viewer, refresh owner/editor |

Übergangsregel: Lokale Entwicklung darf Foundation-Endpunkte ohne Auth testen; Produktbetrieb schützt alle schreibenden Endpunkte mindestens mit `authenticated` plus Rollenprüfung.
