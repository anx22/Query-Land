import { AppShell } from "../../components/app-shell.js";
import { ModulePage } from "../../components/module-page.js";

export default function Page() {
  return (
    <AppShell activePath="/settings">
      <ModulePage href="/settings" />
    </AppShell>
  );
}
