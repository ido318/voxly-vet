import { describe, expect, it, vi } from "vitest";
import { DashboardNotificationsService } from "@/lib/services/dashboard-notifications.service";

/**
 * The booking SMS price now comes from the clinic's editable price_list_items
 * rather than a hardcoded map, so every client mock here needs that table.
 * Only `checkup` has a row, which is what these tests enqueue.
 */
function priceListChain() {
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


describe("DashboardNotificationsService — clinic template overrides", () => {
  it("getSmsTemplateOverrides fetches clinics.settings.smsTemplates for the given clinic", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { settings: { smsTemplates: { cancellation_update: "override {{oldDate}}" } } },
      error: null,
    });
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single,
      }),
    };
    const service = new DashboardNotificationsService(client as never);

    const overrides = await service.getSmsTemplateOverrides("clinic-1");

    expect(overrides).toEqual({ cancellation_update: "override {{oldDate}}" });
  });

  it("getSmsTemplateOverrides returns {} when the clinic has no overrides or the query fails", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
    const client = {
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single }),
    };
    const service = new DashboardNotificationsService(client as never);

    const overrides = await service.getSmsTemplateOverrides("clinic-1");

    expect(overrides).toEqual({});
  });

  it("enqueueDashboardChangeNotification renders reschedule_update using the clinic's override when present", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { settings: { smsTemplates: { reschedule_update: "עדכון קצר: {{newDate}} {{newTime}}" } } },
      error: null,
    });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "clinics") return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single };
        if (table === "price_list_items") return priceListChain();
        return { insert };
      }),
    };
    const service = new DashboardNotificationsService(client as never);

    const result = await service.enqueueDashboardChangeNotification({
      clinicId: "clinic-1",
      customerId: "cust-1",
      appointmentId: "appt-1",
      phone: "+972500000000",
      customerName: "דנה",
      petName: "מיקה",
      templateKey: "reschedule_update",
      oldScheduledAt: "2027-01-15T10:00:00.000Z",
      newScheduledAt: "2027-01-20T12:00:00.000Z",
      location: "הקליניקה, הדוגמה 1 ת\"א",
    });

    expect(result.ok).toBe(true);
    const [row] = insert.mock.calls[0] as [{ body: string; type: string }];
    expect(row.type).toBe("reschedule_update");
    expect(row.body).toContain("עדכון קצר:");
    expect(row.body).not.toContain("{{");
  });

  it("enqueueDashboardChangeNotification falls back to the default wording when there's no override", async () => {
    const single = vi.fn().mockResolvedValue({ data: { settings: { smsTemplates: {} } }, error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "clinics") return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single };
        if (table === "price_list_items") return priceListChain();
        return { insert };
      }),
    };
    const service = new DashboardNotificationsService(client as never);

    const result = await service.enqueueDashboardChangeNotification({
      clinicId: "clinic-1",
      customerId: "cust-1",
      appointmentId: "appt-1",
      phone: "+972500000000",
      customerName: "דנה",
      petName: "מיקה",
      templateKey: "cancellation_update",
      oldScheduledAt: "2027-01-15T10:00:00.000Z",
      location: "הקליניקה, הדוגמה 1 ת\"א",
    });

    expect(result.ok).toBe(true);
    const [row] = insert.mock.calls[0] as [{ body: string }];
    expect(row.body).toContain("בשל אילוץ רפואי");
  });

  it("enqueueApprovalNotifications uses the clinic's booking_confirmation override when present", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { settings: { smsTemplates: { booking_confirmation: "תור אושר! {{petName}}" } } },
      error: null,
    });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "clinics") return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single };
        if (table === "price_list_items") return priceListChain();
        return { insert };
      }),
    };
    const service = new DashboardNotificationsService(client as never);

    await service.enqueueApprovalNotifications({
      appointmentId: "appt-1", scheduledAt: "2027-01-15T10:00:00.000Z", durationMinutes: 30,
      visitType: "checkup", clinicId: "clinic-1", customerId: "cust-1", phone: "+972500000000",
      customerName: "דנה", petName: "מיקה",
    });

    const [rows] = insert.mock.calls[0] as [{ type: string; body: string }[]];
    const booking = rows.find((r) => r.type === "booking_confirmation");
    expect(booking!.body).toBe("תור אושר! מיקה");
  });

  it("enqueueApprovalNotifications falls back to default wording when there's no override", async () => {
    const single = vi.fn().mockResolvedValue({ data: { settings: { smsTemplates: {} } }, error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "clinics") return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single };
        if (table === "price_list_items") return priceListChain();
        return { insert };
      }),
    };
    const service = new DashboardNotificationsService(client as never);

    await service.enqueueApprovalNotifications({
      appointmentId: "appt-1", scheduledAt: "2027-01-15T10:00:00.000Z", durationMinutes: 30,
      visitType: "checkup", clinicId: "clinic-1", customerId: "cust-1", phone: "+972500000000",
      customerName: "דנה", petName: "מיקה",
    });

    const [rows] = insert.mock.calls[0] as [{ type: string; body: string }[]];
    const booking = rows.find((r) => r.type === "booking_confirmation");
    expect(booking!.body).toContain("דנה");
    expect(booking!.body).not.toContain("{{");
  });

  it("enqueueApprovalNotifications also queues arrival_reminder two hours before the appointment", async () => {
    const single = vi.fn().mockResolvedValue({ data: { settings: { smsTemplates: {} } }, error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "clinics") return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single };
        if (table === "price_list_items") return priceListChain();
        return { insert };
      }),
    };
    const service = new DashboardNotificationsService(client as never);
    const scheduledAt = "2027-01-15T10:00:00.000Z";

    await service.enqueueApprovalNotifications({
      appointmentId: "appt-1", scheduledAt, durationMinutes: 30,
      visitType: "checkup", clinicId: "clinic-1", customerId: "cust-1", phone: "+972500000000",
      customerName: "דנה", petName: "מיקה",
    });

    const [rows] = insert.mock.calls[0] as [{ type: string; scheduled_for: string; body: string }[]];
    const arrival = rows.find((r) => r.type === "arrival_reminder");
    expect(arrival).toBeDefined();
    expect(arrival!.scheduled_for).toBe(
      new Date(new Date(scheduledAt).getTime() - 2 * 60 * 60_000).toISOString(),
    );
    expect(arrival!.body).not.toContain("{{");
  });

  it("enqueueApprovalNotifications skips arrival_reminder when the appointment is already within two hours", async () => {
    const single = vi.fn().mockResolvedValue({ data: { settings: { smsTemplates: {} } }, error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "clinics") return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single };
        if (table === "price_list_items") return priceListChain();
        return { insert };
      }),
    };
    const service = new DashboardNotificationsService(client as never);

    await service.enqueueApprovalNotifications({
      appointmentId: "appt-1",
      scheduledAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      durationMinutes: 30,
      visitType: "checkup", clinicId: "clinic-1", customerId: "cust-1", phone: "+972500000000",
      customerName: "דנה", petName: "מיקה",
    });

    const [rows] = insert.mock.calls[0] as [{ type: string }[]];
    expect(rows.some((r) => r.type === "arrival_reminder")).toBe(false);
  });

  it("enqueueApprovalNotifications uses the clinic's arrival_reminder override when present", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { settings: { smsTemplates: { arrival_reminder: "מגיעים בעוד שעתיים ל-{{location}}" } } },
      error: null,
    });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "clinics") return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single };
        if (table === "price_list_items") return priceListChain();
        return { insert };
      }),
    };
    const service = new DashboardNotificationsService(client as never);

    await service.enqueueApprovalNotifications({
      appointmentId: "appt-1", scheduledAt: "2027-01-15T10:00:00.000Z", durationMinutes: 30,
      visitType: "checkup", clinicId: "clinic-1", customerId: "cust-1", phone: "+972500000000",
      customerName: "דנה", petName: "מיקה",
    });

    const [rows] = insert.mock.calls[0] as [{ type: string; body: string }[]];
    const arrival = rows.find((r) => r.type === "arrival_reminder");
    expect(arrival!.body).toContain("מגיעים בעוד שעתיים");
    expect(arrival!.body).not.toContain("{{");
  });

  it("enqueueRejectionNotification uses the clinic's cancellation_update override when present", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { settings: { smsTemplates: { cancellation_update: "בוטל תור {{petName}} מ-{{oldDate}}" } } },
      error: null,
    });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "clinics") return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single };
        if (table === "price_list_items") return priceListChain();
        return { insert };
      }),
    };
    const service = new DashboardNotificationsService(client as never);

    await service.enqueueRejectionNotification({
      appointmentId: "appt-1", scheduledAt: "2027-01-15T10:00:00.000Z",
      clinicId: "clinic-1", customerId: "cust-1", phone: "+972500000000",
      customerName: "דנה", petName: "מיקה",
    });

    const [row] = insert.mock.calls[0] as [{ body: string }];
    expect(row.body).toContain("בוטל תור מיקה מ-");
    expect(row.body).not.toContain("{{");
  });

  it("enqueueRejectionNotification falls back to default wording when there's no override", async () => {
    const single = vi.fn().mockResolvedValue({ data: { settings: { smsTemplates: {} } }, error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "clinics") return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single };
        if (table === "price_list_items") return priceListChain();
        return { insert };
      }),
    };
    const service = new DashboardNotificationsService(client as never);

    await service.enqueueRejectionNotification({
      appointmentId: "appt-1", scheduledAt: "2027-01-15T10:00:00.000Z",
      clinicId: "clinic-1", customerId: "cust-1", phone: "+972500000000",
      customerName: "דנה", petName: "מיקה",
    });

    const [row] = insert.mock.calls[0] as [{ body: string }];
    expect(row.body).toContain("בשל אילוץ רפואי");
  });

  it("enqueueVaccinationReminder uses the clinic's vaccination_reminder override when present", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { settings: { smsTemplates: { vaccination_reminder: "תזכורת: {{vaccineName}} ל{{petName}}" } } },
      error: null,
    });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "clinics") return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single };
        if (table === "price_list_items") return priceListChain();
        return { upsert };
      }),
    };
    const service = new DashboardNotificationsService(client as never);

    await service.enqueueVaccinationReminder({
      vaccinationId: "vac-1", clinicId: "clinic-1", customerId: "cust-1", phone: "+972500000000",
      customerName: "דנה", petName: "מיקה", vaccineName: "כלבת", nextDueAt: "2027-01-20",
    });

    const [row] = upsert.mock.calls[0] as [{ body: string }];
    expect(row.body).toBe("תזכורת: כלבת למיקה");
  });

  it("enqueueVaccinationReminder falls back to default wording when there's no override", async () => {
    const single = vi.fn().mockResolvedValue({ data: { settings: { smsTemplates: {} } }, error: null });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "clinics") return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single };
        if (table === "price_list_items") return priceListChain();
        return { upsert };
      }),
    };
    const service = new DashboardNotificationsService(client as never);

    await service.enqueueVaccinationReminder({
      vaccinationId: "vac-1", clinicId: "clinic-1", customerId: "cust-1", phone: "+972500000000",
      customerName: "דנה", petName: "מיקה", vaccineName: "כלבת", nextDueAt: "2027-01-20",
    });

    const [row] = upsert.mock.calls[0] as [{ body: string }];
    expect(row.body).not.toContain("{{");
    expect(row.body).toContain("מיקה");
  });
});
