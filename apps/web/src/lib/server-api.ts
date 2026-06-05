import { createApp, createSQLiteStore } from "@seo-tool/api";

interface ApiResponse {
  status: number;
  body: unknown;
}

interface RequestContext {
  headers?: Record<string, string | undefined>;
}

type ApiHandler = ReturnType<typeof createApp>;

type SeoToolGlobal = typeof globalThis & {
  __seoToolApiHandler?: ApiHandler;
};

const globalForApi = globalThis as SeoToolGlobal;

function internalApiHandler(): ApiHandler {
  if (!globalForApi.__seoToolApiHandler) {
    globalForApi.__seoToolApiHandler = createApp(createSQLiteStore());
  }
  return globalForApi.__seoToolApiHandler;
}

export async function callInternalApi(method: string, path: string, body?: unknown, context: RequestContext = {}): Promise<ApiResponse> {
  return internalApiHandler()(method, path, body, context);
}
