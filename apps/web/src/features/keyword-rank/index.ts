/**
 * Feature boundary for the keyword-rank module (Keyword Core / Welle 3 + UX §F).
 *
 * NOTE: `keyword-logic.ts` is API-free (safe for client islands). The screen
 * loads data via lib/keywords-api.ts and renders the client islands below.
 */
export { KeywordTableClient } from "./keyword-table-client";
export { KeywordInspector } from "./keyword-inspector";
export type { KeywordRow, KeywordInspectorData, KeywordFilter } from "./keyword-logic";
