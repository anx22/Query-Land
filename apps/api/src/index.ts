import { appRoutes, demoProject, seoMemory } from "@seo-tool/shared-config";

export function getFoundationState() {
  return {
    memory: seoMemory,
    project: demoProject,
    routeCount: appRoutes.length,
  };
}

export { createApp, handleRequest } from "./app.js";
export { createStore, createStoreWithDatabase, type Store, type AuthStore, type ProjectStore, type CrawlStore, type JobStore, type SourceMapStore } from "./store.js";

// OAuth / Google Search Console surface for the web OAuth routes.
export { createGscClient, GSC_AUTH_ENDPOINT, GSC_OAUTH_SCOPE, GA4_OAUTH_SCOPE, GscApiError, type GscClient, type GscSiteEntry, type GscTokens } from "./oauth/gsc-client.js";
export { encryptJson, decryptJson, oauthEncryptionConfigured } from "./oauth/token-crypto.js";

// AI answer-provider readiness — lets the web surface an honest "no LLM connected" state.
export { getAiProvider, isAiProviderConfigured, type AiProvider } from "./ai/index.js";
