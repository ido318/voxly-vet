import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VisitNotesSection } from "@/app/dashboard/visits/visit-notes-section";
import type { MedicalNote } from "@/types/domain/medical-note";

const { mockRefresh } = vi.hoisted(() => ({ mockRefresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

function makeNote(overrides: Partial<MedicalNote> = {}): MedicalNote {
  return {
    id: "note-1",
    clinicId: "clinic-1",
    visitId: "visit-1",
    noteType: "general",
    content: "תוכן ההערה המקורי",
    subjective: null,
    objective: null,
    assessment: null,
    plan: null,
    parentNoteId: null,
    status: "draft",
    approvedByUserId: null,
    approvedAt: null,
    version: 1,
    authorUserId: "user-1",
    createdAt: "2026-08-30T10:00:00.000Z",
    updatedAt: "2026-08-30T10:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function okJsonResponse(data: unknown = {}): Response {
  return { ok: true, json: async () => ({ data }) } as Response;
}

describe("VisitNotesSection", () => {
  beforeEach(() => {
    mockRefresh.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows an approve button for a draft note, posts to the approve route, and refreshes on success", async () => {
    const note = makeNote({ status: "draft" });
    vi.mocked(fetch).mockResolvedValueOnce(okJsonResponse(note));

    render(<VisitNotesSection visitId="visit-1" initialNotes={[note]} />);

    fireEvent.click(screen.getByRole("button", { name: "אשר וחתום" }));

    await vi.waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith("/api/visits/visit-1/notes/note-1/approve", { method: "POST" });
  });

  it("shows an approve error message when the approve request fails", async () => {
    const note = makeNote({ status: "draft" });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "לא ניתן לאשר" } }),
    } as Response);

    render(<VisitNotesSection visitId="visit-1" initialNotes={[note]} />);
    fireEvent.click(screen.getByRole("button", { name: "אשר וחתום" }));

    expect(await screen.findByText("לא ניתן לאשר")).toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("renders a locked note with a lock badge and an add-addendum affordance instead of edit, and posts the addendum", async () => {
    const lockedNote = makeNote({
      status: "approved",
      createdAt: "2000-01-01T00:00:00.000Z", // far more than 24h before "now" in any test run
    });
    vi.mocked(fetch).mockResolvedValueOnce(okJsonResponse());

    render(<VisitNotesSection visitId="visit-1" initialNotes={[lockedNote]} />);

    expect(screen.getByText("נעול")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ערוך" })).not.toBeInTheDocument();
    // Locked and status "approved" means no approve button either.
    expect(screen.queryByRole("button", { name: "אשר וחתום" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "הוסף נספח" }));

    const textarea = screen.getByPlaceholderText("תוכן הנספח");
    fireEvent.change(textarea, { target: { value: "המצב השתפר לאחר הטיפול" } });
    fireEvent.click(screen.getByRole("button", { name: "שמור נספח" }));

    await vi.waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      "/api/visits/visit-1/notes/note-1/addendum",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content: "המצב השתפר לאחר הטיפול" }),
      }),
    );
  });

  it("disables the addendum cancel button while the save is in flight", async () => {
    const lockedNote = makeNote({
      status: "approved",
      createdAt: "2000-01-01T00:00:00.000Z",
    });
    let resolveFetch!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(<VisitNotesSection visitId="visit-1" initialNotes={[lockedNote]} />);

    fireEvent.click(screen.getByRole("button", { name: "הוסף נספח" }));
    fireEvent.change(screen.getByPlaceholderText("תוכן הנספח"), {
      target: { value: "עדכון מצב" },
    });
    fireEvent.click(screen.getByRole("button", { name: "שמור נספח" }));

    // While the request is still pending, cancel must not be clickable —
    // otherwise a user who "cancels" here could still have the save silently
    // land (and trigger router.refresh()) once the in-flight fetch resolves.
    expect(screen.getByRole("button", { name: "ביטול" })).toBeDisabled();

    resolveFetch(okJsonResponse());
    await vi.waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  });

  it("shows edit for an unlocked note (draft) and round-trips a save through PATCH", async () => {
    const note = makeNote({
      status: "draft",
      subjective: "מתלונן על עייפות",
    });
    vi.mocked(fetch).mockResolvedValueOnce(okJsonResponse(note));

    render(<VisitNotesSection visitId="visit-1" initialNotes={[note]} />);

    expect(screen.queryByText("נעול")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "הוסף נספח" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ערוך" }));

    const contentBox = screen.getByDisplayValue("תוכן ההערה המקורי");
    expect(contentBox).toBeInTheDocument();
    expect(screen.getByDisplayValue("מתלונן על עייפות")).toBeInTheDocument();

    fireEvent.change(contentBox, { target: { value: "תוכן מעודכן" } });
    fireEvent.click(screen.getByRole("button", { name: "שמור שינויים" }));

    await vi.waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      "/api/visits/visit-1/notes/note-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          content: "תוכן מעודכן",
          subjective: "מתלונן על עייפות",
          objective: null,
          assessment: null,
          plan: null,
        }),
      }),
    );

    // Edit form is closed again after a successful save.
    expect(screen.queryByRole("button", { name: "שמור שינויים" })).not.toBeInTheDocument();
  });

  it("disables the edit cancel button while the save is in flight", async () => {
    const note = makeNote({ status: "draft" });
    let resolveFetch!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(<VisitNotesSection visitId="visit-1" initialNotes={[note]} />);

    fireEvent.click(screen.getByRole("button", { name: "ערוך" }));
    fireEvent.click(screen.getByRole("button", { name: "שמור שינויים" }));

    // While the request is still pending, cancel must not be clickable —
    // otherwise a user who "cancels" here could still have the save silently
    // land (and trigger router.refresh()) once the in-flight fetch resolves.
    expect(screen.getByRole("button", { name: "ביטול" })).toBeDisabled();

    resolveFetch(okJsonResponse(note));
    await vi.waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  });

  it("treats an approved note still within the 24h window as editable, not locked", () => {
    const recentlyApproved = makeNote({
      status: "approved",
      createdAt: new Date().toISOString(),
    });

    render(<VisitNotesSection visitId="visit-1" initialNotes={[recentlyApproved]} />);

    expect(screen.queryByText("נעול")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ערוך" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "הוסף נספח" })).not.toBeInTheDocument();
    // Already approved: no approve button.
    expect(screen.queryByRole("button", { name: "אשר וחתום" })).not.toBeInTheDocument();
  });

  it("cancel discards local edits without calling the API", () => {
    const note = makeNote({ status: "draft" });
    render(<VisitNotesSection visitId="visit-1" initialNotes={[note]} />);

    fireEvent.click(screen.getByRole("button", { name: "ערוך" }));
    const contentBox = screen.getByDisplayValue("תוכן ההערה המקורי");
    fireEvent.change(contentBox, { target: { value: "טיוטה שלא תישמר" } });

    fireEvent.click(screen.getByRole("button", { name: "ביטול" }));

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText("תוכן ההערה המקורי")).toBeInTheDocument();
    expect(screen.queryByText("טיוטה שלא תישמר")).not.toBeInTheDocument();
  });

  it("nests each addendum under its own parent note, independently by note id", () => {
    const parentA = makeNote({ id: "note-a", content: "תוכן א" });
    const addendumA = makeNote({
      id: "note-a-addendum",
      noteType: "addendum",
      parentNoteId: "note-a",
      content: "תוכן נספח א",
      status: "draft",
    });
    const parentB = makeNote({ id: "note-b", content: "תוכן ב" });
    const addendumB = makeNote({
      id: "note-b-addendum",
      noteType: "addendum",
      parentNoteId: "note-b",
      content: "תוכן נספח ב",
      status: "draft",
    });

    render(
      <VisitNotesSection
        visitId="visit-1"
        initialNotes={[parentA, addendumA, parentB, addendumB]}
      />,
    );

    expect(screen.getAllByText(/נספח מתאריך/)).toHaveLength(2);

    const parentALi = screen.getByText("תוכן א").closest("li");
    const parentBLi = screen.getByText("תוכן ב").closest("li");
    const addendumAText = screen.getByText("תוכן נספח א");
    const addendumBText = screen.getByText("תוכן נספח ב");

    expect(parentALi).not.toBeNull();
    expect(parentBLi).not.toBeNull();
    expect(parentALi?.contains(addendumAText)).toBe(true);
    expect(parentALi?.contains(addendumBText)).toBe(false);
    expect(parentBLi?.contains(addendumBText)).toBe(true);
    expect(parentBLi?.contains(addendumAText)).toBe(false);
  });

  it("shows the empty state when there are no notes", () => {
    render(<VisitNotesSection visitId="visit-1" initialNotes={[]} />);
    expect(screen.getByText("אין עדיין הערות.")).toBeInTheDocument();
  });

  it("renders a 'soap_full' note (as produced by VoiceSoapRecorder) with the 'SOAP מלא' badge", () => {
    const note = makeNote({ noteType: "soap_full", content: "הערת SOAP מלאה מהקלטה קולית" });
    render(<VisitNotesSection visitId="visit-1" initialNotes={[note]} />);

    expect(screen.getByText("SOAP מלא")).toBeInTheDocument();
    expect(screen.getByText("הערת SOAP מלאה מהקלטה קולית")).toBeInTheDocument();
  });
});
