export const sqliteFoundationSchema = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')) DEFAULT 'owner',
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')) DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'archived')) DEFAULT 'draft',
  default_locale TEXT NOT NULL DEFAULT 'de-DE',
  markets TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('domain', 'subdomain', 'folder')),
  base_url TEXT NOT NULL,
  crawl_frequency TEXT NOT NULL DEFAULT 'weekly',
  business_value INTEGER NOT NULL CHECK (business_value BETWEEN 1 AND 100),
  created_at TEXT NOT NULL,
  UNIQUE (project_id, base_url)
);

CREATE TABLE IF NOT EXISTS discovered_urls (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('seed', 'sitemap', 'link')),
  discovered_from TEXT,
  depth INTEGER NOT NULL DEFAULT 0,
  discovered_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (project_id, site_id, normalized_url)
);

CREATE INDEX IF NOT EXISTS idx_discovered_urls_project_site ON discovered_urls(project_id, site_id, discovered_at);


CREATE TABLE IF NOT EXISTS url_fetch_results (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  discovered_url_id TEXT NOT NULL REFERENCES discovered_urls(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  final_url TEXT NOT NULL,
  status_code INTEGER,
  status_class TEXT NOT NULL CHECK (status_class IN ('success', 'redirect', 'client_error', 'server_error', 'network_error')),
  headers TEXT NOT NULL DEFAULT '{}',
  redirect_chain TEXT NOT NULL DEFAULT '[]',
  fetched_at TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_url_fetch_results_discovered_url ON url_fetch_results(discovered_url_id, fetched_at DESC);


CREATE TABLE IF NOT EXISTS url_indexability_assessments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  discovered_url_id TEXT NOT NULL REFERENCES discovered_urls(id) ON DELETE CASCADE,
  fetch_result_id TEXT REFERENCES url_fetch_results(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('indexable', 'blocked_by_status', 'blocked_by_meta', 'blocked_by_x_robots', 'blocked_by_robots', 'canonicalized')),
  is_indexable INTEGER NOT NULL CHECK (is_indexable IN (0, 1)),
  reasons TEXT NOT NULL DEFAULT '[]',
  canonical_url TEXT,
  assessed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_url_indexability_discovered_url ON url_indexability_assessments(discovered_url_id, assessed_at DESC);


CREATE TABLE IF NOT EXISTS crawl_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')) DEFAULT 'running',
  trigger TEXT NOT NULL CHECK (trigger IN ('manual', 'scheduled', 'deploy')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  summary TEXT NOT NULL DEFAULT '{}',
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_crawl_runs_project_site ON crawl_runs(project_id, site_id, started_at DESC);

CREATE TABLE IF NOT EXISTS audit_issues (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  discovered_url_id TEXT REFERENCES discovered_urls(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  rule TEXT NOT NULL CHECK (rule IN ('http_error', 'redirect_chain', 'missing_title', 'duplicate_title', 'canonical_mismatch', 'broken_link')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  message TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  resolved_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_issues_project_site ON audit_issues(project_id, site_id, resolved_at, severity);

CREATE TABLE IF NOT EXISTS crawl_health_scores (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  total_issues INTEGER NOT NULL,
  issue_counts TEXT NOT NULL DEFAULT '{}',
  generated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crawl_health_scores_project_site ON crawl_health_scores(project_id, site_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS integration_accounts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('disconnected', 'pending', 'connected', 'degraded', 'error')) DEFAULT 'pending',
  source_confidence TEXT NOT NULL CHECK (source_confidence IN ('A', 'B', 'C', 'D', 'E')),
  auth_config TEXT NOT NULL DEFAULT '{}',
  quota_remaining INTEGER,
  freshness TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (project_id, provider)
);

CREATE TABLE IF NOT EXISTS raw_events (
  id TEXT PRIMARY KEY,
  integration_account_id TEXT REFERENCES integration_accounts(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_confidence TEXT NOT NULL CHECK (source_confidence IN ('A', 'B', 'C', 'D', 'E')),
  payload TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS normalized_metrics (
  id TEXT PRIMARY KEY,
  raw_event_id TEXT REFERENCES raw_events(id) ON DELETE SET NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  value REAL NOT NULL,
  measured_at TEXT NOT NULL,
  source_confidence TEXT NOT NULL CHECK (source_confidence IN ('A', 'B', 'C', 'D', 'E'))
);

CREATE TABLE IF NOT EXISTS job_queue (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')) DEFAULT 'queued',
  idempotency_key TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL DEFAULT '{}',
  attempts INTEGER NOT NULL DEFAULT 0,
  scheduled_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_repos (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  repo_url TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  source_repo_id TEXT NOT NULL REFERENCES source_repos(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  component TEXT NOT NULL,
  repo_path TEXT NOT NULL,
  UNIQUE (source_repo_id, repo_path)
);

CREATE TABLE IF NOT EXISTS url_template_map (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url_pattern TEXT NOT NULL,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  confidence TEXT NOT NULL CHECK (confidence IN ('exact', 'manifest', 'heuristic', 'unknown')) DEFAULT 'unknown',
  created_at TEXT NOT NULL,
  UNIQUE (project_id, url_pattern, template_id)
);

CREATE TABLE IF NOT EXISTS deploy_markers (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  commit_sha TEXT NOT NULL,
  deployed_at TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT ''
);
`;
