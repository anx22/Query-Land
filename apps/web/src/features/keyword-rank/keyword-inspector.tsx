"use client";

/**
 * KeywordInspector (spec Teil 3 §F) — keyword detail drawer.
 *
 * Opened by a row click in the keyword table. Shows, for the selected keyword:
 *   - Rank history (positions over time, newest first).
 *   - SERP features (latest snapshot) as chips.
 *   - SERP-Diff (entered/left domains, gained/lost features, position delta).
 *
 * Pure client island: receives a fully-resolved row + inspector payload (plain
 * serialisable objects) and an onClose callback. Closes on Escape and backdrop
 * click — same pattern as the Evidence-Chain-Drawer.
 * Serious-zone: factual, no metaphor.
 */

import { useRef } from "react";
import { useFocusTrap } from "../../lib/use-focus-trap";
import { ConfidenceBadge } from "../../components/confidence-badge";
import { DeltaChip } from "../../components/delta-chip";
import { TermTooltip } from "../../components/term-tooltip";
import {
  confidenceLevel,
  intentLabel,
  type KeywordInspectorData,
  type KeywordRow,
} from "./keyword-logic";

export type { KeywordInspectorData };

export interface KeywordInspectorProps {
  row: KeywordRow | null;
  inspector: KeywordInspectorData | null;
  onClose: () => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "numeric", year: "2-digit" });
  } catch {
    return iso;
  }
}

export function KeywordInspector({ row, inspector, onClose }: KeywordInspectorProps) {
  const drawerRef = useRef<HTMLElement>(null);
  useFocusTrap(drawerRef, row !== null, onClose);

  if (!row) return null;

  const history = [...row.rankHistory].reverse(); // newest first for display
  const diff = inspector?.serpDiff ?? null;
  const latestSerp = inspector
    ? [...inspector.serpSnapshots].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0] ?? null
    : null;
  const features = latestSerp?.serpFeatures ?? row.serpFeatures;

  return (
    <div className="kw-drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        ref={drawerRef}
        className="kw-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Keyword-Details: ${row.phrase}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="kw-drawer__head">
          <div>
            <p className="kicker">Keyword-Detail</p>
            <h2 className="kw-drawer__title">{row.phrase}</h2>
          </div>
          <button type="button" className="button secondary compact" onClick={onClose} aria-label="Drawer schließen">
            Schließen
          </button>
        </header>

        <div className="kw-drawer__badges">
          <span className={`badge kw-intent kw-intent--${row.intent}`}>{intentLabel(row.intent)}</span>
          {row.brand ? <span className="badge kw-brand">Brand</span> : null}
          <span className="badge">{row.market}</span>
          <ConfidenceBadge level={confidenceLevel(row.sourceConfidence)} />
        </div>

        {row.targetUrl ? (
          <p className="muted kw-drawer__target">Ziel-URL: {row.targetUrl}</p>
        ) : (
          <p className="muted kw-drawer__target">Keine Ziel-URL hinterlegt.</p>
        )}

        {/* Current position + delta */}
        <section className="kw-drawer__section">
          <p className="kicker">Aktuelle Position</p>
          <div className="kw-drawer__posrow">
            <span className="metric-value">{row.currentPosition != null ? row.currentPosition : "—"}</span>
            {row.positionDelta != null && row.positionDelta !== 0 ? (
              <DeltaChip value={row.positionDelta} invertColors unit=" Plätze" />
            ) : (
              <span className="muted">unverändert</span>
            )}
          </div>
        </section>

        {/* Rank history */}
        <section className="kw-drawer__section">
          <p className="kicker">Rang-Historie</p>
          {history.length > 0 ? (
            <ul className="kw-history">
              {history.map((p, i) => (
                <li key={`${p.capturedAt}-${i}`} className="kw-history__row">
                  <span className="muted">{formatDate(p.capturedAt)}</span>
                  <span className="metric-value">{p.position != null ? `Pos. ${p.position}` : "nicht gerankt"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Noch keine Rang-Snapshots erfasst.</p>
          )}
        </section>

        {/* SERP features */}
        <section className="kw-drawer__section">
          <p className="kicker">
            <TermTooltip term="SERP / SERP-Feature">SERP-Features</TermTooltip>
          </p>
          {features.length > 0 ? (
            <div className="badge-row">
              {features.map((f) => (
                <span key={f} className="badge kw-feature">{f}</span>
              ))}
            </div>
          ) : (
            <p className="muted">Keine SERP-Features beobachtet.</p>
          )}
        </section>

        {/* SERP diff */}
        <section className="kw-drawer__section kw-drawer__section--last">
          <p className="kicker">SERP-Veränderung (Diff)</p>
          {diff ? (
            <div className="kw-diff">
              {diff.ownPositionDelta != null ? (
                <p className="kw-diff__row">
                  Eigene Position: {diff.ownPositionBefore ?? "—"} → {diff.ownPositionAfter ?? "—"}{" "}
                  <DeltaChip value={diff.ownPositionDelta} invertColors unit=" Plätze" />
                </p>
              ) : null}
              <DiffList label="Neue Domains" items={diff.enteredDomains} tone="gain" />
              <DiffList label="Verschwundene Domains" items={diff.leftDomains} tone="loss" />
              <DiffList label="Neue Features" items={diff.gainedFeatures} tone="gain" />
              <DiffList label="Verlorene Features" items={diff.lostFeatures} tone="loss" />
            </div>
          ) : (
            <p className="muted">Kein Diff verfügbar (mindestens zwei SERP-Snapshots nötig).</p>
          )}
        </section>
      </aside>
    </div>
  );
}

function DiffList({ label, items, tone }: { label: string; items: string[]; tone: "gain" | "loss" }) {
  if (!items || items.length === 0) return null;
  return (
    <p className="kw-diff__row">
      <span className="muted">{label}: </span>
      {items.map((item) => (
        <span key={item} className={`badge kw-diff__chip kw-diff__chip--${tone}`}>{item}</span>
      ))}
    </p>
  );
}
