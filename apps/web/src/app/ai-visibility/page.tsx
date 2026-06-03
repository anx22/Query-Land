import { AppShell } from "../../components/app-shell.js";
import { ModulePage } from "../../components/module-page.js";

export default function Page() {
  return (
    <AppShell activePath="/ai-visibility">
      <ModulePage href="/ai-visibility" />
    </AppShell>
  );
}
