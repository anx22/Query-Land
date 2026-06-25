"use client";

/**
 * brief-editor.tsx — the interactive Content-Workspace brief editor island.
 *
 * Editing is a client island because the MANUAL term checklist needs in-place
 * toggling and the list fields are friendlier as live-edited textareas. All
 * persistence still goes through the "use server" actions (updateBriefAction);
 * on submit the controlled state is serialised into the field values the action
 * parses with the pure brief-form helpers. Terminal briefs (done/dismissed)
 * render read-only — the API rejects edits there.
 */

import { useState } from "react";
import type { ContentIntent, ContentRecommendation } from "@seo-tool/domain-model";
import { CONTENT_INTENTS } from "@seo-tool/domain-model";
import {
  intentLabel,
  isBriefEditable,
  serializeInternalLinks,
  serializeLines,
  serializeTerms,
} from "./brief-form";

export interface BriefEditorProps {
  brief: ContentRecommendation;
  /** updateBriefAction (use server). */
  onSave: (formData: FormData) => Promise<void>;
}

export function BriefEditor({ brief, onSave }: BriefEditorProps) {
  const editable = isBriefEditable(brief.status);
  const [terms, setTerms] = useState(brief.terms);

  function toggleTerm(index: number) {
    setTerms((prev) => prev.map((t, i) => (i === index ? { ...t, done: !t.done } : t)));
  }

  return (
    <form action={onSave} className="cw-editor">
      <input type="hidden" name="briefId" value={brief.id} />
      {/* The checklist toggles are controlled; serialise current state on submit. */}
      <input type="hidden" name="terms" value={serializeTerms(terms)} />

      <fieldset disabled={!editable} className="cw-editor__fields">
        <label className="cw-field">
          <span className="cw-field__label">Titel</span>
          <input className="cw-input" type="text" name="title" defaultValue={brief.title} required />
        </label>

        <label className="cw-field">
          <span className="cw-field__label">Ziel-Thema</span>
          <input
            className="cw-input"
            type="text"
            name="targetTopic"
            defaultValue={brief.targetTopic}
          />
        </label>

        <label className="cw-field">
          <span className="cw-field__label">Such-Intent</span>
          <select className="cw-input" name="intent" defaultValue={brief.intent}>
            {CONTENT_INTENTS.map((intent: ContentIntent) => (
              <option key={intent} value={intent}>
                {intentLabel(intent)}
              </option>
            ))}
          </select>
        </label>

        <label className="cw-field">
          <span className="cw-field__label">Ziel-Queries (eine pro Zeile)</span>
          <textarea
            className="cw-textarea"
            name="targetQueries"
            rows={3}
            defaultValue={serializeLines(brief.targetQueries)}
          />
        </label>

        <label className="cw-field">
          <span className="cw-field__label">Abschnitte / Gliederung (eine pro Zeile)</span>
          <textarea
            className="cw-textarea"
            name="sections"
            rows={4}
            defaultValue={serializeLines(brief.sections)}
          />
        </label>

        {/* Manual term checklist — toggled in place, serialised via the hidden field. */}
        <div className="cw-field">
          <span className="cw-field__label">Term-Checkliste (manuell)</span>
          {terms.length > 0 ? (
            <ul className="cw-terms">
              {terms.map((term, index) => (
                <li className="cw-term" key={`${term.term}-${index}`}>
                  <label className="cw-term__label">
                    <input
                      type="checkbox"
                      checked={term.done}
                      onChange={() => toggleTerm(index)}
                      disabled={!editable}
                    />
                    <span className={term.done ? "cw-term__text cw-term__text--done" : "cw-term__text"}>
                      {term.term}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted cw-terms__empty">
              Noch keine Terme. Füge Terme über das Notizfeld unten hinzu (ein Term pro Zeile,
              „[x]“ markiert erledigt) und speichere.
            </p>
          )}
          <label className="cw-field cw-field--nested">
            <span className="cw-field__label cw-field__label--sub">
              Terme bearbeiten (eine pro Zeile, „[x]“ = erledigt)
            </span>
            <textarea
              className="cw-textarea"
              rows={3}
              defaultValue={serializeTerms(brief.terms)}
              onChange={(event) => {
                // Re-parse the textarea into the checklist so toggles + text edits stay in sync.
                const lines = event.target.value.split(/\r?\n/);
                const next = lines
                  .map((line) => {
                    const match = line.match(/^\s*\[\s*([xX ])?\s*\]\s*(.+)$/);
                    const text = (match ? match[2] : line).trim();
                    const done = match ? match[1]?.toLowerCase() === "x" : false;
                    return text ? { term: text, done } : null;
                  })
                  .filter((t): t is { term: string; done: boolean } => t !== null);
                setTerms(next);
              }}
            />
          </label>
        </div>

        <label className="cw-field">
          <span className="cw-field__label">
            Interne Links (eine pro Zeile: URL | Anchor | Begründung)
          </span>
          <textarea
            className="cw-textarea"
            name="internalLinks"
            rows={3}
            defaultValue={serializeInternalLinks(brief.internalLinks)}
          />
        </label>

        <label className="cw-field">
          <span className="cw-field__label">Validierungsmetrik</span>
          <input
            className="cw-input"
            type="text"
            name="validationMetric"
            defaultValue={brief.validationMetric}
          />
        </label>

        <label className="cw-field">
          <span className="cw-field__label">Notizen</span>
          <textarea className="cw-textarea" name="notes" rows={3} defaultValue={brief.notes} />
        </label>
      </fieldset>

      {editable ? (
        <div className="cw-editor__actions">
          <button type="submit" className="button">
            Brief speichern
          </button>
        </div>
      ) : (
        <p className="notice">
          Dieser Brief ist {brief.status === "done" ? "erledigt" : "verworfen"} und kann nicht mehr
          bearbeitet werden. Über „Wieder öffnen“ kann er erneut in Bearbeitung genommen werden.
        </p>
      )}
    </form>
  );
}
