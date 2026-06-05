import type { AuthUser } from "@seo-tool/domain-model";
import { callInternalApi } from "./server-api";

export const webSessionCookieName = "seo_os_session";

export interface LoginResponse {
  user: AuthUser;
  token: string;
  expiresAt: string;
}

interface ApiEnvelope<T> {
  data: T;
}

interface ApiErrorEnvelope {
  error?: { message?: string };
}

const configuredApiBaseUrl = process.env.SEO_API_BASE_URL;

export async function registerLocalUser(input: { email: string; password: string; name?: string }): Promise<AuthUser> {
  return apiPost<AuthUser>("/auth/register", input);
}

export async function loginLocalUser(input: { email: string; password: string }): Promise<LoginResponse> {
  return apiPost<LoginResponse>("/auth/login", input);
}

export async function resolveLocalSession(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  if (!configuredApiBaseUrl) {
    const response = await callInternalApi("GET", "/auth/session", undefined, { headers: { authorization: `Bearer ${token}` } });
    if (response.status === 401) return null;
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`GET /auth/session failed with ${response.status}`);
    }
    return unwrapEnvelope<{ user: AuthUser }>(response.body).user;
  }

  const response = await fetch(new URL("/auth/session", configuredApiBaseUrl), {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`GET /auth/session failed with ${response.status}`);
  }
  return unwrapEnvelope<{ user: AuthUser }>(await response.json() as ApiEnvelope<{ user: AuthUser }>).user;
}

export async function logoutLocalSession(token: string | undefined): Promise<void> {
  if (!token) return;
  if (!configuredApiBaseUrl) {
    const response = await callInternalApi("POST", "/auth/logout", undefined, { headers: { authorization: `Bearer ${token}` } });
    if ((response.status < 200 || response.status >= 300) && response.status !== 401) {
      throw new Error(`POST /auth/logout failed with ${response.status}`);
    }
    return;
  }

  const response = await fetch(new URL("/auth/logout", configuredApiBaseUrl), {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!response.ok && response.status !== 401) {
    throw new Error(`POST /auth/logout failed with ${response.status}`);
  }
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  if (!configuredApiBaseUrl) {
    const response = await callInternalApi("POST", path, body);
    if (response.status < 200 || response.status >= 300) {
      const payload = response.body as ApiErrorEnvelope | null;
      throw new Error(payload?.error?.message ?? `POST ${path} failed with ${response.status}`);
    }
    return unwrapEnvelope<T>(response.body);
  }

  const response = await fetch(new URL(path, configuredApiBaseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  const payload = await response.json().catch(() => null) as (ApiEnvelope<T> & ApiErrorEnvelope) | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `POST ${path} failed with ${response.status}`);
  }
  if (payload) {
    return unwrapEnvelope<T>(payload);
  }
  throw new Error(`POST ${path} returned an invalid response`);
}

function unwrapEnvelope<T>(payload: ApiEnvelope<T> | unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiEnvelope<T>).data;
  }
  return payload as T;
}
