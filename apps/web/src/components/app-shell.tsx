import { Navigation } from "./navigation";

export function AppShell({ activePath, children }: { activePath: string; children: React.ReactNode }) {
  return (
    <div className="shell">
      <Navigation activePath={activePath} />
      <main className="main">
        <header className="topbar">
          <input className="search" aria-label="Suche" placeholder="Domains, URLs, Opportunities suchen…" />
          <div className="badge-row">
            <span className="badge primary">Welle 1 · Foundation</span>
            <span className="badge">UTC 2026-06-02</span>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
