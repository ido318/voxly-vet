import { beforeEach, describe, expect, it, vi } from "vitest";

const { queues, setQueue, popResponse, eqCalls, inCalls } = vi.hoisted(() => {
  const queues: Record<string, Array<{ data: unknown; error: unknown }>> = {};
  const eqCalls: Record<string, Array<[string, unknown]>> = {};
  const inCalls: Record<string, Array<[string, unknown]>> = {};

  function setQueue(table: string, responses: Array<{ data: unknown; error: unknown }>) {
    queues[table] = [...responses];
  }

  function popResponse(table: string): Promise<{ data: unknown; error: unknown }> {
    const queue = queues[table];
    if (!queue || queue.length === 0) {
      return Promise.reject(new Error(`no mocked response queued for table "${table}"`));
    }
    return Promise.resolve(queue.shift()!);
  }

  return { queues, setQueue, popResponse, eqCalls, inCalls };
});

vi.mock("../../../src/lib/supabase.js", () => {
  function chainFor(table: string): Record<string, unknown> {
    const chain: Record<string, unknown> = {
      select: vi.fn(() => chain),
      eq: vi.fn((col: string, val: unknown) => {
        (eqCalls[table] ??= []).push([col, val]);
        return chain;
      }),
      in: vi.fn((col: string, val: unknown) => {
        (inCalls[table] ??= []).push([col, val]);
        return chain;
      }),
      is: vi.fn(() => chain),
      gte: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      maybeSingle: vi.fn(() => popResponse(table)),
      then: (onFulfilled: (v: { data: unknown; error: unknown }) => unknown, onRejected: (e: unknown) => unknown) =>
        popResponse(table).then(onFulfilled, onRejected),
    };
    return chain;
  }

  return {
    getSupabase: vi.fn(() => ({
      from: (table: string) => chainFor(table),
    })),
  };
});

import { listCustomerAppointments } from "../../../src/lib/store.js";

const PHONE = "+972541234567";
const CUSTOMER_ID = "cust-1";

describe("listCustomerAppointments", () => {
  beforeEach(() => {
    for (const key of Object.keys(queues)) delete queues[key];
    for (const key of Object.keys(eqCalls)) delete eqCalls[key];
    for (const key of Object.keys(inCalls)) delete inCalls[key];
  });

  it("returns an unknown-customer message when the phone is not in the clinic", async () => {
    setQueue("customers", [{ data: null, error: null }]);

    const { result, appointments } = await listCustomerAppointments(PHONE);

    expect(result).toContain("לא מצאנו לקוח");
    expect(appointments).toEqual([]);
  });

  it("lists upcoming active appointments with scheduled_at for cancel/reschedule", async () => {
    setQueue("customers", [{ data: { id: CUSTOMER_ID }, error: null }]);
    setQueue("appointments", [{
      data: [{
        scheduled_at: "2026-06-14T06:10:00.000Z",
        appointment_type: "checkup",
        status: "scheduled",
        pets: { name: "מיקה" },
      }],
      error: null,
    }]);

    const { result, appointments } = await listCustomerAppointments(PHONE);

    expect(eqCalls["appointments"]).toContainEqual(["customer_id", CUSTOMER_ID]);
    expect(inCalls["appointments"]?.[0]?.[0]).toBe("status");
    expect(inCalls["appointments"]?.[0]?.[1]).toEqual([
      "scheduled",
      "confirmed",
      "pending_approval",
      "checked_in",
      "in_visit",
    ]);
    expect(appointments).toHaveLength(1);
    expect(appointments[0]?.visit_type).toBe("checkup");
    expect(result).toContain("scheduled_at=");
    expect(result).toContain("מיקה");
  });
});
