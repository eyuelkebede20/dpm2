// @vitest-environment happy-dom
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

describe("Accessible & Resilient Button Primitive", () => {
  afterEach(() => {
    cleanup();
  });

  describe("1. Rendering & Accessibility", () => {
    it("renders with accessible role 'button' and accessible name", () => {
      render(<Button>Submit Production Report</Button>);

      const btn = screen.getByRole("button", {
        name: "Submit Production Report",
      });
      expect(btn).toBeDefined();
      expect(btn.getAttribute("type")).toBe("button");
      expect(btn.getAttribute("aria-busy")).toBeNull();
    });

    it("renders custom button types like submit", () => {
      render(<Button type="submit">Save Settings</Button>);
      const btn = screen.getByRole("button", { name: "Save Settings" });
      expect(btn.getAttribute("type")).toBe("submit");
    });

    it("applies variant and size classes according to DESIGN.md tokens", () => {
      const { rerender } = render(
        <Button variant="danger" size="lg">
          Delete Entry
        </Button>
      );
      let btn = screen.getByRole("button", { name: "Delete Entry" });
      expect(btn.className).toContain("bg-rose-600");
      expect(btn.className).toContain("h-12");

      rerender(
        <Button variant="outline" size="xs">
          Filter
        </Button>
      );
      btn = screen.getByRole("button", { name: "Filter" });
      expect(btn.className).toContain("border-slate-300");
      expect(btn.className).toContain("h-7");
    });

    it("renders left and right icon slots", () => {
      render(
        <Button
          leftIcon={<span data-testid="left-icon">←</span>}
          rightIcon={<span data-testid="right-icon">→</span>}
        >
          Navigate
        </Button>
      );

      expect(screen.getByTestId("left-icon")).toBeDefined();
      expect(screen.getByTestId("right-icon")).toBeDefined();
    });
  });

  describe("2. Interaction & Keyboard Events", () => {
    it("triggers onClick handler when clicked", async () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click Me</Button>);

      const btn = screen.getByRole("button", { name: "Click Me" });
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("triggers onClick when activated via Enter keyboard key", async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Press Enter</Button>);

      const btn = screen.getByRole("button", { name: "Press Enter" });
      btn.focus();
      expect(document.activeElement).toBe(btn);

      await user.keyboard("{Enter}");
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("triggers onClick when activated via Space keyboard key", async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Press Space</Button>);

      const btn = screen.getByRole("button", { name: "Press Space" });
      btn.focus();
      await user.keyboard(" ");
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("3. Loading Lockout & Async Protection", () => {
    it("enforces loading lockout: aria-busy='true', disabled, and suppresses click", () => {
      const handleClick = vi.fn();
      render(
        <Button loading loadingText="Saving Data..." onClick={handleClick}>
          Save
        </Button>
      );

      const btn = screen.getByRole("button");
      expect(btn.getAttribute("aria-busy")).toBe("true");
      expect(btn.getAttribute("disabled")).toBeDefined();
      expect(screen.getByText("Saving Data...")).toBeDefined();

      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("automatically locks button while async promise is in-flight", async () => {
      let resolvePromise: () => void = () => {};
      const pendingPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      const handleAsync = vi.fn(() => pendingPromise);
      render(<Button onClick={handleAsync}>Async Action</Button>);

      const btn = screen.getByRole("button", { name: "Async Action" });
      expect(btn.getAttribute("aria-busy")).toBeNull();

      // Trigger first click
      await act(async () => {
        fireEvent.click(btn);
      });

      expect(handleAsync).toHaveBeenCalledTimes(1);
      // Now in-flight
      expect(btn.getAttribute("aria-busy")).toBe("true");

      // Try triggering second click while in flight
      fireEvent.click(btn);
      expect(handleAsync).toHaveBeenCalledTimes(1); // Still 1

      // Resolve async work
      await act(async () => {
        resolvePromise();
      });

      // Cleared
      expect(btn.getAttribute("aria-busy")).toBeNull();
    });
  });

  describe("4. Double-Click Debounce Protection", () => {
    it("suppresses rapid duplicate clicks within debounceMs threshold", () => {
      const handleClick = vi.fn();
      render(
        <Button onClick={handleClick} debounceMs={300}>
          Quick Fire
        </Button>
      );

      const btn = screen.getByRole("button", { name: "Quick Fire" });

      // First click
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);

      // Instant second click within 50ms
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1); // blocked
    });
  });

  describe("5. Disabled State", () => {
    it("does not fire click events when disabled prop is true", () => {
      const handleClick = vi.fn();
      render(
        <Button disabled onClick={handleClick}>
          Inactive
        </Button>
      );

      const btn = screen.getByRole("button", { name: "Inactive" });
      expect(btn.getAttribute("disabled")).toBeDefined();
      expect(btn.getAttribute("aria-disabled")).toBe("true");

      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });
});
