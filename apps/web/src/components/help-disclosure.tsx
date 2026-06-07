/**
 * HelpDisclosure — a collapsible "Ausklapper" for longer help text.
 *
 * Native <details>/<summary>, so it is accessible and works without JS and is
 * server-renderable. Use for explanatory content that would otherwise crowd a
 * productive panel: collapsed by default, expanded on demand.
 */

import type { ReactNode } from "react";
import { Icon } from "./icon";

export interface HelpDisclosureProps {
  /** Summary label shown when collapsed (default "Wie funktioniert das?"). */
  summary?: string;
  children: ReactNode;
  /** Render expanded initially. */
  defaultOpen?: boolean;
}

export function HelpDisclosure({
  summary = "Wie funktioniert das?",
  children,
  defaultOpen = false,
}: HelpDisclosureProps) {
  return (
    <details className="help-disclosure" open={defaultOpen}>
      <summary className="help-disclosure__summary">
        <span className="help-disclosure__icon" aria-hidden="true">
          <Icon name="info" />
        </span>
        <span className="help-disclosure__label">{summary}</span>
        <span className="help-disclosure__chevron" aria-hidden="true">
          <Icon name="chevron" />
        </span>
      </summary>
      <div className="help-disclosure__body">{children}</div>
    </details>
  );
}
