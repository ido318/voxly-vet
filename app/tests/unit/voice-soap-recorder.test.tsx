import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VoiceSoapRecorder } from "@/app/dashboard/visits/voice-soap-recorder";

const { mockRefresh } = vi.hoisted(() => ({ mockRefresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// A minimal fake standing in for the browser's MediaRecorder, which
// doesn't exist in jsdom. Mirrors the real spec's actual timing, which
// matters for the tests below: `.state` flips to "inactive" synchronously
// inside `.stop()`, but the `dataavailable`/`stop` events are dispatched
// on a later microtask, not synchronously — and calling `.stop()` while
// already "inactive" throws, exactly like a real MediaRecorder.
class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static isTypeSupported = vi.fn().mockReturnValue(true);

  state: "inactive" | "recording" = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start = vi.fn(() => {
    this.state = "recording";
  });
  stop = vi.fn(() => {
    if (this.state !== "recording") {
      throw new DOMException(
        "Failed to execute 'stop' on 'MediaRecorder': The MediaRecorder's state is 'inactive'.",
        "InvalidStateError",
      );
    }
    this.state = "inactive";
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(["fake-audio-bytes"], { type: "audio/webm" }) });
      this.onstop?.();
    });
  });

  constructor(
    public stream: unknown,
    public options?: { mimeType?: string },
  ) {
    FakeMediaRecorder.instances.push(this);
  }
}

// A recorder whose construction always throws — used to regression-test
// the mic-stream-release/error-message path when starting the recorder
// fails outright.
class ThrowingMediaRecorder {
  static isTypeSupported = vi.fn().mockReturnValue(true);
  constructor() {
    throw new Error("boom: recorder could not be started");
  }
}

const fakeTrack = { stop: vi.fn() };
const fakeStream = { getTracks: () => [fakeTrack] };

function okJsonResponse(data: unknown = {}): Response {
  return { ok: true, json: async () => ({ data }) } as Response;
}

function errorJsonResponse(message: string): Response {
  return { ok: false, json: async () => ({ error: { message } }) } as Response;
}

async function recordAndStop() {
  fireEvent.click(screen.getByRole("button", { name: "הקלטה" }));
  await screen.findByRole("button", { name: "עצור הקלטה" });
  fireEvent.click(screen.getByRole("button", { name: "עצור הקלטה" }));
}

describe("VoiceSoapRecorder", () => {
  beforeEach(() => {
    mockRefresh.mockClear();
    fakeTrack.stop.mockClear();
    FakeMediaRecorder.instances = [];
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    Object.defineProperty(window.navigator, "mediaDevices", {
      value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("records, uploads, drafts, and renders an editable form pre-filled with the draft values", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(okJsonResponse({ storagePath: "clinic-1/visit-1/rec.webm" }))
      .mockResolvedValueOnce(
        okJsonResponse({
          id: "artifact-1",
          structuredPayload: {
            subjective: "בעל הכלב מדווח על הקאות",
            objective: "טמפרטורה 39.2",
            assessment: "חשד לדלקת קיבה",
            plan: "צום 12 שעות ומעקב",
          },
        }),
      );

    render(<VoiceSoapRecorder visitId="visit-1" />);
    await recordAndStop();

    expect(await screen.findByLabelText("סובייקטיבי")).toHaveValue("בעל הכלב מדווח על הקאות");
    expect(screen.getByLabelText("אובייקטיבי")).toHaveValue("טמפרטורה 39.2");
    expect(screen.getByLabelText("הערכה")).toHaveValue("חשד לדלקת קיבה");
    expect(screen.getByLabelText("תוכנית טיפול")).toHaveValue("צום 12 שעות ומעקב");

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/api/visits/visit-1/soap-recording",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/visits/visit-1/soap-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storagePath: "clinic-1/visit-1/rec.webm" }),
      signal: expect.any(AbortSignal),
    });
  });

  it("submits the CURRENT edited values, not the original draft, and resets after success", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(okJsonResponse({ storagePath: "clinic-1/visit-1/rec.webm" }))
      .mockResolvedValueOnce(
        okJsonResponse({
          id: "artifact-1",
          structuredPayload: {
            subjective: "טקסט מקורי",
            objective: "טקסט מקורי",
            assessment: "טקסט מקורי",
            plan: "טקסט מקורי",
          },
        }),
      )
      .mockResolvedValueOnce(okJsonResponse({ id: "note-1" })) // notes create
      .mockResolvedValueOnce(okJsonResponse({ id: "artifact-1" })); // artifact approve

    render(<VoiceSoapRecorder visitId="visit-1" />);
    await recordAndStop();
    await screen.findByLabelText("סובייקטיבי");

    fireEvent.change(screen.getByLabelText("סובייקטיבי"), { target: { value: "עדכון ידני של הרופא" } });

    fireEvent.click(screen.getByRole("button", { name: "הוסף כהערה" }));

    await vi.waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));

    expect(fetch).toHaveBeenNthCalledWith(3, "/api/visits/visit-1/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        noteType: "soap_full",
        content:
          "סובייקטיבי:\nעדכון ידני של הרופא\n\nאובייקטיבי:\nטקסט מקורי\n\nהערכה:\nטקסט מקורי\n\nתוכנית טיפול:\nטקסט מקורי",
        subjective: "עדכון ידני של הרופא",
        objective: "טקסט מקורי",
        assessment: "טקסט מקורי",
        plan: "טקסט מקורי",
      }),
    });

    // Also calls the artifact-approve endpoint for the originating draft.
    expect(fetch).toHaveBeenNthCalledWith(4, "/api/ai/artifacts/artifact-1/approve", { method: "POST" });

    // Resets back to the initial "הקלטה" button state, ready for another recording.
    expect(await screen.findByRole("button", { name: "הקלטה" })).toBeInTheDocument();
    expect(screen.queryByLabelText("סובייקטיבי")).not.toBeInTheDocument();
  });

  it("does not block on an artifact-approve failure — the note was already created successfully", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.mocked(fetch)
      .mockResolvedValueOnce(okJsonResponse({ storagePath: "clinic-1/visit-1/rec.webm" }))
      .mockResolvedValueOnce(
        okJsonResponse({
          id: "artifact-1",
          structuredPayload: { subjective: "s", objective: "o", assessment: "a", plan: "p" },
        }),
      )
      .mockResolvedValueOnce(okJsonResponse({ id: "note-1" })) // notes create succeeds
      .mockResolvedValueOnce(errorJsonResponse("שגיאת שרת")); // artifact approve fails

    render(<VoiceSoapRecorder visitId="visit-1" />);
    await recordAndStop();
    await screen.findByLabelText("סובייקטיבי");

    fireEvent.click(screen.getByRole("button", { name: "הוסף כהערה" }));

    await vi.waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(warnSpy).toHaveBeenCalled();
    // No scary error surfaced to the user — the primary action succeeded.
    expect(screen.queryByText("שגיאת שרת")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "הקלטה" })).toBeInTheDocument();

    warnSpy.mockRestore();
  });

  it("shows a clear error and returns to idle when the upload fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(errorJsonResponse("אין הרשאה להעלות הקלטה"));

    render(<VoiceSoapRecorder visitId="visit-1" />);
    await recordAndStop();

    expect(await screen.findByText("אין הרשאה להעלות הקלטה")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "הקלטה" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("shows a clear error and returns to idle when draft generation fails", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(okJsonResponse({ storagePath: "clinic-1/visit-1/rec.webm" }))
      .mockResolvedValueOnce(errorJsonResponse("תמלול ההקלטה נכשל. נסה שוב מאוחר יותר."));

    render(<VoiceSoapRecorder visitId="visit-1" />);
    await recordAndStop();

    expect(await screen.findByText("תמלול ההקלטה נכשל. נסה שוב מאוחר יותר.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "הקלטה" })).toBeInTheDocument();
  });

  it("shows a pulsing recording indicator with an elapsed timer while recording", async () => {
    render(<VoiceSoapRecorder visitId="visit-1" />);
    fireEvent.click(screen.getByRole("button", { name: "הקלטה" }));

    expect(await screen.findByText(/מקליט/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "עצור הקלטה" })).toBeInTheDocument();
  });

  it("releases the mic and shows a Hebrew error if starting the recorder throws", async () => {
    vi.stubGlobal("MediaRecorder", ThrowingMediaRecorder);

    render(<VoiceSoapRecorder visitId="visit-1" />);
    fireEvent.click(screen.getByRole("button", { name: "הקלטה" }));

    expect(await screen.findByText("לא ניתן להתחיל הקלטה. נסה שוב.")).toBeInTheDocument();
    expect(fakeTrack.stop).toHaveBeenCalled();
    // Stays/returns to the idle "הקלטה" button state, not stuck.
    expect(screen.getByRole("button", { name: "הקלטה" })).toBeInTheDocument();
  });

  it("does not crash when the stop button is clicked twice in a row", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(okJsonResponse({ storagePath: "clinic-1/visit-1/rec.webm" }))
      .mockResolvedValueOnce(
        okJsonResponse({
          id: "artifact-1",
          structuredPayload: { subjective: "s", objective: "o", assessment: "a", plan: "p" },
        }),
      );

    render(<VoiceSoapRecorder visitId="visit-1" />);
    fireEvent.click(screen.getByRole("button", { name: "הקלטה" }));
    const stopButton = await screen.findByRole("button", { name: "עצור הקלטה" });
    const recorder = FakeMediaRecorder.instances[0];
    expect(recorder).toBeDefined();

    // Both clicks land while the button is still visible: the recorder's
    // `.state` flips to "inactive" synchronously inside the first
    // .stop() call, but the queued dataavailable/stop events (and the
    // re-render that would remove this button) haven't fired yet. Pre-fix,
    // the second click calls the recorder's real .stop() again, which
    // throws InvalidStateError — that exception escapes React's own
    // event-dispatch machinery asynchronously, so it isn't reliably
    // observable via a synchronous try/catch here; asserting the call
    // count on the underlying .stop() mock catches the regression
    // directly and deterministically instead.
    fireEvent.click(stopButton);
    fireEvent.click(stopButton);

    expect(recorder!.stop).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText("סובייקטיבי")).toHaveValue("s");
    // Only one upload/draft round-trip happened — the guard absorbed the
    // extra click instead of triggering a second real stop.
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not upload if the component unmounts mid-recording", async () => {
    const { unmount } = render(<VoiceSoapRecorder visitId="visit-1" />);
    fireEvent.click(screen.getByRole("button", { name: "הקלטה" }));
    await screen.findByRole("button", { name: "עצור הקלטה" });

    const recorder = FakeMediaRecorder.instances[0];
    expect(recorder).toBeDefined();
    unmount();

    // Simulate the browser's own auto-stop cascade that ending the
    // stream's tracks (in the cleanup effect) would trigger on a
    // still-recording MediaRecorder — this must not silently upload a
    // partial recording and burn a real transcription/LLM call for a
    // visit the vet already left.
    recorder!.ondataavailable?.({ data: new Blob(["fake-audio-bytes"], { type: "audio/webm" }) });
    recorder!.onstop?.();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not call /soap-draft (and aborts the in-flight request) if the component unmounts after stop, while the upload is still in flight", async () => {
    let resolveUpload!: (response: Response) => void;
    const uploadPromise = new Promise<Response>((resolve) => {
      resolveUpload = resolve;
    });
    vi.mocked(fetch).mockReturnValueOnce(uploadPromise);

    const { unmount } = render(<VoiceSoapRecorder visitId="visit-1" />);
    await recordAndStop();

    // handleRecordingStopped is under way: the upload fetch has been
    // issued but hasn't resolved yet. Navigate away right now — before
    // this fix, nothing stopped the rest of handleRecordingStopped from
    // continuing once the upload eventually resolved.
    expect(fetch).toHaveBeenCalledTimes(1);
    const uploadSignal = vi.mocked(fetch).mock.calls[0]![1]?.signal as AbortSignal;
    expect(uploadSignal.aborted).toBe(false);

    unmount();
    expect(uploadSignal.aborted).toBe(true);

    resolveUpload(okJsonResponse({ storagePath: "clinic-1/visit-1/rec.webm" }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Never reached the /soap-draft call — the transcription/LLM call this
    // component exists to avoid wasting on an abandoned visit never happens.
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
