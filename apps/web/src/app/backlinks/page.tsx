import type { BacklinkChange, BacklinkSnapshot } from "@seo-tool/domain-model";
import { AppShell } from "../../components/app-shell";
import { MetricCard } from "../../components/metric-card";
import { loadBacklinkAuthority } from "../../features/backlinks";
import { importBacklinksAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const data = await loadBacklinkAuthority();
  const feedback = feedbackMessage(params);

  const followRatioPct = data.authority ? `${(data.authority.followRatio * 100).toFixed(1)} %` : "—";
  const netBacklinks = data.diff ? (data.diff.netBacklinkChange >= 0 ? `+${data.diff.netBacklinkChange}` : String(data.diff.netBacklinkChange)) : "—";
  const netDomains = data.diff ? (data.diff.netReferringDomainChange >= 0 ? `+${data.diff.netReferringDomainChange}` : String(data.diff.netReferringDomainChange)) : "—";
  const hasData = data.authority !== null || data.snapshots.length > 0;

  return (
    <AppShell activePath="/backlinks">
      <section className="card hero-card">
        <p className="kicker">Authority &amp; Backlinks</p>
        <h1>Backlink-Profil</h1>
        <p>
          Backlink-Profil und Authority-Messung. Importieren Sie den GSC-Links-Report, um Backlinks, verweisende Domains, Follow-Ratio, Zu- und Abgänge sowie die Anchor-Verteilung auszuwerten.
        </p>
        <div className="badge-row">
          <span className="badge primary">{data.selectedProject?.name ?? "kein Projekt"}</span>
          <span className="badge">{data.snapshots.length} Snapshot{data.snapshots.length !== 1 ? "s" : ""}</span>
          <span className={data.connected ? "badge success" : "badge danger"}>{data.connected ? "API verbunden" : "API offline"}</span>
        </div>
        {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
        {!data.connected ? <p className="notice danger">{data.errorMessage} · Erwartete API: {data.apiBaseUrl}</p> : null}
        {data.connected && !hasData ? (
          <p className="notice">Noch keine Backlink-Daten vorhanden. Klicke „Backlinks importieren", um den ersten Snapshot zu erstellen.</p>
        ) : null}
        <div className="action-row">
          <form action={importBacklinksAction}>
            <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
            <button className="button" type="submit" disabled={!data.connected || !data.selectedProject}>Backlinks importieren</button>
          </form>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard
          label="Backlinks gesamt"
          value={data.authority ? String(data.authority.totalBacklinks) : "—"}
          note={hasData ? undefined : "noch kein Import"}
        />
        <MetricCard
          label="Verweisende Domains"
          value={data.authority ? String(data.authority.referringDomains) : "—"}
          note={data.referringDomains.length > 0 ? `${data.referringDomains.length} geladen` : undefined}
        />
        <MetricCard
          label="Follow-Ratio"
          value={followRatioPct}
          note="Anteil Follow-Links"
        />
        <MetricCard
          label="Netto-Veränderung"
          value={data.diff ? `${netBacklinks} Links / ${netDomains} Domains` : "—"}
          note={data.diff ? `${data.diff.newBacklinks.length} neu · ${data.diff.lostBacklinks.length} verloren` : "kein Diff (< 2 Snapshots)"}
        />
      </section>

      <section className="content-grid">
        <div className="card">
          <p className="kicker">Top verweisende Domains</p>
          {data.authority && data.authority.topReferringDomains.length > 0 ? (
            <div className="table-list">
              {data.authority.topReferringDomains.map((rd) => (
                <article key={rd.domain}>
                  <strong>{rd.domain}</strong>
                  <span>{rd.backlinks} Backlinks · {rd.targetUrls} Ziel-URLs</span>
                  <span className="muted">Follow-Anteil {(rd.followShare * 100).toFixed(1)} %</span>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">Noch keine Daten. Importiere Backlinks.</p>
          )}
        </div>

        <div className="card">
          <p className="kicker">Top Anchors</p>
          {data.authority && data.authority.topAnchors.length > 0 ? (
            <div className="table-list">
              {data.authority.topAnchors.map((anchor) => (
                <article key={anchor.anchorText || "(leer)"}>
                  <strong>{anchor.anchorText || "(kein Ankertext)"}</strong>
                  <span>{anchor.count}× · {(anchor.share * 100).toFixed(1)} %</span>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">Noch keine Anchor-Daten.</p>
          )}
        </div>

        <div className="card">
          <p className="kicker">Top Ziel-URLs</p>
          {data.authority && data.authority.topTargetUrls.length > 0 ? (
            <div className="table-list">
              {data.authority.topTargetUrls.map((tu) => (
                <article key={tu.targetUrl}>
                  <strong className="muted">{tu.targetUrl}</strong>
                  <span>{tu.backlinks} Backlinks · {tu.referringDomains} Domains</span>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">Noch keine Ziel-URL-Daten.</p>
          )}
        </div>
      </section>

      {data.diff ? (
        <section className="content-grid">
          <div className="card">
            <p className="kicker">Neue Backlinks ({data.diff.newBacklinks.length})</p>
            {data.diff.newBacklinks.length > 0 ? (
              <div className="table-list">
                {data.diff.newBacklinks.slice(0, 20).map((bl) => (
                  <BacklinkChangeRow key={`new-${bl.sourceUrl}-${bl.targetUrl}`} change={bl} />
                ))}
                {data.diff.newBacklinks.length > 20 ? <p className="muted">… und {data.diff.newBacklinks.length - 20} weitere</p> : null}
              </div>
            ) : (
              <p className="muted">Keine neuen Backlinks seit dem letzten Snapshot.</p>
            )}
          </div>

          <div className="card">
            <p className="kicker">Verlorene Backlinks ({data.diff.lostBacklinks.length})</p>
            {data.diff.lostBacklinks.length > 0 ? (
              <div className="table-list">
                {data.diff.lostBacklinks.slice(0, 20).map((bl) => (
                  <BacklinkChangeRow key={`lost-${bl.sourceUrl}-${bl.targetUrl}`} change={bl} />
                ))}
                {data.diff.lostBacklinks.length > 20 ? <p className="muted">… und {data.diff.lostBacklinks.length - 20} weitere</p> : null}
              </div>
            ) : (
              <p className="muted">Keine verlorenen Backlinks seit dem letzten Snapshot.</p>
            )}
          </div>

          <div className="card">
            <p className="kicker">Neue verweisende Domains ({data.diff.newReferringDomains.length})</p>
            {data.diff.newReferringDomains.length > 0 ? (
              <ul>
                {data.diff.newReferringDomains.slice(0, 20).map((domain) => (
                  <li key={`newdom-${domain}`}>{domain}</li>
                ))}
                {data.diff.newReferringDomains.length > 20 ? <li className="muted">… und {data.diff.newReferringDomains.length - 20} weitere</li> : null}
              </ul>
            ) : (
              <p className="muted">Keine neuen Domains.</p>
            )}
            <p className="kicker" style={{ marginTop: "1rem" }}>Verlorene Domains ({data.diff.lostReferringDomains.length})</p>
            {data.diff.lostReferringDomains.length > 0 ? (
              <ul>
                {data.diff.lostReferringDomains.slice(0, 20).map((domain) => (
                  <li key={`lostdom-${domain}`}>{domain}</li>
                ))}
                {data.diff.lostReferringDomains.length > 20 ? <li className="muted">… und {data.diff.lostReferringDomains.length - 20} weitere</li> : null}
              </ul>
            ) : (
              <p className="muted">Keine verlorenen Domains.</p>
            )}
          </div>
        </section>
      ) : null}

      <section className="card">
        <p className="kicker">Snapshot-Verlauf ({data.snapshots.length})</p>
        {data.snapshots.length > 0 ? (
          <div className="table-list">
            {data.snapshots.map((snap) => (
              <SnapshotRow key={snap.id} snapshot={snap} />
            ))}
          </div>
        ) : (
          <p>Noch keine Snapshots. Klicke „Backlinks importieren", um den ersten Snapshot zu erstellen.</p>
        )}
      </section>
    </AppShell>
  );
}

function BacklinkChangeRow({ change }: { change: BacklinkChange }) {
  return (
    <article>
      <strong className="muted">{change.sourceDomain}</strong>
      <span>{change.sourceUrl}</span>
      <span>→ {change.targetUrl}</span>
      <span className="muted">{change.anchorText || "(kein Ankertext)"} · {change.linkType}</span>
    </article>
  );
}

function SnapshotRow({ snapshot }: { snapshot: BacklinkSnapshot }) {
  const date = new Date(snapshot.capturedAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
  return (
    <article>
      <strong>{date}</strong>
      <span>{snapshot.totalBacklinks} Backlinks · {snapshot.referringDomains} Domains</span>
      <span className="muted">Quelle {snapshot.sourceConfidence}</span>
    </article>
  );
}

function feedbackMessage(params: Record<string, string | string[] | undefined> | undefined): { kind: "success" | "danger"; message: string } | null {
  const error = singleParam(params?.error);
  if (error) return { kind: "danger", message: error };
  if (singleParam(params?.imported)) return { kind: "success", message: "Backlink-Import gestartet. Der neue Snapshot wird in Kürze verfügbar sein." };
  return null;
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
