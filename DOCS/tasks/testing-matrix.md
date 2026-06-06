# Testing Matrix

| Category | Command | Applies to | Gate |
|---|---|---|---|
| TypeScript build/typecheck | `npm run typecheck` | all code changes | required |
| Workspace boundaries | `npm run check:boundaries` | monorepo/package changes | required |
| OpenAPI structure | `npm run validate:openapi` | API contract changes | required |
| Unit/API tests | `npm test` | domain/API changes | required |
| Web production build | `npm --workspace @seo-tool/web run build` | UI changes | required for UI |
| DB migration smoke | `sqlite::memory:` API/store tests | DB/schema changes | required |
| Welle-1 Foundation smoke | `npm test -- --test-name-pattern "Welle 1 UI smoke"` | Foundation/API/UI-gate changes | required for W1 gate proof |

## Welle-2 minimum gate

Before Crawl/Audit implementation begins, every story must define which of the above checks is required. Crawler stories additionally need at least one fixture URL set and one failure-mode test.

## Welle-1 foundation gate

The Welle-1 smoke is implemented as a Node API test in `apps/api/test/app.test.ts` and is also covered by the full `npm test` command. It uses the real embedded API routes with `sqlite::memory:` and proves: create project → create site → create connector stub → create/see job → read back persisted state.
