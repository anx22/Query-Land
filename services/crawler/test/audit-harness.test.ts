import assert from "node:assert/strict";
import test from "node:test";
import { runAuditScenarios } from "../src/audit-harness.js";

// The audit harness IS the network-free behaviour battery. CI runs it as a test
// so any scenario regression fails the build; `npm run audit:crawl` prints the
// same scenarios as a human-readable diagnostic. Every scenario must stay green.
test("crawler audit harness: every behaviour scenario passes", async () => {
  const report = await runAuditScenarios();
  const failed = report.scenarios.filter((scenario) => !scenario.passed);
  const detail = failed
    .map((scenario) => `\n  ${scenario.name}:\n${scenario.checks.filter((c) => !c.pass).map((c) => `    - ${c.label}: ${c.detail}`).join("\n")}`)
    .join("");
  assert.equal(report.passed, true, `audit harness scenarios failed:${detail}`);
  // Guard against an empty/short battery silently "passing".
  assert.ok(report.scenarios.length >= 10, `expected >= 10 scenarios, got ${report.scenarios.length}`);
});
