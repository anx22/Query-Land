import { createApp, createStore } from "@seo-tool/api";

interface ApiResponse {
  status: number;
  body: unknown;
}

interface RequestContext {
  headers?: Record<string, string | undefined>;
}

type ApiHandler = ReturnType<typeof createApp>;

type SeoToolGlobal = typeof globalThis & {
  __seoToolApiHandlerPromise?: Promise<ApiHandler>;
};

const globalForApi = globalThis as SeoToolGlobal;

// createStore is async (connect + migrate); cache the handler promise on
// the global so a single embedded store/handler is reused across HMR reloads.
function internalApiHandler(): Promise<ApiHandler> {
  if (!globalForApi.__seoToolApiHandlerPromise) {
    globalForApi.__seoToolApiHandlerPromise = createStore().then((store) => createApp(store));
  }
  return globalForApi.__seoToolApiHandlerPromise;
}

export async function callInternalApi(method: string, path: string, body?: unknown, context: RequestContext = {}): Promise<ApiResponse> {
  const handler = await internalApiHandler();
  return handler(method, path, body, context);
}
