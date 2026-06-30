import { AppShell } from "../../components/app-shell";
import { OfflineNotice } from "../../components/offline-notice";
import { createSiteAction, createWebsiteAction, deleteWebsiteAction, setActiveProjectAction } from "./actions";
import { loadProjectControlData } from "../../lib/foundation-api";

export const dynamic = "force-dynamic";

const SCOPE_LABEL: Record<string, string> = { domain: "Ganze Domain", subdomain: "Subdomain", folder: "Verzeichnis" };
const FREQ_LABEL: Record<string, string> = { manual: "Manuell", daily: "Täglich", weekly: "Wöchentlich" };

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const data = await loadProjectControlData();
  const hasProjects = data.projects.length > 0;
  const activeProjectId = (data.selectedProject ?? data.projects[0])?.id ?? null;
  const feedback = feedbackMessage(params?.created, params?.error, params?.deleted);

  return (
    <AppShell activePath="/projects">
      <section className="card hero-card">
        <p className="kicker">Projekte</p>
        <h1>Ihre Websites</h1>
        <p>
          Jede Website ist ein eigenes Projekt — mit Analyse, Rankings und Optimierungschancen.
          Fügen Sie eine Website hinzu; alles andere baut darauf auf.
        </p>
        <div className="badge-row">
          <span className="badge primary">{data.projects.length} {data.projects.length === 1 ? "Website" : "Websites"}</span>
          <span className={data.connected ? "badge success" : "badge danger"}>{data.connected ? "Daten verbunden" : "Daten offline"}</span>
        </div>
        {feedback ? (
          <div className={`notice ${feedback.kind} notice--cta`}>
            <span>{feedback.message}</span>
            {feedback.cta ? <a className="button" href={feedback.cta.href}>{feedback.cta.label}</a> : null}
          </div>
        ) : null}
        {!data.connected ? <OfflineNotice /> : null}
      </section>

      {hasProjects && (
        <section className="stack">
          {data.projectSites.map(({ project, sites }) => {
            const site = sites[0] ?? null;
            const isActive = project.id === activeProjectId;
            return (
              <article key={project.id} className={`card website-card${isActive ? " website-card--active" : ""}`}>
                <div className="website-card__head">
                  <div>
                    <h2 className="website-card__name">{project.name}</h2>
                    {site ? (
                      <a className="website-card__url" href={site.baseUrl} target="_blank" rel="noreferrer">{site.baseUrl}</a>
                    ) : (
                      <span className="website-card__url website-card__url--missing">Noch keine Adresse</span>
                    )}
                  </div>
                  {isActive ? <span className="badge success">Aktiv</span> : null}
                </div>

                {site ? (
                  <>
                    <div className="facts">
                      <span className="fact"><span className="fact__label">Umfang</span><span className="fact__value">{SCOPE_LABEL[site.scopeType] ?? site.scopeType}</span></span>
                      <span className="fact"><span className="fact__label">Analyse</span><span className="fact__value">{FREQ_LABEL[site.crawlFrequency] ?? site.crawlFrequency}</span></span>
                      <span className="fact"><span className="fact__label">Wichtigkeit</span><span className="fact__value">{site.businessValue}/100</span></span>
                    </div>
                    <div className="cluster">
                      {isActive ? (
                        <a className="button" href="/">Zur Übersicht →</a>
                      ) : (
                        <form action={setActiveProjectAction}>
                          <input type="hidden" name="projectId" value={project.id} />
                          <button className="button secondary" type="submit">Öffnen</button>
                        </form>
                      )}
                    </div>
                  </>
                ) : (
                  // Legacy project without a site — let the user complete it with one address.
                  <form action={createSiteAction} className="stack stack--sm">
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="scopeType" value="domain" />
                    <input type="hidden" name="crawlFrequency" value="weekly" />
                    <input type="hidden" name="businessValue" value="50" />
                    <label>
                      Website-Adresse ergänzen
                      <input name="baseUrl" required type="url" placeholder="https://ihre-website.de" />
                    </label>
                    <button className="button" type="submit" disabled={!data.connected}>Adresse speichern</button>
                  </form>
                )}

                {/* Deliberately tucked behind a disclosure so deletion is never a one-click accident. */}
                <details className="danger-zone">
                  <summary className="danger-zone__summary">Website entfernen</summary>
                  <p className="danger-zone__warn">
                    Entfernt <strong>{project.name}</strong> und alle zugehörigen Daten (Analysen, Keywords,
                    Chancen, Berichte) unwiderruflich.
                  </p>
                  <form action={deleteWebsiteAction}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <button className="button danger" type="submit" disabled={!data.connected}>
                      Endgültig löschen
                    </button>
                  </form>
                </details>
              </article>
            );
          })}
        </section>
      )}

      {hasProjects ? (
        // A website already exists. Adding more is a secondary action — collapse it so the
        // page doesn't look like setup is unfinished (the user already has their website).
        <details className="card add-website" id="website">
          <summary className="add-website__summary">+ Weitere Website hinzufügen</summary>
          {addWebsiteForm({ connected: data.connected, autoFocus: false })}
        </details>
      ) : (
        // First run — no website yet. Show the form open and focused as the primary action.
        <section className="card" id="website">
          <p className="kicker">Erste Website hinzufügen</p>
          {addWebsiteForm({ connected: data.connected, autoFocus: true })}
        </section>
      )}
    </AppShell>
  );
}

function addWebsiteForm({ connected, autoFocus }: { connected: boolean; autoFocus: boolean }) {
  return (
    <form action={createWebsiteAction} className="stack">
      <label>
        Website-Adresse
        <input name="baseUrl" required type="url" placeholder="https://ihre-website.de" autoFocus={autoFocus} />
      </label>
      <p className="form-hint muted">Eine Website = ein Projekt. Der Name wird aus der Adresse übernommen, wenn Sie keinen angeben.</p>
      <details className="advanced-section">
        <summary>
          <span className="advanced-section__title">Erweitert</span>
          <span className="advanced-section__hint">Name, Umfang, Prüf-Rhythmus und Wichtigkeit — sinnvolle Standards sind gesetzt.</span>
        </summary>
        <label>
          Name (optional)
          <input name="name" placeholder="wird aus der Adresse übernommen" />
        </label>
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
        </label>
      </details>
      <button className="button button--block" type="submit" disabled={!connected}>Website hinzufügen</button>
    </form>
  );
}

function feedbackMessage(
  created: string | string[] | undefined,
  error: string | string[] | undefined,
  deleted: string | string[] | undefined,
): { kind: "success" | "danger"; message: string; cta?: { href: string; label: string } } | null {
  const errorValue = Array.isArray(error) ? error[0] : error;
  if (errorValue) return { kind: "danger", message: errorValue };
  if (Array.isArray(deleted) ? deleted[0] : deleted) return { kind: "success", message: "Website entfernt." };
  const createdValue = Array.isArray(created) ? created[0] : created;
  const startAnalysis = { href: "/technical-audit#crawl-start", label: "Erste Analyse starten →" };
  if (createdValue === "website") return { kind: "success", message: "Website hinzugefügt und aktiviert.", cta: startAnalysis };
  if (createdValue === "site") return { kind: "success", message: "Adresse gespeichert.", cta: startAnalysis };
  return null;
}
