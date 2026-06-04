import type { ReactNode } from "react";
import type { ModuleRoute } from "../app/module-routes";

const statusLabel: Record<ModuleRoute["status"], string> = {
  active: "Aktiv",
  planned: "Geplant"
};

export function ModulePage({ route, children }: { route: ModuleRoute; children?: ReactNode }) {
  return (
    <>
      <section className="card hero-card">
        <p className="kicker">{statusLabel[route.status]} · Delivery-Welle {route.plannedWave}</p>
        <h1>{route.label}</h1>
        <p>{route.description}</p>
        <div className="badge-row">
          <span className="badge primary">{statusLabel[route.status]}</span>
          <span className="badge">Welle {route.plannedWave}</span>
          <span className="badge">{route.path}</span>
        </div>
      </section>

      {children}
    </>
  );
}
