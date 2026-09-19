import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/dashboard/ui/toast";
import InventoryPage from "@/app/dashboard/inventory/page";

function meResponse(): Response {
  return {
    ok: true,
    json: async () => ({ data: { profile: { defaultClinicId: "clinic-1" }, memberships: [] } }),
  } as Response;
}

function inventoryResponse(items: unknown[]): Response {
  return { ok: true, json: async () => ({ data: { items } }) } as Response;
}

describe("InventoryPage loading/empty states", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a distinct empty state, not a bare table, when there are no items", async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/me")) return Promise.resolve(meResponse());
      return Promise.resolve(inventoryResponse([]));
    });

    render(<InventoryPage />);

    expect(await screen.findByText("אין פריטי מלאי עדיין")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("labels the add-item fields instead of relying on placeholder text alone", async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/me")) return Promise.resolve(meResponse());
      return Promise.resolve(inventoryResponse([]));
    });

    render(<InventoryPage />);

    expect(screen.getByLabelText("שם פריט")).toBeInTheDocument();
    expect(screen.getByLabelText("כמות")).toBeInTheDocument();
  });
});

// createItem never looked at the POST response. A 400 or 403 cleared the
// form and reloaded the list, so a rejected item was indistinguishable from
// a saved one — and a failed /api/me left clinicId null, which made the
// button a silent no-op with no feedback at all.
describe("InventoryPage add-item feedback", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function renderPage() {
    return render(
      <ToastProvider>
        <InventoryPage />
      </ToastProvider>,
    );
  }

  async function fillAndSubmit() {
    fireEvent.change(await screen.findByLabelText("שם פריט"), { target: { value: "מזרק 5 מ\"ל" } });
    fireEvent.change(screen.getByLabelText("כמות"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "הוסף פריט" }));
  }

  it("keeps the form filled and says so when the POST is rejected", async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/me")) return Promise.resolve(meResponse());
      if (init?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ error: { message: "שם הפריט כבר קיים" } }),
        } as Response);
      }
      return Promise.resolve(inventoryResponse([]));
    });

    renderPage();
    await fillAndSubmit();

    expect(await screen.findByText("שם הפריט כבר קיים")).toBeInTheDocument();
    // The form must not look like it saved.
    expect(screen.getByLabelText("שם פריט")).toHaveValue("מזרק 5 מ\"ל");
  });

  it("clears the form only once the item really saved", async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/me")) return Promise.resolve(meResponse());
      if (init?.method === "POST") {
        return Promise.resolve({ ok: true, json: async () => ({ data: {} }) } as Response);
      }
      return Promise.resolve(inventoryResponse([]));
    });

    renderPage();
    await fillAndSubmit();

    expect(await screen.findByText("הפריט נוסף")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("שם פריט")).toHaveValue(""));
  });

  it("says why the button does nothing when the clinic never loaded", async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/me")) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) } as Response);
      }
      return Promise.resolve(inventoryResponse([]));
    });

    renderPage();

    expect(
      await screen.findByText("טעינת פרטי המרפאה נכשלה — לא ניתן להוסיף פריטים."),
    ).toBeInTheDocument();
  });
});
