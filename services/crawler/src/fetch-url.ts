import type { FetchResult } from "@seo-tool/domain-model";
import type { FetchWorkerInput } from "./types.js";
import { normalizeCrawlUrl } from "./url-normalization.js";

export async function fetchUrl(input: FetchWorkerInput): Promise<FetchResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const fetchedAt = input.fetchedAt ?? new Date().toISOString();
  const maxAttempts = Math.max(1, input.retry?.maxAttempts ?? 1);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = input.timeoutMs ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), input.timeoutMs) : null;

    try {
      const response = await fetchImpl(input.url, { redirect: "manual", signal: controller?.signal });
      if (timeout) clearTimeout(timeout);
      const headers = normalizeHeaders(response.headers);
      const statusCode = response.status;
      const location = response.headers.get("location");
      const finalUrl = location ? normalizeCrawlUrl(location, input.url) : response.url || input.url;
      const responseBody = await response.text().catch(() => "");

      return {
        url: input.url,
        finalUrl,
        statusCode,
        statusClass: classifyStatus(statusCode),
        headers,
        redirectChain: statusCode >= 300 && statusCode < 400 && location ? [input.url, finalUrl] : [],
        fetchedAt,
        responseBody
      };
    } catch (error) {
      if (timeout) clearTimeout(timeout);
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(input.retry?.delayMs ?? 0);
      }
    }
  }

  return {
    url: input.url,
    finalUrl: input.url,
    statusCode: null,
    statusClass: "network_error",
    headers: {},
    redirectChain: [],
    fetchedAt,
    errorMessage: networkErrorMessage(lastError, maxAttempts)
  };
}

function classifyStatus(statusCode: number): FetchResult["statusClass"] {
  if (statusCode >= 200 && statusCode < 300) return "success";
  if (statusCode >= 300 && statusCode < 400) return "redirect";
  if (statusCode >= 400 && statusCode < 500) return "client_error";
  return "server_error";
}

function normalizeHeaders(headers: Headers): Record<string, string> {
  const output: Record<string, string> = {};
  headers.forEach((value, key) => {
    output[key.toLowerCase()] = value;
  });
  return output;
}

function networkErrorMessage(error: unknown, attempts: number): string {
  const message = error instanceof Error ? error.message : "Unknown fetch error";
  return attempts > 1 ? `${message} after ${attempts} attempts` : message;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
