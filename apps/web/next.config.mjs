import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(projectRoot, "..", "..");

// Content-Security-Policy — konservativ und am realen Bedarf ausgerichtet:
// Next.js/React injizieren Inline-Styles/-Scripts (Hydration) → 'unsafe-inline';
// Recharts ist SVG-basiert (kein eval). Die Web-App ruft die API unter
// NEXT_PUBLIC_API_BASE_URL → in connect-src aufnehmen, sofern gesetzt.
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const connectSrc = ["'self'", apiBaseUrl].filter(Boolean).join(" ");
const contentSecurityPolicy = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  `connect-src ${connectSrc}`,
  "frame-ancestors 'none'",
  "base-uri 'self'"
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
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
