import assert from "node:assert/strict";
import test from "node:test";
import { makeIdempotencyKey, normalizeEmail, sourceConfidenceForProvider, validateBusinessValue, validatePassword } from "../src/index.js";

test("maps first-party providers to source confidence classes", () => {
  assert.equal(sourceConfidenceForProvider("ga4"), "A");
  assert.equal(sourceConfidenceForProvider("gsc"), "B");
  assert.equal(sourceConfidenceForProvider("serp"), "C");
  assert.equal(sourceConfidenceForProvider("backlink"), "D");
});

test("creates stable idempotency keys for foundation jobs", () => {
  assert.equal(makeIdempotencyKey("project-1", "connector_sync", "GSC Daily"), "project-1:connector_sync:gsc-daily");
});

test("validates business value range", () => {
  assert.equal(validateBusinessValue(50), 50);
  assert.throws(() => validateBusinessValue(0), /businessValue/);
  assert.throws(() => validateBusinessValue(101), /businessValue/);
});

test("normalizes auth inputs", () => {
  assert.equal(normalizeEmail(" User@Example.COM "), "user@example.com");
  assert.equal(validatePassword("very-long-password"), "very-long-password");
  assert.throws(() => normalizeEmail("not-an-email"), /email/);
  assert.throws(() => validatePassword("short"), /password/);
});
