import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

function toolHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer test-tools-token-1234567",
  };
}

vi.mock("../../../src/lib/store.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/store.js")>();
  return {
    ...actual,
    checkAvailability: vi.fn(),
    bookAppointment: vi.fn(),
    cancelAppointment: vi.fn(),
    rescheduleAppointment: vi.fn(),
    joinWaitlist: vi.fn(),
    listCustomerAppointments: vi.fn(),
    findCustomerByPhone: vi.fn(),
    addEscalation: vi.fn().mockResolvedValue(undefined),
  };
});

import { toolsRoutes } from "../../../src/server/routes/tools.js";
import {
  bookAppointment,
  cancelAppointment,
  checkAvailability,
  joinWaitlist,
  listCustomerAppointments,
  rescheduleAppointment,
} from "../../../src/lib/store.js";

function makeApp() {
  const app = new Hono();
  app.route("/", toolsRoutes);
  return app;
}

describe("appointment tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The real format, not "חלונות פנויים: 09:10, 12:20". That invented
    // shorthand is why the urgent-callback regex bug survived: the code parsed
    // a time out of this string, and the mock was the only place the parse
    // ever saw 24-hour, zero-padded times. Production emits a 12-hour spoken
    // time plus the ISO instant — see formatSlotOptionForTool.
    vi.mocked(checkAvailability).mockResolvedValue(
      "חלונות פנויים לבדיקה בקליניקה ב-14/06/2026 (יום ראשון): " +
        "9:10 בבוקר (scheduled_at=2026-06-14T09:10:00+03:00), " +
        "12:20 בצהריים (scheduled_at=2026-06-14T12:20:00+03:00). " +
        "לקביעת תור חובה להשתמש בערך scheduled_at המדויק מאחת האופציות, כולל אזור הזמן.",
    );
    vi.mocked(bookAppointment).mockResolvedValue("✅ תור נקבע");
    vi.mocked(cancelAppointment).mockResolvedValue("✅ התור בוטל בהצלחה.");
    vi.mocked(rescheduleAppointment).mockResolvedValue("✅ התור הוזז בהצלחה.");
    vi.mocked(joinWaitlist).mockResolvedValue("✅ נרשמ/ה לרשימת ההמתנה.");
    vi.mocked(listCustomerAppointments).mockResolvedValue({
      result: "תורים פעילים: 14/06/2026 בשעה 9:10 בבוקר — בדיקה בקליניקה עבור Mika (scheduled_at=2026-06-14T09:10:00+03:00)",
      appointments: [{
        scheduled_at: "2026-06-14T09:10:00+03:00",
        visit_type: "checkup",
        pet_name: "Mika",
        status: "scheduled",
      }],
    });
  });

  it("POST /tools/check-availability returns result string", async () => {
    const res = await makeApp().request("/tools/check-availability", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify({ date_iso: "2026-06-14", visit_type: "checkup" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { result: string };
    expect(json.result).toContain("09:10");
    expect(vi.mocked(checkAvailability)).toHaveBeenCalledWith("2026-06-14", "checkup");
  });

  it("POST /tools/check-availability rejects the jobs bearer token", async () => {
    const res = await makeApp().request("/tools/check-availability", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer test-bearer-token-1234567",
      },
      body: JSON.stringify({ date_iso: "2026-06-14", visit_type: "checkup" }),
    });

    expect(res.status).toBe(403);
    expect(vi.mocked(checkAvailability)).not.toHaveBeenCalled();
  });

  it("POST /tools/conversation-policy returns Hebrew next-step guidance", async () => {
    const res = await makeApp().request("/tools/conversation-policy", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify({
        user_utterance_he: "הכלב טיפה מקיא ולא מרגיש טוב",
        known_pet_type: "כלב",
        known_symptoms_he: "טיפה מקיא ולא מרגיש טוב",
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { result: string };
    expect(json.result).toContain("פעולה הבאה: ask_follow_up");
    expect(json.result).toContain("כמה פעמים");
    expect(json.result).toContain("לא להפנות לבית חולים");
  });

  it("POST /tools/book-appointment passes full booking payload", async () => {
    const payload = {
      phone: "+972541234567",
      customer_name: "Ido",
      pet_name: "Mika",
      pet_species: "כלב",
      pet_breed: "לברדור",
      scheduled_at: "2026-06-14T09:10:00+03:00",
      visit_type: "home_visit",
      reason: "בדיקה",
      twilio_call_sid: "CA123",
      elevenlabs_conversation_id: "conv123",
    };
    const res = await makeApp().request("/tools/book-appointment", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { result: string };
    expect(json.result).toContain("תור");
    expect(vi.mocked(bookAppointment)).toHaveBeenCalledWith(payload);
  });

  it("POST /tools/cancel-or-reschedule cancels appointments", async () => {
    const res = await makeApp().request("/tools/cancel-or-reschedule", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify({
        phone: "+972541234567",
        action: "cancel",
        current_scheduled_at: "2026-06-14T09:10:00+03:00",
      }),
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(cancelAppointment)).toHaveBeenCalledWith(
      "+972541234567",
      "2026-06-14T09:10:00+03:00",
    );
  });

  it("POST /tools/cancel-or-reschedule reschedules appointments", async () => {
    const res = await makeApp().request("/tools/cancel-or-reschedule", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify({
        phone: "+972541234567",
        action: "reschedule",
        current_scheduled_at: "2026-06-14T09:10:00+03:00",
        new_scheduled_at: "2026-06-15T12:20:00+03:00",
        visit_type: "checkup",
      }),
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(rescheduleAppointment)).toHaveBeenCalledWith(
      "+972541234567",
      "2026-06-14T09:10:00+03:00",
      "2026-06-15T12:20:00+03:00",
      "checkup",
    );
  });

  it("POST /tools/join-waitlist passes waitlist payload", async () => {
    const payload = {
      phone: "+972541234567",
      customer_name: "Ido",
      pet_name: "Mika",
      pet_species: "כלב",
      pet_breed: "מעורב",
      visit_type: "checkup",
      preferred_start: "2026-06-14",
      notes: "אפשר בבוקר",
    };
    const res = await makeApp().request("/tools/join-waitlist", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(joinWaitlist)).toHaveBeenCalledWith(payload);
  });

  it("POST /tools/list-customer-appointments returns upcoming active appointments", async () => {
    const res = await makeApp().request("/tools/list-customer-appointments", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify({ phone: "+972541234567" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as {
      result: string;
      appointments: Array<{ scheduled_at: string }>;
    };
    expect(json.result).toContain("תורים פעילים");
    expect(json.appointments[0]?.scheduled_at).toBe("2026-06-14T09:10:00+03:00");
    expect(vi.mocked(listCustomerAppointments)).toHaveBeenCalledWith("+972541234567");
  });

  it("POST /tools/book-appointment returns HTTP 200 with a Hebrew result on validation failure", async () => {
    const res = await makeApp().request("/tools/book-appointment", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify({ phone: "+972541234567" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { result: string };
    expect(json.result).toContain("פרמטרים חסרים");
    expect(vi.mocked(bookAppointment)).not.toHaveBeenCalled();
  });
});
