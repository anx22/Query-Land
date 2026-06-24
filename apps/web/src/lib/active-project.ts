/**
 * active-project.ts — server-side helper for the globally selected project.
 *
 * The active project is persisted in a plain (non-httpOnly) cookie so the
 * ProjectSwitcher client island can set it and a server refresh picks it up.
 * Reading happens here, in server components / loaders, via next/headers.
 *
 * The cookie NAME lives in active-project-cookie.ts (client-safe); this module
 * imports next/headers and must only be used server-side.
 */

import { cookies } from "next/headers";
import { ACTIVE_PROJECT_COOKIE } from "./active-project-cookie";

export { ACTIVE_PROJECT_COOKIE };

/** Read the active project id from the request cookie, or null if unset. */
export async function getActiveProjectId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_PROJECT_COOKIE)?.value ?? null;
}
