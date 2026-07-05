-- 020_audit_issue_rules_open — drop the hard-coded audit_issues.rule CHECK constraint.
--
-- The on-page audit rule set (Master-Spec §5 M2) is now a single source of truth in the domain
-- layer (packages/domain-model AUDIT_ISSUE_RULES) and every write is validated at the API seam
-- against that list (apps/api/src/request-validators.ts). Keeping a parallel, hand-maintained SQL
-- CHECK IN (...) here only creates drift — adding a rule would fail inserts until a matching
-- migration lands. Removing it lets the application layer stay authoritative for the rule vocabulary
-- while the NOT NULL guarantee remains.
ALTER TABLE audit_issues DROP CONSTRAINT IF EXISTS audit_issues_rule_check;
