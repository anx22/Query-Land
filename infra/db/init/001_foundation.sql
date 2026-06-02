CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE project_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE site_scope_type AS ENUM ('domain', 'subdomain', 'folder');
CREATE TYPE source_confidence AS ENUM ('A', 'B', 'C', 'D', 'E');
CREATE TYPE integration_status AS ENUM ('disconnected', 'pending', 'connected', 'degraded', 'error');
CREATE TYPE job_status AS ENUM ('queued', 'running', 'succeeded', 'failed', 'cancelled');
CREATE TYPE mapping_confidence AS ENUM ('exact', 'manifest', 'heuristic', 'unknown');

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status project_status NOT NULL DEFAULT 'draft',
  default_locale text NOT NULL DEFAULT 'de-DE',
  markets jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scope_type site_scope_type NOT NULL,
  base_url text NOT NULL,
  crawl_frequency text NOT NULL DEFAULT 'weekly',
  business_value integer NOT NULL CHECK (business_value BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, base_url)
);

CREATE TABLE integration_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status integration_status NOT NULL DEFAULT 'pending',
  source_confidence source_confidence NOT NULL,
  auth_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  quota_remaining integer,
  freshness timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, provider)
);

CREATE TABLE raw_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id uuid REFERENCES integration_accounts(id) ON DELETE SET NULL,
  source_type text NOT NULL,
  source_confidence source_confidence NOT NULL,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE normalized_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_event_id uuid REFERENCES raw_events(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  metric text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  value numeric NOT NULL,
  measured_at timestamptz NOT NULL,
  source_confidence source_confidence NOT NULL
);

CREATE TABLE job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  status job_status NOT NULL DEFAULT 'queued',
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE source_repos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  repo_url text NOT NULL,
  default_branch text NOT NULL DEFAULT 'main',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_repo_id uuid NOT NULL REFERENCES source_repos(id) ON DELETE CASCADE,
  name text NOT NULL,
  component text NOT NULL,
  repo_path text NOT NULL,
  UNIQUE (source_repo_id, repo_path)
);

CREATE TABLE url_template_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url_pattern text NOT NULL,
  template_id uuid NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  confidence mapping_confidence NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, url_pattern, template_id)
);

CREATE TABLE deploy_markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  commit_sha text NOT NULL,
  deployed_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text NOT NULL DEFAULT ''
);
