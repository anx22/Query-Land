/**
 * GlossarLink — a quiet inline link to a term on the /glossar page.
 *
 * For use inside help text where TermTooltip's hover popover would be too heavy.
 * Renders a subtle underlined link to /glossar#<slug>. Server-renderable.
 */

import type { ReactNode } from "react";

export interface GlossarLinkProps {
  children: ReactNode;
  /** Glossary key override; defaults to the visible text. */
  term?: string;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function GlossarLink({ children, term }: GlossarLinkProps) {
  const key = term ?? (typeof children === "string" ? children : "");
  return (
    <a className="glossar-link" href={`/glossar#${slugify(key)}`}>
      {children}
    </a>
  );
}
