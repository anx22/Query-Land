import { AppShell } from "../components/app-shell";
import { Dashboard } from "../components/dashboard";
import { loadFoundationDashboardData } from "../lib/foundation-api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const dashboardData = await loadFoundationDashboardData();

  return (
    <AppShell activePath="/">
      <Dashboard data={dashboardData} />
    </AppShell>
  );
}
