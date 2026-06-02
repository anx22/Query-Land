export const stackDecision = {
  frontend: "Next.js/React",
  api: "TypeScript Node HTTP API",
  database: "SQLite embedded for local/Codex execution; Postgres remains the scale-out migration target",
  jobSystem: "SQLite-backed queue locally; same contract can migrate to Postgres-backed queue when scale requires it",
  auth: "Backend-owned email/password sessions stored in the embedded database"
} as const;

export const apiDefaults = {
  port: Number.parseInt(process.env.API_PORT ?? "4000", 10),
  version: "0.2.0-sqlite-auth",
  databaseUrl: process.env.DATABASE_URL ?? "sqlite:data/seo-os.sqlite"
} as const;
