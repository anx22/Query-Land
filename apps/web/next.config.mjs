import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(projectRoot, "..", "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@seo-tool/api", "@seo-tool/domain-model", "@seo-tool/shared-config"],
  // PGlite (embedded Postgres WASM, local dev only) must not be bundled by the
  // Next server compiler — webpack mishandles its WASM/fs loading and throws
  // "path argument ... Received an instance of URL", taking the embedded API
  // offline locally. Keep it external so it loads as a normal node module.
  serverExternalPackages: ["@electric-sql/pglite"],
  // The embedded API reads its Postgres migrations from infra/db/postgres/*.sql
  // at runtime (readdirSync/readFileSync). Next's build tracer can't see those
  // dynamic reads, so without this they are missing from the serverless bundle
  // and every server-rendered request fails with "Postgres migrations directory
  // not found". Pin the tracing root to the repo root and explicitly include
  // the migration files so they ship inside the function.
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/**": ["../../infra/db/postgres/**"]
  }
};

export default nextConfig;
