/**
 * ReadinessBanner — prominent gate notice shown on pages whose waterfall
 * prerequisites are not yet met. Pure/server: takes the first unmet
 * prerequisite and renders an explanation + next-step CTA. Renders nothing
 * when the route is unlocked.
 */

import Link from "next/link";
import { Icon } from "./icon";
import { PREREQUISITE_META, type Prerequisite } from "../lib/readiness";

export interface ReadinessBannerProps {
  unmet: Prerequisite | null;
}

export function ReadinessBanner({ unmet }: ReadinessBannerProps) {
  if (!unmet) return null;
  const meta = PREREQUISITE_META[unmet];

  return (
    <div className="readiness-banner" role="status">
      <span className="readiness-banner__icon" aria-hidden="true">
        <Icon name="lock" />
      </span>
      <div className="readiness-banner__body">
        <strong className="readiness-banner__title">Bereich noch nicht freigeschaltet</strong>
        <p className="readiness-banner__text">{meta.banner}</p>
      </div>
      <Link className="button primary readiness-banner__cta" href={meta.ctaHref}>
        {meta.ctaLabel}
      </Link>
    </div>
  );
}
