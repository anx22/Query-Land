# Vercel single-deployment setup

This monorepo can run the Next.js web app and the embedded foundation API in one Vercel project.

## Import settings

Use these settings in Vercel. The repository-root `vercel.json` is authoritative for the project configuration, so keep the Vercel project rooted at the repository root and mirror the values from that file when importing or reviewing the project settings:

- **Root Directory:** repository root / leave empty
- **Framework Preset:** Next.js
- **Install Command:** default (`npm install`)
- **Build Command:** `npm --workspace @seo-tool/web run build`
- **Output Directory:** `apps/web/.next`

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
- The crawler worker loop is still a worker process and is not started by Vercel. It does not run permanently inside the Vercel single deployment; schedule/worker execution still needs a separate scheduler/worker outside the web deployment or a future cron/function integration. API endpoints remain available under `/api/backend/*`.
