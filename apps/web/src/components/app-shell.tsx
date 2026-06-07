import { Navigation } from "./navigation";

export function AppShell({ activePath, children }: { activePath: string; children: React.ReactNode }) {
  return (
    <div className="shell">
      <Navigation activePath={activePath} />
      <main className="main">
        <header className="topbar">
          <input className="search" aria-label="Suche" placeholder="Domains, URLs, Chancen suchen…" />
          <div className="badge-row">
            <a className="badge" href="/login">Anmelden</a>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
