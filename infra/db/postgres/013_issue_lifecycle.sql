-- T4 Issue-Lifecycle-Tiefe: a real dismissed state + actor attribution + per-issue history.
-- Until now resolve and dismiss were identical (both only set resolved_at). This migration
-- adds a distinct dismissed state (dismissed_at + dismiss_reason), actor columns recording
-- who last changed each issue, and an audit_issue_history table for queryable transitions.
ALTER TABLE audit_issues ADD COLUMN IF NOT EXISTS dismissed_at TEXT;
ALTER TABLE audit_issues ADD COLUMN IF NOT EXISTS dismiss_reason TEXT;
ALTER TABLE audit_issues ADD COLUMN IF NOT EXISTS resolved_by TEXT;
ALTER TABLE audit_issues ADD COLUMN IF NOT EXISTS dismissed_by TEXT;
ALTER TABLE audit_issues ADD COLUMN IF NOT EXISTS last_actor TEXT;

-- Per-issue lifecycle history: one row per status transition (resolve/dismiss/reopen),
-- with the acting actor and an optional reason. Newest-first when queried by detected order.
CREATE TABLE IF NOT EXISTS audit_issue_history (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  issue_id TEXT NOT NULL REFERENCES audit_issues(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('resolve', 'dismiss', 'reopen')),
  actor TEXT NOT NULL DEFAULT 'system',
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_issue_history_issue ON audit_issue_history(issue_id, created_at DESC);
