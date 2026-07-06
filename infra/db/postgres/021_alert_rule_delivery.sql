-- 021_alert_rule_delivery — optional delivery channel/target per alert rule.
--
-- Alert rules previously had only metric/comparator/threshold, so a triggered alert could only be
-- recorded as an event, never delivered (M6 loose end). These nullable columns let a rule name a
-- delivery channel (webhook/email/slack) + target, reusing the existing report-delivery transport.
-- Null channel → record the event only (unchanged behaviour for existing rules).
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS target TEXT;

-- Drop the hand-maintained metric CHECK: the metric vocabulary (incl. the new search_clicks
-- traffic-drop metric) is now a single source of truth in the domain layer (ALERT_METRICS) and
-- validated at the API seam, so a parallel SQL CHECK IN (...) only creates drift (same rationale as
-- migration 020 for audit_issues). NOT NULL on metric remains.
ALTER TABLE alert_rules DROP CONSTRAINT IF EXISTS alert_rules_metric_check;
