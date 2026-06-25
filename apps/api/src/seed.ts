import type { AsyncDatabase } from "./db/index.js";

// Foundation bootstrap: seeds only real, non-demo configuration. No demo project, site,
// integrations or placeholder metrics — a fresh database starts empty and the UI guides the
// user through creating their first project. The only seeded row is the feature flag that
// enables local email/password sessions, which is real runtime config (not demo data).
export async function seedFoundation(db: AsyncDatabase): Promise<void> {
  const existing = Number(
    (await db.prepare(`SELECT COUNT(*) AS count FROM feature_flags WHERE key = ?`).get("auth.email_password"))?.count ?? 0
  );
  if (existing > 0) {
    return;
  }
  await db
    .prepare(`INSERT INTO feature_flags (key, enabled, description) VALUES (?, ?, ?)`)
    .run("auth.email_password", 1, "Enable local backend-owned email/password sessions.");
}
