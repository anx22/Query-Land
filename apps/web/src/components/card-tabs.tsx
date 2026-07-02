"use client";

import type { ReactNode } from "react";

export type CardTabTone = "good" | "warn" | "bad" | "neutral";

export interface CardTabDef {
  id: string;
  label: string;
  /** Small inline glyph/SVG shown before the label. */
  icon?: ReactNode;
  /** One-line context under the label. */
  hint?: string;
  /** Mini-KPI preview shown on the tab itself, so the bar doubles as a mini-dashboard. */
  kpi?: string;
  kpiTone?: CardTabTone;
}

export interface CardTabsProps {
  tabs: CardTabDef[];
  /** Controlled active tab id. */
  active: string;
  onSelect: (id: string) => void;
  ariaLabel?: string;
  /** The active panel content, rendered by the parent (kept controlled/reusable). */
  children: ReactNode;
}

/**
 * CardTabs — richer-than-text tabs: each tab is a small card (icon + label + hint + mini-KPI), so the
 * tab bar is navigation AND a glanceable preview. Controlled: the parent owns the active id (works with
 * useState, a URL param, etc.). Part of the "Schicht 2" work-area vocabulary for content-heavy screens.
 */
export function CardTabs({ tabs, active, onSelect, ariaLabel = "Ansicht wählen", children }: CardTabsProps) {
  return (
    <div className="card-tabs">
      <div className="card-tabs__bar" role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`card-tab${isActive ? " card-tab--active" : ""}`}
              onClick={() => onSelect(tab.id)}
            >
              <span className="card-tab__row">
                {tab.icon ? <span className="card-tab__icon" aria-hidden="true">{tab.icon}</span> : null}
                <span className="card-tab__label">{tab.label}</span>
                {tab.kpi ? <span className={`card-tab__kpi card-tab__kpi--${tab.kpiTone ?? "neutral"}`}>{tab.kpi}</span> : null}
              </span>
              {tab.hint ? <span className="card-tab__hint">{tab.hint}</span> : null}
            </button>
          );
        })}
      </div>
      <div className="card-tabs__panel" role="tabpanel">
        {children}
      </div>
    </div>
  );
}
