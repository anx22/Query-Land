# Plan 004 — `/integrations` Ownership-Härtung

- **Kategorie:** Security (Autorisierung) · **Aufwand:** S–M · **Risiko:** MED · **Hängt ab von:** —
- **Geschrieben gegen Commit:** `ac6a800`.

## Kontext / Warum

Die id-adressierten Integrations-Endpoints nehmen eine Integrations-ID entgegen, **ohne** zu prüfen, ob
sie zu einem genannten Projekt gehört — im Gegensatz zum projekt-scoped Rest der API. Unter dem aktuellen
Single-Org-Modell (DEC-008) ist das noch **kein** Tenant-Breach, aber eine offene Autorisierungsgrenze,
die zum echten IDOR wird, sobald User-/Mandanten-Isolation kommt. **Wichtig zur Impact-Kalibrierung:**
es werden **keine Tokens** geleakt — der Status-View enthält kein `auth_config`. Es geht um
projektübergreifende **Aktionen** (fremden Connector-Sync auslösen/planen) und Metadaten-Enumeration.

Belege:
- Route `apps/api/src/routes/integrations.ts`: `GET /integrations/{id}` (Zeile 33),
  `POST /integrations/{id}/sync` (Zeile 26), `POST /integrations/{id}/sync/schedule` (Zeile 17) —
  reichen die ID direkt an den Store durch.
- Store `apps/api/src/stores/project-store.ts`: `getIntegration(id)` (Zeile 161–167) und
  `runConnectorSync(id)`/`scheduleConnectorSync(id)` (um Zeile 291 ff.) lookupen per ID ohne Projekt-Guard.
- `mapIntegration` (`apps/api/src/row-mappers.ts:154`) enthält bewusst **kein** `auth_config` → kein
  Token im View. Nicht widerlegen, das ist der Grund für die Impact-Kalibrierung.

## Gewählter Ansatz (minimal-invasiv)

Ownership-Check **in den Store-Methoden**, ohne Routen-Umbau.

1. **Helper** analog `assertSiteScope`: eine private Methode, z. B.
   `private async assertIntegrationExists(integrationId): Promise<{ projectId: string; row: ... }>`,
   die per `SELECT ... FROM integration_accounts WHERE id = ?` lädt und bei Nicht-Existenz
   `RequestError(404, "unknown_integration", ...)` wirft. (Vorher prüfen, ob es schon eine solche
   Existenz-Prüfung gibt — dann diese wiederverwenden statt duplizieren.)
2. `getIntegration`, `runConnectorSync`, `scheduleConnectorSync` rufen den Helper am Anfang auf, sodass
   jede id-adressierte Aktion eine **harte Existenz-Grenze** bekommt. Damit ist die heute stille
   „ID existiert nicht"/„gehört woanders hin"-Lücke geschlossen (404 statt undefiniertem Verhalten).
3. **Wichtige Prüfung vor Duplizierung:** `runConnectorSync`/`scheduleConnectorSync` validieren bei
   gesetztem `siteId` bereits, dass die Site zum Projekt der Integration gehört (um Zeile 305–312).
   Nutze diese vorhandene Projekt-Auflösung — der neue Guard soll die **Existenz** absichern und die
   Projekt-Ableitung konsolidieren, **nicht** eine zweite, widersprüchliche Scope-Logik einführen.
4. **Globaler Cron-Listing-Pfad bleibt unverändert:** `GET /integrations` → `listIntegrations()` (ohne
   Projekt) wird bewusst projektübergreifend gebraucht von
   `apps/web/src/lib/connector-sync-cron.ts` (Zeile ~30) für den täglichen Drain aller Connector-Syncs,
   geschützt durch `CRON_SECRET`. **Nicht** ändern. Nur einen Code-Kommentar an Route + Store-Methode
   setzen: „internal/cron-only, trusted caller (CRON_SECRET) — bewusst nicht projekt-gescoped."
5. **Optional (nur bei Bedarf):** eine projekt-scoped Liste `GET /projects/{projectId}/integrations` +
   `listIntegrations(projectId)`-Overload — **nur** anlegen, wenn ein Web-Aufrufer sie braucht. Die
   Exploration fand als einzigen Aufrufer von `GET /integrations` den Cron; also standardmäßig
   **weglassen**.

## Scope

- **In scope:** `apps/api/src/stores/project-store.ts` (Guard + Aufrufe), Kommentare in
  `apps/api/src/routes/integrations.ts`.
- **Explizit out of scope:** die Credentials-Pfade (`upsertIntegrationCredentials`, OAuth-Callback),
  der Cron-Drain, DEC-008-Multi-Tenancy (eigenes Thema — kein User-/Rollenmodell hier bauen).

## Verifikation (Done-Kriterien)

1. Neuer Test in `apps/api/test/` (Muster `app.test.ts`: `createStore("sqlite::memory:")` +
   `seedDemoFoundation`, App über `app("METHOD", path, body)` ansprechen):
   - Zwei Projekte anlegen; Integration in Projekt A erstellen.
   - `POST /integrations/{A-id}/sync` (mit gültigem, zu A gehörendem `siteId`) → Erfolg.
   - `GET /integrations/{unbekannte-id}` → **404** `unknown_integration`.
   - `POST /integrations/{A-id}/sync` mit einem `siteId`, das zu Projekt B gehört → Fehler (der
     vorhandene Site-Scope-Guard muss weiterhin greifen; nicht schwächer werden).
2. `npm test` grün (alle bestehenden Tests bleiben grün — insbesondere die Connector-Sync-/Integration-
   Tests).
3. `npm run validate:openapi` grün (falls die OpenAPI die 404-Antwort beschreibt, ergänzen).

## Test-Plan

Der neue Test oben ist der Kern. Zusätzlich sicherstellen, dass ein bestehender Test, der
`GET /integrations` (globale Liste) über den Cron-Pfad nutzt, **unverändert** grün bleibt — der globale
Listing-Contract darf nicht brechen.

## Wartungshinweis / Escape-Hatch

- **Escape-Hatch:** Wenn sich beim Lesen herausstellt, dass `runConnectorSync`/`scheduleConnectorSync`
  die Projekt-Zuordnung bereits vollständig prüfen und der neue Guard nur Existenz-404 ergänzt — dann
  genau das tun (Existenz-404) und **keine** zweite Scope-Prüfung danebenlegen. Bei Unklarheit über den
  Cron-Contract (welche Felder der globale Drain aus `listIntegrations()` erwartet) **STOP und melden**,
  bevor du an `listIntegrations()` etwas änderst.
- Sobald DEC-008 (User-/Mandanten-Isolation) umgesetzt wird, wird aus diesem Existenz-Guard ein echter
  Ownership-Guard (projekt→user). Diesen Plan dann als Grundlage nehmen und den globalen Cron-Pfad auf
  einen system-internen Actor umstellen.
