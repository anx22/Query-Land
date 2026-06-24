import { AppShell } from "../../components/app-shell";
import { createProjectAction, createSiteAction } from "./actions";
import { loadProjectControlData } from "../../lib/foundation-api";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const data = await loadProjectControlData();
  const feedback = feedbackMessage(params?.created, params?.error);

  return (
    <AppShell activePath="/projects">
      <section className="card hero-card">
        <p className="kicker">Projekte</p>
        <h1>Projekte &amp; Sites</h1>
        <p>
          Verwalten Sie Projekte, Site-Scopes, Märkte und Business-Werte — die Grundlage für alle Analysen und Optimierungschancen.
        </p>
        <div className="badge-row">
          <span className="badge primary">{data.projects.length} Projekte</span>
          <span className="badge">{data.projectSites.reduce((sum, item) => sum + item.sites.length, 0)} Sites</span>
          <span className={data.connected ? "badge success" : "badge danger"}>{data.connected ? "API verbunden" : "API offline"}</span>
        </div>
        {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
        {!data.connected ? <p className="notice danger">{data.errorMessage} · Erwartete API: {data.apiBaseUrl}</p> : null}
      </section>

      <section className="content-grid">
        <form className="card form-card" action={createProjectAction}>
          <p className="kicker">Projekt anlegen</p>
          <label>
            Name
            <input name="name" required placeholder="Owned Web Platform" />
          </label>
          <label>
            Slug
            <input name="slug" required pattern="[a-z0-9-]+" placeholder="owned-web-platform" />
          </label>
          <label>
            Default Locale
            <input name="defaultLocale" defaultValue="de-DE" />
          </label>
          <button className="button" type="submit" disabled={!data.connected}>Projekt speichern</button>
        </form>

        <form className="card form-card" action={createSiteAction}>
          <p className="kicker">Site-Scope anlegen</p>
          <label>
            Projekt
            <select name="projectId" required disabled={!data.connected || data.projects.length === 0}>
              {data.projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label>
            Base URL
            <input name="baseUrl" required type="url" placeholder="https://example.com" />
          </label>
          <label>
            Scope Type
            <select name="scopeType" defaultValue="domain">
              <option value="domain">Domain</option>
              <option value="subdomain">Subdomain</option>
              <option value="folder">Folder</option>
            </select>
          </label>
          <label>
            Crawl Frequency
            <select name="crawlFrequency" defaultValue="weekly">
              <option value="manual">Manual</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          <label>
            Business Value
            <input name="businessValue" type="number" min="1" max="100" defaultValue="50" />
          </label>
          <button className="button" type="submit" disabled={!data.connected || data.projects.length === 0}>Site speichern</button>
        </form>
      </section>

      <section className="card">
        <p className="kicker">Persistierte Project-/Site-Tabelle</p>
        {data.projectSites.length > 0 ? (
          <div className="entity-list">
            {data.projectSites.map(({ project, sites }) => (
              <article key={project.id} className="entity-row">
                <div>
                  <strong>{project.name}</strong>
                  <span>{project.slug} · {project.status} · {project.defaultLocale}</span>
                </div>
                <div className="nested-list">
                  {sites.length > 0 ? sites.map((site) => (
                    <span key={site.id}>{site.baseUrl} · {site.scopeType} · {site.crawlFrequency} · Value {site.businessValue}</span>
                  )) : <span>Keine Site-Scopes angelegt.</span>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p>Noch keine Projekte aus der API geladen.</p>
        )}
      </section>
    </AppShell>
  );
}

function feedbackMessage(created: string | string[] | undefined, error: string | string[] | undefined): { kind: "success" | "danger"; message: string } | null {
  const errorValue = Array.isArray(error) ? error[0] : error;
  if (errorValue) return { kind: "danger", message: errorValue };
  const createdValue = Array.isArray(created) ? created[0] : created;
  if (createdValue === "project") return { kind: "success", message: "Projekt wurde gespeichert." };
  if (createdValue === "site") return { kind: "success", message: "Site-Scope wurde gespeichert." };
  return null;
}
