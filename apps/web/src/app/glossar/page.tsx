/**
 * /glossar — Glossar-Seite (Server Component)
 *
 * Renders all glossary terms from the single-source glossary.ts.
 * Also includes the Konfidenz/Evidenz-Legende (A–E) per spec Teil 1 §5.
 *
 * Route: /glossar
 * Source: ux-ui-sprint.md "Glossar-Seed" table + Teil 1 §5
 */

import type { Metadata } from "next";
import { glossaryEntries } from "../../lib/glossary";
import { confidenceMeta, type ConfidenceLevel } from "../../components/confidence-badge";
import { ConfidenceBadge } from "../../components/confidence-badge";

export const metadata: Metadata = {
  title: "Glossar — Query-Land",
  description:
    "SEO-Fachbegriffe und deren Definitionen im Berater-Ton — eine Satz, sachlich, Deutsch.",
};

const CONFIDENCE_LEVELS: ConfidenceLevel[] = ["A", "B", "C", "D", "E"];

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export default function GlossarPage() {
  return (
    <div className="glossar-page">
      <h1>Glossar</h1>
      <p className="glossar-page__lead">
        SEO-Fachbegriffe, kurz und sachlich erklärt. Tooltips in der Anwendung
        verlinken auf diese Seite.
      </p>

      {/* Konfidenz/Evidenz-Legende */}
      <section aria-labelledby="konfidenz-heading">
        <h2 id="konfidenz-heading">Konfidenz / Evidenz-Skala (A–E)</h2>
        <p className="glossar-page__lead">
          Jede Aussage und Kennzahl trägt eine Konfidenz-Klasse, die zeigt, wie
          belastbar der Beleg dahinter ist.
        </p>
        <dl className="conf-legend">
          {CONFIDENCE_LEVELS.map((level) => {
            const meta = confidenceMeta(level);
            return (
              <div key={level} className="conf-legend__row">
                <ConfidenceBadge level={level} />
                <dd className="conf-legend__desc">{meta.description}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      {/* Glossary terms */}
      <section aria-labelledby="begriffe-heading">
        <h2 id="begriffe-heading">Begriffe</h2>
        <dl className="glossar-list">
          {glossaryEntries.map((entry) => {
            const id = slugify(entry.term);
            return (
              <div key={entry.term} id={id} className="glossar-term">
                <dt className="glossar-term__word">{entry.term}</dt>
                <dd className="glossar-term__def">{entry.definition}</dd>
              </div>
            );
          })}
        </dl>
      </section>
    </div>
  );
}
