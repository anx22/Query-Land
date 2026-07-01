-- 017_crawl_page_signals — durable per-page audit signals for resumable crawls.
--
-- The audit rules (duplicate_title across all pages, broken_link over a page's
-- outgoing links, canonical_mismatch, http_error/redirect) run over the whole
-- crawl. In a single-invocation crawl that happens in memory. For a RESUMABLE
-- crawl processed across several worker invocations, the earlier batches' page
-- data is gone — so we persist exactly the signals the audit needs, keyed by
-- crawl run, and finalize from this table once the frontier is drained.

CREATE TABLE IF NOT EXISTS crawl_page_signals (
  id TEXT PRIMARY KEY,
  crawl_run_id TEXT NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  normalized_url TEXT NOT NULL,
  final_url TEXT NOT NULL,
  status_code INTEGER,
  title TEXT,
  canonical_url TEXT,
  -- JSON array of { url, statusCode } for the page's in-scope outgoing links.
  outgoing_links TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  UNIQUE (crawl_run_id, normalized_url)
);

CREATE INDEX IF NOT EXISTS idx_crawl_page_signals_run ON crawl_page_signals(crawl_run_id);
