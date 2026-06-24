-- Postgres port: the original SQLite migration rebuilt the table to widen the
-- `state` CHECK constraint (SQLite cannot ALTER a CHECK). Postgres can swap the
-- constraint in place, which is idempotent and safe on a fresh database where
-- 001 already created the final form.
ALTER TABLE url_indexability_assessments
  DROP CONSTRAINT IF EXISTS url_indexability_assessments_state_check;

ALTER TABLE url_indexability_assessments
  ADD CONSTRAINT url_indexability_assessments_state_check
  CHECK (state IN (
    'indexable',
    'blocked_by_status',
    'blocked_by_meta',
    'blocked_by_x_robots',
    'blocked_by_robots',
    'canonicalized'
  ));

CREATE INDEX IF NOT EXISTS idx_url_indexability_discovered_url
  ON url_indexability_assessments(discovered_url_id, assessed_at DESC);
