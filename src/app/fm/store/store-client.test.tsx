import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { StoreClient } from "./store-client";
import * as fmActions from "@/actions/fm-actions";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: mockRefresh,
  }),
}));

vi.mock("@/actions/fm-actions", () => ({
  createStoreTransactionAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe("Button Interaction Tests - StoreClient", () => {
  const sampleFactory = {
    id: "fac_1",
    name: "Hawassa Mega Plant",
  };

  const sampleBalances = [
    {
      productId: "prod_1",
      productName: "Sparkling Water 500ml",
      sku: "WAT-500",
      currentStock: 15400,
    },
    {
      productId: "prod_2",
      productName: "Orange Juice 1L",
      sku: "JUC-1000",
      currentStock: 8200,
    },
  ];

  const sampleTransactions = [
    {
      id: "stk_1",
      delta: 5000,
      createdAt: new Date("2026-03-10T10:00:00Z"),
      reportEntryId: "rep_1",
      productId: "prod_1",
      productName: "Sparkling Water 500ml",
      productSku: "WAT-500",
      reportDate: "2026-03-10",
    },
    {
      id: "stk_2",
      delta: -1200,
      createdAt: new Date("2026-03-11T12:00:00Z"),
      reportEntryId: null,
      productId: "prod_2",
      productName: "Orange Juice 1L",
      productSku: "JUC-1000",
      reportDate: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const renderStore = () => {
    return render(
      <StoreClient
        factory={sampleFactory}
        productBalances={sampleBalances}
        transactions={sampleTransactions}
      />
    );
  };

  it("renders stock balance cards and aggregate inventory", () => {
    renderStore();

    expect(screen.getByText(/Store Stock Ledger — Hawassa Mega Plant/i)).toBeDefined();
    expect(screen.getAllByText("Sparkling Water 500ml").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Orange Juice 1L").length).toBeGreaterThan(0);

    // Aggregate: 15400 + 8200 = 23,600
    expect(screen.getByText(/23,600/)).toBeDefined();
  });

  it("opens, cancels, and submits 'Store Transaction' modal", async () => {
    renderStore();

    const openBtn = screen.getByRole("button", { name: /store transaction/i });
    fireEvent.click(openBtn);

    expect(screen.getByRole("heading", { name: /record store stock transaction/i })).toBeDefined();

    // Cancel modal
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(screen.queryByRole("heading", { name: /record store stock transaction/i })).toBeNull();

    // Reopen and submit dispatch
    fireEvent.click(openBtn);

    // Switch to Dispatch / Out (-)
    const dispatchBtn = screen.getByRole("button", { name: /dispatch \/ out/i });
    fireEvent.click(dispatchBtn);

    const qtyInput = screen.getByPlaceholderText(/e\.g\. 500/i);
    fireEvent.change(qtyInput, { target: { value: "350" } });

    const submitBtn = screen.getByRole("button", { name: /record transaction/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(fmActions.createStoreTransactionAction).toHaveBeenCalledWith({
        productId: "prod_1",
        delta: -350,
        notes: undefined,
      });
    });
  });

  it("filters transaction history log by direction pills", () => {
    renderStore();

    // Stock In pill
    const inFilterBtn = screen.getByRole("button", { name: /stock in \(\+\)/i });
    fireEvent.click(inFilterBtn);

    // Should show +5000 pcs and hide -1200 pcs
    expect(screen.getAllByText(/\+5,000 pcs/i).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/-1,200 pcs/i).length).toBe(0);

    // Stock Out pill
    const outFilterBtn = screen.getByRole("button", { name: /stock out \(-\)/i });
    fireEvent.click(outFilterBtn);

    expect(screen.getAllByText(/-1,200 pcs/i).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/\+5,000 pcs/i).length).toBe(0);
  });
});