# Decisions Backlog

## DEC-001 — Plattform-Typen im Scope

- **Status:** ready for decision
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

- **Status:** ready for decision
- **Options:** DACH first; DACH + one reference market; international from day one.
- **Recommendation:** DACH first.
- **Impact:** Simplifies language, SERP and reporting assumptions.
- **Decide by:** Before Welle-3 Keyword Core.

## DEC-004 — Agent-Mandat

- **Status:** ready for decision
- **Options:** read-only; create tickets; propose PRs; CMS writes.
- **Recommendation:** read-only + create tickets for Welle 1-3; PR proposals only after Source Map validation in Welle 4.
- **Impact:** Affects security roles and MCP tools.
- **Decide by:** Before Welle-4 Opportunity Engine.
