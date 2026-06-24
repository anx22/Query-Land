import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Web test runner for light UI-logic tests (per the UX-sprint DoD):
// pure logic such as ConfidenceBadge mapping, DeltaChip direction, formatters
// and data adapters. Visual/chart correctness is covered by `build:web`.
// Test files are excluded from the Next tsconfig so they never affect the
// production typecheck/build; Vitest transforms and runs them in isolation.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
