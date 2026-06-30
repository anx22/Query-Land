/**
 * crawl-start.tsx — the primary action of the Technical Audit: start a crawl.
 *
 * Server component. Posts to the existing `startCrawlAction`, which schedules a
 * crawl_seed run and drains it inline, then redirects back with `?started=1`.
 * The button locks (with a reason) until project + site exist, the API is
 * reachable, and no run is currently in flight — mirroring the disabled-action
 * pattern used on the keywords page.
 */

import type { CrawlRun } from "@seo-tool/domain-model";
import { Icon } from "../../components/icon";
import type { ActionLock } from "../../lib/readiness";
import type { FoundationProject, FoundationSite } from "../../lib/foundation-api";
import { startCrawlAction } from "./actions";

const FREQUENCY_LABEL: Record<string, string> = {
  manual: "manuell",
  daily: "täglich",
  weekly: "wöchentlich",
};

export interface CrawlStartPanelProps {
  project: FoundationProject | null;
  site: FoundationSite | null;
  lock: ActionLock;
  connected: boolean;
  runningRun: CrawlRun | null;
}

export function CrawlStartPanel({ project, site, lock, connected, runningRun }: CrawlStartPanelProps) {
  const running = runningRun !== null;
  const disabled = lock.locked || !connected || running;

  const reason = !connected
    ? "Daten momentan nicht erreichbar."
    : running
      ? "Analyse läuft bereits."
      : lock.reason;

  return (
    <section className="card crawl-start" id="crawl-start">
      <div className="crawl-start__head">
        <div>
          <p className="kicker">Analyse starten</p>
          <p className="muted crawl-start__scope">
            {site ? (
              <>
                Analysiert: <strong>{site.baseUrl}</strong> · Rhythmus{" "}
                {FREQUENCY_LABEL[site.crawlFrequency] ?? site.crawlFrequency}
              </>
            ) : (
              "Noch keine Website gewählt — füge zuerst eine Website zum Projekt hinzu."
            )}
          </p>
        </div>
        {running ? <span className="badge primary">Analyse läuft …</span> : null}
      </div>

      <div className="action-row">
        <div className="locked-action">
          <form action={startCrawlAction}>
            <input type="hidden" name="projectId" value={project?.id ?? ""} />
            <input type="hidden" name="siteId" value={site?.id ?? ""} />
            <input type="hidden" name="baseUrl" value={site?.baseUrl ?? ""} />
            <button className="button" type="submit" disabled={disabled}>
              Analyse starten
            </button>
          </form>
          {disabled && reason ? (
            <span className="locked-action__reason">
              <Icon name="lock" />
              {reason}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
