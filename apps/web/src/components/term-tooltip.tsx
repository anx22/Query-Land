"use client";

/**
 * TermTooltip (also exported as Term) — accessible glossary tooltip.
 *
 * Design rules (ux-ui-sprint.md Teil 2 §3.4):
 *   - Dotted underline marks glossary terms.
 *   - Popover opens on hover AND keyboard focus.
 *   - Dismiss on Escape key.
 *   - Respects prefers-reduced-motion (animation in globals.css is gated on
 *     `prefers-reduced-motion: no-preference`).
 *   - Definition pulled from glossary.ts single source.
 *   - "use client" required for interactivity (hover/focus/keyboard state).
 *
 * Props:
 *   children   — the term text to display (required)
 *   term       — optional override for the glossary lookup key
 *                (defaults to children cast to string)
 *   glossarUrl — base URL for the glossar page (default: "/glossar")
 */

import { useCallback, useId, useRef, useState } from "react";
import { lookupGlossaryTerm } from "../lib/glossary";

export interface TermTooltipProps {
  /** The term text rendered to the user */
  children: string;
  /**
   * Glossary lookup key override. If omitted, `children` is used as the key.
   * Useful when the displayed text differs from the canonical term name.
   */
  term?: string;
  /** Base URL for the /glossar page — appended with `#<slug>` */
  glossarUrl?: string;
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/**
 * TermTooltip / Term — interactive glossary tooltip component.
 *
 * @example
 *   <TermTooltip>Crawl</TermTooltip>
 *   <TermTooltip term="indexierbarkeit">Indexierbarkeit</TermTooltip>
 */
export function TermTooltip({
  children,
  term,
  glossarUrl = "/glossar",
}: TermTooltipProps) {
  const lookupKey = term ?? children;
  const definition = lookupGlossaryTerm(lookupKey);

  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.blur();
      }
    },
    []
  );

  // If the term has no definition, render plain text
  if (!definition) {
    return <>{children}</>;
  }

  const glossarHref = `${glossarUrl}#${slugify(lookupKey)}`;

  return (
    <span
      ref={triggerRef}
      className="term"
      tabIndex={0}
      role="button"
      aria-describedby={open ? popoverId : undefined}
      aria-label={`${children} — Begriff im Glossar`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={handleKeyDown}
    >
      {children}

      {open && (
        <span
          id={popoverId}
          className="term__popover"
          role="tooltip"
          aria-live="polite"
        >
          <span className="term__popover-title">{children}</span>
          <span className="term__popover-def">{definition}</span>
          <a
            href={glossarHref}
            className="term__popover-link"
            tabIndex={-1}
            aria-label={`${children} im Glossar ansehen`}
          >
            Im Glossar ansehen →
          </a>
        </span>
      )}
    </span>
  );
}

/** Convenience alias — shorter name for inline use */
export { TermTooltip as Term };
