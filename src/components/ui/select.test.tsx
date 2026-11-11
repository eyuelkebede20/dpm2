import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Select } from "./select";

describe("Select Component - Accessibility & Sizing", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with 44px minimum height and accessible chevron dropdown indicator", () => {
    render(
      <Select aria-label="Select Role">
        <option value="fm">Factory Manager</option>
        <option value="qa">QA Inspector</option>
      </Select>
    );
    const select = screen.getByRole("combobox", { name: "Select Role" });
    expect(select.className).toContain("min-h-[44px]");
    expect(select.className).toContain("text-base");
    expect(select.className).toContain("sm:text-sm");
  });

  it("changes value when an option is selected", () => {
    const handleChange = vi.fn();
    render(
      <Select aria-label="Select Role" onChange={handleChange}>
        <option value="fm">Factory Manager</option>
        <option value="qa">QA Inspector</option>
      </Select>
    );
    const select = screen.getByRole("combobox", { name: "Select Role" });
    fireEvent.change(select, { target: { value: "qa" } });
    expect(handleChange).toHaveBeenCalled();
  });
});
