-- WP-0.6: interner Linkgraph. Persistiert gerichtete interne Link-Kanten je Site,
-- damit Inlinks/Outlinks und Orphan-/Deep-URLs ausgewertet werden können (Modul 2).
CREATE TABLE IF NOT EXISTS internal_link_edges (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  from_url TEXT NOT NULL,
  to_url TEXT NOT NULL,
  anchor TEXT,
  rel TEXT,
  discovered_at TEXT NOT NULL,
  UNIQUE (site_id, from_url, to_url)
);

CREATE INDEX IF NOT EXISTS idx_internal_link_edges_site_to ON internal_link_edges (site_id, to_url);
CREATE INDEX IF NOT EXISTS idx_internal_link_edges_site_from ON internal_link_edges (site_id, from_url);
