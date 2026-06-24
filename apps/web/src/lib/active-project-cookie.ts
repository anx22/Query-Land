/**
 * Client-safe constant for the active-project cookie name.
 *
 * Kept in its own module (no next/headers import) so client components like the
 * ProjectSwitcher can reference the cookie name without pulling server-only code
 * into the browser bundle.
 */
export const ACTIVE_PROJECT_COOKIE = "ql_active_project";
