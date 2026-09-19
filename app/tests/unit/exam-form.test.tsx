import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ExamForm } from "@/app/dashboard/visits/exam-form";

const { mockRefresh } = vi.hoisted(() => ({ mockRefresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

function okJsonResponse(data: unknown = {}): Response {
  return { ok: true, json: async () => ({ data }) } as Response;
}

function errorJsonResponse(message: string): Response {
  return { ok: false, json: async () => ({ error: { message } }) } as Response;
}

describe("ExamForm", () => {
  beforeEach(() => {
    mockRefresh.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("every system starts as תקין, with no note field shown", () => {
    render(<ExamForm visitId="visit-1" />);

    // 8 systems x "תקין" toggle = 8, plus the save button's own label text
    // never says תקין, so this count is exactly the toggle buttons.
    expect(screen.getAllByRole("button", { name: "תקין" })).toHaveLength(8);
    expect(screen.queryByText("תיאור הממצא")).not.toBeInTheDocument();
  });

  it("marking a system חריג reveals a note field for it only", async () => {
    render(<ExamForm visitId="visit-1" />);

    const abnormalButtons = screen.getAllByRole("button", { name: "חריג" });
    fireEvent.click(abnormalButtons[0]!);

    expect(await screen.findAllByText("תיאור הממצא")).toHaveLength(1);
  });

  it("saves a composed note through the same /notes endpoint VisitNotesSection uses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(okJsonResponse({ id: "note-1" }));

    render(<ExamForm visitId="visit-1" />);

    const abnormalButtons = screen.getAllByRole("button", { name: "חריג" });
    fireEvent.click(abnormalButtons[2]!); // "לב וכלי דם"

    const noteField = await screen.findByLabelText("תיאור הממצא");
    fireEvent.change(noteField, { target: { value: "אוושה קלה בהאזנה" } });

    fireEvent.click(screen.getByRole("button", { name: "שמור בדיקה גופנית" }));

    await vi.waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));

    expect(fetch).toHaveBeenCalledWith("/api/visits/visit-1/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        noteType: "general",
        content:
          "כללי: תקין\n" +
          "עיניים/אוזניים/אף/גרון: תקין\n" +
          "לב וכלי דם: חריג — אוושה קלה בהאזנה\n" +
          "נשימה: תקין\n" +
          "מערכת עיכול: תקין\n" +
          "שרירים ושלד: תקין\n" +
          "עור ופרווה: תקין\n" +
          "נוירולוגי: תקין",
      }),
    });

    expect(await screen.findByText("הבדיקה נשמרה כהערה רפואית.")).toBeInTheDocument();
  });

  it("shows a clear error and does not refresh when saving fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(errorJsonResponse("שמירת הבדיקה נכשלה"));

    render(<ExamForm visitId="visit-1" />);
    fireEvent.click(screen.getByRole("button", { name: "שמור בדיקה גופנית" }));

    expect(await screen.findByText("שמירת הבדיקה נכשלה")).toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
