/**
 * app/lib/services/dashboard-notifications.service.ts builds its own copies of
 * five SMS templates that are otherwise owned by agent/src/services/sms.templates.ts
 * (frozen wording — CLAUDE.md: "do not change without Dana's approval"). The two
 * copies exist because the dashboard enqueues some of these notifications
 * (booking/rejection/vaccination-reminder) at moments the agent's own cron
 * doesn't cover, and there is currently no shared package agent and app can
 * both import from without touching either's deploy pipeline (agent's Docker
 * build copies only its own package.json + src/, with no workspace access;
 * app's Vercel build has no configured outputFileTracingRoot for a monorepo
 * import to be reliably bundled into serverless functions).
 *
 * Until that's worth the deploy risk, this test is the actual guardrail: it
 * imports the real agent templates (not a third hand-copied string) and
 * fails the moment the two diverge, so a wording edit on one side can never
 * ship silently — which is the exact failure mode that produced an
 * unapproved SMS going out to real customers before.
 */
import { describe, expect, it, vi } from "vitest";
import { DashboardNotificationsService } from "@/lib/services/dashboard-notifications.service";
import { smsTemplates } from "../../../agent/src/services/sms.templates";

function buildClient() {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const single = vi.fn().mockResolvedValue({ data: { settings: { smsTemplates: {} } }, error: null });
  const client = {
    from: vi.fn((table: string) => {
      if (table === "clinics") {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single };
      }
      if (table === "price_list_items") {
        // The booking SMS price comes from the clinic's price list now.
        let visitType = "";
        const chain: Record<string, unknown> = {};
        chain["select"] = vi.fn().mockReturnValue(chain);
        chain["eq"] = vi.fn((column: string, value: unknown) => {
          if (column === "visit_type") visitType = String(value);
          return chain;
        });
        chain["is"] = vi.fn().mockReturnValue(chain);
        chain["maybeSingle"] = vi.fn(async () => ({
          data: visitType === "checkup" ? { default_price: 150, agent_quotable: true } : null,
          error: null,
        }));
        return chain;
      }
      return { insert, upsert };
    }),
  };
  return { client, insert, upsert };
}

describe("SMS template parity: app vs. agent (frozen wording)", () => {
  it("booking_confirmation matches verbatim", async () => {
    const { client, insert } = buildClient();
    const service = new DashboardNotificationsService(client as never);

    await service.enqueueApprovalNotifications({
      appointmentId: "appt-1",
      scheduledAt: "2027-01-15T10:00:00.000Z",
      durationMinutes: 30,
      visitType: "checkup",
      clinicId: "clinic-1",
      customerId: "cust-1",
      phone: "+972500000000",
      customerName: "דנה כהן",
      petName: "מיקה",
    });

    const [rows] = insert.mock.calls[0] as [{ type: string; body: string }[]];
    const booking = rows.find((r) => r.type === "booking_confirmation");
    expect(booking).toBeDefined();
    expect(booking!.body).toBe(
      smsTemplates.booking_confirmation({
        customerName: "דנה כהן",
        petName: "מיקה",
        dayName: booking!.body.match(/📅 ([^,]+),/)![1]!,
        date: booking!.body.match(/, ([\d.]+) \|/)![1]!,
        time: booking!.body.match(/🕒 (\d{2}:\d{2}) \|/)![1]!,
        location: 'הקליניקה, הדוגמה 1 ת"א',
        visitType: "בדיקה",
        // Whole segment now, not a bare number: a service with no fixed price
        // (neutering) carries a sentence here instead, so the template no longer
        // appends "₪" itself.
        price: "150 ₪",
      }),
    );
  });

  it("morning_reminder matches verbatim", async () => {
    const { client, insert } = buildClient();
    const service = new DashboardNotificationsService(client as never);

    // A scheduled time far enough in the future that "8am on the appointment
    // date, Israel time" always still lies ahead of "now" when this runs.
    await service.enqueueApprovalNotifications({
      appointmentId: "appt-1",
      scheduledAt: "2027-01-15T10:00:00.000Z",
      durationMinutes: 30,
      visitType: "home_visit",
      clinicId: "clinic-1",
      customerId: "cust-1",
      phone: "+972500000000",
      customerName: "דנה כהן",
      petName: "מיקה",
    });

    const [rows] = insert.mock.calls[0] as [{ type: string; body: string }[]];
    const reminder = rows.find((r) => r.type === "morning_reminder");
    expect(reminder).toBeDefined();
    expect(reminder!.body).toBe(
      smsTemplates.morning_reminder({
        customerName: "דנה כהן",
        petName: "מיקה",
        time: reminder!.body.match(/🕒 (\d{2}:\d{2}) \|/)![1]!,
        location: "ביקור בית בכתובתכם",
        visitType: "ביקור בית",
      }),
    );
  });

  it("post_visit_followup matches verbatim", async () => {
    const { client, insert } = buildClient();
    const service = new DashboardNotificationsService(client as never);

    await service.enqueueApprovalNotifications({
      appointmentId: "appt-1",
      scheduledAt: "2027-01-15T10:00:00.000Z",
      durationMinutes: 30,
      visitType: "checkup",
      clinicId: "clinic-1",
      customerId: "cust-1",
      phone: "+972500000000",
      customerName: "דנה כהן",
      petName: "מיקה",
    });

    const [rows] = insert.mock.calls[0] as [{ type: string; body: string }[]];
    const followup = rows.find((r) => r.type === "post_visit_followup");
    expect(followup).toBeDefined();
    expect(followup!.body).toBe(
      smsTemplates.post_visit_followup({ customerName: "דנה כהן", petName: "מיקה" }),
    );
  });

  it("arrival_reminder matches verbatim and is scheduled 2 hours before the appointment", async () => {
    const { client, insert } = buildClient();
    const service = new DashboardNotificationsService(client as never);
    const scheduledAt = "2027-01-15T10:00:00.000Z";

    await service.enqueueApprovalNotifications({
      appointmentId: "appt-1",
      scheduledAt,
      durationMinutes: 30,
      visitType: "checkup",
      clinicId: "clinic-1",
      customerId: "cust-1",
      phone: "+972500000000",
      customerName: "דנה כהן",
      petName: "מיקה",
    });

    const [rows] = insert.mock.calls[0] as [{ type: string; body: string; scheduled_for: string }[]];
    const arrival = rows.find((r) => r.type === "arrival_reminder");
    expect(arrival).toBeDefined();
    expect(arrival!.scheduled_for).toBe(new Date(new Date(scheduledAt).getTime() - 2 * 60 * 60_000).toISOString());
    expect(arrival!.body).toBe(
      smsTemplates.arrival_reminder({
        customerName: "דנה כהן",
        petName: "מיקה",
        time: arrival!.body.match(/בשעה (\d{2}:\d{2}) \|/)![1]!,
        location: 'הקליניקה, הדוגמה 1 ת"א',
        visitType: "בדיקה",
      }),
    );
  });

  it("cancellation_update matches verbatim", async () => {
    const { client, insert } = buildClient();
    const service = new DashboardNotificationsService(client as never);

    await service.enqueueRejectionNotification({
      appointmentId: "appt-1",
      scheduledAt: "2027-01-15T10:00:00.000Z",
      clinicId: "clinic-1",
      customerId: "cust-1",
      phone: "+972500000000",
      customerName: "דנה כהן",
      petName: "מיקה",
    });

    const [row] = insert.mock.calls[0] as [{ body: string; type: string }];
    expect(row.type).toBe("cancellation_update");
    expect(row.body).toBe(
      smsTemplates.cancellation_update({
        customerName: "דנה כהן",
        petName: "מיקה",
        oldDate: row.body.match(/מיום ([\d.]+) בוטל/)![1]!,
      }),
    );
  });

  it("vaccination_reminder matches verbatim", async () => {
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
    expect(row.body).toBe(
      smsTemplates.vaccination_reminder({
        customerName: "דנה כהן",
        petName: "מיקה",
        vaccineName: "כלבת",
      }),
    );
  });
});
