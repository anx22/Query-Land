import { json, type ApiResponse } from "../http.js";
import { pageMeta, paginationOptions, type ResourceRoute } from "./shared.js";

// WP-4.1/4.2/4.3: Authority / Backlinks. import erzeugt einen Snapshot (Klasse B); GET liefert
// die neueste Charge, die verweisenden Domains, das New/Lost-Diff, die Authority-Zusammenfassung
// und den Snapshot-Verlauf.
export const routeBacklinks: ResourceRoute = (store, method, pathname, searchParams): ApiResponse | null => {
  const importMatch = pathname.match(/^\/projects\/([^/]+)\/backlinks\/import$/);
  if (method === "POST" && importMatch) {
    return json(202, { data: store.importBacklinks(importMatch[1]) });
  }

  const diffMatch = pathname.match(/^\/projects\/([^/]+)\/backlinks\/diff$/);
  if (method === "GET" && diffMatch) {
    return json(200, { data: store.backlinkDiff(diffMatch[1]) });
  }

  const listMatch = pathname.match(/^\/projects\/([^/]+)\/backlinks$/);
  if (method === "GET" && listMatch) {
    const page = store.listBacklinks(listMatch[1], paginationOptions(searchParams));
    return json(200, { data: page.data, meta: pageMeta(page) });
  }

  const referringMatch = pathname.match(/^\/projects\/([^/]+)\/referring-domains$/);
  if (method === "GET" && referringMatch) {
    return json(200, { data: store.listReferringDomains(referringMatch[1]) });
  }

  const authorityMatch = pathname.match(/^\/projects\/([^/]+)\/authority$/);
  if (method === "GET" && authorityMatch) {
    return json(200, { data: store.authoritySummary(authorityMatch[1]) });
  }

  const snapshotsMatch = pathname.match(/^\/projects\/([^/]+)\/backlink-snapshots$/);
  if (method === "GET" && snapshotsMatch) {
    return json(200, { data: store.listBacklinkSnapshots(snapshotsMatch[1]) });
  }

  return null;
};
