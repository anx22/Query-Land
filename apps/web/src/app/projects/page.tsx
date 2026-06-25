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
        <h1>Projekte &amp; Websites</h1>
        <p>
          Legen Sie ein Projekt an und tragen Sie die Website ein, die Sie verbessern möchten — das ist die Grundlage für alle Auswertungen.
        </p>
        <div className="badge-row">
          <span className="badge primary">{data.projects.length} Projekte</span>
          <span className="badge">{data.projectSites.reduce((sum, item) => sum + item.sites.length, 0)} Websites</span>
          <span className={data.connected ? "badge success" : "badge danger"}>{data.connected ? "Verbunden" : "Nicht erreichbar"}</span>
        </div>
        {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
        {!data.connected ? <p className="notice danger">{data.errorMessage} · Erwartete API: {data.apiBaseUrl}</p> : null}
      </section>

      <section className="content-grid">
        <form className="card form-card" action={createProjectAction}>
          <p className="kicker">Neues Projekt</p>
          <label>
            Projektname
            <input name="name" required placeholder="z. B. Firmen-Website" />
          </label>
          <p className="muted form-hint">Ein Projekt bündelt alle Auswertungen einer Website. Die Adresse tragen Sie gleich daneben ein.</p>
          <details className="advanced-section">
            <summary>
              <span className="advanced-section__title">Erweitert</span>
              <span className="advanced-section__hint">Kennung und Sprache — werden sonst automatisch gesetzt.</span>
            </summary>
            <label>
              Kennung (optional)
              <input name="slug" pattern="[a-z0-9-]+" placeholder="wird aus dem Namen abgeleitet" />
            </label>
            <label>
              Sprache / Region
              <input name="defaultLocale" defaultValue="de-DE" />
            </label>
          </details>
          <button className="button" type="submit" disabled={!data.connected}>Projekt anlegen</button>
        </form>

        <form className="card form-card" action={createSiteAction}>
          <p className="kicker">Website hinzufügen</p>
          <label>
            Zu welchem Projekt?
            <select name="projectId" required disabled={!data.connected || data.projects.length === 0}>
              {data.projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label>
            Website-Adresse
            <input name="baseUrl" required type="url" placeholder="https://ihre-website.de" />
          </label>
          <details className="advanced-section">
            <summary>
              <span className="advanced-section__title">Erweitert</span>
              <span className="advanced-section__hint">Umfang, Prüf-Rhythmus und Wichtigkeit — sinnvolle Standards sind gesetzt.</span>
            </summary>
            <label>
              Was soll analysiert werden?
              <select name="scopeType" defaultValue="domain">
                <option value="domain">Ganze Domain</option>
                <option value="subdomain">Nur eine Subdomain</option>
                <option value="folder">Nur ein Verzeichnis</option>
              </select>
            </label>
            <label>
              Wie oft prüfen?
              <select name="crawlFrequency" defaultValue="weekly">
                <option value="manual">Nur manuell</option>
                <option value="daily">Täglich</option>
                <option value="weekly">Wöchentlich</option>
              </select>
            </label>
            <label>
              Wie wichtig ist diese Website? (1–100)
              <input name="businessValue" type="number" min="1" max="100" defaultValue="50" />
              <span className="muted form-hint">Hilft, Probleme auf wichtigen Websites zuerst anzuzeigen.</span>
            </label>
          </details>
          <button className="button" type="submit" disabled={!data.connected || data.projects.length === 0}>Website hinzufügen</button>
        </form>
      </section>

      <section className="card">
        <p className="kicker">Ihre Projekte &amp; Websites</p>
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
                    <span key={site.id}>{site.baseUrl} · {site.scopeType} · {site.crawlFrequency} · Wichtigkeit {site.businessValue}</span>
                  )) : <span>Noch keine Website hinzugefügt.</span>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p>Noch kein Projekt angelegt — legen Sie oben Ihr erstes Projekt an.</p>
        )}
      </section>
    </AppShell>
  );
}

function feedbackMessage(created: string | string[] | undefined, error: string | string[] | undefined): { kind: "success" | "danger"; message: string } | null {
  const errorValue = Array.isArray(error) ? error[0] : error;
  if (errorValue) return { kind: "danger", message: errorValue };
  const createdValue = Array.isArray(created) ? created[0] : created;
  if (createdValue === "project") return { kind: "success", message: "Projekt angelegt und aktiviert. Fügen Sie als Nächstes die Website-Adresse hinzu." };
  if (createdValue === "site") return { kind: "success", message: "Website hinzugefügt. Starten Sie jetzt die erste Analyse im Technical Audit." };
  return null;
}
