/**
 * WhyItMatters — a calm one-line "Warum das zählt" benefit row.
 *
 * Design rules (ux-ui-sprint.md Teil 2 §3.5):
 *   - Small row below a card title; color: var(--muted).
 *   - Optional lightbulb icon in var(--primary).
 *   - Exactly one benefit sentence as children or `text` prop.
 *   - Serious-zone: sachlicher Nutzen; dezente Land-Metapher erlaubt, wenn
 *     keine Zahl drinsteht.
 *   - Server-renderable: no "use client" directive.
 *
 * Props:
 *   children    — benefit sentence (required if `text` not provided)
 *   text        — alternative to children (string)
 *   showIcon    — boolean (default true) — show lightbulb glyph
 */

import type { ReactNode } from "react";
import { Icon } from "./icon";

export interface WhyItMattersProps {
  /** Benefit sentence rendered as content */
  children?: ReactNode;
  /** Alternative to children — plain string benefit text */
  text?: string;
  /** Show the lightbulb icon prefix (default: true) */
  showIcon?: boolean;
}

/**
 * WhyItMatters — server-renderable benefit hint row.
 *
 * @example
 *   <WhyItMatters>Zeigt, wo Crawler blockiert werden, bevor es Traffic kostet.</WhyItMatters>
 *   <WhyItMatters text="Striking-Distance-Keywords sind die günstigsten Hebel." />
 *   <WhyItMatters showIcon={false}>Kompakte Variante ohne Icon.</WhyItMatters>
 */
export function WhyItMatters({
  children,
  text,
  showIcon = true,
}: WhyItMattersProps) {
  const content = children ?? text;

  if (!content) return null;

  return (
    <p className="why-it-matters">
      {showIcon && (
        <span className="why-it-matters__icon" aria-hidden="true">
          <Icon name="lightbulb" />
        </span>
      )}
      <span>{content}</span>
    </p>
  );
}
