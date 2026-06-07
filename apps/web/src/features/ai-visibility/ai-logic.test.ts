import {
  citationGlyph,
  citationStatus,
  citationStatusBadge,
  citationStatusLabel,
  countCited,
  toMatrixRow,
  proposalKindLabel,
  proposalStatusBadge,
  proposalStatusLabel,
  type CitationStatus,
} from "./ai-logic";

describe("citationStatus()", () => {
  it("returns 'none' when no snapshot exists", () => {
    expect(citationStatus(null)).toBe("none");
  });
  it("returns 'cited' when our domain was cited", () => {
    expect(citationStatus({ ourCited: true, brandMentioned: false })).toBe("cited");
  });
  it("prefers 'cited' even when only brand mentioned is also true", () => {
    expect(citationStatus({ ourCited: true, brandMentioned: true })).toBe("cited");
  });
  it("returns 'mentioned' when brand named but not cited", () => {
    expect(citationStatus({ ourCited: false, brandMentioned: true })).toBe("mentioned");
  });
  it("returns 'absent' when a snapshot exists but neither cited nor mentioned", () => {
    expect(citationStatus({ ourCited: false, brandMentioned: false })).toBe("absent");
  });
});

describe("citationGlyph()", () => {
  it("maps cited to a filled circle and absent to a hollow circle", () => {
    expect(citationGlyph("cited")).toBe("●");
    expect(citationGlyph("absent")).toBe("○");
  });
  it("maps mentioned to a half circle and none to a dash", () => {
    expect(citationGlyph("mentioned")).toBe("◐");
    expect(citationGlyph("none")).toBe("–");
  });
});

describe("citationStatusLabel()", () => {
  const cases: Array<[CitationStatus, string]> = [
    ["cited", "Zitiert"],
    ["mentioned", "Erwähnt (nicht zitiert)"],
    ["absent", "Nicht zitiert"],
    ["none", "Kein Snapshot"],
  ];
  it.each(cases)("labels %s in German", (status, label) => {
    expect(citationStatusLabel(status)).toBe(label);
  });
});

describe("citationStatusBadge()", () => {
  it("maps statuses to functional badge modifiers (text always paired in UI)", () => {
    expect(citationStatusBadge("cited")).toBe("success");
    expect(citationStatusBadge("mentioned")).toBe("warning");
    expect(citationStatusBadge("absent")).toBe("danger");
    expect(citationStatusBadge("none")).toBe("");
  });
});

describe("proposal labels & badges", () => {
  it("labels proposal kinds in German", () => {
    expect(proposalKindLabel("dev_ticket")).toBe("Dev-Ticket");
    expect(proposalKindLabel("fix_pr")).toBe("Fix-PR");
  });
  it("labels proposal statuses in German", () => {
    expect(proposalStatusLabel("proposed")).toBe("Vorgeschlagen");
    expect(proposalStatusLabel("accepted")).toBe("Akzeptiert");
    expect(proposalStatusLabel("rejected")).toBe("Verworfen");
  });
  it("maps proposal statuses to functional badge modifiers", () => {
    expect(proposalStatusBadge("proposed")).toBe("warning");
    expect(proposalStatusBadge("accepted")).toBe("success");
    expect(proposalStatusBadge("rejected")).toBe("danger");
  });
});

describe("countCited()", () => {
  it("counts only rows with 'cited' status", () => {
    expect(
      countCited([
        { status: "cited" },
        { status: "mentioned" },
        { status: "cited" },
        { status: "absent" },
        { status: "none" },
      ]),
    ).toBe(2);
  });
  it("returns 0 for an empty list", () => {
    expect(countCited([])).toBe(0);
  });
});

describe("toMatrixRow()", () => {
  it("derives a 'none' row when there is no latest snapshot", () => {
    const row = toMatrixRow({
      promptId: "p1",
      prompt: "best seo tools",
      market: "de",
      snapshotCount: 0,
      latest: null,
    });
    expect(row).toEqual({
      promptId: "p1",
      prompt: "best seo tools",
      market: "de",
      status: "none",
      citedDomains: [],
      snapshotCount: 0,
      capturedAt: null,
    });
  });
  it("derives a 'cited' row and carries domains + timestamp", () => {
    const row = toMatrixRow({
      promptId: "p2",
      prompt: "seo audit",
      market: "en-US",
      snapshotCount: 3,
      latest: {
        ourCited: true,
        brandMentioned: true,
        citedDomains: ["example.com", "foo.com"],
        capturedAt: "2026-06-01T00:00:00.000Z",
      },
    });
    expect(row.status).toBe("cited");
    expect(row.citedDomains).toEqual(["example.com", "foo.com"]);
    expect(row.capturedAt).toBe("2026-06-01T00:00:00.000Z");
    expect(row.snapshotCount).toBe(3);
  });
});
