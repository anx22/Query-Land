import type { ReactNode } from "react";
import type { ModuleRoute } from "../app/module-routes";

export function ModulePage({ route, children }: { route: ModuleRoute; children?: ReactNode }) {
  return (
    <>
      <section className="card hero-card">
        <p className="kicker">{route.label}</p>
        <h1>{route.label}</h1>
        <p>{route.description}</p>
      </section>

      {children}
    </>
  );
}
