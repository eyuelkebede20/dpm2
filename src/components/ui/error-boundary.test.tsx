// @vitest-environment happy-dom
import React from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ErrorBoundary } from "./error-boundary";
import { AppError } from "@/lib/errors";

function ThrowingComponent({ shouldThrow, error }: { shouldThrow: boolean; error?: Error }) {
  if (shouldThrow) {
    throw error || new Error("Crash in component");
  }
  return <div data-testid="child-content">Normal Content</div>;
}

describe("Resilient ErrorBoundary Component", () => {
  beforeEach(() => {
    // Suppress React boundary console.error during expected throw tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("1. Normal Rendering", () => {
    it("renders children uninterrupted when no error occurs", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId("child-content")).toBeDefined();
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("2. Error Catching & Fallback Display", () => {
    it("catches render error, displays role='alert' and accessible fallback", () => {
      render(
        <ErrorBoundary title="Widget Failed">
          <ThrowingComponent shouldThrow={true} error={new Error("Failed calculation")} />
        </ErrorBoundary>
      );

      const alert = screen.getByRole("alert");
      expect(alert).toBeDefined();
      expect(screen.getByText("Widget Failed")).toBeDefined();
      expect(screen.getByText("Failed calculation")).toBeDefined();
      expect(screen.queryByTestId("child-content")).toBeNull();
    });

    it("displays friendly userMessage when AppError is thrown", () => {
      const appErr = AppError.forbidden("Access denied internally", "You do not have access to view this plant.");
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} error={appErr} />
        </ErrorBoundary>
      );

      expect(screen.getByText("You do not have access to view this plant.")).toBeDefined();
    });

    it("supports custom function fallback with error and reset handler", () => {
      render(
        <ErrorBoundary
          fallback={({ error, reset }) => (
            <div data-testid="custom-fallback">
              <span>Custom: {error.message}</span>
              <button onClick={reset}>Custom Reset</button>
            </div>
          )}
        >
          <ThrowingComponent shouldThrow={true} error={new Error("Custom crash")} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId("custom-fallback")).toBeDefined();
      expect(screen.getByText("Custom: Custom crash")).toBeDefined();
    });
  });

  describe("3. Recovery & Reset Workflow", () => {
    it("resets error state when 'Try Again' button is clicked", () => {
      function FlakyComponent({ shouldFail }: { shouldFail: boolean }) {
        if (shouldFail) {
          throw new Error("Temporary crash");
        }
        return <div data-testid="child-content">Recovered Content</div>;
      }

      function TestContainer() {
        const [shouldFail, setShouldFail] = React.useState(true);
        return (
          <ErrorBoundary onReset={() => setShouldFail(false)}>
            <FlakyComponent shouldFail={shouldFail} />
          </ErrorBoundary>
        );
      }

      render(<TestContainer />);

      expect(screen.getByRole("alert")).toBeDefined();

      const retryBtn = screen.getByRole("button", { name: /try again/i });
      fireEvent.click(retryBtn);

      expect(screen.getByTestId("child-content")).toBeDefined();
      expect(screen.getByText("Recovered Content")).toBeDefined();
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("4. Diagnostics & Failure Isolation", () => {
    it("invokes onError callback with error and component stack info", () => {
      const onError = vi.fn();
      const testError = new Error("Diagnostic crash");

      render(
        <ErrorBoundary onError={onError}>
          <ThrowingComponent shouldThrow={true} error={testError} />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledWith(testError, expect.objectContaining({ componentStack: expect.any(String) }));
    });

    it("isolates errors to specific widget boundary without crashing sibling components", () => {
      render(
        <div>
          <div data-testid="healthy-sibling">Healthy Widget</div>
          <ErrorBoundary>
            <ThrowingComponent shouldThrow={true} />
          </ErrorBoundary>
        </div>
      );

      expect(screen.getByTestId("healthy-sibling")).toBeDefined();
      expect(screen.getByRole("alert")).toBeDefined();
    });
  });
});
