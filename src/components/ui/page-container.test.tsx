import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PageContainer } from "./page-container";

describe("PageContainer Responsive Layout", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with cohesive big-screen responsive padding by default", () => {
    render(<PageContainer data-testid="container">Content</PageContainer>);
    const el = screen.getByTestId("container");
    expect(el).toBeDefined();
    // Verify responsive horizontal gutters for big screens
    expect(el.className).toContain("px-4");
    expect(el.className).toContain("sm:px-6");
    expect(el.className).toContain("md:px-8");
    expect(el.className).toContain("lg:px-10");
    expect(el.className).toContain("xl:px-12");
    expect(el.className).toContain("2xl:px-16");
    // Default 8xl max width for wide desktop screens
    expect(el.className).toContain("max-w-7xl");
    expect(el.className).toContain("2xl:max-w-8xl");
  });

  it("supports narrow max-width for forms and settings", () => {
    render(
      <PageContainer maxWidth="narrow" data-testid="narrow-container">
        Settings
      </PageContainer>
    );
    const el = screen.getByTestId("narrow-container");
    expect(el.className).toContain("max-w-4xl");
  });

  it("renders custom element tag like 'main'", () => {
    render(
      <PageContainer as="main" data-testid="main-container">
        Main
      </PageContainer>
    );
    const el = screen.getByTestId("main-container");
    expect(el.tagName.toLowerCase()).toBe("main");
  });
});
