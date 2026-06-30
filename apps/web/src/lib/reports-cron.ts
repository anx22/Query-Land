/**
 * Reports cron helper — dispatch due report schedules across all projects.
 *
 * The daily Vercel cron (see api/cron/crawl) calls this so scheduled reports are actually generated
 * and delivered (webhook/email) once they fall due. Mirrors the connector-sync cron shape: it only
 * issues internal API calls and tolerates per-project failures so one bad project can't stall the rest.
 */

type Call = (method: string, path: string, body?: unknown) => Promise<{ status: number; body: unknown }>;

function dataOf<T>(response: { body: unknown }): T | undefined {
  return (response.body as { data?: T } | null)?.data;
}

export interface ReportsCronResult {
  projects: number;
  generated: number;
  failures: number;
}

export async function runDueReportSchedules(call: Call): Promise<ReportsCronResult> {
  const projects = dataOf<Array<{ id: string }>>(await call("GET", "/projects")) ?? [];
  let generated = 0;
  let failures = 0;
  for (const project of projects) {
    try {
      const result = dataOf<{ generated?: number }>(await call("POST", `/projects/${project.id}/report-schedules/run-due`, {}));
      generated += result?.generated ?? 0;
    } catch {
      failures += 1;
    }
  }
  return { projects: projects.length, generated, failures };
}
