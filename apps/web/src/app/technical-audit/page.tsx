import { AppShell } from "../../components/app-shell.js";
import { ModulePage } from "../../components/module-page.js";

export default function Page() {
  return (
    <AppShell activePath="/technical-audit">
      <ModulePage href="/technical-audit" />
    </AppShell>
  );
}
