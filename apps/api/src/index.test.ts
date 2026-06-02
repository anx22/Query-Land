import { describe, expect, it } from "vitest";
import { getFoundationState } from "./index";

describe("api foundation state", () => {
  it("exposes the foundation memory and documented route count", () => {
    expect(getFoundationState()).toMatchObject({
      routeCount: 9,
      memory: { deliveryWave: "foundation" },
    });
  });
});
