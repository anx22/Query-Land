import { AppShell } from "../../components/app-shell";
import { MetricCard } from "../../components/metric-card";
import { StatusList } from "../../components/status-list";
import { loadTechnicalAuditData } from "../../features/technical-audit";
import { computeHealthAction, dismissIssueAction, reopenIssueAction, resolveIssueAction, startCrawlAction } from "../../features/technical-audit/actions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const issueStatus = singleParam(params?.issueStatus) ?? "open";
  const issueSeverity = singleParam(params?.severity) ?? "all";
  const urlOffset = Math.max(0, Number.parseInt(singleParam(params?.urlOffset) ?? "0", 10) || 0);
  const data = await loadTechnicalAuditData({ issueStatus, issueSeverity, urlOffset });
  const latestHealth = data.healthScores[0] ?? null;
  const latestRun = data.crawlRuns[0] ?? null;
  const openIssues = data.auditIssues.filter((issue) => issue.resolvedAt === null);
  const filteredIssues = data.auditIssues;
  const nextUrlOffset = data.urlExplorerMeta.offset + data.urlExplorerRows.length;
  const previousUrlOffset = Math.max(0, data.urlExplorerMeta.offset - data.urlExplorerMeta.limit);
  const feedback = feedbackMessage(params?.started, params?.health, params?.issue, params?.error);
  const crawlRunItems = data.crawlRuns.length > 0
    ? data.crawlRuns.map((run) => ({
      id: run.id,
      label: `${run.trigger} · ${new Date(run.startedAt).toLocaleString("de-DE")}`,
      status: run.status,
      statusClassName: `status ${run.status}`
    }))
    : [{ id: "crawl-empty", label: "Noch kein Crawl Run", status: "empty", statusClassName: "status blocked" }];

  return (
    <AppShell activePath="/technical-audit">
      <section className="card hero-card">
        <p className="kicker">Technical Audit</p>
        <h1>Crawl Runs, Health & URL Explorer</h1>
        <p>
          Welle-2 UI-Slice: Die Seite liest Crawl Runs, Health Scores, Audit Issues und Discovered URLs aus SQLite/API. Der Worker folgt als nächster Ausführungsslice; hier wird die Bedienoberfläche an die bestehenden Contracts gebunden.
        </p>
        <div className="badge-row">
          <span className="badge primary">{data.selectedProject?.name ?? "kein Projekt"}</span>
          <span className="badge">{data.selectedSite?.baseUrl ?? "keine Site"}</span>
          <span className={data.connected ? "badge success" : "badge danger"}>{data.connected ? "API verbunden" : "API offline"}</span>
        </div>
        {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
        {!data.connected ? <p className="notice danger">{data.errorMessage} · Erwartete API: {data.apiBaseUrl}</p> : null}
        <div className="action-row">
          <form action={startCrawlAction}>
            <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
            <input type="hidden" name="siteId" value={data.selectedSite?.id ?? ""} />
            <input type="hidden" name="baseUrl" value={data.selectedSite?.baseUrl ?? ""} />
            <button className="button" type="submit" disabled={!data.connected || !data.selectedProject || !data.selectedSite}>Crawl starten</button>
          </form>
          <form action={computeHealthAction}>
            <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
            <input type="hidden" name="siteId" value={data.selectedSite?.id ?? ""} />
            <button className="button secondary" type="submit" disabled={!data.connected || !data.selectedProject || !data.selectedSite}>Health neu berechnen</button>
          </form>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard label="Health Score" value={latestHealth ? String(latestHealth.score) : "—"} note={latestHealth ? `${latestHealth.totalIssues} offene Issues gewertet` : "noch kein Score"} />
        <MetricCard label="Crawl Runs" value={String(data.crawlRunsMeta.total)} note={latestRun ? `letzter Status ${latestRun.status}` : "noch kein Run"} />
        <MetricCard label="Open Issues" value={String(openIssues.length)} note={`${data.auditIssuesMeta.total} Issues im Filter`} />
        <MetricCard label="Discovered URLs" value={String(data.discoveredUrlsMeta.total)} note={`${data.urlExplorerRows.length} im Explorer geladen`} />
      </section>

      <section className="content-grid">
        <div className="card">
          <p className="kicker">Crawl Runs</p>
          <StatusList items={crawlRunItems} />
        </div>
        <div className="card">
          <p className="kicker">Health Breakdown</p>
          {latestHealth ? (
            <div className="table-list">
              {Object.entries(latestHealth.issueCounts).map(([severity, count]) => (
                <article key={severity}>
                  <strong>{severity}</strong>
                  <span>{count} offene Issues</span>
                </article>
              ))}
            </div>
          ) : (
            <p>Noch kein Health Score berechnet.</p>
          )}
        </div>
      </section>

      <section className="content-grid">
        <div className="card">
          <p className="kicker">Web Vitals (PSI)</p>
          <p className="muted">Core Web Vitals aus dem PageSpeed-Connector (Confidence-Klasse B), neueste Messung je Kennzahl.</p>
          {data.webVitals.length > 0 ? (
            <div className="table-list">
              {data.webVitals.map((vital) => (
                <article key={vital.metric}>
                  <strong>{webVitalLabel(vital.metric)}</strong>
                  <span>{formatWebVital(vital.metric, vital.value)} · Quelle {vital.sourceConfidence} · {new Date(vital.measuredAt).toLocaleString("de-DE")}</span>
                </article>
              ))}
            </div>
          ) : (
            <p>Noch keine Web Vitals. Lege einen PageSpeed-Connector an und synchronisiere ihn für diese Site.</p>
          )}
        </div>
      </section>

      <section className="content-grid">
        <div className="card">
          <p className="kicker">Issue Tabelle</p>
          <p className="muted">Serverseitig limitiert: {data.auditIssues.length} von {data.auditIssuesMeta.total} Issues geladen.</p>
          <form className="filter-row" action="/technical-audit">
            <label>
              Status
              <select name="issueStatus" defaultValue={issueStatus}>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="all">Alle</option>
              </select>
            </label>
            <label>
              Severity
              <select name="severity" defaultValue={issueSeverity}>
                <option value="all">Alle</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <input type="hidden" name="urlOffset" value={String(urlOffset)} />
            <button className="button secondary" type="submit">Filtern</button>
          </form>
          {data.auditIssues.length > 0 ? (
            <div className="table-list">
              {filteredIssues.map((issue) => (
                <article key={issue.id}>
                  <strong>{issue.severity.toUpperCase()} · {issue.rule}</strong>
                  <span>{issue.url}</span>
                  <span>{issue.message} · {issue.resolvedAt ? `resolved ${new Date(issue.resolvedAt).toLocaleString("de-DE")}` : "open"}</span>
                  <div className="inline-actions">
                    <IssueActionForm action={issue.resolvedAt ? reopenIssueAction : resolveIssueAction} projectId={data.selectedProject?.id ?? ""} siteId={data.selectedSite?.id ?? ""} issueId={issue.id} disabled={!data.connected} label={issue.resolvedAt ? "Reopen" : "Als resolved markieren"} />
                    {!issue.resolvedAt ? (
                      <IssueActionForm action={dismissIssueAction} projectId={data.selectedProject?.id ?? ""} siteId={data.selectedSite?.id ?? ""} issueId={issue.id} disabled={!data.connected} label="Dismiss" />
                    ) : null}
                  </div>
                </article>
              ))}
              {filteredIssues.length === 0 ? <p>Keine Issues für die aktiven Filter.</p> : null}
            </div>
          ) : (
            <p>Keine Audit Issues gespeichert. Der Worker-Slice wird diese Tabelle befüllen.</p>
          )}
        </div>
        <div className="card">
          <p className="kicker">URL Explorer</p>
          <p className="muted">Seite {Math.floor(data.urlExplorerMeta.offset / Math.max(data.urlExplorerMeta.limit, 1)) + 1}: {data.urlExplorerRows.length} von {data.urlExplorerMeta.total} URLs geladen; latest Fetch und Indexability kommen aggregiert aus einem API-Endpoint.</p>
          {data.urlExplorerRows.length > 0 ? (
            <>
              <div className="table-list">
                {data.urlExplorerRows.map((row) => (
                  <article key={row.discoveredUrl.id}>
                    <strong>{row.discoveredUrl.normalizedUrl}</strong>
                    <span>{row.discoveredUrl.source} · depth {row.discoveredUrl.depth} · discovered {new Date(row.discoveredUrl.discoveredAt).toLocaleString("de-DE")}</span>
                    <span>
                      Fetch: {row.latestFetch ? `${row.latestFetch.statusClass} · ${row.latestFetch.statusCode ?? "network"} · ${new Date(row.latestFetch.fetchedAt).toLocaleString("de-DE")}` : "noch kein Fetch"}
                    </span>
                    <span>
                      Indexability: {row.latestIndexability ? `${row.latestIndexability.state} · ${row.latestIndexability.isIndexable ? "indexable" : "not indexable"}` : "noch keine Bewertung"}
                    </span>
                    {row.latestIndexability?.reasons.length ? <span>Reasons: {row.latestIndexability.reasons.join(", ")}</span> : null}
                  </article>
                ))}
              </div>
              <div className="action-row">
                {data.urlExplorerMeta.offset > 0 ? (
                  <a className="button secondary" href={technicalAuditHref(issueStatus, issueSeverity, previousUrlOffset)}>Zurück</a>
                ) : null}
                {data.urlExplorerMeta.nextCursor ? (
                  <a className="button secondary" href={technicalAuditHref(issueStatus, issueSeverity, nextUrlOffset)}>Mehr laden</a>
                ) : null}
              </div>
            </>
          ) : (
            <p>Noch keine Discovered URLs für die ausgewählte Site.</p>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function IssueActionForm({ action, projectId, siteId, issueId, disabled, label }: { action: (formData: FormData) => Promise<void>; projectId: string; siteId: string; issueId: string; disabled: boolean; label: string }) {
  return (
    <form action={action}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="issueId" value={issueId} />
      <button className="button secondary compact" type="submit" disabled={disabled}>{label}</button>
    </form>
  );
}

function feedbackMessage(started: string | string[] | undefined, health: string | string[] | undefined, issue: string | string[] | undefined, error: string | string[] | undefined): { kind: "success" | "danger"; message: string } | null {
  const errorValue = Array.isArray(error) ? error[0] : error;
  const issueValue = Array.isArray(issue) ? issue[0] : issue;
  if (errorValue) return { kind: "danger", message: errorValue };
  if (started) return { kind: "success", message: "Crawl Run und crawl_seed Job wurden angelegt." };
  if (health) return { kind: "success", message: "Health Score wurde neu berechnet." };
  if (issueValue === "dismiss") return { kind: "success", message: "Issue wurde dismissed und Health neu berechnet." };
  if (issueValue === "reopen") return { kind: "success", message: "Issue wurde wieder geöffnet und Health neu berechnet." };
  if (issueValue === "resolve") return { kind: "success", message: "Issue wurde als resolved markiert und Health neu berechnet." };
  return null;
}

const webVitalLabels: Record<string, string> = {
  psi_lcp_ms: "LCP",
  psi_cls: "CLS",
  psi_inp_ms: "INP",
  psi_ttfb_ms: "TTFB"
};

function webVitalLabel(metric: string): string {
  return webVitalLabels[metric] ?? metric;
}

function formatWebVital(metric: string, value: number): string {
  return metric.endsWith("_ms") ? `${Math.round(value)} ms` : String(value);
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function technicalAuditHref(issueStatus: string, issueSeverity: string, urlOffset: number): string {
  const params = new URLSearchParams({ issueStatus, severity: issueSeverity, urlOffset: String(urlOffset) });
  return `/technical-audit?${params.toString()}`;
}
