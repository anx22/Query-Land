# Deployment

Ein einzelnes Vercel-Projekt (Root `apps/web`) bündelt Frontend und eingebettete API.

## Nach dem Deploy prüfen (Env-Variablen in Vercel)

| Variable | Wofür | Ohne sie |
|---|---|---|
| `DATABASE_URL` | Neon-Postgres (Produktion) | App läuft auf flüchtigem PGlite — keine Persistenz |
| `CRON_SECRET` | schützt die Crawl-Cron-Route | Crawl-Route antwortet mit 503 (kein offener Trigger) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_OAUTH_REDIRECT_URI` / `OAUTH_ENCRYPTION_KEY` | GSC-OAuth | GSC-Connect zeigt ehrlich „noch nicht verfügbar" |
| `PAGESPEED_API_KEY` *(optional)* | echte Web-Vitals | PageSpeed/Lighthouse laufen als Stub |

## Anleitungen
- [`vercel-single-deployment.md`](./vercel-single-deployment.md) — Projekt-/Build-Konfiguration.
- [`serverless-crawl-worker.md`](./serverless-crawl-worker.md) — Cron-Crawl-Worker (`/api/cron/crawl`).
- [`google-oauth-setup.md`](./google-oauth-setup.md) — Google Search Console verbinden (Schritt 1–6).
