/**
 * NextStep — a calm "continue along the flow" hand-off shown at the bottom of a stage that has
 * produced data. Makes the documented wave sequence (Analyse → Keywords → Chancen → Content →
 * Reports, all feeding the Opportunity loop) visible as one continuous flow instead of isolated
 * screens. Secondary CTA by design — it must never compete with the page's primary action.
 *
 * Data-gated by the caller: only render this once the current stage actually has something to hand
 * off, otherwise it becomes a dead pointer on an empty first-run screen.
 */
export interface NextStepProps {
  /** One line: what the user just achieved and why the next stage follows. */
  hint: string;
  href: string;
  ctaLabel: string;
  /** Eyebrow label (default "Nächster Schritt im Fluss"). */
  eyebrow?: string;
}

export function NextStep({ hint, href, ctaLabel, eyebrow = "Nächster Schritt im Fluss" }: NextStepProps) {
  return (
    <section className="card next-step" aria-label={eyebrow}>
      <div className="next-step__body">
        <p className="kicker">{eyebrow}</p>
        <p className="next-step__hint">{hint}</p>
      </div>
      <a className="button secondary" href={href}>{ctaLabel}</a>
    </section>
  );
}
