import { randomUUID } from "node:crypto";
import { bearerToken, apiError, json, logRequest, type ApiResponse, type RequestContext } from "./http.js";
import { authRequest, createProjectRequest } from "./request-validators.js";
import { routeProjectChildren } from "./routes.js";
import { createSQLiteStore, RequestError, type BackendStore } from "./sqlite-store.js";

export type { ApiResponse, ApiErrorBody, RequestContext } from "./http.js";

export function createApp(store: BackendStore = createSQLiteStore()) {
  return async function appHandleRequest(method: string, pathname: string, body?: unknown, context: RequestContext = {}): Promise<ApiResponse> {
    return routeRequest(store, method, pathname, body, context);
  };
}

const defaultHandleRequest = createApp();

export async function handleRequest(method: string, pathname: string, body?: unknown, context: RequestContext = {}): Promise<ApiResponse> {
  return defaultHandleRequest(method, pathname, body, context);
}

async function routeRequest(store: BackendStore, method: string, pathname: string, body?: unknown, context: RequestContext = {}): Promise<ApiResponse> {
  const requestId = context.headers?.["x-request-id"] ?? context.headers?.["X-Request-Id"] ?? `req-${randomUUID()}`;

  try {
    const response = await routeTopLevel(store, method, pathname, body, context, requestId);
    logRequest(method, pathname, response.status, requestId);
    return response;
  } catch (error) {
    const response = error instanceof RequestError
      ? apiError(error.status, error.code, error.message, requestId, error.details)
      : error instanceof Error
        ? apiError(400, "validation_error", error.message, requestId)
        : apiError(500, "internal_error", "Internal error", requestId);
    logRequest(method, pathname, response.status, requestId);
    return response;
  }
}

async function routeTopLevel(store: BackendStore, method: string, pathname: string, body: unknown, context: RequestContext, requestId: string): Promise<ApiResponse> {
  if (method === "GET" && pathname === "/health") {
    return json(200, store.health());
  }
  if (method === "POST" && pathname === "/auth/register") {
    const input = authRequest(body, true);
    return json(201, { data: store.registerUser(input) });
  }
  if (method === "POST" && pathname === "/auth/login") {
    const input = authRequest(body, false);
    const result = store.login(input.email, input.password);
    return result ? json(200, { data: result }) : apiError(401, "invalid_credentials", "Invalid credentials", requestId);
  }
  if (method === "POST" && pathname === "/auth/logout") {
    const token = bearerToken(context.headers?.authorization ?? context.headers?.Authorization);
    if (!token) {
      return apiError(401, "missing_bearer_token", "Missing bearer token", requestId);
    }
    store.invalidateSessionToken(token);
    return json(204, null);
  }
  if (method === "GET" && pathname === "/auth/session") {
    const token = bearerToken(context.headers?.authorization ?? context.headers?.Authorization);
    if (!token) {
      return apiError(401, "missing_bearer_token", "Missing bearer token", requestId);
    }
    const user = store.getUserBySessionToken(token);
    return user ? json(200, { data: { user } }) : apiError(401, "invalid_or_expired_session", "Invalid or expired session", requestId);
  }
  if (method === "GET" && pathname === "/projects") {
    return json(200, { data: store.listProjects() });
  }
  if (method === "POST" && pathname === "/projects") {
    return json(201, { data: store.createProject(createProjectRequest(body)) });
  }

  return routeProjectChildren(store, method, pathname, body, requestId);
}
