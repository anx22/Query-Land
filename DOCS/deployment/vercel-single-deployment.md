# Vercel single-deployment setup

This monorepo can run the Next.js web app and the embedded foundation API in one Vercel project.

## Verified Vercel settings

The Vercel project points at the **Next.js app workspace**. Configure these project settings in the Vercel dashboard (Settings → Build & Deployment):

- **Root Directory:** `apps/web`
- **Include source files outside of the Root Directory in the Build Step:** **enabled** (`sourceFilesOutsideRootDirectory: true`)
- **Framework Preset:** Next.js
- **Install Command:** default / empty override
- **Build Command:** `npm run vercel-build` (default; resolves to the `apps/web` workspace script)
- **Output Directory:** `.next`

`apps/web/vercel.json` is the single source of truth for the build command and output directory. There is intentionally **no repository-root `vercel.json`** — Root Directory is `apps/web`, so a root config would be ignored and only cause confusion.

> **Important:** "Include source files outside of the Root Directory" must stay enabled. With Root Directory set to `apps/web`, Vercel otherwise isolates the build to that directory, but `vercel-build` compiles `packages/*` and `apps/api` (outside `apps/web`) before `next build`. Without this toggle, `build:deps` fails because the sibling workspaces are not present in the build checkout. Vercel usually enables it automatically for detected monorepos; verify it is on for new or repaired projects.

If a deployment log shows `workspace @seo-tool/api` or `Missing script: "vercel-build"`, the project's Root Directory is mis-pointed (e.g. at `apps/api` or the repository root). Fix it in the dashboard by setting Root Directory back to `apps/web`.

## The build script

`apps/web` owns the deployment script. `vercel-build` first compiles the internal TypeScript workspace dependencies (`packages/*` and `apps/api`) via `build:deps`, then runs `next build`:

```jsonc
// apps/web/package.json
"build:deps": "npm --workspace @seo-tool/domain-model run build && npm --workspace @seo-tool/shared-config run build && npm --workspace @seo-tool/api run build",
"build:next": "DATABASE_URL=sqlite::memory: next build",
"vercel-build": "npm run build:deps && npm run build:next"
```

Because the build runs inside the `apps/web` workspace, the TypeScript compiler must be installed there: `typescript` and `@types/node` are listed in `apps/web` devDependencies (not only at the repository root) so `tsc -b` is available when `build:deps` compiles the sibling workspaces. Without this, the build fails with `tsc: command not found` (exit 127).

The web `build:next` script sets `DATABASE_URL=sqlite::memory:` during `next build` so static generation does not open a real database connection. Runtime persistence is provided by Neon Postgres via `DATABASE_URL` (see the database section below).

## Environment variables

For the single-deployment mode, do **not** set `SEO_API_BASE_URL`. When it is absent, the web app calls the embedded API handler directly and also exposes the same backend under `/api/backend/*`.

Required runtime value:

```env
DATABASE_URL=postgresql://<user>:<password>@<neon-host>/<db>?sslmode=require
```

## Database

Production persistence is **Neon Postgres**, configured via `DATABASE_URL`. Set `DATABASE_URL` on the Vercel project to the Neon connection string so the API and crawler share a durable database across cold starts and function instances.

Local development uses an **embedded PGlite** database (no external server required), so a local checkout works without provisioning Postgres. The `sqlite::memory:` value is only used during `next build` to avoid opening a real connection during static generation.

## Crawler execution

The crawler runs **in-process on Vercel** via the cron route `/api/cron/crawl`. The cron schedule (`0 3 * * *`, daily at 03:00 UTC) is declared in `apps/web/vercel.json`, and the route is gated by `CRON_SECRET` so only authenticated cron invocations can trigger a crawl cycle. There is **no separate external worker instance** (VPS, Fly.io, Render, Railway).

Each cron invocation runs one crawl cycle inside the Vercel function and then returns; it does not start an infinite polling loop. Set `CRON_SECRET` on the Vercel project to enable the schedule.

```env
CRON_SECRET=<random-secret>
```

> **Details:** See [`serverless-crawl-worker.md`](./serverless-crawl-worker.md) for the full in-process cron crawl design, the request contract, and the `CRON_SECRET` gating.

## Limitations

- The embedded API and the cron crawl route run as Vercel/Next.js server functions, not as a permanent background process.
- Crawl execution is bounded by Vercel server-function limits per cron invocation; very large crawls may need to be split across cycles. See [`serverless-crawl-worker.md`](./serverless-crawl-worker.md).
