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

## DEC-005 — Open-Source- und Souveränitätsstrategie

- **Status:** ready for decision
- **Options:** Proprietary-managed only; open-source-first self-hostable core; hybrid core with replaceable providers.
- **Recommendation:** Open-source-first self-hostable Foundation Core with hybrid, replaceable provider adapters for optional external services. The current EU digital-sovereignty and Open-Source strategy signal (June 2026) reinforces this as a product guardrail, not as a late procurement checkbox.
- **Impact:** Keeps Foundation data, crawl/audit evidence and connector contracts portable; requires dependency/license review before production hardening and avoids mandatory SaaS lock-in in Welle 1-2.
- **Decide by:** Before production connector credentials, hosted deployments or paid provider adapters are introduced.
