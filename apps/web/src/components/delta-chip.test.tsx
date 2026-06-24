/**
 * Tests for DeltaChip — pure logic + rendering.
 * Vitest + React Testing Library (jsdom, globals enabled).
 */

import { render, screen } from "@testing-library/react";
import { deltaDirection, DeltaChip } from "./delta-chip";

// ---------------------------------------------------------------------------
// Pure logic: deltaDirection()
// ---------------------------------------------------------------------------

describe("deltaDirection()", () => {
  it("positive value → 'up'", () => {
    expect(deltaDirection(10)).toBe("up");
    expect(deltaDirection(0.1)).toBe("up");
    expect(deltaDirection(1000)).toBe("up");
  });

  it("negative value → 'down'", () => {
    expect(deltaDirection(-5)).toBe("down");
    expect(deltaDirection(-0.001)).toBe("down");
  });

  it("zero → 'flat'", () => {
    expect(deltaDirection(0)).toBe("flat");
  });

  it("positive + invert → 'down' (bad when going up)", () => {
    expect(deltaDirection(3, true)).toBe("down");
  });

  it("negative + invert → 'up' (good when going down, e.g. ranking)", () => {
    expect(deltaDirection(-3, true)).toBe("up");
  });

  it("zero + invert → 'flat'", () => {
    expect(deltaDirection(0, true)).toBe("flat");
  });
});

// ---------------------------------------------------------------------------
// Rendering: DeltaChip
// ---------------------------------------------------------------------------

describe("<DeltaChip />", () => {
  it("renders arrow ▲ for positive value", () => {
    render(<DeltaChip value={12} />);
    expect(screen.getByText("▲", { exact: false })).toBeInTheDocument();
  });

  it("renders arrow ▼ for negative value", () => {
    render(<DeltaChip value={-8} />);
    expect(screen.getByText("▼", { exact: false })).toBeInTheDocument();
  });

  it("renders – for zero value", () => {
    render(<DeltaChip value={0} />);
    expect(screen.getByText("–", { exact: false })).toBeInTheDocument();
  });

  it("applies .delta-chip--up for positive value", () => {
    const { container } = render(<DeltaChip value={5} />);
    expect(container.querySelector(".delta-chip--up")).toBeInTheDocument();
  });

  it("applies .delta-chip--down for negative value", () => {
    const { container } = render(<DeltaChip value={-5} />);
    expect(container.querySelector(".delta-chip--down")).toBeInTheDocument();
  });

  it("applies .delta-chip--flat for zero", () => {
    const { container } = render(<DeltaChip value={0} />);
    expect(container.querySelector(".delta-chip--flat")).toBeInTheDocument();
  });

  it("renders sr-only direction text so color is not the only signal", () => {
    const { container } = render(<DeltaChip value={10} />);
    const srEl = container.querySelector(".sr-only");
    expect(srEl).toBeInTheDocument();
    expect(srEl?.textContent).toMatch(/gestiegen/i);
  });

  it("sr-only says 'gesunken' for negative value", () => {
    const { container } = render(<DeltaChip value={-5} />);
    const srEl = container.querySelector(".sr-only");
    expect(srEl?.textContent).toMatch(/gesunken/i);
  });

  it("sr-only says 'unverändert' for zero", () => {
    const { container } = render(<DeltaChip value={0} />);
    const srEl = container.querySelector(".sr-only");
    expect(srEl?.textContent).toMatch(/unverändert/i);
  });

  it("invertColors: positive value renders .delta-chip--down", () => {
    const { container } = render(<DeltaChip value={3} invertColors />);
    expect(container.querySelector(".delta-chip--down")).toBeInTheDocument();
  });

  it("invertColors: negative value renders .delta-chip--up (lower = better, e.g. ranking)", () => {
    const { container } = render(<DeltaChip value={-3} invertColors />);
    expect(container.querySelector(".delta-chip--up")).toBeInTheDocument();
  });

  it("renders formatted positive value with + prefix", () => {
    const { container } = render(<DeltaChip value={42} />);
    const valueEl = container.querySelector(".delta-chip__value");
    expect(valueEl?.textContent).toBe("+42");
  });

  it("renders unit when provided", () => {
    render(<DeltaChip value={5} unit=" Klicks" />);
    // The value span should include the unit
    const valueEl = document.querySelector(".delta-chip__value");
    expect(valueEl?.textContent).toMatch(/Klicks/);
  });

  it("percent format renders % sign", () => {
    const { container } = render(<DeltaChip value={10} format="percent" />);
    const valueEl = container.querySelector(".delta-chip__value");
    expect(valueEl?.textContent).toMatch(/%/);
  });
});
