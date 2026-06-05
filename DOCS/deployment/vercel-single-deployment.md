# Vercel single-deployment setup

This monorepo can run the Next.js web app and the embedded foundation API in one Vercel project.

## Import settings

Preferred root import settings:

- **Framework Preset:** Next.js
- **Root Directory:** repository root / leave empty
- **Install Command:** default (`npm install`) or the checked-in `vercel.json` value
- **Build Command:** `npm --workspace @seo-tool/web run build` (checked in via `vercel.json`)
- **Output Directory:** `apps/web/.next` (checked in via `vercel.json`)

The root `package.json` intentionally declares `next`, `react`, and `react-dom` so Vercel can detect Next.js even when the project is imported at the repository root. The checked-in `vercel.json` then builds the actual web workspace.

Alternative workspace-root settings:

- **Framework Preset:** Next.js
- **Root Directory:** `apps/web`
- **Build Command:** default (`npm run build`)
- **Output Directory:** default

## Environment variables

For the single-deployment mode, do **not** set `SEO_API_BASE_URL`. When it is absent, the web app calls the embedded API handler directly and also exposes the same backend under `/api/backend/*`.

Optional values:

```env
DATABASE_URL=sqlite:/tmp/seo-os.sqlite
```

When `DATABASE_URL` is omitted on Vercel, the shared config falls back to `sqlite:/tmp/seo-os.sqlite` so the SQLite database is written to Vercel's writable temporary directory instead of the read-only deployment bundle.

## Limitations

- The embedded API runs as Vercel/Next.js server functions, not as a permanent background process.
- SQLite in `/tmp` is suitable for preview/demo operation but is not durable across cold starts or new function instances. Move `DATABASE_URL` to a durable database adapter when production persistence is required.
- The crawler worker loop is still a worker process and is not started by Vercel. API endpoints remain available under `/api/backend/*`; schedule/worker execution needs a separate trigger or future cron/function integration.
