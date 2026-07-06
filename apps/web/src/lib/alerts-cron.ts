/**
 * Alerts cron (§M6). Alert rules previously only fired when a human clicked "evaluate"; this drives
 * evaluation automatically for every project on each scheduled tick. Each evaluation records events
 * and delivers any triggered alert whose rule names a channel + target (handled in the API store).
 */

interface ApiResponse {
  status: number;
  body: unknown;
}

type ApiCaller = (method: string, path: string, body?: unknown) => Promise<ApiResponse>;

function unwrap<T>(response: ApiResponse): T {
  return (response.body as { data?: T } | null)?.data as T;
}

export interface EvaluateAllAlertsResult {
  projects: number;
  evaluated: number;
  triggered: number;
}

export async function evaluateAllAlerts(call: ApiCaller): Promise<EvaluateAllAlertsResult> {
  const projects = unwrap<Array<{ id: string }>>(await call("GET", "/projects")) ?? [];
  let evaluated = 0;
  let triggered = 0;
  for (const project of projects) {
    const response = await call("POST", `/projects/${project.id}/alerts/evaluate`);
    if (response.status >= 400) continue;
    const events = unwrap<Array<{ triggered: boolean }>>(response) ?? [];
    evaluated += events.length;
    triggered += events.filter((event) => event.triggered).length;
  }
  return { projects: projects.length, evaluated, triggered };
}
