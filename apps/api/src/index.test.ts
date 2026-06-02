import assert from "node:assert/strict";
import test from "node:test";
import { getFoundationState } from "./index.js";

test("exposes the foundation memory and documented route count", () => {
  assert.deepEqual(getFoundationState().routeCount, 9);
  assert.equal(getFoundationState().memory.deliveryWave, "foundation");
});
