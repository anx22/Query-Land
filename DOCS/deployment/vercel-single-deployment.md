# Vercel single-deployment setup

This monorepo can run the Next.js web app and the embedded foundation API in one Vercel project.

## Import settings

Use these settings in Vercel. The repository-root `vercel.json` is authoritative for the project configuration, so keep the Vercel project rooted at the repository root and mirror the values from that file when importing or reviewing the project settings. The build command intentionally compiles TypeScript workspace packages before `next build`, because the web app imports the embedded API and shared config packages by their workspace package names:

- **Root Directory:** repository root / leave empty
- **Framework Preset:** Next.js
- **Install Command:** `npm install --workspaces --include-workspace-root`
- **Build Command:** `npm run vercel-build`
- **Output Directory:** `apps/web/.next`

## Environment variables

For the single-deployment mode, do **not** set `SEO_API_BASE_URL`. When it is absent, the web app calls the embedded API handler directly and also exposes the same backend under `/api/backend/*`.

Optional values:

```env
DATABASE_URL=sqlite:/tmp/seo-os.sqlite
```

When `DATABASE_URL` is omitted on Vercel, the shared config falls back to `sqlite:/tmp/seo-os.sqlite` so the SQLite database is written to Vercel's writable temporary directory instead of the read-only deployment bundle.

## Crawler execution

The selected operating mode is a **separate crawler worker instance** outside the Vercel web deployment, for example on a VPS, Fly.io, Render, or Railway.

This keeps the crawler as a long-running worker process and avoids coupling crawl duration, polling, retries, and network fetches to Vercel server-function limits. Vercel remains responsible for the web app and the embedded API under `/api/backend/*`; the external worker calls that API over HTTPS.

Configure the worker runtime with these environment variables:

```env
SEO_API_BASE_URL=https://<vercel-project-domain>/api/backend
CRAWLER_ONCE=0
CRAWLER_POLL_INTERVAL_MS=5000
CRAWLER_FETCH_TIMEOUT_MS=10000
```

- `SEO_API_BASE_URL` must point to the deployed Vercel backend proxy, including `/api/backend`.
- `CRAWLER_ONCE=0` or an omitted value runs the normal polling loop. Set `CRAWLER_ONCE=1` only for one-shot execution, smoke tests, or scheduler-driven jobs.
- `CRAWLER_POLL_INTERVAL_MS` controls how long the worker waits between claim attempts when no one-shot mode is active.
- `CRAWLER_FETCH_TIMEOUT_MS` limits outbound page fetches performed by the crawler.

Expected start commands:

```bash
npm --workspace @seo-tool/crawler run start
```

Use the one-shot variant only for smoke checks or when a scheduler intentionally starts exactly one cycle:

```bash
npm --workspace @seo-tool/crawler run start:once
```

### Alternatives considered

- **Vercel Cron:** deferred. A future cron mode should add a minimal protected API trigger that runs exactly one worker cycle, behaves like `start:once`, and rejects unauthenticated requests via a dedicated secret header or bearer token. That endpoint must not start an infinite polling loop inside a Vercel function.
- **Queue-based external runner:** deferred until the job queue is backed by a durable queue service. At that point the external runner can replace polling with queue consumption while keeping the same crawler cycle contract.

## Limitations

- The embedded API runs as Vercel/Next.js server functions, not as a permanent background process.
- SQLite in `/tmp` is suitable for preview/demo operation but is not durable across cold starts or new function instances. Move `DATABASE_URL` to a durable database adapter when production persistence is required.
- The crawler worker loop is still a worker process and is not started by Vercel. It does not run permanently inside the Vercel single deployment; schedule/worker execution still needs a separate scheduler/worker outside the web deployment or a future cron/function integration. API endpoints remain available under `/api/backend/*`.
