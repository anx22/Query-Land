/**
 * Feature boundary for the keyword-rank module (Keyword Core / Welle 3 + UX §F).
 *
 * NOTE: `keyword-logic.ts` is API-free (safe for client islands). `api.ts` is a
 * server-only loader (legacy library view). The new screen uses
 * lib/keywords-api.ts + the client islands below.
 */
export * from "./api";
export { KeywordTableClient } from "./keyword-table-client";
export { KeywordInspector } from "./keyword-inspector";
export type { KeywordRow, KeywordInspectorData, KeywordFilter } from "./keyword-logic";
