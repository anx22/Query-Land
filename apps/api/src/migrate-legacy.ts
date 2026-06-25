import { apiDefaults } from "@seo-tool/shared-config";
import { createDatabase } from "./db/index.js";
import { runMigrations } from "./db/migrate.js";

const databaseUrl =
  process.argv[2] ?? process.env.SEO_DATABASE_URL ?? process.env.DATABASE_URL ?? apiDefaults.databaseUrl;

const db = await createDatabase(databaseUrl);
try {
  const result = await runMigrations(db);
  console.log(
    JSON.stringify(
      {
        database: databaseUrl,
        migrationsDir: result.migrationsDir,
        applied: result.applied.map((migration) => migration.filename),
        skipped: result.skipped.map((migration) => migration.filename)
      },
      null,
      2
    )
  );
} finally {
  await db.close();
}
