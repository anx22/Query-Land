/**
 * chartTheme — single source of truth for chart colors in JS contexts.
 *
 * Design rules (ux-ui-sprint.md §2):
 *   - No hardcoded hex values; every entry references a CSS custom property.
 *   - Brand-orange (--primary) is used ONLY for "our/own" series (the site being analysed).
 *     Never as a generic category color or semantic indicator.
 *   - Colors in the "confidence" map follow the A–E evidence scale (Teil 2 §2.3).
 *   - Sequential scale encodes position buckets (best → weakest ranking tier).
 *   - Chart chrome (axes, grid, tooltips) always uses neutral tokens.
 *
 * prefers-reduced-motion:
 *   Chart islands should read the `reducedMotion` flag exported below and set
 *   `isAnimationActive={reducedMotion ? false : 'auto'}` on every animated Recharts element.
 *   Recharts 3 also supports `isAnimationActive="auto"` which respects the media query
 *   automatically — use that as the default; `false` is the explicit override.
 */

// ---------------------------------------------------------------------------
// Series colors
// ---------------------------------------------------------------------------

export const series = {
  /** Own domain / the metric being tracked: brand-orange. */
  own: "var(--primary)",
  /** Comparison / competitor series: neutral gray, never orange. */
  compare: "var(--muted)",
  /** Second neutral option for competitor series. */
  compareAlt: "#9aa0a6",
} as const;

// ---------------------------------------------------------------------------
// Chart chrome (axes, grid, tooltip background)
// ---------------------------------------------------------------------------

export const chrome = {
  /** Grid lines and axis lines. */
  grid: "var(--line)",
  /** Axis tick labels. */
  axisText: "var(--muted)",
  /** Axis tick font size (rem string for SVG text). */
  axisFontSize: "0.75rem",
  /** Tooltip background: matches .card surface. */
  tooltipBackground: "var(--surface)",
  /** Tooltip border. */
  tooltipBorder: "var(--line)",
  /** Tooltip border-radius (mirrors .card). */
  tooltipBorderRadius: "1rem",
  /** Box shadow for tooltips (mirrors .card). */
  tooltipShadow: "0 24px 80px rgba(77,47,23,.08)",
  /** Tooltip text color. */
  tooltipText: "var(--ink)",
} as const;

// ---------------------------------------------------------------------------
// Own-series fill opacity for AreaChart
// ---------------------------------------------------------------------------

export const area = {
  /** Stroke for the own-domain area line. */
  stroke: "var(--primary)",
  /** Fill for the area below the line. */
  fill: "var(--primary)",
  /** Fill opacity for the area (8 % per spec Teil 2 §4.1). */
  fillOpacity: 0.08,
} as const;

// ---------------------------------------------------------------------------
// Confidence / evidence scale (A–E, Teil 2 §2.3)
// ---------------------------------------------------------------------------

export const confidence = {
  A: "var(--conf-a, #16794d)",
  B: "var(--conf-b, #0e7c86)",
  C: "var(--conf-c, #b7791f)",
  D: "var(--conf-d, #5b6478)",
  E: "var(--conf-e, #9aa0a6)",
} as const;

export const confidenceSoft = {
  A: "var(--conf-a-soft, #e7f6ee)",
  B: "var(--conf-b-soft, #e2f4f5)",
  C: "var(--conf-c-soft, #fbf0db)",
  D: "var(--conf-d-soft, #edeff3)",
  E: "var(--conf-e-soft, #f1f1f2)",
} as const;

// ---------------------------------------------------------------------------
// Categorical colors for opportunity types (Teil 2 §2.3)
// Deliberately avoids green, red, and orange to preserve semantic meaning.
// ---------------------------------------------------------------------------

export const categorical = {
  technical: "var(--cat-technical, #0e7c86)",
  keyword:   "var(--cat-keyword,   #6f7d2e)",
  cannibal:  "var(--cat-cannibal,  #8a4f9e)",
  money:     "var(--cat-money,     #4f56b5)",
  link:      "var(--cat-link,      #9a6b4f)",
  aeo:       "var(--cat-aeo,       #5b6478)",
} as const;

// ---------------------------------------------------------------------------
// Sequential scale for position buckets (ranking tiers best → weakest)
// ---------------------------------------------------------------------------

export const sequential = {
  /** Positions 1–3 */
  top3:           "#16794d",
  /** Positions 4–10 */
  top10:          "#4f9e6f",
  /** Positions 11–20 — "Striking Distance" */
  strikingDist:   "#b7791f",
  /** Positions 21–50 */
  mid:            "#5b6478",
  /** Positions 51–100 */
  weak:           "#9aa0a6",
} as const;

// ---------------------------------------------------------------------------
// Semantic indicator colors (success/warning/danger for diverging bars etc.)
// ---------------------------------------------------------------------------

export const semantic = {
  gain:    "var(--success)",
  loss:    "var(--danger)",
  neutral: "var(--muted)",
} as const;

// ---------------------------------------------------------------------------
// Animation / reduced-motion helpers
// ---------------------------------------------------------------------------

/**
 * Default animation duration in ms (≤ 300 per spec).
 * Use as `animationDuration` on Recharts elements.
 */
export const animationDuration = 300;

/**
 * Use this as the default `isAnimationActive` value on all Recharts elements.
 *
 * Recharts 3 interprets `"auto"` as:
 *   - `false` during SSR (prevents hydration mismatch)
 *   - respects `prefers-reduced-motion: reduce` in the browser
 *
 * Chart islands can also pass `false` explicitly when the parent has already
 * detected reduced-motion preference via `window.matchMedia`.
 *
 * @example
 *   <Area isAnimationActive={ANIMATION_DEFAULT} animationDuration={animationDuration} />
 */
export const ANIMATION_DEFAULT: boolean | "auto" = "auto";

// ---------------------------------------------------------------------------
// Composite export (convenience for spread usage)
// ---------------------------------------------------------------------------

export const chartTheme = {
  series,
  chrome,
  area,
  confidence,
  confidenceSoft,
  categorical,
  sequential,
  semantic,
  animationDuration,
} as const;

export type ChartTheme = typeof chartTheme;
