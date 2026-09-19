// /tools/triage-pet-case had no route-level test at all, which is how the
// urgent-callback slot bug survived.
//
// The handler used to pull a time out of checkAvailability's Hebrew prose with
// /\b(\d{2}:\d{2})\b/. That prose is written for the LLM: formatSlotSpokenHe
// renders a 12-hour hour with no leading zero ("1:00 בצהריים"), so the regex
// skipped the spoken time and matched the seconds inside the ISO that follows
// it — a 13:00 slot was announced to the caller as "היום ב-00:00". On a
// Saturday it matched 08:00 out of the opening hours quoted in the "clinic is
// closed" message and offered a callback on a day the clinic is shut.
//
// It now reads getFreeSlots, which returns the instants themselves.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

function toolHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: "Bearer test-tools-token-1234567",
  };
}

import { toolsRoutes } from "../../../src/server/routes/tools.js";

vi.mock("../../../src/lib/store.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/store.js")>();
  return {
    ...actual,
    getFreeSlots: vi.fn().mockResolvedValue([]),
    checkAvailability: vi.fn(),
    addEscalation: vi.fn().mockResolvedValue(undefined),
  };
});

import { getFreeSlots } from "../../../src/lib/store.js";

function makeApp() {
  const app = new Hono();
  app.route("/", toolsRoutes);
  return app;
}

// Symptoms that score as urgent but not an emergency referral, during
// business hours — the only path that appends a slot suggestion.
async function triage(): Promise<string> {
  const res = await makeApp().request("/tools/triage-pet-case", {
    method: "POST",
    headers: toolHeaders(),
    body: JSON.stringify({
      symptoms_he: "הכלב מקיא כבר יומיים ולא אוכל",
      pet_type: "כלב",
      duration_he: "יומיים",
    }),
  });
  expect(res.status).toBe(200);
  const json = (await res.json()) as { result: string };
  return json.result;
}

// The handler reads `new Date()` and decideTriage routes to
// after_hours_referral outside clinic hours — so without a fixed clock this
// suite passes or fails depending on what time it runs.
// 2026-06-14 is a Sunday; 10:00 Israel time is mid-morning, clinic open.
const DURING_BUSINESS_HOURS = new Date("2026-06-14T07:00:00Z");

describe("POST /tools/triage-pet-case — urgent callback slot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(DURING_BUSINESS_HOURS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("announces an afternoon slot in spoken Hebrew, not 00:00", async () => {
    // 13:00 Israel time — the case the old regex reported as "00:00", because
    // the spoken form is "1:00" (one digit) so it fell through to the ISO.
    vi.mocked(getFreeSlots).mockResolvedValue(["2026-06-14T13:00:00+03:00"]);

    const result = await triage();

    expect(result).not.toContain("00:00");
    expect(result).toMatch(/1:00 בצהריים/);
  });

  it("announces a single-digit morning hour correctly", async () => {
    // 09:10 → "9:10 בבוקר". The old regex returned "10:00" here: the minutes
    // and seconds of the ISO, a time that was never offered.
    vi.mocked(getFreeSlots).mockResolvedValue(["2026-06-14T09:10:00+03:00"]);

    const result = await triage();

    expect(result).toMatch(/9:10 בבוקר/);
    expect(result).not.toContain("10:00");
  });

  it("offers nothing when there are no free slots", async () => {
    vi.mocked(getFreeSlots).mockResolvedValue([]);

    const result = await triage();

    expect(result).not.toContain("מצאתי אפשרות");
  });

  it("offers nothing on a closed day", async () => {
    // getFreeSlots returns [] for a Saturday. The old code never asked it —
    // it regexed the "clinic is closed, hours are 08:00-20:00" sentence and
    // pulled 08:00 out of the opening hours.
    vi.mocked(getFreeSlots).mockResolvedValue([]);

    const result = await triage();

    expect(result).not.toContain("08:00");
    expect(result).not.toContain("מצאתי אפשרות");
  });

  it("still answers when the slot lookup throws", async () => {
    vi.mocked(getFreeSlots).mockRejectedValue(new Error("supabase down"));

    const result = await triage();

    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toContain("מצאתי אפשרות");
  });
});
