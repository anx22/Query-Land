import { AppShell } from "../components/app-shell";
import { ModulePage } from "../components/module-page";
import { findModuleRoute, type ModulePath } from "./module-routes";

export function createPlannedModulePage(path: ModulePath) {
  return function PlannedModulePage() {
    const route = findModuleRoute(path);

    return (
      <AppShell activePath={route.path}>
        <ModulePage route={route}>
          <section className="content-grid">
            <div className="card">
              <p className="kicker">UI State</p>
              <h2>Route vorbereitet, Modul folgt in Welle {route.plannedWave}</h2>
              <p>
                Diese Route reserviert Navigation, URL und Layout-Rahmen. Fachliche Screens, Datenmodelle und Workflows entstehen im jeweiligen Feature-Verzeichnis statt in generischen Wrappern.
              </p>
            </div>
            <div className="card">
              <p className="kicker">Feature Boundary</p>
              <h2>{route.label} bleibt eigenständig</h2>
              <p>
                Sobald die Umsetzung startet, kapselt das Modul seine Komponenten, Hooks und UI-Logik unter <code>apps/web/src/features</code> und übergibt nur fertige Inhalte an die Route.
              </p>
            </div>
          </section>
        </ModulePage>
      </AppShell>
    );
  };
}
