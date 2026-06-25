"use client";

/**
 * SiteSwitcher — global active-site selector in the topbar context bar.
 *
 * The active site is the crawl/audit scope inside the active project. Selecting
 * one writes the `ql_active_site` cookie and refreshes the server tree so every
 * loader re-reads it (mirrors ProjectSwitcher). Receives the serialisable site
 * list + current id as props (resolved server-side). No data fetching here.
 */

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ACTIVE_SITE_COOKIE } from "../lib/active-project-cookie";

export interface SiteSwitcherOption {
  id: string;
  baseUrl: string;
}

export interface SiteSwitcherProps {
  sites: SiteSwitcherOption[];
  activeSiteId: string | null;
}

export function SiteSwitcher({ sites, activeSiteId }: SiteSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (sites.length === 0) {
    return (
      <div className="site-switcher site-switcher--empty">
        <span className="site-switcher__label">Aktive Site</span>
        <a className="site-switcher__cta" href="/projects">
          + Site hinzufügen
        </a>
      </div>
    );
  }

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const id = event.target.value;
    document.cookie = `${ACTIVE_SITE_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div className="site-switcher" data-pending={isPending ? "" : undefined}>
      <label className="site-switcher__label" htmlFor="site-switcher-select">
        Aktive Site
      </label>
      <select
        id="site-switcher-select"
        className="site-switcher__select"
        value={activeSiteId ?? sites[0]?.id}
        onChange={onChange}
        disabled={isPending}
      >
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.baseUrl}
          </option>
        ))}
      </select>
    </div>
  );
}
