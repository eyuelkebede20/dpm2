import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Input } from "./input";

describe("Input Component - Accessibility & Sizing", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with minimum height 44px for touch targets and font-size >= 16px on mobile", () => {
    render(<Input placeholder="Enter plant name" />);
    const input = screen.getByPlaceholderText("Enter plant name");
    expect(input.className).toContain("min-h-[44px]");
    expect(input.className).toContain("text-base");
    expect(input.className).toContain("sm:text-sm");
  });

  it("handles user typing and change events properly", () => {
    const handleChange = vi.fn();
    render(<Input placeholder="Type here" onChange={handleChange} />);
    const input = screen.getByPlaceholderText("Type here");
    fireEvent.change(input, { target: { value: "New Value" } });
    expect(handleChange).toHaveBeenCalled();
  });

  it("applies accessible error styling and aria-invalid attribute when hasError is true", () => {
    render(<Input placeholder="Invalid field" hasError />);
    const input = screen.getByPlaceholderText("Invalid field");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.className).toContain("border-rose-400");
  });

  it("disables interaction when disabled is true", () => {
    render(<Input placeholder="Disabled" disabled />);
    const input = screen.getByPlaceholderText("Disabled") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.className).toContain("cursor-not-allowed");
  });
});
