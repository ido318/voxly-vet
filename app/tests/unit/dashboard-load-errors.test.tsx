// Three screens rendered a failed load as an empty one.
//
// waitlist, billing and inventory each did `if (res.ok) { … }` with no else
// and no catch, so a 500 left the list empty and the page drew its empty
// state: "אין ממתינים כרגע", "אין חשבוניות", "אין פריטי מלאי עדיין". A
// network throw was worse — an unhandled rejection with loading stuck true,
// i.e. a skeleton that never resolves.
//
// Billing had a second failure mode: an empty invoice list sums to zero, so
// the page stated ₪0.00 outstanding as fact.
//
// The today screen was fixed for exactly this in an earlier pass; these
// follow its pattern, and this file follows today-dashboard-load-error.test.tsx.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { render } from "@testing-library/react";

import WaitlistPage from "@/app/dashboard/waitlist/page";
import BillingPage from "@/app/dashboard/billing/page";

function okJson(body: unknown): Response {
  return { ok: true, json: async () => body } as Response;
}

function failed(): Response {
  return { ok: false, status: 500, json: async () => ({}) } as Response;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("waitlist load failure", () => {
  it("reports the failure instead of showing an empty queue", async () => {
    vi.mocked(fetch).mockResolvedValue(failed());

    render(<WaitlistPage />);

    expect(await screen.findByText("טעינת רשימת ההמתנה נכשלה.")).toBeInTheDocument();
    // The queue is not empty — we simply do not know what is in it.
    expect(screen.queryByText("אין ממתינים כרגע")).not.toBeInTheDocument();
  });

  it("reports a network failure rather than hanging on the skeleton", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    render(<WaitlistPage />);

    expect(
      await screen.findByText("טעינת רשימת ההמתנה נכשלה. בדוק/י את החיבור ונסה/י שוב."),
    ).toBeInTheDocument();
  });

  it("recovers on retry", async () => {
    vi.mocked(fetch).mockResolvedValue(failed());
    render(<WaitlistPage />);
    await screen.findByText("טעינת רשימת ההמתנה נכשלה.");

    vi.mocked(fetch).mockResolvedValue(okJson({ data: { items: [] } }));
    fireEvent.click(screen.getByRole("button", { name: "נסה שוב" }));

    expect(await screen.findByText("אין ממתינים כרגע")).toBeInTheDocument();
    expect(screen.queryByText("טעינת רשימת ההמתנה נכשלה.")).not.toBeInTheDocument();
  });
});

describe("billing load failure", () => {
  it("does not state an outstanding balance it could not load", async () => {
    vi.mocked(fetch).mockResolvedValue(failed());

    render(<BillingPage />);

    expect(await screen.findByText("טעינת החשבוניות נכשלה.")).toBeInTheDocument();
    // ₪0.00 would be a confident, wrong financial figure.
    expect(screen.queryByText("₪0.00")).not.toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("אין חשבוניות")).not.toBeInTheDocument();
  });

  it("shows the real total once the load succeeds", async () => {
    vi.mocked(fetch).mockResolvedValue(okJson({ data: { items: [] } }));

    render(<BillingPage />);

    expect(await screen.findByText("אין חשבוניות")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });
});
