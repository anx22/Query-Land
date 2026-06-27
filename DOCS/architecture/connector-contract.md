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

## Stub → Real-Seam (B3: echte Adapter)

`fetch(ctx)` ist **async** (`Promise<ConnectorFetchResult>`); alle Aufrufer awaiten es. Der
einzige Baustein, der durch B3 real wurde, ist der Netzwerk-Call: Ein echter Provider-Adapter
ersetzt nur den `ok`-Zweig von `fetch()` durch einen echten HTTPS-`fetch()`. Auth-Gate, Quota-,
Freshness- und Capability-Logik sowie `validate`/`normalize` bleiben unverändert.

Der Adapter läuft **nur**, wenn echte Provider-Credentials/Env aufgelöst werden können
(`apps/api/src/connectors/credential-resolution.ts`). Andernfalls — insbesondere bei
Stub-`auth_config` wie in Produktion — fällt `fetch()` auf den deterministischen Stub zurück.
Ist `auth_config` ganz leer, liefert `fetch()` weiterhin `missing_credentials`. **Ohne echte
Credentials ist das Verhalten byte-für-byte unverändert.**

Implementierung: `apps/api/src/connectors/adapters.ts` (Netzwerk-Calls + reine Mapper),
`apps/api/src/connectors/credential-resolution.ts` (Credential/Env-Auflösung).

### Reale Adapter & Datenfluss

| Provider | Live-Quelle | Mapping (normalisierte Rows) |
| --- | --- | --- |
| `gsc` | Search Console **Search Analytics** API (POST `…/searchAnalytics/query`, 28-Tage-Fenster) | `clicks`, `impressions`, `ctr`, `position` |
| `pagespeed` | **PageSpeed Insights** v5 (`runPagespeed`) | `lcp_ms`, `cls`, `inp_ms`, `ttfb_ms` (aus `lighthouseResult.audits`) |
| `lighthouse` | derselbe PSI-Call (`lighthouseResult.categories`) | `performance`, `accessibility`, `best_practices`, `seo` |

Die `fetchImpl` ist injizierbar (Default `globalThis.fetch`, das `HTTPS_PROXY` respektiert),
sodass Adapter vollständig offline testbar sind.

### Credential-/Env-Auflösung

| Provider | Quelle (Reihenfolge) |
| --- | --- |
| `gsc` | `auth_config.accessToken` (entschlüsselt) → `GSC_ACCESS_TOKEN`; Property aus `auth_config.property` → `GSC_PROPERTY` → Site-`base_url` |
| `pagespeed` | `auth_config.apiKey` → `PAGESPEED_API_KEY`; Ziel-URL aus der Site-`base_url` |
| `lighthouse` | teilt den PSI-Key (`PAGESPEED_API_KEY` / `auth_config.apiKey`) |

`describe()` bekommt die entschlüsselte `auth_config` und meldet `authStatus = connected`,
sobald entweder eine (Stub- oder echte) `auth_config` hinterlegt ist **oder** echte
Env-Credentials konfiguriert sind — so spiegelt der Status (und die Quota) die Realität wider.

### Fehlerbehandlung im Live-Pfad

Netzwerkfehler, non-2xx und Quota werfen **nie** roh am Connector-Seam, sondern werden in
typisierte Outcomes mit klarer `reason` übersetzt: `401 → expired`, `429 → quota_exceeded`,
alles andere/Netzwerkfehler → `degraded`. Der Sync persistiert diese als sichtbaren
`degraded`-Status (siehe Failure-mode-Abschnitt unten).

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
