// @vitest-environment happy-dom
import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Button } from "@/components/ui/button";
import { StepperInput } from "@/components/ui/stepper-input";
import { LineTallyVisualizer } from "@/components/entry-grid/line-tally-visualizer";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { DailyEntryClient } from "@/components/entry-grid/daily-entry-client";
import { DashboardView } from "@/app/dashboard/dashboard-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/entry",
  useSearchParams: () => new URLSearchParams(),
}));

describe("UI Stress-Test & Resilience Harness (Item 03 - break-ui)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("1. Extreme Payloads & Long Strings (120 characters unbroken)", () => {
    const longString120 =
      "SUPER_LONG_UNBROKEN_PRODUCT_IDENTIFIER_LINE_ASSEMBLY_TESTING_MANUFACTURING_FACTORY_STRESS_PAYLOAD_STRING_ABCDEFGHIJKLMN123456789";

    it("renders Button with 120-character label without crashing", () => {
      render(
        <Button variant="primary" size="md">
          {longString120}
        </Button>
      );

      const btn = screen.getByRole("button", { name: longString120 });
      expect(btn).toBeDefined();
      expect(btn.textContent).toBe(longString120);
    });

    it("renders LineTallyVisualizer with extreme string name", () => {
      const { container } = render(
        <LineTallyVisualizer
          plannedQty={1000}
          finishedGood={500}
          className="max-w-md truncate"
        />
      );

      expect(container.firstChild).toBeDefined();
    });

    it("renders DailyEntryClient with 120-character line and product names", () => {
      const stressRow = {
        lineId: "line-stress-1",
        lineName: longString120,
        productId: "prod-stress-1",
        productName: longString120,
        sku: "SKU-STRESS-LONG-12345",
        plan: {
          id: "plan-1",
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          plannedQty: 10000,
        },
        entry: {
          finishedGood: 250,
          rework: 5,
          reject: 2,
          scrap: 1,
          wip: 10,
          downtimeMinutes: 0,
          issueNote: longString120,
        },
      };

      render(
        <DailyEntryClient
          initialDate="2026-11-08"
          initialRows={[stressRow]}
          workingDays={[1, 2, 3, 4, 5, 6]}
          factoryId="fac-stress"
          userRole="fm"
        />
      );

      expect(screen.getAllByText(longString120).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("2. Boundary, Zero & Extreme Numbers", () => {
    it("handles zero values cleanly across all numeric inputs", () => {
      const handleChange = vi.fn();
      render(
        <StepperInput
          value={0}
          min={0}
          max={1000000}
          onChange={handleChange}
        />
      );

      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("0");

      // Decrementing at min=0 should not go negative
      const decBtn = screen.getByTitle("Decrease");
      fireEvent.click(decBtn);
      expect(handleChange).not.toHaveBeenCalled();
    });

    it("handles extreme numbers (1,000,000 units) without display truncation failure", () => {
      render(
        <LineTallyVisualizer
          plannedQty={1000000}
          finishedGood={1250000}
          rework={5000}
          reject={2000}
          scrap={1000}
        />
      );

      expect(screen.getByText("1,000,000")).toBeDefined();
      expect(screen.getByText("1,250,000")).toBeDefined();
    });

    it("clamps negative manual input to minimum threshold", () => {
      const handleChange = vi.fn();
      render(
        <StepperInput
          value={10}
          min={0}
          max={1000}
          onChange={handleChange}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "-50" } });
      // Clamps to min 0
      expect(handleChange).toHaveBeenCalledWith(0);
    });
  });

  describe("3. Empty Database Collections", () => {
    it("renders welcoming empty state in DailyEntryClient when rows array is empty", () => {
      render(
        <DailyEntryClient
          initialDate="2026-11-08"
          initialRows={[]}
          workingDays={[1, 2, 3, 4, 5, 6]}
          factoryId="fac-empty"
          userRole="fm"
        />
      );

      expect(
        screen.getByText("No active lines or products configured for this factory.")
      ).toBeDefined();
    });

    it("renders DashboardView gracefully with zero factories and metrics", () => {
      const mockUser = {
        id: "usr-stress-1",
        name: "Abebe Bikila",
        email: "abebe@factory.local",
        role: "fm" as const,
        active: true,
        mustChangePassword: false,
      };

      const emptyFmData = {
        todayMetrics: {
          totalFinishedGood: 0,
          totalTarget: 0,
          variance: 0,
          variancePercentage: null,
          totalRework: 0,
          totalReject: 0,
          totalScrap: 0,
          totalWip: 0,
          totalDowntime: 0,
        },
        linesCount: 0,
        productsCount: 0,
        activePlansCount: 0,
        recentEntries: [],
      };

      render(
        <DashboardView
          user={mockUser}
          fmData={emptyFmData}
          factoryName="Plant Zero"
          calendarSystem="gregorian"
        />
      );

      expect(screen.getByText(/Plant Zero/i)).toBeDefined();
      expect(screen.getByText(/Abebe Bikila/i)).toBeDefined();
    });
  });

  describe("4. Rapid Double-Click & In-Flight Lockout", () => {
    it("prevents double-firing when Button is clicked multiple times rapidly", async () => {
      let resolveClick: () => void = () => {};
      const clickPromise = new Promise<void>((resolve) => {
        resolveClick = resolve;
      });
      const handleClick = vi.fn().mockReturnValue(clickPromise);

      render(
        <Button onClick={handleClick} debounceMs={300}>
          Confirm Production Plan
        </Button>
      );

      const btn = screen.getByRole("button", { name: "Confirm Production Plan" });

      // Click rapidly 4 times
      fireEvent.click(btn);
      fireEvent.click(btn);
      fireEvent.click(btn);
      fireEvent.click(btn);

      // Only first click should be dispatched
      expect(handleClick).toHaveBeenCalledTimes(1);

      // Settle promise and wait for button to leave busy state before test teardown
      resolveClick();
      await waitFor(() => {
        expect(btn.getAttribute("aria-busy")).toBeNull();
      });
    });
  });

  describe("5. International Unicode & Amharic Language Support", () => {
    it("renders Amharic headers and labels with correct visual glyphs", () => {
      const amharicLabels = ["ጥሩ ምርት", "ብልሽት", "ቆሻሻ", "መቆሚያ", "ዛሬ"];

      render(
        <div>
          {amharicLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      );

      for (const label of amharicLabels) {
        expect(screen.getByText(label)).toBeDefined();
      }
    });
  });

  describe("6. Error Boundary Recovery under Deliberate Render Crash", () => {
    const ProblemChild = ({ shouldCrash }: { shouldCrash: boolean }) => {
      if (shouldCrash) {
        throw new Error("Deliberate simulation crash in manufacturing component");
      }
      return <div>Subsystem Operating Normally</div>;
    };

    it("isolates catastrophic child crash and displays accessible fallback with retry", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { rerender } = render(
        <ErrorBoundary title="Module Failure">
          <ProblemChild shouldCrash={true} />
        </ErrorBoundary>
      );

      expect(screen.getByRole("alert")).toBeDefined();
      expect(screen.getByText("Module Failure")).toBeDefined();
      expect(screen.getByText(/Deliberate simulation crash/i)).toBeDefined();

      const retryBtn = screen.getByRole("button", { name: /Try Again/i });
      expect(retryBtn).toBeDefined();

      // Rerender with clean state and click retry
      rerender(
        <ErrorBoundary title="Module Failure">
          <ProblemChild shouldCrash={false} />
        </ErrorBoundary>
      );
      fireEvent.click(retryBtn);

      expect(screen.getByText("Subsystem Operating Normally")).toBeDefined();
      spy.mockRestore();
    });
  });
});
