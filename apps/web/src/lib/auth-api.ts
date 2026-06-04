import { apiDefaults } from "@seo-tool/shared-config";
import type { AuthUser } from "@seo-tool/domain-model";

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

const apiBaseUrl = process.env.SEO_API_BASE_URL ?? `http://localhost:${apiDefaults.port}`;

export async function registerLocalUser(input: { email: string; password: string; name?: string }): Promise<AuthUser> {
  return apiPost<AuthUser>("/auth/register", input);
}

export async function loginLocalUser(input: { email: string; password: string }): Promise<LoginResponse> {
  return apiPost<LoginResponse>("/auth/login", input);
}

export async function resolveLocalSession(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  const response = await fetch(new URL("/auth/session", apiBaseUrl), {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`GET /auth/session failed with ${response.status}`);
  }
  const payload = await response.json() as ApiEnvelope<{ user: AuthUser }>;
  return payload.data.user;
}

export async function logoutLocalSession(token: string | undefined): Promise<void> {
  if (!token) return;
  const response = await fetch(new URL("/auth/logout", apiBaseUrl), {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!response.ok && response.status !== 401) {
    throw new Error(`POST /auth/logout failed with ${response.status}`);
  }
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(new URL(path, apiBaseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  const payload = await response.json().catch(() => null) as (ApiEnvelope<T> & ApiErrorEnvelope) | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `POST ${path} failed with ${response.status}`);
  }
  if (payload && "data" in payload) {
    return payload.data;
  }
  throw new Error(`POST ${path} returned an invalid response`);
}
