-- WP-3.1: Search-Performance-Intelligence (Welle 4, Modul 4). GSC-Query×Page-Matrix als
-- normalisierte Snapshots (Confidence-Klasse B). Jede Synchronisation schreibt eine Charge
-- mit gemeinsamem captured_at; die Intelligence-Sichten (Striking-Distance, CTR-Gap,
-- Kannibalisierung) lesen die jeweils neueste Charge je Site.
CREATE TABLE IF NOT EXISTS search_performance_rows (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  page_url TEXT NOT NULL,
  clicks INTEGER NOT NULL,
  impressions INTEGER NOT NULL,
  ctr REAL NOT NULL,
  position REAL NOT NULL,
  market TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  source_confidence TEXT NOT NULL CHECK (source_confidence IN ('A', 'B', 'C', 'D', 'E'))
);

CREATE INDEX IF NOT EXISTS idx_search_performance_site ON search_performance_rows (site_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_search_performance_query ON search_performance_rows (site_id, query);
