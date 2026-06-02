import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@seo-tool/domain-model": fileURLToPath(new URL("./packages/domain-model/src/index.ts", import.meta.url)),
      "@seo-tool/shared-config": fileURLToPath(new URL("./packages/shared-config/src/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["apps/**/*.test.ts", "packages/**/*.test.ts", "services/**/*.test.ts"],
  },
});
