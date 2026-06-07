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
import { Sparkline } from "../../components/charts/sparkline";
import { TrendChart } from "../../components/charts/trend-chart";
import { ScoreGauge } from "../../components/charts/score-gauge";
import { PositionDistribution } from "../../components/charts/position-distribution";
import { PriorityMatrix, type PriorityBubble } from "../../components/charts/priority-matrix";
import { IndexabilityFunnel } from "../../components/charts/indexability-funnel";
import { SectionTreemap } from "../../components/charts/section-treemap";

const KIT_BUBBLES: PriorityBubble[] = [
  { id: "o1", title: "H1 fehlt auf Money-Pages", effort: 2, expectedImpact: 4, businessValue: 5, priority: 480, confidenceLevel: "A", colorKey: "technical", typeLabel: "Technischer Fix" },
  { id: "o2", title: "Striking-Distance-Keyword optimieren", effort: 3, expectedImpact: 5, businessValue: 4, priority: 420, confidenceLevel: "B", colorKey: "keyword", typeLabel: "Keyword-Chance" },
  { id: "o3", title: "Interne Verlinkung zu /pricing", effort: 1, expectedImpact: 3, businessValue: 3, priority: 300, confidenceLevel: "C", colorKey: "link", typeLabel: "Interne Verlinkung" },
];

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

      {/* ============================================================
          Charts (UX-1 / Block 2) — populated + empty states
          ============================================================ */}
      <section className="kit-section" aria-labelledby="charts-heading">
        <h2 id="charts-heading">Charts</h2>
        <p>Jede Chart-Komponente mit Beispieldaten und Leerzustand. Alle Farben über <code>chartTheme</code>-Tokens, <code>prefers-reduced-motion</code> respektiert.</p>

        <div className="content-grid">
          <div className="card">
            <span className="kit-label">Sparkline</span>
            <div style={{ width: "12rem" }}><Sparkline data={[12, 18, 15, 22, 30, 28, 35]} ariaLabel="Beispiel-Trend" /></div>
            <span className="kit-label" style={{ display: "block", marginTop: "0.75rem" }}>Sparkline · leer</span>
            <div style={{ width: "12rem" }}><Sparkline data={[]} /></div>
          </div>

          <div className="card">
            <span className="kit-label">ScoreGauge</span>
            <ScoreGauge value={72} max={100} label="Health Score" size={150} />
            <span className="kit-label" style={{ display: "block", marginTop: "0.75rem" }}>ScoreGauge · keine Daten</span>
            <ScoreGauge value={null} max={100} label="Health Score" size={150} />
          </div>
        </div>

        <div className="card" style={{ marginTop: "1rem" }}>
          <span className="kit-label">TrendChart (+ Event-Marker)</span>
          <TrendChart
            data={[
              { label: "1.5.", value: 42 },
              { label: "8.5.", value: 48 },
              { label: "15.5.", value: 45 },
              { label: "22.5.", value: 53 },
              { label: "29.5.", value: 61 },
            ]}
            title="Visibility-Verlauf (Beispiel)"
            valueLabel="Visibility-Index"
            events={[{ label: "15.5.", description: "Deploy" }]}
          />
          <span className="kit-label" style={{ display: "block", marginTop: "0.75rem" }}>TrendChart · leer</span>
          <TrendChart data={[]} title="Visibility-Verlauf (leer)" />
        </div>

        <div className="content-grid" style={{ marginTop: "1rem" }}>
          <div className="card">
            <span className="kit-label">PositionDistribution</span>
            <PositionDistribution buckets={{ top3: 4, top10: 9, strikingDist: 12, mid: 20, weak: 7, total: 52 }} title="Positions-Verteilung (Beispiel)" />
            <span className="kit-label" style={{ display: "block", marginTop: "0.75rem" }}>· leer</span>
            <PositionDistribution buckets={{ top3: 0, top10: 0, strikingDist: 0, mid: 0, weak: 0, total: 0 }} />
          </div>

          <div className="card">
            <span className="kit-label">IndexabilityFunnel</span>
            <IndexabilityFunnel
              stages={[
                { key: "discovered", label: "Entdeckt", value: 1240, drop: null },
                { key: "fetched", label: "Abgerufen", value: 1180, drop: -60 },
                { key: "indexable", label: "Indexierbar", value: 910, drop: -270 },
                { key: "indexed", label: "Indexiert", value: null, drop: null },
              ]}
              title="Indexierbarkeits-Funnel (Beispiel)"
            />
            <span className="kit-label" style={{ display: "block", marginTop: "0.75rem" }}>· leer</span>
            <IndexabilityFunnel
              stages={[
                { key: "discovered", label: "Entdeckt", value: null, drop: null },
                { key: "fetched", label: "Abgerufen", value: null, drop: null },
                { key: "indexable", label: "Indexierbar", value: null, drop: null },
                { key: "indexed", label: "Indexiert", value: null, drop: null },
              ]}
            />
          </div>
        </div>

        <div className="card" style={{ marginTop: "1rem" }}>
          <span className="kit-label">PriorityMatrix (Impact × Aufwand)</span>
          <PriorityMatrix bubbles={KIT_BUBBLES} title="Chancen-Matrix (Beispiel)" />
          <span className="kit-label" style={{ display: "block", marginTop: "0.75rem" }}>PriorityMatrix · leer</span>
          <PriorityMatrix bubbles={[]} />
        </div>

        <div className="card" style={{ marginTop: "1rem" }}>
          <span className="kit-label">SectionTreemap</span>
          <SectionTreemap
            sections={[
              { path: "/blog", urlCount: 320, issueCount: 12, health: 78 },
              { path: "/shop", urlCount: 540, issueCount: 40, health: 55 },
              { path: "/", urlCount: 80, issueCount: 2, health: 94 },
            ]}
            title="Section-Health (Beispiel)"
          />
          <span className="kit-label" style={{ display: "block", marginTop: "0.75rem" }}>SectionTreemap · leer</span>
          <SectionTreemap sections={[]} />
        </div>
      </section>
    </div>
  );
}
