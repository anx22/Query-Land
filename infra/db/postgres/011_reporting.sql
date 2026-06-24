-- WP-5.1..5.4: Reporting & Alerts (§5 Modul 6, Welle 6). Reports sind generierte Snapshots aus den
-- vorhandenen Domänen; Deliveries protokollieren Versand (Stub-Kanäle); Schedules treiben die
-- Automatisierung (Wochenreport); Alert-Regeln + Events machen Schwellwert-Verletzungen sichtbar.
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('weekly_summary', 'opportunity_digest', 'authority_report')),
  title TEXT NOT NULL,
  sections TEXT NOT NULL DEFAULT '[]',
  generated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_project ON reports (project_id, generated_at);

CREATE TABLE IF NOT EXISTS report_deliveries (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'slack')),
  target TEXT,
  status TEXT NOT NULL,
  delivered_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_report_deliveries_report ON report_deliveries (report_id);

CREATE TABLE IF NOT EXISTS report_schedules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('weekly_summary', 'opportunity_digest', 'authority_report')),
  cadence TEXT NOT NULL CHECK (cadence IN ('weekly', 'monthly')),
  channel TEXT CHECK (channel IN ('email', 'slack')),
  target TEXT,
  last_run_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_report_schedules_project ON report_schedules (project_id);

CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  metric TEXT NOT NULL CHECK (metric IN ('visibility_score', 'health_score', 'open_opportunities', 'referring_domains')),
  comparator TEXT NOT NULL CHECK (comparator IN ('lt', 'lte', 'gt', 'gte')),
  threshold REAL NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alert_rules_project ON alert_rules (project_id);

CREATE TABLE IF NOT EXISTS alert_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  comparator TEXT NOT NULL,
  threshold REAL NOT NULL,
  observed_value REAL NOT NULL,
  triggered INTEGER NOT NULL,
  evaluated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alert_events_project ON alert_events (project_id, evaluated_at);
