import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LineTallyVisualizer } from "./line-tally-visualizer";

describe("LineTallyVisualizer Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders target, actual finished good, and completion percentage", () => {
    render(
      <LineTallyVisualizer
        plannedQty={1000}
        finishedGood={750}
        rework={20}
        reject={10}
        scrap={5}
      />
    );

    expect(screen.getByText("75% of target")).toBeDefined();
    expect(screen.getByText("750")).toBeDefined();
    expect(screen.getByText("1,000")).toBeDefined();
    expect(screen.getByText("Good (750)")).toBeDefined();
    expect(screen.getByText("Rework (20)")).toBeDefined();
    expect(screen.getByText("Defect (15)")).toBeDefined();
  });

  it("displays over-target badge when actual exceeds planned target", () => {
    render(
      <LineTallyVisualizer
        plannedQty={1000}
        finishedGood={1250}
      />
    );

    expect(screen.getByText(/OVER/i)).toBeDefined();
    expect(screen.getByText(/ትርፍ/i)).toBeDefined();
  });

  it("calls onIncrement when green quick tally buttons (+1, +5, +10, +50, +100) are clicked", () => {
    const handleIncrement = vi.fn();
    render(
      <LineTallyVisualizer
        plannedQty={1000}
        finishedGood={500}
        onIncrement={handleIncrement}
        showQuickButtons={true}
      />
    );

    const add1 = screen.getByTitle("Add 1 Good Unit");
    const add5 = screen.getByTitle("Add 5 Good Units");
    const add10 = screen.getByTitle("Add 10 Good Units");
    const add50 = screen.getByTitle("Add 50 Good Units");
    const add100 = screen.getByTitle("Add 100 Good Units");
    const minus10 = screen.getByTitle("Minus 10");

    fireEvent.click(add1);
    expect(handleIncrement).toHaveBeenCalledWith(1);

    fireEvent.click(add5);
    expect(handleIncrement).toHaveBeenCalledWith(5);

    fireEvent.click(add10);
    expect(handleIncrement).toHaveBeenCalledWith(10);

    fireEvent.click(add50);
    expect(handleIncrement).toHaveBeenCalledWith(50);

    fireEvent.click(add100);
    expect(handleIncrement).toHaveBeenCalledWith(100);

    fireEvent.click(minus10);
    expect(handleIncrement).toHaveBeenCalledWith(-10);
  });
});
