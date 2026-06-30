import { Suspense } from "react";
import { AppShell } from "../components/app-shell";
import { Dashboard } from "../components/dashboard";
import { PageSkeleton } from "../components/page-skeleton";
import { loadOverviewData } from "../lib/overview-api";

export const dynamic = "force-dynamic";

// The data-dependent body is its own async component so it streams behind a Suspense boundary:
// the AppShell (nav, header, onboarding) paints immediately and the dashboard fills in when its
// data resolves — instead of the whole page blocking on loadOverviewData().
async function OverviewBody() {
  const overviewData = await loadOverviewData();
  return <Dashboard data={overviewData} />;
}

export default function HomePage() {
  return (
    <AppShell activePath="/">
      <Suspense fallback={<PageSkeleton label="Übersicht wird geladen …" />}>
        <OverviewBody />
      </Suspense>
    </AppShell>
  );
}
