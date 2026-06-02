# Welle-2 Audit-Core Story Seeds

## W2-AUDIT-001 — URL Discovery v0

- **Status:** ready
- **Scope:** Start-URL + sitemap discovery; persist discovered URLs.
- **Acceptance:** Given a fixture sitemap, crawler stores URLs with source metadata.

## W2-AUDIT-002 — HTTP Fetch Worker v0

- **Status:** ready
- **Scope:** Fetch URLs from queue, store status, headers, final URL.
- **Acceptance:** 200/3xx/4xx fixture responses are normalized.

## W2-AUDIT-003 — Indexability Checks v0

- **Status:** ready
- **Scope:** robots meta, X-Robots, canonical and status-code classification.
- **Acceptance:** Each fixture URL receives deterministic indexability state.

## W2-AUDIT-004 — Issue Rules Minimum Set

- **Status:** ready
- **Scope:** HTTP error, redirect chain, missing title, duplicate title, canonical mismatch, broken link.
- **Acceptance:** Rule tests map fixture inputs to issue severity.

## W2-AUDIT-005 — Health Score v0

- **Status:** ready
- **Scope:** Compute simple weighted score from issue severities.
- **Acceptance:** Score changes predictably when critical issues are added/removed.
