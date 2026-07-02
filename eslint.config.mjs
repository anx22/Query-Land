// Flat ESLint config (ESLint 9). Deliberately conservative and NON-blocking:
// - No type-checked rules (fast, no `parserOptions.project` needed on this monorepo).
// - The noisiest rules on an existing codebase are set to "warn", not "error", so the
//   lint step is informational until the warnings are worked down. CI runs it as a
//   separate, non-blocking job (see .github/workflows/ci.yml).
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      ".devdb/**",
      "**/*.d.ts",
      "**/coverage/**",
      "scripts/**", // plain Node scripts, not part of the TS project graph
      "**/next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // Keep the baseline informational on an existing codebase (warn, not error).
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-constant-condition": ["warn", { checkLoops: false }], // `for (;;)` BFS loops are intentional
      // Keep the whole baseline at warn-level so `npm run lint` is non-blocking (exit 0).
      "no-useless-assignment": "warn",
      "no-irregular-whitespace": "warn",
    },
  },
);
