/**
 * HelpPanel — an explanatory panel with a deliberately different look than the
 * productive .card surfaces. Tinted background, info accent and a "Hilfe" label,
 * so help content is layout-separated from data/action panels at a glance.
 *
 * Use as an <aside> next to or above productive content — never to hold live
 * data or primary actions.
 */

import type { ReactNode } from "react";
import { Icon } from "./icon";

export interface HelpPanelProps {
  title: string;
  children: ReactNode;
  /** Eyebrow label (default "Hilfe"). */
  eyebrow?: string;
}

export function HelpPanel({ title, children, eyebrow = "Hilfe" }: HelpPanelProps) {
  return (
    <aside className="help-panel" role="note">
      <div className="help-panel__header">
        <span className="help-panel__icon" aria-hidden="true">
          <Icon name="info" />
        </span>
        <div>
          <span className="help-panel__eyebrow">{eyebrow}</span>
          <strong className="help-panel__title">{title}</strong>
        </div>
      </div>
      <div className="help-panel__body">{children}</div>
    </aside>
  );
}
