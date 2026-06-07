/**
 * Tests for ConfidenceBadge — pure logic + rendering.
 * Vitest + React Testing Library (jsdom, globals enabled).
 */

import { render, screen } from "@testing-library/react";
import {
  confidenceMeta,
  ConfidenceBadge,
  type ConfidenceLevel,
} from "./confidence-badge";

// ---------------------------------------------------------------------------
// Pure logic: confidenceMeta()
// ---------------------------------------------------------------------------

describe("confidenceMeta()", () => {
  const levels: ConfidenceLevel[] = ["A", "B", "C", "D", "E"];

  it("returns a label for every level", () => {
    for (const level of levels) {
      const meta = confidenceMeta(level);
      expect(meta.label).toBeTruthy();
    }
  });

  it("returns a description for every level", () => {
    for (const level of levels) {
      const meta = confidenceMeta(level);
      expect(meta.description).toBeTruthy();
    }
  });

  it("A → label 'Gesichert'", () => {
    expect(confidenceMeta("A").label).toBe("Gesichert");
  });

  it("B → label 'Beobachtet'", () => {
    expect(confidenceMeta("B").label).toBe("Beobachtet");
  });

  it("C → label 'Gemessen (SERP)'", () => {
    expect(confidenceMeta("C").label).toBe("Gemessen (SERP)");
  });

  it("D → label 'Geschätzt'", () => {
    expect(confidenceMeta("D").label).toBe("Geschätzt");
  });

  it("E → label 'KI-Hinweis (kein Beleg)'", () => {
    expect(confidenceMeta("E").label).toBe("KI-Hinweis (kein Beleg)");
  });

  it("A → description mentions own data", () => {
    expect(confidenceMeta("A").description.toLowerCase()).toContain("eigene");
  });

  it("E → description mentions LLM", () => {
    expect(confidenceMeta("E").description).toMatch(/LLM|kein Beleg/i);
  });
});

// ---------------------------------------------------------------------------
// Rendering: ConfidenceBadge
// ---------------------------------------------------------------------------

describe("<ConfidenceBadge />", () => {
  it.each<ConfidenceLevel>(["A", "B", "C", "D", "E"])(
    "renders the letter %s so color is not the only signal",
    (level) => {
      const { container } = render(<ConfidenceBadge level={level} />);
      // The letter element must be present (color is never the only signal)
      const letterEl = container.querySelector(".confidence-badge__letter");
      expect(letterEl).toBeInTheDocument();
      expect(letterEl?.textContent).toBe(level);
    }
  );

  it.each<[ConfidenceLevel, string]>([
    ["A", "Gesichert"],
    ["B", "Beobachtet"],
    ["C", "Gemessen (SERP)"],
    ["D", "Geschätzt"],
    ["E", "KI-Hinweis (kein Beleg)"],
  ])("renders the text label for level %s", (level, label) => {
    render(<ConfidenceBadge level={level} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("applies the correct BEM modifier class", () => {
    const { container } = render(<ConfidenceBadge level="A" />);
    expect(container.querySelector(".confidence-badge--A")).toBeInTheDocument();
  });

  it("does not render label text when showLabel=false", () => {
    render(<ConfidenceBadge level="B" showLabel={false} />);
    expect(screen.queryByText("Beobachtet")).not.toBeInTheDocument();
  });

  it("still renders the letter when showLabel=false (a11y: color not only signal)", () => {
    render(<ConfidenceBadge level="B" showLabel={false} />);
    // Letter B should still appear
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("has an accessible aria-label", () => {
    render(<ConfidenceBadge level="C" />);
    const badge = screen.getByRole("generic", {
      // aria-label is on the outer <span>
      name: /Konfidenz C/i,
    });
    expect(badge).toBeInTheDocument();
  });

  it("renders a dot element for visual signal", () => {
    const { container } = render(<ConfidenceBadge level="D" />);
    expect(
      container.querySelector(".confidence-badge__dot")
    ).toBeInTheDocument();
  });
});
