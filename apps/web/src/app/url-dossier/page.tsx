import { AppShell } from "../../components/app-shell";
import { MetricCard } from "../../components/metric-card";
import { loadUrlDossier } from "../../features/url-dossier";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const url = singleParam(params?.url);
  const data = await loadUrlDossier({ url });

  return (
    <AppShell activePath="/url-dossier">
      <section className="card hero-card">
        <p className="kicker">URL Dossier</p>
        <h1>Eine URL als vollständiges SEO-Objekt</h1>
        <p>
          Crawl-Status, Indexierbarkeit, interne Verlinkung, Issues und Optimierungschancen für eine einzelne URL — inklusive Quell-Verknüpfung zur verantwortlichen Code-Stelle.
        </p>
        <div className="badge-row">
          <span className="badge primary">{data.selectedProject?.name ?? "kein Projekt"}</span>
          <span className="badge">{data.selectedSite?.baseUrl ?? "keine Site"}</span>
          <span className={data.connected ? "badge success" : "badge danger"}>{data.connected ? "API verbunden" : "API offline"}</span>
        </div>
        {!data.connected ? <p className="notice danger">{data.errorMessage} · Erwartete API: {data.apiBaseUrl}</p> : null}
        {data.urlOptions.length > 0 ? (
          <form className="filter-row" action="/url-dossier">
            <label>
              URL
              <select name="url" defaultValue={data.selectedUrl ?? ""}>
                {data.urlOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <button className="button secondary" type="submit">Öffnen</button>
          </form>
        ) : (
          <p className="notice">Noch keine Discovered URLs für die ausgewählte Site. Starte zuerst einen Crawl im Technical Audit.</p>
        )}
      </section>

      {data.selectedUrl ? (
        <>
          <section className="metric-grid">
            <MetricCard label="Fetch" value={data.latestFetch ? String(data.latestFetch.statusCode ?? "network") : "—"} note={data.latestFetch ? data.latestFetch.statusClass : "noch kein Fetch"} />
            <MetricCard label="Indexability" value={data.latestIndexability ? (data.latestIndexability.isIndexable ? "indexable" : "blocked") : "—"} note={data.latestIndexability?.state ?? "keine Bewertung"} />
            <MetricCard label="Inlinks / Outlinks" value={`${data.inlinks.length} / ${data.outlinks.length}`} note="interner Linkgraph" />
            <MetricCard label="Issues / Opps" value={`${data.issues.length} / ${data.opportunities.length}`} note="auf dieser URL" />
          </section>

          <section className="content-grid">
            <div className="card">
              <p className="kicker">Identität &amp; Quell-Verknüpfung</p>
              <div className="table-list">
                <article>
                  <strong>{data.selectedUrl}</strong>
                  <span>{data.discoveredUrl ? `${data.discoveredUrl.source} · depth ${data.discoveredUrl.depth}` : "keine Discovery-Daten"}</span>
                </article>
                <article>
                  <strong>Quell-Verknüpfung</strong>
                  {data.sourceAnchor ? (
                    <>
                      <span>{data.sourceAnchor.template} · {data.sourceAnchor.component}</span>
                      <span className="muted">{data.sourceAnchor.repoPath} · Confidence {data.sourceAnchor.confidence}</span>
                    </>
                  ) : (
                    <span className="muted">Kein Source-Anker. Lege in Settings eine URL→Repo-Zuordnung an.</span>
                  )}
                </article>
              </div>
            </div>
            <div className="card">
              <p className="kicker">Opportunities</p>
              {data.opportunities.length > 0 ? (
                <div className="table-list">
                  {data.opportunities.map((opportunity) => (
                    <article key={opportunity.id}>
                      <strong>{opportunity.type} · Prio {opportunity.priority}</strong>
                      <span className={`status ${opportunity.status}`}>{opportunity.status}</span>
                      <span>{opportunity.recommendedAction}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <p>Keine Opportunities für diese URL.</p>
              )}
            </div>
          </section>

          <section className="content-grid">
            <div className="card">
              <p className="kicker">Indexability-Historie</p>
              {data.indexabilityHistory.length > 0 ? (
                <div className="table-list">
                  {data.indexabilityHistory.map((record) => (
                    <article key={record.id}>
                      <strong>{record.state} · {record.isIndexable ? "indexable" : "not indexable"}</strong>
                      <span>{new Date(record.assessedAt).toLocaleString("de-DE")}</span>
                      {record.reasons.length ? <span className="muted">{record.reasons.join(", ")}</span> : null}
                    </article>
                  ))}
                </div>
              ) : (
                <p>Noch keine Indexability-Bewertungen.</p>
              )}
            </div>
            <div className="card">
              <p className="kicker">Fetch-Historie</p>
              {data.fetchHistory.length > 0 ? (
                <div className="table-list">
                  {data.fetchHistory.map((record) => (
                    <article key={record.id}>
                      <strong>{record.statusClass} · {record.statusCode ?? "network"}</strong>
                      <span>{new Date(record.fetchedAt).toLocaleString("de-DE")}</span>
                      {record.errorMessage ? <span className="muted">{record.errorMessage}</span> : null}
                    </article>
                  ))}
                </div>
              ) : (
                <p>Noch keine Fetch-Ergebnisse.</p>
              )}
            </div>
          </section>

          <section className="content-grid">
            <div className="card">
              <p className="kicker">Issues auf dieser URL</p>
              {data.issues.length > 0 ? (
                <div className="table-list">
                  {data.issues.map((issue) => (
                    <article key={issue.id}>
                      <strong>{issue.severity.toUpperCase()} · {issue.rule}</strong>
                      <span>{issue.message} · {issue.resolvedAt ? "resolved" : "open"}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <p>Keine Issues auf dieser URL.</p>
              )}
            </div>
            <div className="card">
              <p className="kicker">Interne Verlinkung</p>
              <div className="table-list">
                <article>
                  <strong>Inlinks ({data.inlinks.length})</strong>
                  {data.inlinks.slice(0, 8).map((edge) => <span key={edge.id}>{edge.fromUrl}{edge.anchor ? ` · „${edge.anchor}"` : ""}</span>)}
                  {data.inlinks.length === 0 ? <span className="muted">keine Inlinks (potenzielle Orphan-URL)</span> : null}
                </article>
                <article>
                  <strong>Outlinks ({data.outlinks.length})</strong>
                  {data.outlinks.slice(0, 8).map((edge) => <span key={edge.id}>{edge.toUrl}</span>)}
                  {data.outlinks.length === 0 ? <span className="muted">keine Outlinks erfasst</span> : null}
                </article>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
