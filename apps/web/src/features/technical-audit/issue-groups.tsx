"use client";

/**
 * IssueGroups — collapsible audit-issue groups for the Technical Audit overview
 * (UX-6, spec §5.3 / §5.4-style overview). Replaces a flat issue table.
 *
 * Each group = rule + severity, with an impact score (count × severity weight),
 * a severity badge, and a collapsible list of sample issues. Factual copy only.
 *
 * Serious-Zone: no metaphor; severity colors are functional and paired with text.
 * A11y: native <details>/<summary> (keyboard + screen-reader friendly).
 * Empty-state handled by the parent (renders nothing when there are no groups).
 */

import { useEffect, useState } from "react";
import type { AuditIssueHistoryEntry, AuditIssueRecord, AuditIssueSeverity } from "@seo-tool/domain-model";
import type { IssueGroup } from "../../lib/audit-api";
import { dismissIssueAction, loadIssueHistoryAction, reopenIssueAction, resolveIssueAction } from "./actions";
import { availableIssueActions, formatHistoryEntry, ISSUE_ACTION_LABEL, issueStatusLabel, type IssueAction } from "./issue-actions";

const SEVERITY_BADGE: Record<AuditIssueSeverity, string> = {
  critical: "danger",
  high: "warning",
  medium: "primary",
  low: "",
};

const SEVERITY_LABEL: Record<AuditIssueSeverity, string> = {
  critical: "Kritisch",
  high: "Hoch",
  medium: "Mittel",
  low: "Niedrig",
};

const RULE_LABEL: Record<IssueGroup["rule"], string> = {
  http_error: "HTTP-Fehler",
  redirect_chain: "Redirect-Kette",
  missing_title: "Fehlender Title",
  duplicate_title: "Doppelter Title",
  canonical_mismatch: "Canonical-Abweichung",
  broken_link: "Defekter Link",
};

export function ruleLabel(rule: IssueGroup["rule"]): string {
  return RULE_LABEL[rule] ?? rule;
}

const ACTION_FN: Record<IssueAction, (formData: FormData) => void | Promise<void>> = {
  resolve: resolveIssueAction,
  dismiss: dismissIssueAction,
  reopen: reopenIssueAction,
};

export interface IssueGroupsProps {
  groups: IssueGroup[];
}

export function IssueGroups({ groups }: IssueGroupsProps) {
  const [selected, setSelected] = useState<AuditIssueRecord | null>(null);

  if (groups.length === 0) {
    return (
      <p className="audit-issues-empty">
        Keine offenen Issues. Sobald ein Crawl Probleme findet, werden sie hier nach Regel und
        Schweregrad gruppiert.
      </p>
    );
  }

  return (
    <div className="audit-issue-groups">
      {groups.map((group, index) => (
        <details className="audit-issue-group" key={group.key} open={index === 0}>
          <summary className="audit-issue-group__summary">
            <span className={`badge ${SEVERITY_BADGE[group.severity]}`.trim()}>
              {SEVERITY_LABEL[group.severity]}
            </span>
            <span className="audit-issue-group__rule">{ruleLabel(group.rule)}</span>
            <span className="audit-issue-group__count">
              {group.count.toLocaleString("de-DE")} {group.count === 1 ? "Issue" : "Issues"}
            </span>
            <span className="audit-issue-group__impact" title="Impact = Anzahl × Schweregrad-Gewicht">
              Impact {group.impact.toLocaleString("de-DE")}
            </span>
          </summary>
          <ul className="audit-issue-group__list">
            {group.issues.map((issue) => (
              <li key={issue.id}>
                <button
                  type="button"
                  className={`audit-issue-group__item${selected?.id === issue.id ? " audit-issue-group__item--active" : ""}`}
                  onClick={() => setSelected(issue)}
                  aria-expanded={selected?.id === issue.id}
                >
                  <span className="audit-issue-group__url">{issue.url}</span>
                  <span className="audit-issue-group__message">{issue.message}</span>
                </button>
              </li>
            ))}
            {group.count > group.issues.length ? (
              <li className="audit-issue-group__more">
                + {(group.count - group.issues.length).toLocaleString("de-DE")} weitere
              </li>
            ) : null}
          </ul>
        </details>
      ))}

      {selected ? <IssueDetailDrawer issue={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function IssueDetailDrawer({ issue, onClose }: { issue: AuditIssueRecord; onClose: () => void }) {
  const [history, setHistory] = useState<AuditIssueHistoryEntry[] | null>(null);

  // Load the issue's lifecycle history when the drawer opens / switches issue.
  useEffect(() => {
    let cancelled = false;
    setHistory(null);
    loadIssueHistoryAction(issue.projectId, issue.siteId, issue.id)
      .then((entries) => {
        if (!cancelled) setHistory(entries);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [issue.projectId, issue.siteId, issue.id]);

  const actions = availableIssueActions(issue);

  return (
    <aside className="issue-drawer" role="dialog" aria-label="Issue-Details" aria-modal="false">
      <div className="issue-drawer__head">
        <span className={`badge ${SEVERITY_BADGE[issue.severity]}`.trim()}>{SEVERITY_LABEL[issue.severity]}</span>
        <span className="issue-drawer__title">{ruleLabel(issue.rule)}</span>
        <button type="button" className="issue-drawer__close" onClick={onClose} aria-label="Details schließen">
          ×
        </button>
      </div>
      <dl className="issue-drawer__facts">
        <dt>URL</dt>
        <dd className="issue-drawer__url">{issue.url}</dd>
        <dt>Meldung</dt>
        <dd>{issue.message}</dd>
        <dt>Status</dt>
        <dd>{issueStatusLabel(issue)}</dd>
        <dt>Erkannt</dt>
        <dd>{new Date(issue.detectedAt).toLocaleString("de-DE")}</dd>
        {issue.resolvedAt ? (
          <>
            <dt>Gelöst</dt>
            <dd>{new Date(issue.resolvedAt).toLocaleString("de-DE")}</dd>
          </>
        ) : null}
        {issue.dismissedAt ? (
          <>
            <dt>Verworfen</dt>
            <dd>{new Date(issue.dismissedAt).toLocaleString("de-DE")}</dd>
          </>
        ) : null}
        {issue.dismissReason ? (
          <>
            <dt>Grund</dt>
            <dd>{issue.dismissReason}</dd>
          </>
        ) : null}
      </dl>
      <div className="issue-drawer__actions">
        {actions.map((action) =>
          action === "dismiss" ? (
            <form key={action} className="issue-drawer__dismiss" action={ACTION_FN[action]}>
              <input type="hidden" name="projectId" value={issue.projectId} />
              <input type="hidden" name="siteId" value={issue.siteId} />
              <input type="hidden" name="issueId" value={issue.id} />
              <label className="issue-drawer__reason-label" htmlFor={`dismiss-reason-${issue.id}`}>
                Grund (optional)
              </label>
              <textarea
                id={`dismiss-reason-${issue.id}`}
                name="reason"
                className="issue-drawer__reason"
                rows={2}
                placeholder="z. B. Falsch-positiv, wird über JS gesetzt"
              />
              <button type="submit" className="button compact">
                {ISSUE_ACTION_LABEL[action]}
              </button>
            </form>
          ) : (
            <form key={action} action={ACTION_FN[action]}>
              <input type="hidden" name="projectId" value={issue.projectId} />
              <input type="hidden" name="siteId" value={issue.siteId} />
              <input type="hidden" name="issueId" value={issue.id} />
              <button type="submit" className="button compact">
                {ISSUE_ACTION_LABEL[action]}
              </button>
            </form>
          )
        )}
      </div>

      <section className="issue-drawer__history" aria-label="Verlauf">
        <h3 className="issue-drawer__history-title">Verlauf</h3>
        {history === null ? (
          <p className="issue-drawer__history-empty">Wird geladen…</p>
        ) : history.length === 0 ? (
          <p className="issue-drawer__history-empty">Noch keine Statusänderungen.</p>
        ) : (
          <ol className="issue-drawer__history-list">
            {history.map((entry) => (
              <li key={entry.id} className="issue-drawer__history-item">
                {formatHistoryEntry(entry)}
              </li>
            ))}
          </ol>
        )}
      </section>
    </aside>
  );
}
