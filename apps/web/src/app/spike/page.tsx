/**
 * /spike — UX-0 Chart-Lib-Spike proof route.
 *
 * PURPOSE: Verify that Recharts 3 renders correctly under Next.js 15 App Router
 * SSR + React 19 hydration, with real server-loaded data passed as props to a
 * client island. This is a TEMPORARY proof route.
 *
 * TODO (UX-1): This chart will be folded into the real Overview page
 * (src/app/page.tsx) as the TrendChart hero component once the chart library
 * is confirmed working. This /spike route can then be removed.
 *
 * Standalone minimal page (no AppShell/Navigation import) per task spec:
 * the spike must not touch or depend on any existing layout/navigation file.
 */

import { loadSpikeVisibility } from "../../lib/spike-visibility";
import { VisibilitySpikeChart } from "../../components/charts/visibility-spike-chart";

// Force dynamic rendering so the server always hits the real API at request time.
// During `build:web` (sqlite::memory:) the API returns [] → empty-state renders.
export const dynamic = "force-dynamic";

export default async function SpikePage() {
  const data = await loadSpikeVisibility();

  return (
    <main
      style={{
        maxWidth: "52rem",
        margin: "0 auto",
        padding: "2rem",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "var(--ink, #211b17)",
      }}
    >
      {/* Page heading */}
      <p
        style={{
          color: "var(--primary, #ff5c00)",
          fontSize: "0.72rem",
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          margin: "0 0 0.35rem",
        }}
      >
        UX-0 — Chart-Lib-Spike
      </p>

      <h1
        style={{
          margin: "0 0 0.5rem",
          fontSize: "clamp(1.5rem, 4vw, 2.4rem)",
          letterSpacing: "-0.05em",
          lineHeight: 1,
          color: "var(--ink, #211b17)",
        }}
      >
        Backlink-Verlauf
      </h1>

      <p
        style={{
          color: "var(--muted, #766b62)",
          lineHeight: 1.65,
          margin: "0 0 1.5rem",
          fontSize: "0.95rem",
        }}
      >
        Gesamtzahl der Backlinks über die Zeit — geladen vom API-Endpunkt
        <code style={{ fontFamily: "monospace", margin: "0 0.3em" }}>
          /projects/&#123;id&#125;/backlink-snapshots
        </code>
        und als Props an die Client-Insel übergeben.
        {data.length > 0 ? (
          <> {data.length} Snapshot{data.length !== 1 ? "s" : ""} geladen.</>
        ) : (
          <> Noch keine Snapshots vorhanden — leerer Zustand wird gerendert.</>
        )}
      </p>

      {/* Chart island — receives only plain serialisable props. */}
      <div
        className="card"
        style={{
          border: "1px solid var(--line, #e8dfd6)",
          borderRadius: "1.5rem",
          background: "rgba(255,255,255,0.83)",
          padding: "1.25rem",
          boxShadow: "0 24px 80px rgba(77,47,23,.08)",
        }}
      >
        <p
          style={{
            margin: "0 0 0.75rem",
            fontSize: "0.9rem",
            fontWeight: 700,
            color: "var(--muted, #766b62)",
          }}
        >
          Backlinks gesamt
        </p>
        <VisibilitySpikeChart
          data={data}
          title="Backlink-Verlauf"
          valueLabel="Backlinks"
        />
      </div>

      {/* Implementation notes — visible for reviewer convenience, remove in UX-1 */}
      <details
        style={{
          marginTop: "2rem",
          border: "1px solid var(--line, #e8dfd6)",
          borderRadius: "1rem",
          padding: "0.8rem 1rem",
          fontSize: "0.82rem",
          color: "var(--muted, #766b62)",
        }}
      >
        <summary style={{ cursor: "pointer", fontWeight: 700, color: "var(--ink, #211b17)" }}>
          Spike-Notizen (für Reviewer)
        </summary>
        <ul style={{ margin: "0.75rem 0 0", paddingLeft: "1.25rem", lineHeight: 1.7 }}>
          <li>
            <strong>Import-Muster:</strong>{" "}
            <code>recharts</code> wird ausschließlich in{" "}
            <code>VisibilitySpikeChart</code> (<code>"use client"</code>)
            importiert — kein Recharts-Code im Server-Bundle.
          </li>
          <li>
            <strong>SSR-Grenze:</strong> Diese Seite ist ein async Server
            Component. Die Client-Insel wird als statischer Placeholder
            gerendert und im Browser hydratisiert (keine Hydration-Fehler
            erwartet).
          </li>
          <li>
            <strong>ResponsiveContainer:</strong> Erhält{" "}
            <code>height="100%"</code> innerhalb eines Wrapper-div mit fester
            Pixel-Höhe (14 rem) — verhindert Infinite-Resize-Loop in v3.
          </li>
          <li>
            <strong>prefers-reduced-motion:</strong>{" "}
            <code>isAnimationActive="auto"</code> (Recharts 3 default) +
            explizite <code>matchMedia</code>-Prüfung im Island.
          </li>
          <li>
            <strong>Leer-Zustand:</strong> Wenn die API keine Snapshots
            zurückgibt (z. B. Build-Zeit mit SQLite in-memory), rendert die
            Insel einen beschrifteten EmptyState statt eines leeren SVG.
          </li>
        </ul>
      </details>
    </main>
  );
}
