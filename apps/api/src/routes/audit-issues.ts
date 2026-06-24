import { json } from "../http.js";
import { recordAuditIssuesRequest } from "../request-validators.js";
import { enumQuery, pageMeta, paginationOptions, type ResourceRoute } from "./shared.js";

export const routeAuditIssues: ResourceRoute = async (store, method, pathname, searchParams, body) => {
  const listMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/audit-issues$/);
  if (listMatch) {
    if (method === "GET") {
      const page = await store.listAuditIssuesPage(listMatch[1], listMatch[2], paginationOptions(searchParams), {
        status: enumQuery(searchParams, "status", ["open", "resolved", "all"]),
        severity: enumQuery(searchParams, "severity", ["critical", "high", "medium", "low"]),
        rule: enumQuery(searchParams, "rule", ["http_error", "redirect_chain", "missing_title", "duplicate_title", "canonical_mismatch", "broken_link"])
      });
      return json(200, { data: page.data, meta: pageMeta(page) });
    }
    if (method === "POST") {
      const input = recordAuditIssuesRequest(body);
      const result = await store.recordAuditIssues(listMatch[1], listMatch[2], input.issues, { checkedDiscoveredUrlIds: input.checkedDiscoveredUrlIds });
      return json(201, { data: result.issues, meta: { inserted: result.inserted, updated: result.updated, resolved: result.resolved } });
    }
    return null;
  }

  const actionMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/audit-issues\/([^/]+)\/(resolve|dismiss|reopen)$/);
  if (method === "POST" && actionMatch) {
    const [projectId, siteId, issueId, action] = actionMatch.slice(1) as [string, string, string, "resolve" | "dismiss" | "reopen"];
    const issue = action === "resolve"
      ? await store.resolveAuditIssue(projectId, siteId, issueId)
      : action === "dismiss"
        ? await store.dismissAuditIssue(projectId, siteId, issueId)
        : await store.reopenAuditIssue(projectId, siteId, issueId);
    return json(200, { data: issue });
  }

  return null;
};
