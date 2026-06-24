import { formatCount, formatCtr, formatPosition, formatDateTime, severityVariant } from "./format";

describe("formatCount()", () => {
  it("groups thousands in German locale", () => {
    expect(formatCount(1234567)).toBe("1.234.567");
  });
  it("rounds and renders zero", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(12.7)).toBe("13");
  });
  it("returns dash for non-finite", () => {
    expect(formatCount(Number.NaN)).toBe("—");
  });
});

describe("formatCtr()", () => {
  it("renders a 0–1 fraction as percent", () => {
    expect(formatCtr(0.123)).toBe("12,3 %");
  });
  it("renders zero", () => {
    expect(formatCtr(0)).toBe("0 %");
  });
  it("returns dash for non-finite", () => {
    expect(formatCtr(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("formatPosition()", () => {
  it("renders one decimal", () => {
    expect(formatPosition(4.27)).toBe("4,3");
  });
  it("returns dash for null/zero/negative", () => {
    expect(formatPosition(null)).toBe("—");
    expect(formatPosition(0)).toBe("—");
    expect(formatPosition(-2)).toBe("—");
  });
});

describe("formatDateTime()", () => {
  it("returns dash for empty/invalid", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime("not-a-date")).toBe("—");
  });
  it("formats a valid ISO timestamp", () => {
    const out = formatDateTime("2026-06-07T10:30:00.000Z");
    expect(out).not.toBe("—");
    expect(out.length).toBeGreaterThan(0);
  });
});

describe("severityVariant()", () => {
  it("maps critical/high to danger", () => {
    expect(severityVariant("critical")).toBe("danger");
    expect(severityVariant("high")).toBe("danger");
  });
  it("maps medium to warning", () => {
    expect(severityVariant("medium")).toBe("warning");
  });
  it("maps low/unknown to default", () => {
    expect(severityVariant("low")).toBe("default");
    expect(severityVariant("whatever")).toBe("default");
  });
});
