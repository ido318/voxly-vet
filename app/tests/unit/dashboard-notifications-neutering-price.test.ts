import { describe, expect, it, vi } from "vitest";
import { DashboardNotificationsService } from "@/lib/services/dashboard-notifications.service";

/**
 * Neutering costs 350 ₪ and Dana bills by that number — but the price depends
 * on species, weight, age and medical state, so she quotes it herself and the
 * approval SMS must not name it. The SMS used to print "💳 350 ₪" anyway.
 *
 * That used to be reconciled by leaving neutering out of a hardcoded price map
 * in each workspace, which encoded the outcome but lost the reason. The price
 * now comes from the clinic's editable price_list_items, where
 * agent_quotable = false carries it.
 */

// One row per visit type, mirroring what the migration seeds.
const PRICE_ROWS: Record<string, { default_price: number; agent_quotable: boolean }> = {
  checkup: { default_price: 150, agent_quotable: true },
  urgent: { default_price: 200, agent_quotable: true },
  neutering: { default_price: 350, agent_quotable: false },
};

function buildClient() {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const single = vi.fn().mockResolvedValue({ data: { settings: { smsTemplates: {} } }, error: null });
  const client = {
    from: vi.fn((table: string) => {
      if (table === "clinics") {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single };
      }
      if (table === "price_list_items") {
        let visitType = "";
        const chain: Record<string, unknown> = {};
        chain["select"] = vi.fn().mockReturnValue(chain);
        chain["eq"] = vi.fn((column: string, value: unknown) => {
          if (column === "visit_type") visitType = String(value);
          return chain;
        });
        chain["is"] = vi.fn().mockReturnValue(chain);
        chain["maybeSingle"] = vi.fn(async () => ({
          data: PRICE_ROWS[visitType] ?? null,
          error: null,
        }));
        return chain;
      }
      return { insert };
    }),
  };
  return { client, insert };
}

type QueuedRow = { type: string; body: string };

async function enqueueFor(visitType: string): Promise<QueuedRow[]> {
  const { client, insert } = buildClient();
  const service = new DashboardNotificationsService(client as never);

  const result = await service.enqueueApprovalNotifications({
    appointmentId: "appt-1",
    // Far future, so the morning reminder is queued too and every row is asserted.
    scheduledAt: "2099-06-21T09:00:00.000Z",
    durationMinutes: 40,
    visitType,
    clinicId: "clinic-1",
    customerId: "cust-1",
    phone: "+972500000000",
    customerName: "דנה כהן",
    petName: "רקס",
  });

  expect(result.ok).toBe(true);
  return (insert.mock.calls[0] as [QueuedRow[]])[0];
}

describe("approval SMS pricing", () => {
  it("never names a number for a neutering appointment, though the row has one", async () => {
    const rows = await enqueueFor("neutering");
    const confirmation = rows.find((row) => row.type === "booking_confirmation");

    expect(confirmation).toBeDefined();
    expect(confirmation!.body).toContain('המחיר יימסר על ידי ד"ר דנה');
    // The old body read "💳 350 ₪". No digits may follow the card marker.
    expect(confirmation!.body).not.toMatch(/💳\s*\d/);
    expect(confirmation!.body).not.toContain("350");
  });

  it("prints the clinic's price for a quotable visit type", async () => {
    const rows = await enqueueFor("checkup");
    const confirmation = rows.find((row) => row.type === "booking_confirmation");

    expect(confirmation!.body).toContain("💳 150 ₪");
  });

  it("agrees with the agent on urgent, which the two hardcoded maps did not", async () => {
    // The agent quoted 200 ₪; this service had no `urgent` key and fell
    // through to `?? "150 ₪"`. Same appointment, two prices.
    const rows = await enqueueFor("urgent");
    const confirmation = rows.find((row) => row.type === "booking_confirmation");

    expect(confirmation!.body).toContain("💳 200 ₪");
  });

  // Was "falls back to the standard fee for an unknown visit type", asserting
  // `?? "150 ₪"`. That fallback invented a price nobody had configured and
  // texted it to a client as a commitment.
  it("does not invent a price for a visit type the clinic has not configured", async () => {
    const rows = await enqueueFor("something_new");
    const confirmation = rows.find((row) => row.type === "booking_confirmation");

    expect(confirmation!.body).toContain('המחיר יימסר על ידי ד"ר דנה');
    expect(confirmation!.body).not.toMatch(/💳\s*\d/);
  });
});
