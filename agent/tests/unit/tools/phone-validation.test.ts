// Locks down the fix for the phone = "+" incident.
//
// normalisePhone used to end with `return "+" + digits`, so an empty or
// non-numeric caller id normalised to the string "+". Every /tools/* phone
// parameter was `z.string().min(5)`, which let "aaaaa" and "unknown" through
// to it. The result was a real customers row with phone = "+", and because
// createOrFindCustomer looks the number up before inserting, every later junk
// call reused that same row — merging unrelated callers onto one card. Nine
// SMS to it failed at Twilio with "Invalid 'To' Phone Number".
//
// Two independent guards now have to hold: the tool schema rejects the input,
// and createOrFindCustomer refuses to write it even if something reached it.
import { describe, it, expect, vi, beforeEach } from "vitest";
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
    findCustomerByPhone: vi.fn().mockResolvedValue(null),
    bookAppointment: vi.fn().mockResolvedValue("booked"),
    joinWaitlist: vi.fn().mockResolvedValue("queued"),
    addEscalation: vi.fn().mockResolvedValue(undefined),
  };
});

import { bookAppointment, findCustomerByPhone, joinWaitlist, normalisePhone } from "../../../src/lib/store.js";

function makeApp() {
  const app = new Hono();
  app.route("/", toolsRoutes);
  return app;
}

// The exact inputs that produced "+" before the fix.
const UNUSABLE = ["", "aaaaa", "-----", "unknown", "+"];

describe("tool phone validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(UNUSABLE)("book-appointment rejects %j without touching the store", async (phone) => {
    const res = await makeApp().request("/tools/book-appointment", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify({
        phone,
        customer_name: "אידו",
        pet_name: "גבר",
        pet_species: "כלב",
        visit_type: "checkup",
        scheduled_at: "2026-09-21T08:00:00+03:00",
      }),
    });

    expect(res.status).toBe(200);
    // The booking never runs, so no customer row can be created.
    expect(vi.mocked(bookAppointment)).not.toHaveBeenCalled();
  });

  it.each(UNUSABLE)("join-waitlist rejects %j without touching the store", async (phone) => {
    const res = await makeApp().request("/tools/join-waitlist", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify({
        phone,
        customer_name: "אידו",
        pet_name: "גבר",
        pet_species: "כלב",
        visit_type: "checkup",
      }),
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(joinWaitlist)).not.toHaveBeenCalled();
  });

  it.each(UNUSABLE)("lookup-customer rejects %j without querying", async (phone) => {
    const res = await makeApp().request("/tools/lookup-customer", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify({ phone }),
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(findCustomerByPhone)).not.toHaveBeenCalled();
  });

  it("still accepts the number shapes a caller or the agent actually produces", async () => {
    for (const phone of ["050-000-0001", "0500000001", "+972500000001", "500000001"]) {
      const res = await makeApp().request("/tools/lookup-customer", {
        method: "POST",
        headers: toolHeaders(),
        body: JSON.stringify({ phone }),
      });
      expect(res.status, `${phone} should be accepted`).toBe(200);
    }
  });
});

describe("normalisePhone", () => {
  it("returns null rather than \"+\" for input with no usable digits", () => {
    for (const phone of UNUSABLE) {
      expect(normalisePhone(phone), `${JSON.stringify(phone)} must not normalise`).toBeNull();
    }
  });

  it("collapses every spelling of one number onto a single stored value", () => {
    const stored = new Set(
      ["050-000-0001", "0500000001", "+972500000001", "500000001"].map(normalisePhone),
    );
    expect(stored).toEqual(new Set(["+972500000001"]));
  });
});
