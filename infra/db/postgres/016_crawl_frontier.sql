-- 016_crawl_frontier — run-scoped BFS frontier for resumable, multi-invocation crawls.
--
-- The existing discovered_urls table is per-SITE and persists across runs, so it
-- cannot track "what is still pending for THIS run". crawl_frontier is keyed by
-- crawl_run_id and records each URL's processing status, letting one crawl run be
-- processed in time-bounded batches across several worker invocations (a
-- continuation job resumes from the remaining pending rows).

CREATE TABLE IF NOT EXISTS crawl_frontier (
  id TEXT PRIMARY KEY,
  crawl_run_id TEXT NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  normalized_url TEXT NOT NULL,
  depth INTEGER NOT NULL DEFAULT 0,
  discovered_from TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'done')) DEFAULT 'pending',
  enqueued_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (crawl_run_id, normalized_url)
);

-- Claiming pending work: filter by run + status, take the shallowest (BFS order) first.
CREATE INDEX IF NOT EXISTS idx_crawl_frontier_run_status ON crawl_frontier(crawl_run_id, status, depth);
