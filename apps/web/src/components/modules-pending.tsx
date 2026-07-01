/**
 * ModulesPending — the calm "first-run" panel shown INSTEAD of a screen's full machinery
 * (KPI grids, charts, gauges, filter rows) before any analysis has produced data.
 *
 * Rationale (design review): rendering the complete production layout in empty state makes
 * every screen a wall of grey "noch keine Daten" boxes that reads as broken. The two-mode
 * approach hides the machinery until there is something true to show, leaving one clear next
 * action — the "powerful under a super-easy, guided mask" goal.
 */
import { Icon, type IconName } from "./icon";

export interface ModulesPendingProps {
  /** Short headline (e.g. "Bereit für Ihre erste Analyse"). */
  title: string;
  /** One sentence explaining what will appear here once data exists. */
  text: string;
  /** Primary action target. */
  ctaHref: string;
  /** Primary action label. */
  ctaLabel: string;
  /** Optional line icon (defaults to a neutral chart/description glyph). */
  icon?: IconName;
  /** When true, render the CTA disabled-looking (e.g. a prerequisite isn't met yet). */
  ctaDisabled?: boolean;
  /** Reason shown under a disabled CTA. */
  disabledReason?: string;
  /** CTA emphasis. "primary" (filled, default) or "secondary" (outline) — use secondary
   *  when this panel's action is a soft "next step" rather than THE one orange CTA on screen. */
  ctaVariant?: "primary" | "secondary";
}

export function ModulesPending({
  title,
  text,
  ctaHref,
  ctaLabel,
  icon = "description",
  ctaDisabled = false,
  disabledReason,
  ctaVariant = "primary",
}: ModulesPendingProps) {
  return (
    <section className="card modules-pending" aria-label={title}>
      <span className="modules-pending__icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <h2 className="modules-pending__title">{title}</h2>
      <p className="modules-pending__text">{text}</p>
      {ctaDisabled ? (
        <div className="locked-action">
          <button className="button" type="button" disabled>{ctaLabel}</button>
          {disabledReason ? (
            <span className="locked-action__reason">
              <Icon name="lock" />
              {disabledReason}
            </span>
          ) : null}
        </div>
      ) : (
        <a className={ctaVariant === "secondary" ? "button secondary" : "button"} href={ctaHref}>{ctaLabel}</a>
      )}
    </section>
  );
}
