# Decisions Backlog

## DEC-001 — Plattform-Typen im Scope

- **Status:** akzeptiert
- **Options:** Content first; Shop first; SaaS first; mixed from day one.
- **Recommendation:** Content + SaaS first, because crawl/audit and source-map assumptions stay simpler.
- **Impact:** Affects Welle-2 crawl fixtures and Welle-4 opportunity classes.
- **Decide by:** Before Welle-2 implementation starts.

## DEC-002 — Competitor Intelligence Provider in V1

- **Status:** ready for decision
- **Options:** No provider; optional SERP-only provider; licensed SEO provider.
- **Recommendation:** No licensed provider in Welle 1/2; add provider abstraction only.
- **Impact:** Avoids third-party dependency before first-party audit loop works.
- **Decide by:** Before Welle-3 Keyword Core.

## DEC-003 — Märkte zuerst

- **Status:** akzeptiert
- **Options:** DACH first; DACH + one reference market; international from day one.
- **Recommendation:** DACH first.
- **Impact:** Simplifies language, SERP and reporting assumptions.
- **Decide by:** Before Welle-3 Keyword Core.

## DEC-004 — Agent-Mandat

- **Status:** akzeptiert
- **Options:** read-only; create tickets; propose PRs; CMS writes.
- **Recommendation:** read-only + create tickets for Welle 1-3; PR proposals only after Source Map validation in Welle 4.
- **Impact:** Affects security roles and MCP tools.
- **Decide by:** Before Welle-4 Opportunity Engine.

## DEC-005 — Open-Source- und Souveränitätsstrategie

- **Status:** ready for decision
- **Options:** Proprietary-managed only; open-source-first self-hostable core; hybrid core with replaceable providers.
- **Recommendation:** Open-source-first self-hostable Foundation Core with hybrid, replaceable provider adapters for optional external services. The current EU digital-sovereignty and Open-Source strategy signal (June 2026) reinforces this as a product guardrail, not as a late procurement checkbox.
- **Impact:** Keeps Foundation data, crawl/audit evidence and connector contracts portable; requires dependency/license review before production hardening and avoids mandatory SaaS lock-in in Welle 1-2.
- **Decide by:** Before production connector credentials, hosted deployments or paid provider adapters are introduced.

## DEC-006 — Crawl Seed Scheduling Seam

- **Status:** accepted in code, document if revisited
- **Decision:** UI-triggered crawls should use a single Technical Audit scheduling seam that creates the Crawl Run and the typed `crawl_seed` Job together. Worker-created or legacy `crawl_seed` Jobs may omit `crawlRunId`; the Worker then creates the Crawl Run before crawling.
- **Reason:** Keeps the UI from knowing the low-level Job payload/subject convention while preserving backwards-compatible Worker behaviour.
- **Impact:** Future refactors must not make `crawlRunId` globally required for every claimed `crawl_seed` payload; only scheduled job creation requires it.

## DEC-007 — Production Smoke Target

- **Status:** accepted for manual test usage
- **Decision:** Use `https://queryland-mikadesign.vercel.app/` for manual browser checks, internal logs and deployment smoke tests until a dedicated staging URL exists.
- **Reason:** Gives agents and humans a shared, stable URL for Vercel/runtime validation.
- **Impact:** Future handoffs and QA notes should cite this target when asking for browser or runtime smoke validation.
