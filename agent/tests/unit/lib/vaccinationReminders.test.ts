import { describe, it, expect, vi, beforeEach } from "vitest";
import { enqueueDueVaccinationReminders } from "../../../src/lib/vaccinationReminders.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Supabase — "vaccinations" select chain, "clinics" override lookup,
// "notifications_log" upsert
// ─────────────────────────────────────────────────────────────────────────────

const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn();
const mockSingle = vi.fn().mockResolvedValue({ data: { settings: { smsTemplates: {} } }, error: null });

vi.mock("../../../src/lib/supabase.js", () => ({
  getSupabase: () => ({
    from: mockFrom,
  }),
}));

function makeVaccinationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "vacc-1",
    vaccine_name: "משושה",
    next_due_at: "2026-09-01",
    clinic_id: "clinic-1",
    pet: { name: "ביסלי" },
    customer: { id: "cust-1", full_name: "שרה", phone: "+972501234567" },
    ...overrides,
  };
}

/** Chainable mock for `.from("vaccinations").select().eq().gte().lte().is().returns()` */
function vaccinationsChain(resolveValue: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain["select"] = vi.fn().mockReturnValue(chain);
  chain["eq"] = vi.fn().mockReturnValue(chain);
  chain["gte"] = vi.fn().mockReturnValue(chain);
  chain["lte"] = vi.fn().mockReturnValue(chain);
  chain["is"] = vi.fn().mockReturnValue(chain);
  chain["returns"] = vi.fn().mockResolvedValue(resolveValue);
  return chain;
}

function clinicsChain() {
  return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: mockSingle };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpsert.mockResolvedValue({ error: null });
  mockSingle.mockResolvedValue({ data: { settings: { smsTemplates: {} } }, error: null });
  mockFrom.mockImplementation((table: string) => {
    if (table === "notifications_log") return { upsert: mockUpsert };
    if (table === "clinics") return clinicsChain();
    throw new Error(`unexpected table in default mockFrom: ${table}`);
  });
});

describe("enqueueDueVaccinationReminders", () => {
  it("queries vaccinations for rows due within the next 14 days", async () => {
    const chain = vaccinationsChain({ data: [], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "vaccinations") return chain;
      if (table === "notifications_log") return { upsert: mockUpsert };
      if (table === "clinics") return clinicsChain();
      throw new Error(`unexpected table: ${table}`);
    });

    await enqueueDueVaccinationReminders();

    expect(mockFrom).toHaveBeenCalledWith("vaccinations");
    // Without this filter the daily scan walked every tenant's vaccinations
    // and enqueued SMS on their behalf, from this clinic's Twilio number.
    expect(chain["eq"]).toHaveBeenCalledWith(
      "clinic_id",
      "00000000-0000-4000-8000-000000000001",
    );
    expect(chain["gte"]).toHaveBeenCalledWith(
      "next_due_at",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    expect(chain["lte"]).toHaveBeenCalledWith(
      "next_due_at",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );

    // Assert the window is ~14 days wide.
    const gteCall = (chain["gte"] as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const lteCall = (chain["lte"] as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const start = new Date(gteCall[1] as string);
    const end = new Date(lteCall[1] as string);
    const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60_000));
    expect(diffDays).toBe(14);
  });

  it("builds the SMS body via resolveSmsTemplate (default wording) and upserts with vaccination_id", async () => {
    const row = makeVaccinationRow();
    const chain = vaccinationsChain({ data: [row], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "vaccinations") return chain;
      if (table === "notifications_log") return { upsert: mockUpsert };
      if (table === "clinics") return clinicsChain();
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await enqueueDueVaccinationReminders();

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [payload, options] = mockUpsert.mock.calls[0]!;
    expect(payload).toMatchObject({
      clinic_id: "clinic-1",
      customer_id: "cust-1",
      vaccination_id: "vacc-1",
      phone: "+972501234567",
      type: "vaccination_reminder",
      status: "pending",
    });
    expect(payload.body).toContain("שרה");
    expect(payload.body).toContain("ביסלי");
    expect(payload.body).toContain("משושה");
    expect(options).toEqual({ onConflict: "vaccination_id,type", ignoreDuplicates: true });

    expect(result).toEqual({ scanned: 1, enqueued: 1, skippedNoPhone: 0, failed: 0 });
  });

  it("skips a vaccination whose linked customer has no phone number", async () => {
    const row = makeVaccinationRow({
      customer: { id: "cust-2", full_name: "דני", phone: null },
    });
    const chain = vaccinationsChain({ data: [row], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "vaccinations") return chain;
      if (table === "notifications_log") return { upsert: mockUpsert };
      if (table === "clinics") return clinicsChain();
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await enqueueDueVaccinationReminders();

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, enqueued: 0, skippedNoPhone: 1, failed: 0 });
  });

  it("handles a mix of due vaccinations, enqueuing only the ones with a phone", async () => {
    const withPhone = makeVaccinationRow({ id: "vacc-1", customer: { id: "cust-1", full_name: "שרה", phone: "+972501234567" } });
    const withoutPhone = makeVaccinationRow({ id: "vacc-2", customer: { id: "cust-2", full_name: "דני", phone: null } });
    const chain = vaccinationsChain({ data: [withPhone, withoutPhone], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "vaccinations") return chain;
      if (table === "notifications_log") return { upsert: mockUpsert };
      if (table === "clinics") return clinicsChain();
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await enqueueDueVaccinationReminders();

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ scanned: 2, enqueued: 1, skippedNoPhone: 1, failed: 0 });
  });

  it("throws when the vaccinations query returns an error", async () => {
    const chain = vaccinationsChain({ data: null, error: { message: "DB error" } });
    mockFrom.mockImplementation((table: string) => {
      if (table === "vaccinations") return chain;
      if (table === "notifications_log") return { upsert: mockUpsert };
      if (table === "clinics") return clinicsChain();
      throw new Error(`unexpected table: ${table}`);
    });

    await expect(enqueueDueVaccinationReminders()).rejects.toThrow(
      "enqueueDueVaccinationReminders: failed to query vaccinations",
    );
  });

  it("returns zeros without upserting when no vaccinations are due", async () => {
    const chain = vaccinationsChain({ data: [], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "vaccinations") return chain;
      if (table === "notifications_log") return { upsert: mockUpsert };
      if (table === "clinics") return clinicsChain();
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await enqueueDueVaccinationReminders();

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 0, enqueued: 0, skippedNoPhone: 0, failed: 0 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Clinic SMS template overrides — resolveSmsTemplate honors clinics.settings.smsTemplates
// ─────────────────────────────────────────────────────────────────────────────

describe("enqueueDueVaccinationReminders — clinic SMS template overrides", () => {
  it("uses the clinic's vaccination_reminder override when present", async () => {
    mockSingle.mockResolvedValue({
      data: { settings: { smsTemplates: { vaccination_reminder: "תזכורת: {{petName}} צריך {{vaccineName}}" } } },
      error: null,
    });
    const row = makeVaccinationRow();
    const chain = vaccinationsChain({ data: [row], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "vaccinations") return chain;
      if (table === "notifications_log") return { upsert: mockUpsert };
      if (table === "clinics") return clinicsChain();
      throw new Error(`unexpected table: ${table}`);
    });

    await enqueueDueVaccinationReminders();

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [payload] = mockUpsert.mock.calls[0]!;
    expect(payload.body).toBe("תזכורת: ביסלי צריך משושה");
  });

  it("falls back to default wording when the clinic has no override", async () => {
    const row = makeVaccinationRow();
    const chain = vaccinationsChain({ data: [row], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "vaccinations") return chain;
      if (table === "notifications_log") return { upsert: mockUpsert };
      if (table === "clinics") return clinicsChain();
      throw new Error(`unexpected table: ${table}`);
    });

    await enqueueDueVaccinationReminders();

    const [payload] = mockUpsert.mock.calls[0]!;
    expect(payload.body).toContain("הגיע הזמן לחיסון הבא");
  });

  it("falls back to default wording when the clinics lookup errors (does not throw)", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "not found" } });
    const row = makeVaccinationRow();
    const chain = vaccinationsChain({ data: [row], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "vaccinations") return chain;
      if (table === "notifications_log") return { upsert: mockUpsert };
      if (table === "clinics") return clinicsChain();
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await enqueueDueVaccinationReminders();

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [payload] = mockUpsert.mock.calls[0]!;
    expect(payload.body).toContain("הגיע הזמן לחיסון הבא");
    expect(result).toEqual({ scanned: 1, enqueued: 1, skippedNoPhone: 0, failed: 0 });
  });

  it("only fetches clinic overrides once per clinic across multiple due vaccinations (per-run cache)", async () => {
    const row1 = makeVaccinationRow({ id: "vacc-1" });
    const row2 = makeVaccinationRow({ id: "vacc-2", customer: { id: "cust-2", full_name: "דני", phone: "+972509999999" } });
    const chain = vaccinationsChain({ data: [row1, row2], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "vaccinations") return chain;
      if (table === "notifications_log") return { upsert: mockUpsert };
      if (table === "clinics") return clinicsChain();
      throw new Error(`unexpected table: ${table}`);
    });

    await enqueueDueVaccinationReminders();

    expect(mockUpsert).toHaveBeenCalledTimes(2);
    // Both rows share clinic_id "clinic-1" — the clinics lookup should be
    // memoized per run rather than re-fetched per row.
    expect(mockSingle).toHaveBeenCalledTimes(1);
  });
});
