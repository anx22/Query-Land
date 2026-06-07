/**
 * DistributionBars — server-renderable follow/nofollow + anchor-mix bars (UX-4 §H).
 *
 * Two small bar lists driven by the authority summary:
 *   - Follow / Nofollow split (derived from followRatio via followSplit()).
 *   - Top anchor texts with their share.
 *
 * Pure helpers only (backlinks-logic); no fetch. Graceful empty-states.
 */

import type { AuthoritySummary } from "@seo-tool/domain-model";
import { followSplit, formatCount, formatSharePct } from "./backlinks-logic";

export interface DistributionBarsProps {
  authority: AuthoritySummary | null;
}

export function FollowDistribution({ authority }: DistributionBarsProps) {
  const split = followSplit(authority);
  const total = split.followCount + split.nofollowCount;

  if (total === 0) {
    return (
      <div className="backlinks-empty" role="status">
        <strong className="backlinks-empty__title">Noch keine Link-Typ-Daten</strong>
        <span className="backlinks-empty__hint">Follow- und Nofollow-Anteil erscheinen nach dem ersten Import.</span>
      </div>
    );
  }

  return (
    <div className="backlinks-dist">
      <div className="backlinks-dist-row">
        <div className="backlinks-dist-row__head">
          <span className="backlinks-dist-row__label">Follow</span>
          <span className="backlinks-dist-row__value">
            {formatCount(split.followCount)} · {formatSharePct(split.followRatio)}
          </span>
        </div>
        <div className="backlinks-bar-track" aria-hidden="true">
          <div className="backlinks-bar-fill backlinks-bar-fill--follow" style={{ width: `${split.followPct}%` }} />
        </div>
      </div>
      <div className="backlinks-dist-row">
        <div className="backlinks-dist-row__head">
          <span className="backlinks-dist-row__label">Nofollow</span>
          <span className="backlinks-dist-row__value">
            {formatCount(split.nofollowCount)} · {split.nofollowPct.toLocaleString("de-DE")} %
          </span>
        </div>
        <div className="backlinks-bar-track" aria-hidden="true">
          <div className="backlinks-bar-fill backlinks-bar-fill--nofollow" style={{ width: `${split.nofollowPct}%` }} />
        </div>
      </div>
    </div>
  );
}

export function AnchorDistribution({ authority }: DistributionBarsProps) {
  const anchors = authority?.topAnchors ?? [];

  if (anchors.length === 0) {
    return (
      <div className="backlinks-empty" role="status">
        <strong className="backlinks-empty__title">Noch keine Anchor-Daten</strong>
        <span className="backlinks-empty__hint">Die Verteilung der Ankertexte erscheint nach dem ersten Import.</span>
      </div>
    );
  }

  const maxShare = Math.max(...anchors.map((anchor) => anchor.share), 0.0001);

  return (
    <div className="backlinks-dist">
      {anchors.map((anchor) => {
        const widthPct = Math.max(0, Math.min(100, (anchor.share / maxShare) * 100));
        const label = anchor.anchorText || "(kein Ankertext)";
        return (
          <div className="backlinks-dist-row" key={anchor.anchorText || "(empty)"}>
            <div className="backlinks-dist-row__head">
              <span className="backlinks-dist-row__label" title={label}>{label}</span>
              <span className="backlinks-dist-row__value">
                {formatCount(anchor.count)}× · {formatSharePct(anchor.share)}
              </span>
            </div>
            <div className="backlinks-bar-track" aria-hidden="true">
              <div className="backlinks-bar-fill backlinks-bar-fill--anchor" style={{ width: `${widthPct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
