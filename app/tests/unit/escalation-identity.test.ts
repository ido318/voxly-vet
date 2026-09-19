// Escalation cards used to carry no identity at all.
//
// The table held reason/urgency plus two call-id columns that nothing ever
// wrote, so "דורש תשומת לב" showed one Hebrew string: no customer name, no
// number to call back, no link to the call. Everything else was smuggled into
// free text — /tools/escalate-to-vet wrote notes = 'caller_phone: +9725…',
// /tools/triage-pet-case wrote a JSON blob into that same `notes` column.
//
// `notes` is also what a human types when resolving, so resolving an
// escalation overwrote the triage context. Migration 20260918230000 gives
// context its own column; this locks in that the mapper reads it and that the
// two no longer collide.
import { describe, expect, it } from "vitest";
import { mapEscalationRow } from "@/lib/repositories/mappers";

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "esc-1",
    clinic_id: "clinic-1",
    voice_call_id: null,
    elevenlabs_conversation_id: null,
    caller_phone: null,
    customer_id: null,
    pet_id: null,
    reason: "triage: urgent_callback — flags: vomiting",
    urgency: 7,
    context: {},
    resolved_at: null,
    resolved_by: null,
    notes: null,
    created_at: "2026-09-18T09:00:00.000Z",
    updated_at: "2026-09-18T09:00:00.000Z",
    ...overrides,
  };
}

describe("mapEscalationRow", () => {
  it("exposes the caller's identity so the card can name and dial them", () => {
    const result = mapEscalationRow(
      row({
        caller_phone: "+972500000001",
        customer_id: "cust-1",
        pet_id: "pet-1",
        customers: { full_name: "אידו אמסלם" },
        pets: { name: "גבר" },
      }),
    );

    expect(result.callerPhone).toBe("+972500000001");
    expect(result.customerId).toBe("cust-1");
    expect(result.customerName).toBe("אידו אמסלם");
    expect(result.petName).toBe("גבר");
  });

  it("reads triage context from its own column", () => {
    const result = mapEscalationRow(
      row({
        context: {
          decision: "urgent_callback",
          after_hours: true,
          matched_flags: ["vomiting"],
          symptoms_he: "הכלב מקיא כבר יומיים",
        },
      }),
    );

    expect(result.context.matched_flags).toEqual(["vomiting"]);
    expect(result.context.symptoms_he).toBe("הכלב מקיא כבר יומיים");
    expect(result.afterHours).toBe(true);
  });

  // The regression: a resolved escalation has a human note in `notes`, and
  // that must not disturb the agent's context. Before the split, this row
  // shape meant the context was simply gone.
  it("keeps context intact once a human has written a resolution note", () => {
    const result = mapEscalationRow(
      row({
        resolved_at: "2026-09-18T10:00:00.000Z",
        resolved_by: "user-1",
        notes: "התקשרתי, הכלב בסדר",
        context: { after_hours: true, matched_flags: ["vomiting"] },
      }),
    );

    expect(result.notes).toBe("התקשרתי, הכלב בסדר");
    expect(result.context.matched_flags).toEqual(["vomiting"]);
    expect(result.afterHours).toBe(true);
  });

  it("survives a row with no identity — a withheld caller id is still an escalation", () => {
    const result = mapEscalationRow(row());

    expect(result.callerPhone).toBeNull();
    expect(result.customerName).toBeNull();
    expect(result.context).toEqual({});
    expect(result.afterHours).toBeUndefined();
  });
});
