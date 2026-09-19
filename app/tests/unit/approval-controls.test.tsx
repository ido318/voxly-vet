import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ApprovalControls } from "@/components/dashboard/ai/approval-controls";

const { mockRefresh } = vi.hoisted(() => ({ mockRefresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

function okResponse(): Response {
  return { ok: true } as Response;
}

function failResponse(): Response {
  return { ok: false } as Response;
}

describe("ApprovalControls", () => {
  beforeEach(() => {
    mockRefresh.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("refreshes the route after a successful approve", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(okResponse());

    render(<ApprovalControls artifactId="artifact-1" />);
    fireEvent.click(screen.getByRole("button", { name: "אשר" }));

    await vi.waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith("/api/ai/artifacts/artifact-1/approve", {
      method: "POST",
      headers: undefined,
      body: undefined,
    });
  });

  it("refreshes the route after a successful reject", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(okResponse());

    render(<ApprovalControls artifactId="artifact-1" />);
    fireEvent.change(screen.getByPlaceholderText("סיבת דחייה"), {
      target: { value: "לא מדויק" },
    });
    fireEvent.click(screen.getByRole("button", { name: "דחה" }));

    await vi.waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith("/api/ai/artifacts/artifact-1/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "לא מדויק" }),
    });
  });

  it("does not refresh when the approve request fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(failResponse());

    render(<ApprovalControls artifactId="artifact-1" />);
    fireEvent.click(screen.getByRole("button", { name: "אשר" }));

    expect(await screen.findByText("העדכון נכשל")).toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
