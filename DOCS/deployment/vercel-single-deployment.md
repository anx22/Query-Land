# Vercel single-deployment setup

This monorepo can run the Next.js web app and the embedded foundation API in one Vercel project.

## Verified Vercel settings

The Vercel project must point at the **Next.js app workspace**, not the API workspace. The deployment log that says `workspace @seo-tool/api` means the Vercel Root Directory is still set to `apps/api` or the project is linked to the API workspace; that project cannot be the web deployment target.

Use these project settings in Vercel:

- **Root Directory:** `apps/web`
- **Framework Preset:** Next.js
- **Install Command:** default / empty override
- **Build Command:** `npm run vercel-build`
- **Output Directory:** `.next`

`apps/web/vercel.json` mirrors the build command and output directory for the web workspace. The repository-root `vercel.json` remains as a compatibility path for projects that intentionally keep Root Directory empty/repository-root, but the preferred monorepo setting is `apps/web`.


## CLI/API repair path

If the Vercel Dashboard project is already mis-pointed at `apps/api`, fix the project settings through the Vercel REST API instead of guessing in the build scripts. The repository contains a checked-in helper that applies the deployment target used by this app:

```bash
VERCEL_TOKEN=<token> \
VERCEL_PROJECT_ID=<project-id-or-name> \
npm run vercel:sync-settings
```

For team-owned projects, add either a team id or slug:

```bash
VERCEL_TOKEN=<token> \
VERCEL_PROJECT_ID=<project-id-or-name> \
VERCEL_TEAM_ID=<team-id> \
npm run vercel:sync-settings
```

The helper updates the Vercel project to:

- `rootDirectory: apps/web`
- `framework: nextjs`
- `buildCommand: npm run vercel-build`
- `outputDirectory: .next`
- `sourceFilesOutsideRootDirectory: true`

`sourceFilesOutsideRootDirectory` is intentionally enabled because the web workspace builds TypeScript packages from `packages/*` and the embedded API from `apps/api`. Without that setting, Vercel's Root Directory isolation can block files outside `apps/web`.

Use a dry run to verify the exact API request before sending it:

```bash
npm run vercel:sync-settings -- --project <project-id-or-name> --team <team-id-or-slug> --dry-run
```

## Why the scripts are split

Vercel runs the build command against the selected monorepo project/workspace. Therefore every deployment-relevant workspace has a `vercel-build` script:

- `apps/web` is the canonical web deployment script. It first builds internal TypeScript workspace dependencies, then runs `next build`.
- repository root keeps `vercel-build` for root-directory deployments.
- `apps/api` has a forwarding `vercel-build` only to prevent the observed `Missing script: "vercel-build"` failure while the Vercel project is still mis-pointed at the API workspace. The correct permanent setting is still Root Directory `apps/web`.

The web `build:next` script sets `DATABASE_URL=sqlite::memory:` during `next build` so static generation does not create competing file-backed SQLite handles. Runtime behavior is unchanged: when `DATABASE_URL` is omitted on Vercel, shared config still falls back to `sqlite:/tmp/seo-os.sqlite`.

## Environment variables

For the single-deployment mode, do **not** set `SEO_API_BASE_URL`. When it is absent, the web app calls the embedded API handler directly and also exposes the same backend under `/api/backend/*`.

Optional runtime value:

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
