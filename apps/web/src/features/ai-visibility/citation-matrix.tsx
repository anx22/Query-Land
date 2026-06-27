"use client";

/**
 * CitationMatrix (spec §4.12) — factual matrix of tracked prompts (rows) ×
 * citation status ("zitiert? ●/○").
 *
 * Serious-zone, especially strict: this is Confidence Class E (LLM signal),
 * NEVER evidence. Copy is plain and factual — no metaphor, no overclaiming.
 *
 * Client island: receives plain serializable rows as props. It imports ONLY the
 * API-free helpers from ai-logic.ts (never the loader / api-client), so no
 * Node module leaks into the browser bundle.
 *
 * Colour is never the only signal — every glyph is paired with a text label.
 */

import type { CitationMatrixRow } from "./ai-logic";
import {
  citationGlyph,
  citationStatusLabel,
} from "./ai-logic";

export interface CitationMatrixProps {
  rows: CitationMatrixRow[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return "—";
  return new Date(parsed).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });
}

export function CitationMatrix({ rows }: CitationMatrixProps) {
  if (rows.length === 0) {
    return (
      <div className="ai-empty">
        <p className="ai-empty__title">Noch keine getrackten Prompts</p>
        <p className="ai-empty__hint">
          Lege oben einen Prompt an und erfasse einen Snapshot, um zu sehen, ob die eigene Domain in
          LLM-Antworten zitiert wird. Diese Daten sind ein Signal (Klasse E), kein Beleg.
        </p>
      </div>
    );
  }

  return (
    <div className="ai-matrix-scroll">
      <table className="ai-matrix" aria-label="Citation-Matrix: Prompts × zitiert">
        <thead>
          <tr>
            <th scope="col">Prompt</th>
            <th scope="col">Zitiert?</th>
            <th scope="col">Status</th>
            <th scope="col">Zitierte Domains</th>
            <th scope="col">Letzter Snapshot</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const label = citationStatusLabel(row.status);
            return (
              <tr key={row.promptId}>
                <td className="ai-matrix__prompt">
                  <span className="ai-matrix__prompt-text">{row.prompt}</span>
                  {row.market ? <span className="ai-matrix__market">Markt: {row.market}</span> : null}
                </td>

                <td>
                  <span className={`ai-glyph ai-glyph--${row.status}`}>
                    <span className="ai-glyph__mark" aria-hidden="true">
                      {citationGlyph(row.status)}
                    </span>
                    <span className="sr-only">{label}</span>
                  </span>
                </td>

                <td>
                  <span className="muted">{label}</span>
                  {row.snapshotCount > 0 ? (
                    <span className="muted"> · {row.snapshotCount} Snapshot(s)</span>
                  ) : null}
                </td>

                <td className="ai-matrix__domains">
                  {row.citedDomains.length > 0 ? row.citedDomains.join(", ") : "—"}
                </td>

                <td className="muted">{formatDate(row.capturedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
