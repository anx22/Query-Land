import type { DeliveryChannel, ReportExportFormat, ReportType } from "@seo-tool/domain-model";
import { json, type ApiResponse } from "../http.js";
import { RequestError } from "../stores/store-errors.js";
import type { ReportScheduleInput } from "../stores/report-store.js";
import type { ResourceRoute } from "./shared.js";

// WP-5.1/5.2/5.3: Reporting. Generierung, Liste/Detail, Export (CSV/HTML), Versand (Stub) und
// Schedules inkl. "run-due" (Automatisierung des Wochenreports).
export const routeReports: ResourceRoute = (store, method, pathname, searchParams, body): ApiResponse | null => {
  const runDueMatch = pathname.match(/^\/projects\/([^/]+)\/report-schedules\/run-due$/);
  if (method === "POST" && runDueMatch) {
    return json(202, { data: store.runDueReportSchedules(runDueMatch[1]) });
  }

  const schedulesMatch = pathname.match(/^\/projects\/([^/]+)\/report-schedules$/);
  if (schedulesMatch) {
    if (method === "GET") {
      return json(200, { data: store.listReportSchedules(schedulesMatch[1]) });
    }
    if (method === "POST") {
      return json(201, { data: store.createReportSchedule(schedulesMatch[1], asObject(body) as unknown as ReportScheduleInput) });
    }
    return null;
  }

  const collectionMatch = pathname.match(/^\/projects\/([^/]+)\/reports$/);
  if (collectionMatch) {
    if (method === "GET") {
      return json(200, { data: store.listReports(collectionMatch[1]) });
    }
    if (method === "POST") {
      const type = asObject(body).type;
      return json(201, { data: store.generateReport(collectionMatch[1], type as ReportType) });
    }
    return null;
  }

  const exportMatch = pathname.match(/^\/reports\/([^/]+)\/export$/);
  if (method === "GET" && exportMatch) {
    const format = (searchParams.get("format") ?? "csv") as ReportExportFormat;
    return json(200, { data: store.exportReport(exportMatch[1], format) });
  }

  const deliverMatch = pathname.match(/^\/reports\/([^/]+)\/deliver$/);
  if (method === "POST" && deliverMatch) {
    const input = asObject(body);
    const channel = input.channel as DeliveryChannel;
    const target = typeof input.target === "string" ? input.target : null;
    return json(201, { data: store.deliverReport(deliverMatch[1], channel, target) });
  }

  const deliveriesMatch = pathname.match(/^\/reports\/([^/]+)\/deliveries$/);
  if (method === "GET" && deliveriesMatch) {
    return json(200, { data: store.listReportDeliveries(deliveriesMatch[1]) });
  }

  const singleMatch = pathname.match(/^\/reports\/([^/]+)$/);
  if (method === "GET" && singleMatch) {
    return json(200, { data: store.getReport(singleMatch[1]) });
  }

  return null;
};

function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RequestError(400, "invalid_body", "Request body must be an object");
  }
  return body as Record<string, unknown>;
}
