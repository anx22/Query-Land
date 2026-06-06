import type { Opportunity, OpportunityStatus } from "@seo-tool/domain-model";
import { AppShell } from "../../components/app-shell";
import { MetricCard } from "../../components/metric-card";
import { loadOpportunityBoard, OPPORTUNITY_STATUSES } from "../../features/content-opportunities";
import { generateOpportunitiesAction, revalidateOpportunityAction, transitionOpportunityAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const statusFilter = singleParam(params?.status) ?? "all";
  const data = await loadOpportunityBoard({ status: statusFilter });
  const feedback = feedbackMessage(params);
  const openCount = data.opportunities.filter((o) => !["validated", "dismissed", "expired"].includes(o.status)).length;
  const validatedCount = data.opportunities.filter((o) => o.status === "validated").length;

  return (
    <AppShell activePath="/content-opportunities">
      <section className="card hero-card">
        <p className="kicker">Content &amp; Opportunities</p>
        <h1>Opportunity Board</h1>
        <p>
          Die zentrale Einheit (§6): Beobachtung → Evidenz → Ursache → Priorität → Maßnahme → Validierung. v0 liest priorisierte Opportunities aus der API, erlaubt Statuswechsel und die binäre Re-Validierung von Indexierbarkeits-Fixes.
        </p>
        <div className="badge-row">
          <span className="badge primary">{data.selectedProject?.name ?? "kein Projekt"}</span>
          <span className="badge">{data.selectedSite?.baseUrl ?? "keine Site"}</span>
          <span className={data.connected ? "badge success" : "badge danger"}>{data.connected ? "API verbunden" : "API offline"}</span>
        </div>
        {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
        {!data.connected ? <p className="notice danger">{data.errorMessage} · Erwartete API: {data.apiBaseUrl}</p> : null}
        <div className="action-row">
          <form action={generateOpportunitiesAction}>
            <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
            <input type="hidden" name="siteId" value={data.selectedSite?.id ?? ""} />
            <button className="button" type="submit" disabled={!data.connected || !data.selectedProject || !data.selectedSite}>Aus Indexierbarkeit generieren</button>
          </form>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard label="Opportunities" value={String(data.opportunitiesMeta.total)} note={`${data.opportunities.length} im Filter geladen`} />
        <MetricCard label="Aktiv (offen)" value={String(openCount)} note="nicht validiert/dismissed/expired" />
        <MetricCard label="Validiert" value={String(validatedCount)} note="Vorher/Nachher bestätigt" />
        <MetricCard label="Top-Priorität" value={data.opportunities[0] ? String(data.opportunities[0].priority) : "—"} note={data.opportunities[0]?.type ?? "noch keine"} />
      </section>

      <section className="content-grid">
        <div className="card">
          <p className="kicker">Board</p>
          <form className="filter-row" action="/content-opportunities">
            <label>
              Status
              <select name="status" defaultValue={statusFilter}>
                <option value="all">Alle</option>
                {OPPORTUNITY_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            <button className="button secondary" type="submit">Filtern</button>
          </form>
          {data.opportunities.length > 0 ? (
            <div className="table-list">
              {data.opportunities.map((opportunity) => (
                <article key={opportunity.id}>
                  <strong>{opportunity.type} · Prio {opportunity.priority}</strong>
                  <span className={`status ${opportunity.status}`}>{opportunity.status}</span>
                  <span>{opportunity.currentState}</span>
                  <span>Maßnahme: {opportunity.recommendedAction}</span>
                  <span>Validierung: {opportunity.validationMetric} · {opportunity.affectedUrls.join(", ") || "keine URL"}</span>
                  <span className="muted">
                    Evidenz: {opportunity.evidence.map((evidence) => `${evidence.source} (${evidence.sourceConfidence}) ${evidence.metric}: ${String(evidence.beforeValue)}→${String(evidence.currentValue)}`).join(" · ") || "—"}
                  </span>
                  <div className="inline-actions">
                    {opportunity.status === "implemented" ? (
                      <OpportunityForm action={revalidateOpportunityAction} opportunityId={opportunity.id} disabled={!data.connected} label="Re-Validieren" />
                    ) : null}
                    {transitionsFor(opportunity.status).map((next) => (
                      <TransitionForm key={next} opportunityId={opportunity.id} status={next} disabled={!data.connected} />
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>Keine Opportunities im Filter. Lege mit „Aus Indexierbarkeit generieren" erste technische Fixes an (benötigt einen Crawl mit Indexierbarkeits-Blockern).</p>
          )}
        </div>
      </section>
    </AppShell>
  );
}

// v0-Aktionssatz pro Status (Teilmenge des §6.5-Statusmodells; die API erzwingt die Regeln).
function transitionsFor(status: OpportunityStatus): OpportunityStatus[] {
  switch (status) {
    case "open": return ["in_progress", "dismissed"];
    case "planned": return ["in_progress", "dismissed"];
    case "in_progress": return ["implemented", "dismissed"];
    case "implemented": return ["dismissed"];
    case "validated": return ["reopened"];
    case "reopened": return ["in_progress", "dismissed"];
    case "dismissed": return ["open"];
    case "expired": return ["open"];
    default: return [];
  }
}

function TransitionForm({ opportunityId, status, disabled }: { opportunityId: string; status: OpportunityStatus; disabled: boolean }) {
  return (
    <form action={transitionOpportunityAction}>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="status" value={status} />
      <button className="button secondary compact" type="submit" disabled={disabled}>→ {status}</button>
    </form>
  );
}

function OpportunityForm({ action, opportunityId, disabled, label }: { action: (formData: FormData) => Promise<void>; opportunityId: string; disabled: boolean; label: string }) {
  return (
    <form action={action}>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <button className="button compact" type="submit" disabled={disabled}>{label}</button>
    </form>
  );
}

function feedbackMessage(params: Record<string, string | string[] | undefined> | undefined): { kind: "success" | "danger"; message: string } | null {
  const error = singleParam(params?.error);
  if (error) return { kind: "danger", message: error };
  if (singleParam(params?.generated)) return { kind: "success", message: "Opportunities aus Indexierbarkeits-Blockern generiert." };
  if (singleParam(params?.revalidated)) return { kind: "success", message: "Opportunity re-validiert (validated oder reopened)." };
  const transition = singleParam(params?.transition);
  if (transition) return { kind: "success", message: `Status gewechselt zu ${transition}.` };
  return null;
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
