import type { FetchResult } from "@seo-tool/domain-model";
import { DEFAULT_ACCEPT_HEADER, DEFAULT_CRAWLER_USER_AGENT, DEFAULT_MAX_BODY_BYTES, DEFAULT_RETRY_BASE_DELAY_MS, DEFAULT_RETRY_MAX_DELAY_MS, backoffDelayMs } from "./config.js";
import type { FetchWorkerInput } from "./types.js";
import { normalizeCrawlUrl } from "./url-normalization.js";

export async function fetchUrl(input: FetchWorkerInput): Promise<FetchResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const fetchedAt = input.fetchedAt ?? new Date().toISOString();
  const maxAttempts = Math.max(1, input.retry?.maxAttempts ?? 1);
  const baseDelayMs = input.retry?.delayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  const maxDelayMs = input.retry?.maxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS;
  const sleep = input.retry?.sleep ?? defaultSleep;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetchWithRedirectLimit(input, fetchImpl, fetchedAt);
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        // Capped exponential backoff: base * 2^(attempt-1), clamped to maxDelay.
        await sleep(backoffDelayMs(attempt, baseDelayMs, maxDelayMs));
      }
    }
  }

  return networkErrorResult(input.url, fetchedAt, networkErrorMessage(lastError, maxAttempts));
}

async function fetchWithRedirectLimit(input: FetchWorkerInput, fetchImpl: typeof fetch, fetchedAt: string): Promise<FetchResult> {
  const maxRedirects = Math.max(0, input.maxRedirects ?? 0);
  const redirectChain = [input.url];
  const visited = new Set<string>([input.url]);
  let currentUrl = input.url;

  for (let redirectDepth = 0; ; redirectDepth += 1) {
    const controller = input.timeoutMs ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), input.timeoutMs) : null;

    try {
      const response = await fetchImpl(currentUrl, {
        redirect: "manual",
        signal: controller?.signal,
        headers: { "user-agent": input.userAgent ?? DEFAULT_CRAWLER_USER_AGENT, accept: DEFAULT_ACCEPT_HEADER }
      });
      if (timeout) clearTimeout(timeout);
      const headers = normalizeHeaders(response.headers);
      const statusCode = response.status;
      const location = response.headers.get("location");

      if (statusCode >= 300 && statusCode < 400 && location) {
        const nextUrl = normalizeCrawlUrl(location, currentUrl);
        if (visited.has(nextUrl)) {
          return networkErrorResult(input.url, fetchedAt, `redirect loop detected at ${nextUrl}`);
        }
        const nextChain = [...redirectChain, nextUrl];
        if (redirectDepth >= maxRedirects) {
          return {
            url: input.url,
            finalUrl: nextUrl,
            statusCode,
            statusClass: "redirect",
            headers,
            redirectChain: nextChain,
            fetchedAt,
            errorMessage: maxRedirects > 0 ? `redirect depth limit exceeded after ${maxRedirects} redirects` : undefined
          };
        }
        redirectChain.push(nextUrl);
        visited.add(nextUrl);
        currentUrl = nextUrl;
        continue;
      }

      // Only read/parse textual bodies (HTML/XML/plain/unknown). Binary resources
      // (images, PDFs, fonts, octet-stream) are recorded by status+headers but
      // their bodies are discarded — never fed to the HTML parser. Textual bodies
      // are read up to maxBodyBytes and decoded with the declared/​sniffed charset.
      const contentType = headers["content-type"] ?? "";
      const maxBodyBytes = Math.max(0, input.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES);
      let responseBody = "";
      if (shouldReadBody(contentType)) {
        responseBody = await readBodyCapped(response, maxBodyBytes, contentType);
      } else {
        await discardBody(response);
      }
      return {
        url: input.url,
        finalUrl: response.url || currentUrl,
        statusCode,
        statusClass: classifyStatus(statusCode),
        headers,
        redirectChain: redirectChain.length > 1 ? redirectChain : [],
        fetchedAt,
        responseBody
      };
    } catch (error) {
      if (timeout) clearTimeout(timeout);
      throw error;
    }
  }
}

function networkErrorResult(url: string, fetchedAt: string, errorMessage: string): FetchResult {
  return {
    url,
    finalUrl: url,
    statusCode: null,
    statusClass: "network_error",
    headers: {},
    redirectChain: [],
    fetchedAt,
    errorMessage
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

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Should we read and parse this response body? Textual types (HTML/XML/plain)
 * yes; an absent content-type yes (servers routinely omit it); clearly-binary
 * types (image/video/audio/pdf/font/octet-stream/zip) no.
 */
function shouldReadBody(contentType: string): boolean {
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (type === "") return true; // unknown — assume textual, read it
  if (type.startsWith("text/")) return true;
  return type.includes("html") || type.includes("xml") || type.includes("json") || type.includes("javascript");
}

/**
 * Read a response body up to `maxBytes` (streaming, so an oversized payload is
 * never fully buffered), then decode using the charset declared in the
 * content-type, sniffed from a <meta charset>, or UTF-8 as a last resort.
 * Falls back to response.text() when the body is not an inspectable stream
 * (some fetch mocks), which preserves existing behaviour.
 */
async function readBodyCapped(response: Response, maxBytes: number, contentType: string): Promise<string> {
  const reader = response.body?.getReader?.();
  if (!reader) {
    const text = await response.text().catch(() => "");
    return text;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (total + value.byteLength > maxBytes) {
        const remaining = maxBytes - total;
        if (remaining > 0) chunks.push(value.subarray(0, remaining));
        await reader.cancel().catch(() => undefined);
        total = maxBytes;
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } catch {
    // Treat a mid-stream read error as "what we have so far".
  }
  const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return decodeBody(buffer, contentType);
}

/** Drain/cancel a body we will not parse, so the connection is released promptly. */
async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel?.();
  } catch {
    // best effort
  }
}

function decodeBody(buffer: Buffer, contentType: string): string {
  const charset = charsetFromContentType(contentType) ?? sniffMetaCharset(buffer) ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

function charsetFromContentType(contentType: string): string | null {
  const match = /charset=["']?([^"';,\s]+)/i.exec(contentType);
  return match?.[1]?.trim().toLowerCase() || null;
}

/** Sniff `<meta charset>` / `<meta http-equiv content="...charset=...">` from the head. */
function sniffMetaCharset(buffer: Buffer): string | null {
  // Inspect a latin1 view of the first 2 KB — enough to cover the <head> meta tags.
  const head = buffer.subarray(0, 2048).toString("latin1");
  const direct = /<meta[^>]+charset=["']?([^"'>\s/]+)/i.exec(head);
  if (direct?.[1]) return direct[1].trim().toLowerCase();
  const httpEquiv = /<meta[^>]+content=["'][^"']*charset=([^"'>\s;]+)/i.exec(head);
  return httpEquiv?.[1]?.trim().toLowerCase() ?? null;
}
