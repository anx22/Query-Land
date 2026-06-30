/**
 * ReferringDomainsTable — server-renderable table of referring domains (UX-4 §H).
 *
 * Backlinks are evidence class B (Google/eigene API), so every row carries a
 * ConfidenceBadge B. Source data is plain serialisable ReferringDomain[]; this
 * component does NOT fetch (the page loader owns loading) and uses only pure
 * helpers from backlinks-logic — safe for both server and client trees.
 *
 * Data gap: there is no per-domain history endpoint, so no per-row Sparkline is
 * rendered; the follow-share is shown as a compact distribution bar instead.
 * (Per-domain Sparkline is on the backend backlog — see report.)
 */

import type { ReferringDomain } from "@seo-tool/domain-model";
import { ConfidenceBadge } from "../../components/confidence-badge";
import { formatCount, formatSharePct, sortReferringDomains } from "./backlinks-logic";

export interface ReferringDomainsTableProps {
  domains: ReferringDomain[];
  /** Max rows to render (default 50). */
  limit?: number;
}

export function ReferringDomainsTable({ domains, limit = 50 }: ReferringDomainsTableProps) {
  if (!domains || domains.length === 0) {
    return (
      <div className="backlinks-empty" role="status">
        <strong className="backlinks-empty__title">Noch keine verweisenden Domains</strong>
        <span className="backlinks-empty__hint">
          Verbinden Sie Google Search Console, um eingehende Links und ihre Quell-Domains auszuwerten.
        </span>
        <a className="button secondary compact" href="/settings">Google Search Console verbinden →</a>
      </div>
    );
  }

  const sorted = sortReferringDomains(domains).slice(0, limit);
  const overflow = domains.length - sorted.length;

  return (
    <>
      <table className="backlinks-table">
        <thead>
          <tr>
            <th scope="col">Domain</th>
            <th scope="col" className="backlinks-num">Backlinks</th>
            <th scope="col" className="backlinks-num">Ziel-URLs</th>
            <th scope="col">Follow-Anteil</th>
            <th scope="col">Konfidenz</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((domain) => {
            const followPct = Math.max(0, Math.min(100, domain.followShare * 100));
            return (
              <tr key={domain.domain}>
                <td>
                  <span className="backlinks-domain">{domain.domain}</span>
                </td>
                <td className="backlinks-num">{formatCount(domain.backlinks)}</td>
                <td className="backlinks-num">{formatCount(domain.targetUrls)}</td>
                <td>
                  <div className="backlinks-dist-row__head">
                    <span className="backlinks-dist-row__value">{formatSharePct(domain.followShare)}</span>
                  </div>
                  <div className="backlinks-bar-track" aria-hidden="true">
                    <div className="backlinks-bar-fill backlinks-bar-fill--follow" style={{ width: `${followPct}%` }} />
                  </div>
                </td>
                <td>
                  <ConfidenceBadge level="B" showLabel={false} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {overflow > 0 ? <p className="muted">… und {formatCount(overflow)} weitere Domains</p> : null}
    </>
  );
}
