import { AppShell } from "../components/app-shell";
import { Dashboard } from "../components/dashboard";
import { loadOverviewData } from "../lib/overview-api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const overviewData = await loadOverviewData();

  return (
    <AppShell activePath="/">
      <Dashboard data={overviewData} />
    </AppShell>
  );
}
