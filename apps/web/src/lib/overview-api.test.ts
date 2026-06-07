import { positionToBucket } from "./overview-api";

describe("positionToBucket", () => {
  it("maps top-3 positions", () => {
    expect(positionToBucket(1)).toBe("top3");
    expect(positionToBucket(3)).toBe("top3");
  });

  it("maps positions 4–10 to top10", () => {
    expect(positionToBucket(4)).toBe("top10");
    expect(positionToBucket(10)).toBe("top10");
  });

  it("maps positions 11–20 to striking distance", () => {
    expect(positionToBucket(11)).toBe("strikingDist");
    expect(positionToBucket(20)).toBe("strikingDist");
  });

  it("maps positions 21–50 to mid", () => {
    expect(positionToBucket(21)).toBe("mid");
    expect(positionToBucket(50)).toBe("mid");
  });

  it("maps positions 51–100 to weak", () => {
    expect(positionToBucket(51)).toBe("weak");
    expect(positionToBucket(100)).toBe("weak");
  });

  it("returns null for out-of-range / invalid positions", () => {
    expect(positionToBucket(0)).toBeNull();
    expect(positionToBucket(101)).toBeNull();
    expect(positionToBucket(-5)).toBeNull();
  });
});
