import { AppShell } from "../../components/app-shell";
import { MetricCard } from "../../components/metric-card";
import { StatusList } from "../../components/status-list";
import { loadTechnicalAuditData } from "../../lib/foundation-api";
import { computeHealthAction, startCrawlAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const data = await loadTechnicalAuditData();
  const latestHealth = data.healthScores[0] ?? null;
  const latestRun = data.crawlRuns[0] ?? null;
  const openIssues = data.auditIssues.filter((issue) => issue.resolvedAt === null);
  const feedback = feedbackMessage(params?.started, params?.health, params?.error);
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
        <MetricCard label="Crawl Runs" value={String(data.crawlRuns.length)} note={latestRun ? `letzter Status ${latestRun.status}` : "noch kein Run"} />
        <MetricCard label="Open Issues" value={String(openIssues.length)} note={`${data.auditIssues.length} Issues insgesamt`} />
        <MetricCard label="Discovered URLs" value={String(data.discoveredUrls.length)} note="aus /discovered-urls" />
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
          <p className="kicker">Issue Tabelle</p>
          {data.auditIssues.length > 0 ? (
            <div className="table-list">
              {data.auditIssues.map((issue) => (
                <article key={issue.id}>
                  <strong>{issue.severity.toUpperCase()} · {issue.rule}</strong>
                  <span>{issue.url}</span>
                  <span>{issue.message} · {issue.resolvedAt ? "resolved" : "open"}</span>
                </article>
              ))}
            </div>
          ) : (
            <p>Keine Audit Issues gespeichert. Der Worker-Slice wird diese Tabelle befüllen.</p>
          )}
        </div>
        <div className="card">
          <p className="kicker">URL Explorer</p>
          {data.discoveredUrls.length > 0 ? (
            <div className="table-list">
              {data.discoveredUrls.map((url) => (
                <article key={url.id}>
                  <strong>{url.normalizedUrl}</strong>
                  <span>{url.source} · depth {url.depth} · discovered {new Date(url.discoveredAt).toLocaleString("de-DE")}</span>
                </article>
              ))}
            </div>
          ) : (
            <p>Noch keine Discovered URLs für die ausgewählte Site.</p>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function feedbackMessage(started: string | string[] | undefined, health: string | string[] | undefined, error: string | string[] | undefined): { kind: "success" | "danger"; message: string } | null {
  const errorValue = Array.isArray(error) ? error[0] : error;
  if (errorValue) return { kind: "danger", message: errorValue };
  if (started) return { kind: "success", message: "Crawl Run und crawl_seed Job wurden angelegt." };
  if (health) return { kind: "success", message: "Health Score wurde neu berechnet." };
  return null;
}
