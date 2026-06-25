# Connector-Vertrag (T5)

Jeder Provider-Connector erfüllt einen einheitlichen, typisierten Vertrag, damit UI und Agent
den Verbindungszustand, das Quota-Budget, die Datenfrische und die Fähigkeiten einer Integration
einheitlich lesen können — und damit Fehlermodi sichtbar statt opak werden.

Quelle: `apps/api/src/connectors/index.ts` (Contract + Stubs),
`apps/api/src/stores/project-store.ts` (Persistenz + Status-Sicht),
`apps/api/src/routes/integrations.ts` (Read-Endpoints).

## Provider-Vertrag

Der `Connector` meldet über `describe(ctx)` einen `ConnectorContract`:

| Feld | Typ | Bedeutung |
| --- | --- | --- |
| `provider` | `IntegrationProvider` | Provider-Schlüssel (z. B. `gsc`, `ga4`, `pagespeed`, `lighthouse`). |
| `sourceType` | `string` | Rohdatenquelle (z. B. `search_console`). |
| `sourceConfidence` | `A..E` | Confidence-Klasse der gelieferten Daten. |
| `authStatus` | `connected \| missing_credentials \| expired \| degraded` | Verbindungszustand. |
| `quota` | `{ used, limit, resetsAt? } \| null` | Verbrauchtes/erlaubtes Anfrage-Budget. |
| `freshness` | `{ lastSyncedAt, lastEvidenceAt }` | Letzter erfolgreicher Sync bzw. letzter Rohdatensatz (ISO oder null). |
| `capabilities` | `string[]` | Was der Connector liefert (z. B. `clicks`, `web_vitals`). |

`describe()` ist read-only und bekommt einen `ConnectorStatusContext`
(`hasCredentials`, `lastSyncedAt`, `lastEvidenceAt`). `hasCredentials` leitet sich aus dem
nicht-leeren `auth_config` am `integration_account` ab.

### Surfacing über die API

- `GET /integrations` — Liste mit `IntegrationStatusView` (persistierter Account + `contract`
  + `lastSyncedAt`/`lastEvidenceAt`).
- `GET /integrations/{integrationId}` — Einzelstatus mit demselben Vertrag.
- `POST /integrations/{integrationId}/sync` — Sync-Lauf; Antwort enthält `outcome`, den
  aktualisierten `contract` und (bei Erfolg) `rawEventId` + `normalizedMetricsInserted`.

Alle Antworten folgen der Standard-Hülle `{ data: ... }`.

## Stub → Real-Seam

Welle 1 verbindet keine produktiven OAuth-Flows. Connectoren sind deterministische Stubs.
Der einzige fehlende Baustein für den Live-Betrieb ist **der reale Netzwerk-Call plus echte
Credentials**: Ein echter Provider-Adapter ersetzt nur den `ok`-Zweig von `fetch()` durch den
HTTP-Aufruf. Auth-Gate, Quota-, Freshness- und Capability-Logik sowie `validate`/`normalize`
bleiben unverändert. Solange `auth_config` leer ist, liefert `fetch()` deterministisch
`missing_credentials` statt eines echten Calls.

## Fehlermodi (Failure-mode visibility)

`fetch()` gibt ein typisiertes `ConnectorFetchResult` mit `outcome` zurück:

- `ok` — Payload vorhanden, wird normalisiert und persistiert; Status → `connected`.
- `missing_credentials` — kein `auth_config`; kein realer Call.
- `quota_exceeded` — Budget aufgebraucht.
- `expired` — Credentials abgelaufen.
- `degraded` — Provider teilweise verfügbar.

Bei jedem Nicht-`ok`-Ergebnis **crasht der Sync nicht**. Stattdessen:

1. Der `integration_account` wird auf Status `degraded` gesetzt (persistiert, abfragbar).
2. Ein Audit-Eintrag `integration.sync_degraded` mit `outcome`/`reason` wird geschrieben.
3. Die Sync-Antwort liefert `outcome`, eine menschenlesbare `reason`, `rawEventId: null` und
   den aktuellen `contract` (dessen `authStatus` z. B. `missing_credentials` zeigt).

So sieht UI/Agent einen sichtbaren, abfragbaren blockierten Zustand statt einer opaken 502.
Echte, unerwartete Fehler (z. B. ein kaputtes Payload-Schema) bleiben hingegen ein harter
`connector_sync_failed` (502) mit Status `error`.
