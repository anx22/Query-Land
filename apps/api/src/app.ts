import { randomUUID } from "node:crypto";
import { apiError, bearerToken, json, logRequest, type ApiResponse, type RequestContext } from "./http.js";
import { authorizeRequest } from "./auth-gate.js";
import { authRequest, createProjectRequest } from "./request-validators.js";
import { routeProjectChildren } from "./routes.js";
import { createStore, type AuthStore, type HealthStore, type ProjectStore } from "./store.js";
import { RequestError } from "./stores/store-errors.js";
import type { ProjectChildStore } from "./routes.js";

export type AppStore = HealthStore & AuthStore & ProjectStore & ProjectChildStore;

export function createApp(store: AppStore) {
  return async function appHandleRequest(method: string, pathname: string, body?: unknown, context: RequestContext = {}): Promise<ApiResponse> {
    return routeRequest(store, method, pathname, body, context);
  };
}

// Lazily create the default (embedded) store once. createStore is async
// (it connects + migrates), so the default handler resolves it on first use.
let defaultStorePromise: Promise<AppStore> | null = null;

export async function handleRequest(method: string, pathname: string, body?: unknown, context: RequestContext = {}): Promise<ApiResponse> {
  defaultStorePromise ??= createStore();
  const store = await defaultStorePromise;
  return routeRequest(store, method, pathname, body, context);
}

async function routeRequest(store: AppStore, method: string, requestPath: string, body?: unknown, context: RequestContext = {}): Promise<ApiResponse> {
  const parsedUrl = new URL(requestPath, "http://localhost");
  const pathname = parsedUrl.pathname;
  const requestId = context.headers?.["x-request-id"] ?? context.headers?.["X-Request-Id"] ?? `req-${randomUUID()}`;

  try {
    const response = await routeTopLevel(store, method, pathname, parsedUrl.searchParams, body, context, requestId);
    logRequest(method, pathname, response.status, requestId);
    return response;
  } catch (error) {
    const response = error instanceof RequestError
      ? apiError(error.status, error.code, error.message, requestId, error.details)
      : apiError(500, "internal_error", "Internal error", requestId);
    logRequest(method, pathname, response.status, requestId);
    return response;
  }
}

async function routeTopLevel(store: AppStore, method: string, pathname: string, searchParams: URLSearchParams, body: unknown, context: RequestContext, requestId: string): Promise<ApiResponse> {
  // Auth gate (WP-Z.1): reject non-public routes without a valid session when
  // AUTH_GATE_ENABLED. On success the actor is attached to the request context.
  const auth = await authorizeRequest(store, method, pathname, context, requestId);
  if (auth.denied) return auth.denied;
  if (auth.actor) context.actor = auth.actor;

  if (method === "GET" && pathname === "/health") {
    return json(200, store.health());
  }

  if (method === "POST" && pathname === "/auth/register") {
    const input = authRequest(body, true);
    return json(201, { data: await store.registerUser(input) });
  }

  if (method === "POST" && pathname === "/auth/login") {
    const input = authRequest(body, false);
    const result = await store.login(input.email, input.password);
    return result ? json(200, { data: result }) : apiError(401, "invalid_credentials", "Invalid credentials", requestId);
  }

  if (method === "GET" && pathname === "/auth/session") {
    const token = bearerToken(context.headers?.authorization ?? context.headers?.Authorization);
    const user = token ? await store.getUserBySessionToken(token) : null;
    return user ? json(200, { data: { user } }) : apiError(401, "invalid_session", "Missing, invalid or expired session", requestId);
  }

  if (method === "POST" && pathname === "/auth/logout") {
    const token = bearerToken(context.headers?.authorization ?? context.headers?.Authorization);
    const invalidated = token ? await store.invalidateSessionToken(token) : false;
    return invalidated ? json(204, null) : apiError(401, "invalid_session", "Missing, invalid or expired session", requestId);
  }

  if (method === "GET" && pathname === "/projects") {
    return json(200, { data: await store.listProjects() });
  }

  if (method === "POST" && pathname === "/projects") {
    return json(201, { data: await store.createProject(createProjectRequest(body)) });
  }

  const projectDeleteMatch = /^\/projects\/([^/]+)$/.exec(pathname);
  if (method === "DELETE" && projectDeleteMatch) {
    await store.deleteProject(decodeURIComponent(projectDeleteMatch[1]));
    return json(200, { data: { deleted: true } });
  }

  return routeProjectChildren(store, method, pathname, searchParams, body, requestId, context);
}
