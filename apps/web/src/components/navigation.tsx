import Link from "next/link";
import { appRoutes } from "@seo-tool/shared-config";

function initials(label: string) {
  return label
    .split(/\s|&/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.at(0))
    .join("");
}

export function Navigation({ activePath }: { activePath: string }) {
  return (
    <aside className="sidebar">
      <div>
        <span className="brand-eyebrow">Internal SEO OS</span>
        <h1 className="brand-title">AuraSEO</h1>
        <p>First-party, source-anchored SEO Workflows.</p>
      </div>
      <nav className="nav-list" aria-label="Hauptnavigation">
        {appRoutes.map((route) => {
          const isActive = activePath === route.href;
          return (
            <Link key={route.href} className={`nav-item${isActive ? " active" : ""}`} href={route.href}>
              <span className="nav-icon" aria-hidden="true">{initials(route.label)}</span>
              <span>{route.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
