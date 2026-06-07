"use client";

/**
 * BacklinkTrendCard — hero client island: toggles the TrendChart between the
 * "Backlinks" and "Verweisende Domains" series over time (UX-4 §H).
 *
 * Receives both fully-derived, serialisable TrendPoint[] arrays as props (built
 * server-side from backlink snapshots). Imports ONLY pure helpers + chart
 * primitives — never the loader / api-client — so it stays out of the Node
 * bundle (avoids the node:fs/crypto-in-browser trap).
 *
 * Serious-Zone: numbers/axes are factual.
 * NOTE: the shared TrendChart fixes its Y-domain to 0–100; raw counts above 100
 * are visually clipped. This matches the existing reuse of TrendChart elsewhere;
 * a count-aware domain is a backend/chart backlog item (see report).
 */

import { useState } from "react";
import { TrendChart, type TrendDataPoint } from "../../components/charts/trend-chart";

type Series = "backlinks" | "domains";

export interface BacklinkTrendCardProps {
  backlinks: TrendDataPoint[];
  domains: TrendDataPoint[];
}

const TABS: Array<{ key: Series; label: string }> = [
  { key: "backlinks", label: "Backlinks" },
  { key: "domains", label: "Verweisende Domains" },
];

export function BacklinkTrendCard({ backlinks, domains }: BacklinkTrendCardProps) {
  const [series, setSeries] = useState<Series>("backlinks");
  const data = series === "backlinks" ? backlinks : domains;
  const valueLabel = series === "backlinks" ? "Backlinks" : "Verweisende Domains";

  return (
    <div className="backlinks-chart">
      <div className="badge-row" role="tablist" aria-label="Verlauf-Serie">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={series === tab.key}
            className={`badge ${series === tab.key ? "primary" : ""}`}
            style={{ cursor: "pointer" }}
            onClick={() => setSeries(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <TrendChart data={data} title={`${valueLabel} — Verlauf`} valueLabel={valueLabel} height={14} yMax="auto" />
    </div>
  );
}
