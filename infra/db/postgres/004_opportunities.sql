-- WP-1.2: Opportunity-Rueckgrat (§6). Die zentrale Einheit verbindet Beobachtung -> Evidenz
-- -> Ursache -> Prioritaet -> Massnahme -> Validierung. Evidenz liegt in eigener Tabelle (§6.3).
CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('technical_fix', 'low_hanging_keyword', 'cannibalization', 'money_page', 'internal_link_gap', 'aeo')),
  affected_urls TEXT NOT NULL DEFAULT '[]',
  affected_keywords TEXT NOT NULL DEFAULT '[]',
  affected_clusters TEXT NOT NULL DEFAULT '[]',
  source_anchor TEXT,
  current_state TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  expected_impact REAL NOT NULL,
  effort REAL NOT NULL,
  confidence REAL NOT NULL,
  business_value REAL NOT NULL,
  urgency REAL NOT NULL,
  priority INTEGER NOT NULL,
  validation_metric TEXT NOT NULL,
  owner TEXT NOT NULL DEFAULT 'system',
  status TEXT NOT NULL CHECK (status IN ('open', 'planned', 'in_progress', 'implemented', 'validated', 'reopened', 'dismissed', 'expired')) DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_opportunities_project_status ON opportunities (project_id, status);

CREATE TABLE IF NOT EXISTS opportunity_evidence (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_confidence TEXT NOT NULL CHECK (source_confidence IN ('A', 'B', 'C', 'D', 'E')),
  metric TEXT NOT NULL,
  before_value TEXT NOT NULL,
  current_value TEXT NOT NULL,
  time_window TEXT NOT NULL,
  affected_entity TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_opportunity_evidence_opportunity ON opportunity_evidence (opportunity_id);
