import { AppShell } from "../../components/app-shell";
import { ModulePage } from "../../components/module-page";

export default function Page() {
  return (
    <AppShell activePath="/backlinks">
      <ModulePage href="/backlinks" />
    </AppShell>
  );
}
