import { render, screen } from "@testing-library/react";
import { Sparkline } from "./sparkline";

describe("Sparkline", () => {
  it("renders a neutral placeholder when there is no data", () => {
    render(<Sparkline data={[]} />);
    expect(screen.getByLabelText("Keine Daten")).toBeInTheDocument();
  });

  it("renders an accessible trend container when data is present", () => {
    render(<Sparkline data={[1, 2, 3]} ariaLabel="Positions-Trend" />);
    expect(screen.getByRole("img", { name: "Positions-Trend" })).toBeInTheDocument();
  });
});
