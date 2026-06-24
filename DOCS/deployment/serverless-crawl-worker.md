# Crawl-Worker auf Vercel (serverless Cron)

Lokal läuft der Crawler als Dauer-Daemon (`services/crawler/src/worker.ts`,
pollt alle 5 s `claimNextJob`). **Auf Vercel gibt es keinen Dauerprozess** — ohne
Ersatz würden in Production gestartete Crawls nie verarbeitet.

Lösung: ein **Cron-getriggerter Endpoint**, der die Job-Queue in beschränkten
Häppchen leert.

## Bausteine

- `apps/web/src/app/api/cron/crawl/route.ts` — `GET`-Endpoint, CRON_SECRET-Auth.
- `apps/web/src/lib/crawl-cron.ts` — `drainCrawlJobs()`: leert die Queue, begrenzt
  durch Job-Anzahl (`maxJobs`, Default 5) und Zeitbudget (`timeBudgetMs`, Default 50 s).
- `apps/web/src/lib/crawl-worker-client.ts` — `InProcessCrawlWorkerApiClient`:
  spricht die eingebettete API direkt über `callInternalApi` an (kein HTTP-Hop),
  spiegelt `HttpCrawlWorkerApiClient` der Crawler-Service-Variante.
- `apps/web/vercel.json` → `crons`: `path: /api/cron/crawl`, `schedule: 0 3 * * *`
  (täglich 03:00 UTC — der einzige auf **Hobby** erlaubte Takt; siehe unten).

Der Endpoint ist transport-agnostisch: er ist ein authentifizierter `GET`. Egal
ob Vercel-Cron, GitHub Action oder ein externer Scheduler ihn aufruft.

## Pflicht-Setup (sonst inaktiv)

1. **`CRON_SECRET` in Vercel setzen** (Settings → Environment Variables, Production).
   Vercel sendet ihn bei Cron-Aufrufen automatisch als
   `Authorization: Bearer <CRON_SECRET>`.
   - Ohne `CRON_SECRET` antwortet der Endpoint auf Vercel bewusst mit **503**
     (nie ein offener Crawl-Trigger).
2. **Plan beachten:** Cron im 5-Minuten-Takt erfordert **Vercel Pro**. Auf
   **Hobby** sind Crons nur **einmal täglich** erlaubt — dort entweder
   - `schedule` in `vercel.json` auf z. B. `0 3 * * *` (täglich) reduzieren, oder
   - einen externen Scheduler nutzen, der
     `GET /api/cron/crawl` mit `Authorization: Bearer <CRON_SECRET>` aufruft.
3. **`maxDuration`:** in der Route auf 60 s gesetzt; durch den Plan ggf. niedriger
   gedeckelt. Das Zeitbudget in `drainCrawlJobs` bleibt darunter.

## Manueller Test (nach Deploy)

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" \
  https://queryland-mikadesign.vercel.app/api/cron/crawl
# -> {"ok":true,"processed":N,"stoppedReason":"empty|maxJobs|timeBudget","cycles":[...]}
```
