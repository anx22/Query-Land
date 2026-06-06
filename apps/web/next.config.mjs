import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(projectRoot, "..", "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@seo-tool/api", "@seo-tool/domain-model", "@seo-tool/shared-config"],
  // The embedded API reads its SQLite migrations from infra/db/sqlite/*.sql at
  // runtime (readdirSync/readFileSync). Next's build tracer can't see those
  // dynamic reads, so without this they are missing from the serverless bundle
  // and every server-rendered request fails with "SQLite migrations directory
  // not found". Pin the tracing root to the repo root and explicitly include
  // the migration files so they ship inside the function.
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/**": ["../../infra/db/sqlite/**"]
  }
};

export default nextConfig;
