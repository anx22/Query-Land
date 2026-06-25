"use client";

/**
 * UrlExplorerTable — paginated table of discovered URLs with an inline detail
 * drawer (T3). Same interaction pattern as IssueGroups: rows are buttons that
 * open an inline <aside> drawer. All formatting lives in the pure, non-"use
 * client" url-explorer module so it stays unit-testable.
 *
 * Server-side pagination controls are rendered by the parent server component
 * (Zurück/Weiter links); this island only owns the row/drawer interaction.
 */

import { useState } from "react";
import {
  deriveDrawerFacts,
  fetchBadgeTone,
  formatHttpStatus,
  formatTimestamp,
  indexabilityBadgeTone,
  indexabilityStateLabel,
  type UrlExplorerRow,
} from "./url-explorer";

export interface UrlExplorerTableProps {
  rows: UrlExplorerRow[];
}

export function UrlExplorerTable({ rows }: UrlExplorerTableProps) {
  const [selected, setSelected] = useState<UrlExplorerRow | null>(null);

  if (rows.length === 0) {
    return (
      <p className="audit-issues-empty">
        Keine entdeckten URLs. Sobald ein Crawl URLs findet, erscheinen sie hier mit HTTP-Status und
        Indexierbarkeit.
      </p>
    );
  }

  return (
    <div className="url-explorer">
      <table className="url-explorer__table">
        <thead>
          <tr>
            <th scope="col">URL</th>
            <th scope="col">HTTP-Status</th>
            <th scope="col">Indexierbarkeit</th>
            <th scope="col">Zuletzt abgerufen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const url = row.discoveredUrl.normalizedUrl || row.discoveredUrl.url;
            const active = selected?.discoveredUrl.id === row.discoveredUrl.id;
            return (
              <tr key={row.discoveredUrl.id} className={active ? "url-explorer__row--active" : undefined}>
                <td>
                  <button
                    type="button"
                    className="url-explorer__url-button"
                    onClick={() => setSelected(row)}
                    aria-expanded={active}
                  >
                    {url}
                  </button>
                </td>
                <td>
                  <span className={`badge ${fetchBadgeTone(row.latestFetch)}`.trim()}>
                    {formatHttpStatus(row.latestFetch)}
                  </span>
                </td>
                <td>
                  <span className={`badge ${indexabilityBadgeTone(row.latestIndexability)}`.trim()}>
                    {indexabilityStateLabel(row.latestIndexability?.state)}
                  </span>
                </td>
                <td className="url-explorer__when">{formatTimestamp(row.latestFetch?.fetchedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selected ? <UrlDetailDrawer row={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function UrlDetailDrawer({ row, onClose }: { row: UrlExplorerRow; onClose: () => void }) {
  const facts = deriveDrawerFacts(row);
  return (
    <aside className="issue-drawer" role="dialog" aria-label="URL-Details" aria-modal="false">
      <div className="issue-drawer__head">
        <span className={`badge ${fetchBadgeTone(row.latestFetch)}`.trim()}>{facts.statusClass}</span>
        <span className="issue-drawer__title issue-drawer__url">{facts.url}</span>
        <button type="button" className="issue-drawer__close" onClick={onClose} aria-label="Details schließen">
          ×
        </button>
      </div>

      <p className="kicker">Abruf</p>
      <dl className="issue-drawer__facts">
        <dt>Statuscode</dt>
        <dd>{facts.statusCode}</dd>
        <dt>Status-Klasse</dt>
        <dd>{facts.statusClass}</dd>
        {facts.redirectTarget ? (
          <>
            <dt>Weiterleitungsziel</dt>
            <dd className="issue-drawer__url">{facts.redirectTarget}</dd>
          </>
        ) : null}
        {facts.contentType ? (
          <>
            <dt>Content-Type</dt>
            <dd>{facts.contentType}</dd>
          </>
        ) : null}
        <dt>Abgerufen</dt>
        <dd>{formatTimestamp(facts.fetchedAt)}</dd>
      </dl>

      <p className="kicker">Indexierbarkeit</p>
      <dl className="issue-drawer__facts">
        <dt>Status</dt>
        <dd>
          <span className={`badge ${indexabilityBadgeTone(row.latestIndexability)}`.trim()}>
            {facts.indexabilityState}
          </span>
          {facts.isIndexable !== null ? (facts.isIndexable ? " · indexierbar" : " · blockiert") : null}
        </dd>
        {facts.canonicalUrl ? (
          <>
            <dt>Canonical</dt>
            <dd className="issue-drawer__url">{facts.canonicalUrl}</dd>
          </>
        ) : null}
        {facts.reasons.length > 0 ? (
          <>
            <dt>Gründe</dt>
            <dd>{facts.reasons.join(", ")}</dd>
          </>
        ) : null}
        <dt>Bewertet</dt>
        <dd>{formatTimestamp(facts.assessedAt)}</dd>
      </dl>

      <p className="kicker">Kontext</p>
      <dl className="issue-drawer__facts">
        <dt>Quelle</dt>
        <dd>{facts.source}</dd>
        <dt>Tiefe</dt>
        <dd>{facts.depth}</dd>
        {facts.discoveredFrom ? (
          <>
            <dt>Entdeckt über</dt>
            <dd className="issue-drawer__url">{facts.discoveredFrom}</dd>
          </>
        ) : null}
      </dl>
    </aside>
  );
}
