"use client";

/**
 * ProjectSwitcher — global active-project selector at the top of the sidebar.
 *
 * The active project is the clamp over the whole app (each project has its own
 * overview, audit, keywords …). Selecting one writes the `ql_active_project`
 * cookie and refreshes the server tree so every loader re-reads it.
 *
 * Receives the serialisable project list + current id as props (resolved
 * server-side). No data fetching here.
 */

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ACTIVE_PROJECT_COOKIE } from "../lib/active-project-cookie";
import { SelectMenu } from "./select-menu";

export interface ProjectSwitcherOption {
  id: string;
  name: string;
}

export interface ProjectSwitcherProps {
  projects: ProjectSwitcherOption[];
  activeProjectId: string | null;
}

export function ProjectSwitcher({ projects, activeProjectId }: ProjectSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (projects.length === 0) {
    // No website exists yet — an "Aktive Website" caption would name a state that isn't true (and
    // contradicts the top-bar "Keine Website — zuerst hinzufügen"). Show just the add action.
    return (
      <div className="project-switcher project-switcher--empty">
        <a className="project-switcher__cta" href="/projects">
          + Website hinzufügen
        </a>
      </div>
    );
  }

  // With a single website there is nothing to switch — the dropdown would just duplicate the
  // "Websites"/"Übersicht" nav and the active-site crumb in the top bar. Only surface the switcher
  // once there are at least two websites to choose between.
  if (projects.length === 1) {
    return null;
  }

  function onChange(id: string) {
    document.cookie = `${ACTIVE_PROJECT_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div className="project-switcher" data-pending={isPending ? "" : undefined}>
      <label className="project-switcher__label" id="project-switcher-label" htmlFor="project-switcher-select">
        Aktive Website
      </label>
      <SelectMenu
        variant="plain"
        className="project-switcher__select"
        value={activeProjectId ?? projects[0]?.id}
        onChange={onChange}
        disabled={isPending}
        options={projects.map((p) => ({ value: p.id, label: p.name }))}
        id="project-switcher-select"
        aria-labelledby="project-switcher-label"
      />
    </div>
  );
}
