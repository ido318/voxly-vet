import { describe, expect, it, vi } from "vitest";
import {
  DashboardNotificationsService,
  vaccinationReminderScheduledFor,
} from "@/lib/services/dashboard-notifications.service";
import { smsTemplates } from "../../../agent/src/services/sms.templates";

// Asserts against the real agent template (see sms-template-parity.test.ts
// for the full cross-check across all five duplicated templates) rather than
// a hand-copied string, so this test can't itself drift from the source it's
// meant to guard.
function frozenVaccinationReminderBody(customerName: string, petName: string, vaccineName: string): string {
  return smsTemplates.vaccination_reminder({ customerName, petName, vaccineName });
}

function buildClient() {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const single = vi.fn().mockResolvedValue({ data: { settings: { smsTemplates: {} } }, error: null });
  const client = {
    from: vi.fn((table: string) =>
      table === "clinics"
        ? { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single }
        : { upsert },
    ),
  };
  return { client, upsert };
}

describe("DashboardNotificationsService.enqueueVaccinationReminder", () => {
  it("sends the frozen SMS wording verbatim, not an ad-hoc paraphrase", async () => {
    const { client, upsert } = buildClient();
    const service = new DashboardNotificationsService(client as never);

    const result = await service.enqueueVaccinationReminder({
      vaccinationId: "vacc-1",
      clinicId: "clinic-1",
      customerId: "cust-1",
      phone: "+972500000000",
      customerName: "דנה כהן",
      petName: "מיקה",
      vaccineName: "כלבת",
      nextDueAt: "2026-10-01",
    });

    expect(result.ok).toBe(true);
    expect(client.from).toHaveBeenCalledWith("notifications_log");
    const [row] = upsert.mock.calls[0] as [{ body: string }, unknown];
    expect(row.body).toBe(frozenVaccinationReminderBody("דנה כהן", "מיקה", "כלבת"));
  });

  it("does not mention a specific due date — the frozen template only says 'בקרוב'", async () => {
    const { client, upsert } = buildClient();
    const service = new DashboardNotificationsService(client as never);

    await service.enqueueVaccinationReminder({
      vaccinationId: "vacc-1",
      clinicId: "clinic-1",
      customerId: "cust-1",
      phone: "+972500000000",
      customerName: "דנה כהן",
      petName: "מיקה",
      vaccineName: "כלבת",
      nextDueAt: "2026-10-01",
    });

    const [row] = upsert.mock.calls[0] as [{ body: string }, unknown];
    expect(row.body).not.toContain("2026");
    expect(row.body).toContain("בקרוב");
  });

  it("upserts on (vaccination_id, type) ignoring duplicates, matching the cron job's own idempotent insert", async () => {
    const { client, upsert } = buildClient();
    const service = new DashboardNotificationsService(client as never);

    await service.enqueueVaccinationReminder({
      vaccinationId: "vacc-1",
      clinicId: "clinic-1",
      customerId: "cust-1",
      phone: "+972500000000",
      customerName: "דנה כהן",
      petName: "מיקה",
      vaccineName: "כלבת",
      nextDueAt: "2026-10-01",
    });

    const [, options] = upsert.mock.calls[0] as [unknown, { onConflict: string; ignoreDuplicates: boolean }];
    expect(options).toEqual({ onConflict: "vaccination_id,type", ignoreDuplicates: true });
  });

  it("schedules 14 days before due date at 08:00 Asia/Jerusalem, not on the due date at 06:00 UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
    try {
      expect(vaccinationReminderScheduledFor("2026-10-01")).toBe(
        new Date("2026-09-17T08:00:00+03:00").toISOString(),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("writes that 14-day Jerusalem scheduled_for onto the notification row", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
    try {
      const { client, upsert } = buildClient();
      const service = new DashboardNotificationsService(client as never);

      await service.enqueueVaccinationReminder({
        vaccinationId: "vacc-1",
        clinicId: "clinic-1",
        customerId: "cust-1",
        phone: "+972500000000",
        customerName: "דנה כהן",
        petName: "מיקה",
        vaccineName: "כלבת",
        nextDueAt: "2026-10-01",
      });

      const [row] = upsert.mock.calls[0] as [{ scheduled_for: string }, unknown];
      expect(row.scheduled_for).toBe(new Date("2026-09-17T08:00:00+03:00").toISOString());
      expect(row.scheduled_for).not.toBe("2026-10-01T06:00:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });
});
