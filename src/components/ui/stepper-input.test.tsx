import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { StepperInput } from "./stepper-input";

describe("Button Interaction Tests - StepperInput", () => {
  afterEach(() => {
    cleanup();
  });

  it("decrements quantity when '-' decrease button is clicked", () => {
    const handleChange = vi.fn();
    render(<StepperInput value={10} onChange={handleChange} min={0} step={1} />);

    const decBtn = screen.getByRole("button", { name: /decrease/i }) as HTMLButtonElement;
    expect(decBtn.disabled).toBe(false);

    fireEvent.click(decBtn);
    expect(handleChange).toHaveBeenCalledWith(9);
  });

  it("disables '-' decrease button when value is at or below minimum", () => {
    const handleChange = vi.fn();
    render(<StepperInput value={0} onChange={handleChange} min={0} />);

    const decBtn = screen.getByRole("button", { name: /decrease/i }) as HTMLButtonElement;
    expect(decBtn.disabled).toBe(true);

    fireEvent.click(decBtn);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("increments quantity when '+' increase button is clicked", () => {
    const handleChange = vi.fn();
    render(<StepperInput value={10} onChange={handleChange} max={100} step={1} />);

    const incBtn = screen.getByRole("button", { name: /increase/i }) as HTMLButtonElement;
    expect(incBtn.disabled).toBe(false);

    fireEvent.click(incBtn);
    expect(handleChange).toHaveBeenCalledWith(11);
  });

  it("disables '+' increase button when value is at or above maximum", () => {
    const handleChange = vi.fn();
    render(<StepperInput value={100} onChange={handleChange} max={100} />);

    const incBtn = screen.getByRole("button", { name: /increase/i }) as HTMLButtonElement;
    expect(incBtn.disabled).toBe(true);

    fireEvent.click(incBtn);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("adds specified amounts when quick-add buttons (+1, +5, +10) are clicked", () => {
    const handleChange = vi.fn();
    render(
      <StepperInput
        value={20}
        onChange={handleChange}
        quickAdds={[1, 5, 10]}
      />
    );

    const buttons = screen.getAllByRole("button");
    const add1 = buttons.find((b) => b.textContent?.includes("+1"))!;
    const add5 = buttons.find((b) => b.textContent?.includes("+5"))!;
    const add10 = buttons.find((b) => b.textContent?.includes("+10"))!;

    expect(add1).toBeDefined();
    expect(add5).toBeDefined();
    expect(add10).toBeDefined();

    fireEvent.click(add1);
    expect(handleChange).toHaveBeenCalledWith(21);

    fireEvent.click(add5);
    expect(handleChange).toHaveBeenCalledWith(25);

    fireEvent.click(add10);
    expect(handleChange).toHaveBeenCalledWith(30);
  });

  it("disables all stepper buttons when component is disabled", () => {
    const handleChange = vi.fn();
    render(
      <StepperInput
        value={15}
        onChange={handleChange}
        disabled={true}
        quickAdds={[1, 5]}
      />
    );

    const decBtn = screen.getByRole("button", { name: /decrease/i }) as HTMLButtonElement;
    const incBtn = screen.getByRole("button", { name: /increase/i }) as HTMLButtonElement;
    expect(decBtn.disabled).toBe(true);
    expect(incBtn.disabled).toBe(true);

    // Quick adds are omitted when disabled
    const buttons = screen.getAllByRole("button");
    const quickAddBtns = buttons.filter((b) => b.textContent?.includes("+"));
    expect(quickAddBtns.length).toBe(0);
  });
});
