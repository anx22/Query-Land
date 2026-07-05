import { AUDIT_ISSUE_RULES } from "@seo-tool/domain-model";
import { json } from "../http.js";
import { dismissAuditIssueRequest, recordAuditIssuesRequest } from "../request-validators.js";
import { actorId, enumQuery, pageMeta, paginationOptions, type ResourceRoute } from "./shared.js";

export const routeAuditIssues: ResourceRoute = async (store, method, pathname, searchParams, body, context) => {
  const listMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/audit-issues$/);
  if (listMatch) {
    if (method === "GET") {
      const page = await store.listAuditIssuesPage(listMatch[1], listMatch[2], paginationOptions(searchParams), {
        status: enumQuery(searchParams, "status", ["open", "resolved", "all"]),
        severity: enumQuery(searchParams, "severity", ["critical", "high", "medium", "low"]),
        rule: enumQuery(searchParams, "rule", AUDIT_ISSUE_RULES)
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

  const historyMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/audit-issues\/([^/]+)\/history$/);
  if (method === "GET" && historyMatch) {
    const [projectId, siteId, issueId] = historyMatch.slice(1) as [string, string, string];
    const history = await store.listAuditIssueHistory(projectId, siteId, issueId);
    return json(200, { data: history });
  }

  const actionMatch = pathname.match(/^\/projects\/([^/]+)\/sites\/([^/]+)\/audit-issues\/([^/]+)\/(resolve|dismiss|reopen)$/);
  if (method === "POST" && actionMatch) {
    const [projectId, siteId, issueId, action] = actionMatch.slice(1) as [string, string, string, "resolve" | "dismiss" | "reopen"];
    const actor = actorId(context);
    const issue = action === "resolve"
      ? await store.resolveAuditIssue(projectId, siteId, issueId, actor)
      : action === "dismiss"
        ? await store.dismissAuditIssue(projectId, siteId, issueId, dismissAuditIssueRequest(body), actor)
        : await store.reopenAuditIssue(projectId, siteId, issueId, actor);
    return json(200, { data: issue });
  }

  return null;
};
