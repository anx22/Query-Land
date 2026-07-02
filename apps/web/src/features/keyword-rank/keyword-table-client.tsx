"use client";

/**
 * KeywordTableClient (spec Teil 3 §F) — the interactive Keywords & Rankings island.
 *
 * Composes:
 *   - FilterBar (§3.7, Intent / Brand / Markt) — pure client-side, 0-backend,
 *     driven by URL search params (single source of truth, shareable/reloadable).
 *   - Keyword table — per row a Sparkline (position trend), DeltaChip (vs. previous,
 *     invertColors because a lower ranking position is better) and a ConfidenceBadge.
 *   - SERP-feature chips + Intent badge per row.
 *   - KeywordInspector — drawer opened on row click (rank history + SERP features/diff).
 *
 * Receives fully-resolved, serialisable rows + inspector data as plain props
 * (the loader lives in lib/keywords-api.ts; pure helpers in keyword-logic.ts).
 */

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { KeywordIntent } from "@seo-tool/domain-model";
import { Sparkline } from "../../components/charts/sparkline";
import { ConfidenceBadge } from "../../components/confidence-badge";
import { DeltaChip } from "../../components/delta-chip";
import { SelectMenu } from "../../components/select-menu";
import { TermTooltip } from "../../components/term-tooltip";
import {
  KEYWORD_INTENT_OPTIONS,
  confidenceLevel,
  distinctMarkets,
  filterKeywordRows,
  intentLabel,
  sparklineSeries,
  type BrandFilter,
  type KeywordFilter,
  type KeywordRow,
} from "./keyword-logic";
import { KeywordInspector, type KeywordInspectorData } from "./keyword-inspector";

export interface KeywordTableClientProps {
  rows: KeywordRow[];
  inspectors: Record<string, KeywordInspectorData>;
}

function parseBrand(value: string | null): BrandFilter {
  return value === "brand" || value === "nonbrand" ? value : "all";
}

function parseIntent(value: string | null): KeywordIntent | "all" {
  return value && (KEYWORD_INTENT_OPTIONS as string[]).includes(value)
    ? (value as KeywordIntent)
    : "all";
}

export function KeywordTableClient({ rows, inspectors }: KeywordTableClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const markets = useMemo(() => distinctMarkets(rows), [rows]);

  const filter: KeywordFilter = useMemo(
    () => ({
      intent: parseIntent(searchParams.get("intent")),
      brand: parseBrand(searchParams.get("brand")),
      market: searchParams.get("market") ?? "all",
    }),
    [searchParams]
  );

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "" || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const filtered = useMemo(() => filterKeywordRows(rows, filter), [rows, filter]);

  const selected = useMemo(
    () => filtered.find((r) => r.id === selectedId) ?? rows.find((r) => r.id === selectedId) ?? null,
    [filtered, rows, selectedId]
  );

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = [];
    if (filter.intent && filter.intent !== "all") chips.push({ key: "intent", label: `Intent: ${intentLabel(filter.intent)}` });
    if (filter.brand && filter.brand !== "all") chips.push({ key: "brand", label: `Marke: ${filter.brand === "brand" ? "Mit Marke" : "Ohne Marke"}` });
    if (filter.market && filter.market !== "all") chips.push({ key: "market", label: `Markt: ${filter.market}` });
    return chips;
  }, [filter]);

  return (
    <section className="card kw-table-card">
      <p className="kicker">
        <TermTooltip term="Keyword / Intent">Keyword</TermTooltip>-Set · Facetten-Filter
      </p>

      {/* FilterBar (§3.7) — Intent / Brand / Markt, search-param driven */}
      <div className="filter-row kw-filterbar" role="group" aria-label="Keywords filtern">
        <label>
          <TermTooltip term="Keyword / Intent">Intent</TermTooltip>
          <SelectMenu
            variant="pill"
            value={filter.intent ?? "all"}
            onChange={(v) => setParam("intent", v)}
            options={[
              { value: "all", label: "Alle" },
              ...KEYWORD_INTENT_OPTIONS.map((i) => ({ value: i, label: intentLabel(i) })),
            ]}
            aria-label="Intent"
          />
        </label>
        <label>
          Marke
          <SelectMenu
            variant="pill"
            value={filter.brand ?? "all"}
            onChange={(v) => setParam("brand", v)}
            options={[
              { value: "all", label: "Alle" },
              { value: "brand", label: "Mit Marke" },
              { value: "nonbrand", label: "Ohne Marke" },
            ]}
            aria-label="Marke"
          />
        </label>
        <label>
          Markt
          <SelectMenu
            variant="pill"
            value={filter.market ?? "all"}
            onChange={(v) => setParam("market", v)}
            options={[
              { value: "all", label: "Alle" },
              ...markets.map((m) => ({ value: m, label: m })),
            ]}
            aria-label="Markt"
          />
        </label>
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 ? (
        <div className="badge-row kw-chips">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="badge primary kw-chip"
              onClick={() => setParam(chip.key, null)}
              aria-label={`Filter entfernen: ${chip.label}`}
            >
              {chip.label} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : null}

      <p className="muted kw-count">{filtered.length} von {rows.length} Keywords</p>

      {filtered.length === 0 ? (
        <KeywordTableEmpty hasRows={rows.length > 0} />
      ) : (
        <div className="kw-table" role="table" aria-label="Keyword-Tabelle">
          <div className="kw-table__head" role="row">
            <span role="columnheader">Keyword</span>
            <span role="columnheader">Intent</span>
            <span role="columnheader">Position</span>
            <span role="columnheader">
              <TermTooltip term="SERP / SERP-Feature">SERP</TermTooltip>-Features
            </span>
            <span role="columnheader">Trend</span>
            <span role="columnheader">Δ</span>
            <span role="columnheader">Konfidenz</span>
          </div>
          {filtered.map((row) => (
            <button
              key={row.id}
              type="button"
              role="row"
              className="kw-table__row"
              onClick={() => setSelectedId(row.id)}
              aria-label={`${row.phrase} — Details öffnen`}
            >
              <span role="cell" className="kw-table__phrase">
                <strong>{row.phrase}</strong>
                {row.brand ? <span className="badge kw-brand">Brand</span> : null}
                <span className="muted kw-table__market">{row.market}</span>
              </span>
              <span role="cell">
                <span className={`badge kw-intent kw-intent--${row.intent}`}>{intentLabel(row.intent)}</span>
              </span>
              <span role="cell" className="metric-value kw-table__pos">
                {row.currentPosition != null ? row.currentPosition : "—"}
              </span>
              <span role="cell" className="kw-table__features">
                {row.serpFeatures.length > 0 ? (
                  row.serpFeatures.slice(0, 3).map((f) => (
                    <span key={f} className="badge kw-feature">{f}</span>
                  ))
                ) : (
                  <span className="muted">—</span>
                )}
                {row.serpFeatures.length > 3 ? (
                  <span className="muted">+{row.serpFeatures.length - 3}</span>
                ) : null}
              </span>
              <span role="cell" className="kw-table__spark">
                <Sparkline data={sparklineSeries(row)} ariaLabel={`Positions-Trend für ${row.phrase}`} height={28} />
              </span>
              <span role="cell">
                {row.positionDelta != null && row.positionDelta !== 0 ? (
                  <DeltaChip value={row.positionDelta} invertColors unit=" Plätze" />
                ) : (
                  <span className="muted">–</span>
                )}
              </span>
              <span role="cell">
                <ConfidenceBadge level={confidenceLevel(row.sourceConfidence)} showLabel={false} />
              </span>
            </button>
          ))}
        </div>
      )}

      <KeywordInspector
        row={selected}
        inspector={selected ? inspectors[selected.id] ?? null : null}
        onClose={() => setSelectedId(null)}
      />
    </section>
  );
}

function KeywordTableEmpty({ hasRows }: { hasRows: boolean }) {
  return (
    <div className="kw-empty">
      <strong>{hasRows ? "Keine Keywords im aktuellen Filter" : "Noch keine Keywords"}</strong>
      <span className="muted">
        {hasRows
          ? "Passen Sie die Filter an, um andere Keywords zu sehen."
          : "Fügen Sie unten Keywords hinzu. Positionen und Trends erscheinen, sobald eine Ranking-Quelle verbunden ist."}
      </span>
      {!hasRows ? (
        <a className="button secondary compact" href="/settings">Google Search Console verbinden →</a>
      ) : null}
    </div>
  );
}
