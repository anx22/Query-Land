-- WP-4.1: Authority / Backlinks (§5 Modul 5, Welle 5). Jeder Import erzeugt einen Snapshot und
-- speichert die Backlink-Zeilen mit snapshot_id + captured_at. "Aktuell" = neuester Snapshot;
-- New/Lost = neuester vs. vorheriger Snapshot. Quelle GSC-Links-Stub (Confidence B, DEC-002).
CREATE TABLE IF NOT EXISTS backlink_snapshots (
  id TEXT PRIMARY KEY,
  -- monotonic insertion order; replaces the implicit SQLite rowid used as a
  -- deterministic tiebreaker when two snapshots share the same captured_at.
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  captured_at TEXT NOT NULL,
  total_backlinks INTEGER NOT NULL,
  referring_domains INTEGER NOT NULL,
  source_confidence TEXT NOT NULL CHECK (source_confidence IN ('A', 'B', 'C', 'D', 'E'))
);

CREATE INDEX IF NOT EXISTS idx_backlink_snapshots_project ON backlink_snapshots (project_id, captured_at);

CREATE TABLE IF NOT EXISTS backlinks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_id TEXT NOT NULL REFERENCES backlink_snapshots(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_domain TEXT NOT NULL,
  target_url TEXT NOT NULL,
  anchor_text TEXT NOT NULL,
  link_type TEXT NOT NULL CHECK (link_type IN ('follow', 'nofollow')),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  source_confidence TEXT NOT NULL CHECK (source_confidence IN ('A', 'B', 'C', 'D', 'E')),
  captured_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_backlinks_snapshot ON backlinks (snapshot_id);
CREATE INDEX IF NOT EXISTS idx_backlinks_project_domain ON backlinks (project_id, source_domain);
