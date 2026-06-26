import { AppShell } from "../../components/app-shell";
import { createProjectAction, createSiteAction, setActiveProjectAction } from "./actions";
import { loadProjectControlData } from "../../lib/foundation-api";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const data = await loadProjectControlData();
  const hasProjects = data.projects.length > 0;
  const activeProject = data.selectedProject ?? data.projects[0] ?? null;
  const activeSites = data.projectSites.find((item) => item.project.id === activeProject?.id)?.sites ?? [];
  const totalSites = data.projectSites.reduce((sum, item) => sum + item.sites.length, 0);
  const feedback = feedbackMessage(params?.created, params?.error, activeProject?.name ?? null);

  return (
    <AppShell activePath="/projects">
      <section className="card hero-card">
        <p className="kicker">Projekte</p>
        <h1>Projekte &amp; Websites</h1>
        <p>
          Ein Projekt steht für eine Website, die Sie verbessern möchten. Legen Sie ein Projekt an,
          tragen Sie seine Adresse ein — danach starten alle Auswertungen.
        </p>
        <div className="badge-row">
          <span className="badge primary">{data.projects.length} Projekte</span>
          <span className="badge">{totalSites} Websites</span>
          <span className={data.connected ? "badge success" : "badge danger"}>{data.connected ? "Verbunden" : "Nicht erreichbar"}</span>
        </div>
        {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
        {!data.connected ? <p className="notice danger">{data.errorMessage} · Erwartete API: {data.apiBaseUrl}</p> : null}
      </section>

      {!hasProjects ? (
        // First run: one focused action, nothing else to distract.
        <section className="content-grid">
          <form className="card form-card" action={createProjectAction}>
            <p className="kicker">Schritt 1 — Projekt anlegen</p>
            <label>
              Projektname
              <input name="name" required placeholder="z. B. Firmen-Website" autoFocus />
            </label>
            <p className="muted form-hint">Geben Sie Ihrem Vorhaben einen Namen. Die Website-Adresse tragen Sie gleich danach ein.</p>
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
        </section>
      ) : (
        <>
          <section className="content-grid">
            {/* Active project: its websites live here, and the add-website form is bound to it —
                no project picker, so a website can never land on the wrong project. */}
            <div className="card" id="website">
              <p className="kicker">Aktives Projekt</p>
              <h2>{activeProject?.name}</h2>
              <p className="muted form-hint">
                {activeSites.length === 0
                  ? "Noch keine Website hinzugefügt."
                  : `${activeSites.length} ${activeSites.length === 1 ? "Website" : "Websites"} in diesem Projekt.`}
                {data.projects.length > 1 ? " Anderes Projekt? Unten auswählen oder oben links umschalten." : ""}
              </p>

              {activeSites.length > 0 ? (
                <div className="entity-list">
                  {activeSites.map((site) => (
                    <article key={site.id} className="entity-row">
                      <div>
                        <strong>{site.baseUrl}</strong>
                        <span>{site.scopeType} · {site.crawlFrequency} · Wichtigkeit {site.businessValue}</span>
                      </div>
                    </article>
                  ))}
                  <a className="button" href="/technical-audit#crawl-start" style={{ marginTop: "0.5rem", display: "inline-block" }}>
                    Erste Analyse starten →
                  </a>
                </div>
              ) : (
                <p className="overview-empty-hint">Dieses Projekt hat noch keine Website. Tragen Sie unten die Adresse ein.</p>
              )}

              <form action={createSiteAction} style={{ marginTop: "1.25rem" }}>
                <input type="hidden" name="projectId" value={activeProject?.id ?? ""} />
                <p className="kicker">Website zu „{activeProject?.name}" hinzufügen</p>
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
                <button className="button" type="submit" disabled={!data.connected}>Website hinzufügen</button>
              </form>
            </div>

            {/* Secondary: start another project. */}
            <form className="card form-card" action={createProjectAction}>
              <p className="kicker">Neues Projekt</p>
              <label>
                Projektname
                <input name="name" required placeholder="z. B. Zweite Website" />
              </label>
              <p className="muted form-hint">Ein neues Projekt wird automatisch zum aktiven Projekt.</p>
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
              <button className="button secondary" type="submit" disabled={!data.connected}>Projekt anlegen</button>
            </form>
          </section>

          {data.projects.length > 1 && (
            <section className="card">
              <p className="kicker">Alle Projekte</p>
              <div className="entity-list">
                {data.projectSites.map(({ project, sites }) => {
                  const isActive = project.id === activeProject?.id;
                  return (
                    <article key={project.id} className={`entity-row${isActive ? " entity-row--active" : ""}`}>
                      <div>
                        <strong>{project.name}</strong>
                        <span>{sites.length} {sites.length === 1 ? "Website" : "Websites"} · {project.slug}</span>
                      </div>
                      {isActive ? (
                        <span className="badge success">Aktiv</span>
                      ) : (
                        <form action={setActiveProjectAction}>
                          <input type="hidden" name="projectId" value={project.id} />
                          <button className="button secondary compact" type="submit">Auswählen</button>
                        </form>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}

function feedbackMessage(
  created: string | string[] | undefined,
  error: string | string[] | undefined,
  activeProjectName: string | null,
): { kind: "success" | "danger"; message: string } | null {
  const errorValue = Array.isArray(error) ? error[0] : error;
  if (errorValue) return { kind: "danger", message: errorValue };
  const createdValue = Array.isArray(created) ? created[0] : created;
  if (createdValue === "project") return { kind: "success", message: "Projekt angelegt und aktiviert. Tragen Sie jetzt die Website-Adresse ein." };
  if (createdValue === "site") {
    const where = activeProjectName ? ` zu „${activeProjectName}"` : "";
    return { kind: "success", message: `Website${where} hinzugefügt. Starten Sie jetzt die erste Analyse.` };
  }
  return null;
}
