/**
 * /kit — Component Kit Showcase / Acceptance Surface (Server Component)
 *
 * Renders every UX-9 primitive in ALL relevant states.
 * This is the acceptance surface per the DoD — every component variant is
 * visible here as living documentation.
 *
 * Route: /kit
 * Source: ux-ui-sprint.md "Component Definition-of-Done" + Teil 2 §3
 */

import type { Metadata } from "next";
import { ConfidenceBadge, type ConfidenceLevel } from "../../components/confidence-badge";
import { DeltaChip } from "../../components/delta-chip";
import { TermTooltip } from "../../components/term-tooltip";
import { WhyItMatters } from "../../components/why-it-matters";

export const metadata: Metadata = {
  title: "/kit — Komponenten-Showcase — Query-Land",
  description: "Lebende Dokumentation aller UX-9 Primitiv-Komponenten in allen Zuständen.",
};

const CONFIDENCE_LEVELS: ConfidenceLevel[] = ["A", "B", "C", "D", "E"];

export default function KitPage() {
  return (
    <div className="kit-page">
      <div className="kicker">Komponenten-Kit</div>
      <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", marginBottom: "0.5rem" }}>
        /kit Showcase
      </h1>
      <p>
        Abnahme-Oberfläche und lebende Dokumentation. Alle UX-9 Primitive in
        allen Zuständen.
      </p>

      {/* ============================================================
          ConfidenceBadge
          ============================================================ */}
      <section className="kit-section" aria-labelledby="badge-heading">
        <h2 id="badge-heading">ConfidenceBadge</h2>

        <div className="kit-row">
          <span className="kit-label">Alle Level A–E:</span>
          {CONFIDENCE_LEVELS.map((level) => (
            <ConfidenceBadge key={level} level={level} />
          ))}
        </div>

        <div className="kit-row">
          <span className="kit-label">showLabel=false:</span>
          {CONFIDENCE_LEVELS.map((level) => (
            <ConfidenceBadge key={level} level={level} showLabel={false} />
          ))}
        </div>

        <div className="kit-row">
          <span className="kit-label">A — Gesichert:</span>
          <ConfidenceBadge level="A" />
        </div>
        <div className="kit-row">
          <span className="kit-label">B — Beobachtet:</span>
          <ConfidenceBadge level="B" />
        </div>
        <div className="kit-row">
          <span className="kit-label">C — Gemessen (SERP):</span>
          <ConfidenceBadge level="C" />
        </div>
        <div className="kit-row">
          <span className="kit-label">D — Geschätzt:</span>
          <ConfidenceBadge level="D" />
        </div>
        <div className="kit-row">
          <span className="kit-label">E — KI-Hinweis:</span>
          <ConfidenceBadge level="E" />
        </div>
      </section>

      {/* ============================================================
          DeltaChip
          ============================================================ */}
      <section className="kit-section" aria-labelledby="delta-heading">
        <h2 id="delta-heading">DeltaChip</h2>

        <div className="kit-row">
          <span className="kit-label">Positiv (up):</span>
          <DeltaChip value={12} />
          <DeltaChip value={4.7} />
          <DeltaChip value={100} />
        </div>

        <div className="kit-row">
          <span className="kit-label">Negativ (down):</span>
          <DeltaChip value={-8} />
          <DeltaChip value={-2.3} />
        </div>

        <div className="kit-row">
          <span className="kit-label">Null (flat):</span>
          <DeltaChip value={0} />
        </div>

        <div className="kit-row">
          <span className="kit-label">Invertiert (Ranking — niedriger = besser):</span>
          <DeltaChip value={-3} invertColors />
          <DeltaChip value={5} invertColors />
        </div>

        <div className="kit-row">
          <span className="kit-label">Prozent-Format:</span>
          <DeltaChip value={12.5} format="percent" />
          <DeltaChip value={-3.2} format="percent" />
        </div>

        <div className="kit-row">
          <span className="kit-label">Mit Einheit:</span>
          <DeltaChip value={42} unit=" Klicks" />
          <DeltaChip value={-7} unit=" Plätze" invertColors />
        </div>
      </section>

      {/* ============================================================
          TermTooltip
          ============================================================ */}
      <section className="kit-section" aria-labelledby="tooltip-heading">
        <h2 id="tooltip-heading">TermTooltip</h2>

        <div className="kit-row" style={{ flexDirection: "column", alignItems: "flex-start" }}>
          <p style={{ margin: 0 }}>
            Hover oder Fokus auf den unterstrichenen Begriff:{" "}
            <TermTooltip>Crawl</TermTooltip>. Der Tooltip zeigt eine
            Ein-Satz-Definition und verlinkt ins Glossar.
          </p>
          <p style={{ margin: "0.75rem 0 0" }}>
            Weitere Beispiele:{" "}
            <TermTooltip>Indexierbarkeit</TermTooltip>,{" "}
            <TermTooltip>Striking Distance</TermTooltip>,{" "}
            <TermTooltip>CTR-Gap</TermTooltip>,{" "}
            <TermTooltip>Backlink</TermTooltip>.
          </p>
          <p style={{ margin: "0.75rem 0 0" }}>
            Begriff mit überschriebenem Lookup-Key:{" "}
            <TermTooltip term="health score">Health Score</TermTooltip>.
          </p>
          <p style={{ margin: "0.75rem 0 0" }}>
            Unbekannter Begriff (kein Tooltip, Fallback zu Plaintext):{" "}
            <TermTooltip>UnbekannterBegriff</TermTooltip>.
          </p>
        </div>
      </section>

      {/* ============================================================
          WhyItMatters
          ============================================================ */}
      <section className="kit-section" aria-labelledby="why-heading">
        <h2 id="why-heading">WhyItMatters</h2>

        <div className="kit-row" style={{ flexDirection: "column", alignItems: "flex-start" }}>
          <div className="card" style={{ width: "100%", maxWidth: "28rem" }}>
            <h3 style={{ margin: "0 0 0.25rem" }}>Indexierbarkeits-Funnel</h3>
            <WhyItMatters>
              Zeigt, wo Crawler blockiert werden — bevor es organischen Traffic kostet.
            </WhyItMatters>
          </div>

          <div className="card" style={{ width: "100%", maxWidth: "28rem", marginTop: "1rem" }}>
            <h3 style={{ margin: "0 0 0.25rem" }}>Striking Distance</h3>
            <WhyItMatters text="Keywords auf Position 11–20 sind die günstigsten Hebel — ein Schub reicht." />
          </div>

          <div className="card" style={{ width: "100%", maxWidth: "28rem", marginTop: "1rem" }}>
            <h3 style={{ margin: "0 0 0.25rem" }}>Ohne Icon</h3>
            <WhyItMatters showIcon={false}>
              Kompakte Variante für Kontexte, die kein Icon vertragen.
            </WhyItMatters>
          </div>
        </div>
      </section>

      {/* ============================================================
          Zusammenspiel — combined usage
          ============================================================ */}
      <section className="kit-section" aria-labelledby="combo-heading">
        <h2 id="combo-heading">Zusammenspiel (Combined Usage)</h2>

        <div className="card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <h3 style={{ margin: 0 }}>Visibility-Index</h3>
            <ConfidenceBadge level="B" />
            <DeltaChip value={8.4} />
          </div>
          <WhyItMatters>
            Der positionsgewichtete{" "}
            <TermTooltip>Visibility-Index</TermTooltip> zeigt den
            Gesamttrend über alle getrackten Keywords auf einen Blick.
          </WhyItMatters>
        </div>

        <div className="card" style={{ marginTop: "1rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <h3 style={{ margin: 0 }}>AI-Sichtbarkeit</h3>
            <ConfidenceBadge level="E" />
            <DeltaChip value={2} />
          </div>
          <WhyItMatters>
            <TermTooltip>AI-Visibility / Citation</TermTooltip> — Signal,
            kein Beleg (Konfidenz E).
          </WhyItMatters>
        </div>
      </section>

      {/* ============================================================
          Illustrative loading / empty / error states
          ============================================================ */}
      <section className="kit-section" aria-labelledby="states-heading">
        <h2 id="states-heading">Loading / Empty / Error-Zustände</h2>

        <div className="kit-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "1rem" }}>

          {/* Loading skeleton for ConfidenceBadge */}
          <div>
            <span className="kit-label" style={{ display: "block", marginBottom: "0.5rem" }}>
              Loading-Skeleton (ConfidenceBadge):
            </span>
            <span
              aria-busy="true"
              aria-label="Konfidenz wird geladen …"
              style={{
                display: "inline-block",
                width: "6rem",
                height: "1.5rem",
                borderRadius: "999px",
                background: "var(--surface-muted)",
                opacity: 0.7,
              }}
            />
          </div>

          {/* Loading skeleton for DeltaChip */}
          <div>
            <span className="kit-label" style={{ display: "block", marginBottom: "0.5rem" }}>
              Loading-Skeleton (DeltaChip):
            </span>
            <span
              aria-busy="true"
              aria-label="Delta wird geladen …"
              style={{
                display: "inline-block",
                width: "3.5rem",
                height: "1.4rem",
                borderRadius: "999px",
                background: "var(--surface-muted)",
                opacity: 0.7,
              }}
            />
          </div>

          {/* Empty state */}
          <div className="card notice" style={{ maxWidth: "28rem" }}>
            <strong>Keine Daten verfügbar</strong>
            <p style={{ marginBottom: 0, marginTop: "0.25rem", fontSize: "0.88rem" }}>
              Starten Sie einen Crawl im Technical Audit, um Daten zu erfassen.
            </p>
          </div>

          {/* Error state */}
          <div className="notice danger" style={{ maxWidth: "28rem" }}>
            <strong>Fehler beim Laden</strong>
            <p style={{ marginBottom: 0, marginTop: "0.25rem", fontSize: "0.88rem" }}>
              Die Konfidenz-Daten konnten nicht geladen werden. Bitte Seite
              neu laden.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
