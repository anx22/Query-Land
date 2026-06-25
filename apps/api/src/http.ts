import type { UserRole } from "@seo-tool/domain-model";

export interface ApiResponse {
  status: number;
  body: unknown;
}

/** Authenticated principal for a request, populated by the auth gate. */
export interface Actor {
  userId: string;
  role: UserRole;
}

export interface RequestContext {
  headers?: Record<string, string | undefined>;
  /** Set by the auth gate once a session token is validated (see auth-gate.ts). */
  actor?: Actor;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

export function bearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  return authorization.slice("Bearer ".length).trim();
}

export function apiError(status: number, code: string, message: string, requestId: string, details?: unknown): ApiResponse {
  const error: ApiErrorBody["error"] = { code, message, requestId };
  if (details !== undefined) error.details = details;
  return { status, body: { error } };
}

export function json(status: number, body: unknown): ApiResponse {
  return { status, body };
}

export function logRequest(method: string, path: string, status: number, requestId: string): void {
  if (process.env.NODE_ENV === "test") return;
  console.log(JSON.stringify({ service: "api", event: "request", method, path, status, requestId, at: new Date().toISOString() }));
}
