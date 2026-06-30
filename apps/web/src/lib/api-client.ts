export interface ListMeta {
  limit: number;
  offset: number;
  total: number;
  nextCursor: string | null;
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: ListMeta;
}

const configuredApiBaseUrl = process.env.SEO_API_BASE_URL;
export const apiBaseUrl = configuredApiBaseUrl ?? "/api/backend";

export async function apiGet<T>(path: string): Promise<T> {
  return (await apiGetEnvelope<T>(path)).data;
}

export async function apiGetEnvelope<T>(path: string): Promise<ApiEnvelope<T>> {
  if (!configuredApiBaseUrl) {
    const { callInternalApi } = await import("./server-api");
    const response = await callInternalApi("GET", path);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`GET ${path} failed with ${response.status}`);
    }
    return normalizeEnvelope<T>(response.body);
  }

  const response = await fetch(new URL(path, configuredApiBaseUrl), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`);
  }
  return normalizeEnvelope<T>(await response.json() as ApiEnvelope<T> | T);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  if (!configuredApiBaseUrl) {
    const { callInternalApi } = await import("./server-api");
    const response = await callInternalApi("POST", path, body);
    if (response.status < 200 || response.status >= 300) {
      const payload = response.body as { error?: { message?: string } } | null;
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
  const payload = await response.json().catch(() => null) as (ApiEnvelope<T> & { error?: { message?: string } }) | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `POST ${path} failed with ${response.status}`);
  }
  if (payload) {
    return unwrapEnvelope<T>(payload);
  }
  throw new Error(`POST ${path} returned an invalid response`);
}

export async function apiDelete(path: string): Promise<void> {
  if (!configuredApiBaseUrl) {
    const { callInternalApi } = await import("./server-api");
    const response = await callInternalApi("DELETE", path);
    if (response.status < 200 || response.status >= 300) {
      const payload = response.body as { error?: { message?: string } } | null;
      throw new Error(payload?.error?.message ?? `DELETE ${path} failed with ${response.status}`);
    }
    return;
  }

  const response = await fetch(new URL(path, configuredApiBaseUrl), { method: "DELETE", cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? `DELETE ${path} failed with ${response.status}`);
  }
}

export function emptyListMeta(total = 0): ListMeta {
  return { limit: total, offset: 0, total, nextCursor: null };
}

function unwrapEnvelope<T>(payload: ApiEnvelope<T> | T | unknown): T {
  return normalizeEnvelope<T>(payload).data;
}

function normalizeEnvelope<T>(payload: ApiEnvelope<T> | T | unknown): ApiEnvelope<T> {
  if (isEnvelope<T>(payload)) {
    return payload;
  }
  return { data: payload as T };
}

function isEnvelope<T>(payload: unknown): payload is ApiEnvelope<T> {
  return Boolean(payload && typeof payload === "object" && "data" in payload);
}
