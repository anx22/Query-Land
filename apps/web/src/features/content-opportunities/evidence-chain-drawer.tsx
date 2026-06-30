"use client";

/**
 * Evidence-Chain-Drawer (spec §4.11) — the product differentiator.
 *
 * Makes the §6 unit tangible: Beobachtung → Evidenz → Ursache → Maßnahme →
 * Validierung, incl. before/current. Strict serious-zone: factual, no metaphor,
 * every evidence card carries a ConfidenceBadge + source + before→current.
 *
 * Pure client island: receives a fully-resolved Opportunity (plain object) and
 * an onClose callback. Closes on Escape and on backdrop click.
 */

import { useRef } from "react";
import type { Evidence, Opportunity, SourceConfidence } from "@seo-tool/domain-model";
import { ConfidenceBadge, confidenceMeta, type ConfidenceLevel } from "../../components/confidence-badge";
import { confidenceToLevel, opportunityTypeLabel, opportunityStatusLabel } from "../../lib/board-logic";
import { useFocusTrap } from "../../lib/use-focus-trap";

export interface EvidenceChainDrawerProps {
  opportunity: Opportunity | null;
  onClose: () => void;
}

/** SourceConfidence on Evidence is already an A–E letter — normalise defensively. */
function evidenceLevel(value: SourceConfidence): ConfidenceLevel {
  const upper = String(value).toUpperCase();
  if (upper === "A" || upper === "B" || upper === "C" || upper === "D" || upper === "E") {
    return upper;
  }
  return "E";
}

function formatValue(value: number | string): string {
  if (typeof value === "number") return value.toLocaleString("de-DE", { maximumFractionDigits: 2 });
  return value;
}

/** Build the Content-Workspace drill-down href for an opportunity (url + id context). */
function workspaceDrillHref(opportunity: Opportunity): string {
  const params = new URLSearchParams({ opportunityId: opportunity.id });
  const url = opportunity.affectedUrls[0];
  if (url) params.set("url", url);
  return `/content-workspace?${params.toString()}`;
}

export function EvidenceChainDrawer({ opportunity, onClose }: EvidenceChainDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);
  useFocusTrap(drawerRef, opportunity !== null, onClose);

  if (!opportunity) return null;

  const overallLevel = confidenceToLevel(opportunity.confidence);

  return (
    <div className="board-drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        ref={drawerRef}
        className="board-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Evidenz-Kette: ${opportunityTypeLabel(opportunity.type)}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="board-drawer__head">
          <div>
            <p className="kicker">Evidenz-Kette · {opportunityTypeLabel(opportunity.type)}</p>
            <h2 className="board-drawer__title">Priorität {opportunity.priority}</h2>
          </div>
          <button type="button" className="button secondary compact" onClick={onClose} aria-label="Drawer schließen">
            Schließen
          </button>
        </header>

        <div className="board-drawer__badges">
          <span className={`status ${opportunity.status}`}>{opportunityStatusLabel(opportunity.status)}</span>
          <ConfidenceBadge level={overallLevel} />
          <span className="badge">Wirkung {opportunity.expectedImpact}</span>
          <span className="badge">Aufwand {opportunity.effort}</span>
        </div>

        <ol className="board-chain">
          {/* 1 — Beobachtung */}
          <li className="board-chain__step">
            <span className="board-chain__marker" aria-hidden="true">1</span>
            <div className="board-chain__body">
              <p className="board-chain__label">Beobachtung (Ist-Zustand)</p>
              <p className="board-chain__text">{opportunity.currentState || "Kein Ist-Zustand erfasst."}</p>
            </div>
          </li>

          {/* 2 — Evidenz */}
          <li className="board-chain__step">
            <span className="board-chain__marker" aria-hidden="true">2</span>
            <div className="board-chain__body">
              <p className="board-chain__label">Evidenz</p>
              {opportunity.evidence.length > 0 ? (
                <ul className="board-evidence-list">
                  {opportunity.evidence.map((evidence: Evidence, index) => {
                    const level = evidenceLevel(evidence.sourceConfidence);
                    return (
                      <li key={`${evidence.source}-${evidence.metric}-${index}`} className="board-evidence-card">
                        <div className="board-evidence-card__head">
                          <span className="board-evidence-card__source">{evidence.source}</span>
                          <ConfidenceBadge level={level} />
                        </div>
                        <p className="board-evidence-card__metric">{evidence.metric}</p>
                        <p className="board-evidence-card__delta">
                          <span className="board-evidence-card__before">{formatValue(evidence.beforeValue)}</span>
                          <span aria-hidden="true"> → </span>
                          <span className="board-evidence-card__current">{formatValue(evidence.currentValue)}</span>
                        </p>
                        <p className="board-evidence-card__meta muted">
                          {evidence.affectedEntity} · {evidence.timeWindow} · {confidenceMeta(level).source}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="board-chain__text muted">Keine belegte Evidenz hinterlegt.</p>
              )}
            </div>
          </li>

          {/* 3 — Maßnahme */}
          <li className="board-chain__step">
            <span className="board-chain__marker" aria-hidden="true">3</span>
            <div className="board-chain__body">
              <p className="board-chain__label">Empfohlene Maßnahme</p>
              <p className="board-chain__text">{opportunity.recommendedAction || "Keine Maßnahme definiert."}</p>
              {/* Drill-down into the Content Workspace, carrying the affected URL +
                  opportunity id so a brief can be created in context. */}
              <p className="board-chain__text">
                <a className="button compact secondary" href={workspaceDrillHref(opportunity)}>
                  Im Content Workspace bearbeiten →
                </a>
              </p>
            </div>
          </li>

          {/* 4 — Validierung */}
          <li className="board-chain__step board-chain__step--last">
            <span className="board-chain__marker" aria-hidden="true">4</span>
            <div className="board-chain__body">
              <p className="board-chain__label">Validierung</p>
              <p className="board-chain__text">{opportunity.validationMetric || "Keine Validierungsmetrik definiert."}</p>
              <p className="board-chain__text muted">
                Status: <span className={`status ${opportunity.status}`}>{opportunityStatusLabel(opportunity.status)}</span>
              </p>
              {opportunity.affectedUrls.length > 0 ? (
                <p className="board-chain__text muted">Betroffene URLs: {opportunity.affectedUrls.join(", ")}</p>
              ) : null}
            </div>
          </li>
        </ol>
      </aside>
    </div>
  );
}
