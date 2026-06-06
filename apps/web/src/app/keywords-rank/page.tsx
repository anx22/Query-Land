import { AppShell } from "../../components/app-shell";
import { MetricCard } from "../../components/metric-card";
import { KEYWORD_INTENT_OPTIONS, loadKeywordLibrary } from "../../features/keyword-rank";
import { addKeywordsAction, computeVisibilityAction, createKeywordGroupAction, recordRankAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const intentFilter = singleParam(params?.intent) ?? "all";
  const data = await loadKeywordLibrary({ intent: intentFilter });
  const feedback = feedbackMessage(params);
  const brandCount = data.keywords.filter((keyword) => keyword.brand).length;

  return (
    <AppShell activePath="/keywords-rank">
      <section className="card hero-card">
        <p className="kicker">Keywords &amp; Rank</p>
        <h1>Keyword-Bibliothek</h1>
        <p>
          Welle 3: kuratiertes Keyword-Universum statt Datenmasse (§2.5). Keywords werden automatisch nach Intent, Brand und Funnel-Stage klassifiziert und Themen-Clustern zugeordnet (DACH, DEC-003).
        </p>
        <div className="badge-row">
          <span className="badge primary">{data.selectedProject?.name ?? "kein Projekt"}</span>
          <span className="badge">{data.groups.length} Cluster</span>
          <span className={data.connected ? "badge success" : "badge danger"}>{data.connected ? "API verbunden" : "API offline"}</span>
        </div>
        {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
        {!data.connected ? <p className="notice danger">{data.errorMessage} · Erwartete API: {data.apiBaseUrl}</p> : null}
        <div className="action-row">
          <form action={computeVisibilityAction}>
            <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
            <button className="button secondary" type="submit" disabled={!data.connected || !data.selectedProject}>Visibility neu berechnen</button>
          </form>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard label="Visibility-Index" value={data.visibility ? String(data.visibility.score) : "—"} note={data.visibility ? `${data.visibility.trackedKeywords} getrackt · Ø Pos ${data.visibility.averagePosition ?? "—"}` : "noch nicht berechnet"} />
        <MetricCard label="Keywords" value={String(data.keywordsMeta.total)} note={`${data.keywords.length} im Filter`} />
        <MetricCard label="Cluster" value={String(data.groups.length)} note="Themen-/Keyword-Gruppen" />
        <MetricCard label="Brand" value={String(brandCount)} note="im aktuellen Filter" />
      </section>

      <section className="content-grid">
        <div className="card">
          <p className="kicker">Keywords hinzufügen</p>
          <form className="form-card" action={addKeywordsAction}>
            <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
            <label>Keywords (eines pro Zeile)<textarea name="phrases" rows={5} placeholder={"seo tool kaufen\nahrefs vs semrush\nwie funktioniert seo"} required /></label>
            <label>Cluster (optional)
              <select name="groupId" defaultValue="">
                <option value="">— kein Cluster —</option>
                {data.groups.map((group) => (<option key={group.id} value={group.id}>{group.name}</option>))}
              </select>
            </label>
            <label>Brand-Begriffe (kommagetrennt, optional)<input name="brandTerms" placeholder="AuraSEO, acme" /></label>
            <button className="button" type="submit" disabled={!data.connected || !data.selectedProject}>Klassifizieren &amp; speichern</button>
          </form>
        </div>
        <div className="card">
          <p className="kicker">Cluster anlegen</p>
          <form className="form-card" action={createKeywordGroupAction}>
            <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
            <label>Name<input name="name" placeholder="Pricing" required /></label>
            <label>Thema (optional)<input name="topic" placeholder="Money pages" /></label>
            <button className="button secondary" type="submit" disabled={!data.connected || !data.selectedProject}>Cluster anlegen</button>
          </form>
        </div>
      </section>

      <section className="content-grid">
        <div className="card">
          <p className="kicker">Keyword-Set</p>
          <form className="filter-row" action="/keywords-rank">
            <label>Intent
              <select name="intent" defaultValue={intentFilter}>
                <option value="all">Alle</option>
                {KEYWORD_INTENT_OPTIONS.map((intent) => (<option key={intent} value={intent}>{intent}</option>))}
              </select>
            </label>
            <button className="button secondary" type="submit">Filtern</button>
          </form>
          {data.keywords.length > 0 ? (
            <div className="table-list">
              {data.keywords.map((keyword) => (
                <article key={keyword.id}>
                  <strong>{keyword.phrase}</strong>
                  <span>{keyword.intent} · {keyword.funnelStage}{keyword.brand ? " · brand" : ""} · {keyword.market}</span>
                  <span className="muted">{keyword.targetUrl ? `→ ${keyword.targetUrl}` : "keine Ziel-URL"} · Quelle {keyword.sourceConfidence}</span>
                  <div className="inline-actions">
                    <form action={recordRankAction}>
                      <input type="hidden" name="projectId" value={data.selectedProject?.id ?? ""} />
                      <input type="hidden" name="keywordId" value={keyword.id} />
                      <button className="button secondary compact" type="submit" disabled={!data.connected}>Rang erfassen</button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>Noch keine Keywords im Filter. Füge oben welche hinzu.</p>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function feedbackMessage(params: Record<string, string | string[] | undefined> | undefined): { kind: "success" | "danger"; message: string } | null {
  const error = singleParam(params?.error);
  if (error) return { kind: "danger", message: error };
  if (singleParam(params?.added)) return { kind: "success", message: "Keywords klassifiziert und gespeichert." };
  if (singleParam(params?.group)) return { kind: "success", message: "Keyword-Cluster angelegt." };
  if (singleParam(params?.ranked)) return { kind: "success", message: "Rang-Snapshot erfasst (SERP-Provider-Stub)." };
  if (singleParam(params?.visibility)) return { kind: "success", message: "Visibility-Index neu berechnet." };
  return null;
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
