import Link from "next/link";
import { moduleRoutes } from "../app/module-routes";

export function Navigation({ activePath }: { activePath: string }) {
  return (
    <aside className="sidebar">
      <div>
        <h1 className="brand-title">Query-Land</h1>
        <p className="brand-claim">Sichtbarkeit, die sich belegen lässt.</p>
      </div>
      <nav className="nav-list" aria-label="Hauptnavigation">
        {moduleRoutes.map((route) => {
          const isActive = activePath === route.path;
          return (
            <Link key={route.path} className={`nav-item${isActive ? " active" : ""}`} href={route.path}>
              <span className="nav-icon material-symbols-outlined" aria-hidden="true">{route.icon}</span>
              <span>{route.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
