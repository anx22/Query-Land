import { AppShell } from "../components/app-shell.js";
import { Dashboard } from "../components/dashboard.js";

export default function HomePage() {
  return (
    <AppShell activePath="/">
      <Dashboard />
    </AppShell>
  );
}
