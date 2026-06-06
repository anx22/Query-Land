-- WP-6.1..6.3: AI Layer & MCP-Schreibtools (§5 Modul 7, §4.4, Welle 7).
-- ai_prompts/ai_answer_snapshots: AI-Visibility-Tracking (LLM-Stub, Confidence E — NIE Evidenz).
-- aeo_assessments: content-basierte AEO-Bewertung (Confidence A; speist die aeo-Opportunity-Klasse).
-- proposals: reviewpflichtige Artefakte aus MCP-Schreibtools (keine Produktiv-Mutation).
CREATE TABLE IF NOT EXISTS ai_prompts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  market TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_project ON ai_prompts (project_id);

CREATE TABLE IF NOT EXISTS ai_answer_snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  prompt_id TEXT NOT NULL REFERENCES ai_prompts(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  cited_domains TEXT NOT NULL DEFAULT '[]',
  brand_mentioned INTEGER NOT NULL DEFAULT 0,
  our_cited INTEGER NOT NULL DEFAULT 0,
  captured_at TEXT NOT NULL,
  source_confidence TEXT NOT NULL CHECK (source_confidence IN ('A', 'B', 'C', 'D', 'E'))
);
CREATE INDEX IF NOT EXISTS idx_ai_answer_snapshots_prompt ON ai_answer_snapshots (prompt_id, captured_at);

CREATE TABLE IF NOT EXISTS aeo_assessments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  score INTEGER NOT NULL,
  checks TEXT NOT NULL DEFAULT '[]',
  source_confidence TEXT NOT NULL CHECK (source_confidence IN ('A', 'B', 'C', 'D', 'E')),
  assessed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_aeo_assessments_site ON aeo_assessments (site_id, url, assessed_at);

CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('dev_ticket', 'fix_pr')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  opportunity_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'accepted', 'rejected')) DEFAULT 'proposed',
  source TEXT NOT NULL DEFAULT 'mcp',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_proposals_project ON proposals (project_id, created_at);
