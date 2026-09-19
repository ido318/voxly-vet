import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import TodayPage from "@/app/dashboard/page";

function emptyOkResponse(): Response {
  return { ok: true, json: async () => ({ data: { items: [] } }) } as Response;
}

// TodayPage's fetchData used to have a try/finally with no catch: a failed
// request left its state at [] and just fell through to the same "אין פעילות
// להיום" empty state a genuinely quiet day renders — indistinguishable from
// a real load failure.
describe("TodayPage load error handling", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a distinct error state (not the quiet-day empty state) when a request fails", async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/escalations")) {
        return Promise.resolve({ ok: false, json: async () => ({ error: { message: "boom" } }) } as Response);
      }
      return Promise.resolve(emptyOkResponse());
    });

    render(<TodayPage />);

    expect(await screen.findByText("טעינת ההסלמות נכשלה")).toBeInTheDocument();
    expect(screen.queryByText("אין פעילות להיום")).not.toBeInTheDocument();
  });

  it("does not swallow a network exception either", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    render(<TodayPage />);

    expect(await screen.findByText("טעינת נתוני היום נכשלה. בדוק/י את החיבור ונסה/י שוב.")).toBeInTheDocument();
  });

  it("retry re-fetches and clears the error once every request succeeds", async () => {
    let escalationsShouldFail = true;
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/escalations") && escalationsShouldFail) {
        return Promise.resolve({ ok: false, json: async () => ({ error: { message: "boom" } }) } as Response);
      }
      return Promise.resolve(emptyOkResponse());
    });

    render(<TodayPage />);
    await screen.findByText("טעינת ההסלמות נכשלה");

    escalationsShouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: "נסה שוב" }));

    expect(await screen.findByText("אין פעילות להיום")).toBeInTheDocument();
    expect(screen.queryByText("טעינת ההסלמות נכשלה")).not.toBeInTheDocument();
  });
});
