/**
 * Feature boundary for the backlinks / authority module (§5 Modul 4, Authority & Backlinks).
 *
 * NOTE: `./api` re-exports the server loader + server action (importBacklinks),
 * which pull the Node-only api-client. Do NOT import this barrel from a client
 * component as a value. Client islands import pure helpers from
 * `./backlinks-logic` and presentational components directly.
 */
export * from "./api";
export {
  backlinkTrend,
  referringDomainTrend,
  diffToFlowBars,
  followSplit,
  snapshotDeltas,
  sortReferringDomains,
  formatCount,
  formatRatioPct,
  formatSharePct,
  type TrendPoint,
  type FlowBar,
  type FollowSplit,
  type SnapshotDeltas,
} from "./backlinks-logic";
