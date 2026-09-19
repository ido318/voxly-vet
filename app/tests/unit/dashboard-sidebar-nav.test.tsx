import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Sidebar } from "@/components/dashboard/sidebar";

// Sidebar's NavLink calls usePathname() to highlight the active row; outside
// a real Next.js app-router tree this returns null, so it must be mocked
// here (the same way other component tests in this suite mock next/navigation).
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

// This file was the only component test without one, and an unmounted-tree
// leak here failed the whole CI run — see tests/setup.ts.
afterEach(() => {
  cleanup();
});

describe("Sidebar — provider_admin nav items", () => {
  it("does not show QA/improvements links for a regular clinic_user", () => {
    render(<Sidebar isProviderAdmin={false} />);
    expect(screen.queryByText("שיחות QA")).not.toBeInTheDocument();
    expect(screen.queryByText("הצעות תיקון")).not.toBeInTheDocument();
  });

  it("shows QA/improvements links for a provider_admin", () => {
    render(<Sidebar isProviderAdmin={true} />);
    expect(screen.getByText("שיחות QA")).toBeInTheDocument();
    expect(screen.getByText("הצעות תיקון")).toBeInTheDocument();
  });
});
