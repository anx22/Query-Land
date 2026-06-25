import { apiError, bearerToken, type Actor, type ApiResponse, type RequestContext } from "./http.js";

/**
 * Session auth gate (WP-Z.1). When AUTH_GATE_ENABLED=true, every route except
 * the public allowlist (`/health`, `/auth/*`) requires a valid Bearer session
 * token; otherwise the request is rejected with 401 before reaching a handler.
 *
 * Default OFF so existing deployments are unaffected until the web layer
 * forwards the user's session token on its server-side API calls.
 */
export function isAuthGateEnabled(): boolean {
  return process.env.AUTH_GATE_ENABLED === "true";
}

/** Routes reachable without a session: health probe and the auth flow itself. */
export function isPublicPath(method: string, pathname: string): boolean {
  if (method === "GET" && pathname === "/health") return true;
  return pathname === "/auth/register" || pathname === "/auth/login" || pathname === "/auth/session" || pathname === "/auth/logout";
}

interface SessionResolver {
  getUserBySessionToken(token: string): Promise<{ id: string; role: Actor["role"] } | null>;
}

export interface AuthorizeResult {
  /** Present when the request is rejected; caller should return it as-is. */
  denied?: ApiResponse;
  /** Present on success when the gate resolved a session. */
  actor?: Actor;
}

/**
 * Resolve authorization for a request. Returns `{}` (allow, no actor) when the
 * gate is disabled or the path is public; `{ actor }` when a valid session is
 * present; `{ denied }` (401) when the gate is on and the session is missing or
 * invalid. Denied attempts are logged structurally (not persisted) to avoid an
 * unauthenticated DB-write amplification vector.
 */
export async function authorizeRequest(
  store: SessionResolver,
  method: string,
  pathname: string,
  context: RequestContext,
  requestId: string
): Promise<AuthorizeResult> {
  if (!isAuthGateEnabled() || isPublicPath(method, pathname)) {
    return {};
  }

  const token = bearerToken(context.headers?.authorization ?? context.headers?.Authorization);
  const user = token ? await store.getUserBySessionToken(token) : null;
  if (!user) {
    logAuthDenied(method, pathname, requestId);
    return { denied: apiError(401, "unauthorized", "Authentication required", requestId) };
  }
  return { actor: { userId: user.id, role: user.role } };
}

function logAuthDenied(method: string, pathname: string, requestId: string): void {
  if (process.env.NODE_ENV === "test") return;
  console.warn(JSON.stringify({ service: "api", event: "auth_denied", method, path: pathname, requestId, at: new Date().toISOString() }));
}
