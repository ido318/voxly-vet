import { describe, expect, it, vi } from "vitest";
import { AppError, err, ok } from "@/lib/errors/app-error";
import { AppointmentService } from "@/lib/services/appointment.service";
import type { AppointmentRepository } from "@/lib/repositories/appointment.repository";
import type { AuditService } from "@/lib/services/audit.service";
import type { CustomerRepository } from "@/lib/repositories/customer.repository";
import type { PetRepository } from "@/lib/repositories/pet.repository";
import type { ServiceActor } from "@/lib/services/service-context";
import type { Appointment } from "@/types/domain/appointment";

const clinicId = "00000000-0000-4000-8000-000000000001";
const customerId = "10000000-0000-4000-8000-000000000001";
const petId = "20000000-0000-4000-8000-000000000001";
const appointmentId = "40000000-0000-4000-8000-000000000001";

const actor: ServiceActor = {
  userId: "30000000-0000-4000-8000-000000000001",
  clinicIds: [clinicId],
  defaultClinicId: clinicId,
  memberships: [{ clinicId, role: "staff" }],
};

const owner: ServiceActor = {
  userId: "30000000-0000-4000-8000-000000000002",
  clinicIds: [clinicId],
  defaultClinicId: clinicId,
  memberships: [{ clinicId, role: "owner" }],
};

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: appointmentId,
    clinicId,
    customerId,
    petId,
    customerName: "דנה",
    customerPhone: "+972500000000",
    petName: "מיקה",
    appointmentType: "home_visit",
    status: "confirmed",
    source: "front_desk",
    scheduledAt: "2027-01-15T10:00:00.000Z",
    durationMinutes: 90,
    reason: null,
    notes: null,
    version: 1,
    cancelledAt: null,
    cancelledByUserId: null,
    cancellationReason: null,
    createdByUserId: null,
    createdAt: "2027-01-01T09:00:00.000Z",
    updatedAt: "2027-01-01T09:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function buildService(options: {
  existing: Appointment;
  updated: Appointment;
  withDashboardNotifications?: boolean;
}) {
  const { existing, updated, withDashboardNotifications = true } = options;
  const appointmentRepository = {
    findById: vi.fn().mockResolvedValue(ok(existing)),
    updateVersioned: vi.fn().mockResolvedValue(ok(updated)),
    findActiveOverlaps: vi.fn().mockResolvedValue(ok([])),
  };
  const auditService = { logAction: vi.fn().mockResolvedValue(ok({})) };
  const dashboardNotifications = {
    enqueueDashboardChangeNotification: vi.fn().mockResolvedValue(ok(undefined)),
  };

  const service = new AppointmentService(
    appointmentRepository as unknown as AppointmentRepository,
    {} as CustomerRepository,
    {} as PetRepository,
    auditService as unknown as AuditService,
    withDashboardNotifications ? (dashboardNotifications as never) : undefined,
  );

  return { service, appointmentRepository, auditService, dashboardNotifications };
}

describe("AppointmentService — dashboard change notification", () => {
  it("enqueues reschedule_update with home-visit location when a home_visit appointment's scheduled_at changes", async () => {
    const existing = appointment({ appointmentType: "home_visit", scheduledAt: "2027-01-15T10:00:00.000Z" });
    const updated = appointment({
      appointmentType: "home_visit",
      scheduledAt: "2027-01-20T12:00:00.000Z",
      version: 2,
    });
    const { service, dashboardNotifications } = buildService({ existing, updated });

    const result = await service.updateAppointment(actor, appointmentId, existing.version, {
      scheduledAt: "2027-01-20T12:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    expect(dashboardNotifications.enqueueDashboardChangeNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "reschedule_update",
        location: "ביקור בית בכתובתכם",
        newScheduledAt: "2027-01-20T12:00:00.000Z",
      }),
    );
  });

  it("does NOT enqueue a reschedule notification when scheduled_at doesn't actually change", async () => {
    const existing = appointment();
    const updated = appointment({ notes: "הערה חדשה", version: 2 });
    const { service, dashboardNotifications } = buildService({ existing, updated });

    const result = await service.updateAppointment(actor, appointmentId, existing.version, {
      notes: "הערה חדשה",
    });

    expect(result.ok).toBe(true);
    expect(dashboardNotifications.enqueueDashboardChangeNotification).not.toHaveBeenCalled();
  });

  it("enqueues cancellation_update with clinic location when a checkup appointment is cancelled via the dashboard", async () => {
    const existing = appointment({ appointmentType: "checkup", status: "confirmed" });
    const updated = appointment({
      appointmentType: "checkup",
      status: "cancelled",
      version: 2,
      cancelledAt: "2027-01-10T08:00:00.000Z",
      cancelledByUserId: actor.userId,
    });
    const { service, dashboardNotifications } = buildService({ existing, updated });

    const result = await service.changeStatus(actor, appointmentId, existing.version, {
      status: "cancelled",
    });

    expect(result.ok).toBe(true);
    expect(dashboardNotifications.enqueueDashboardChangeNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "cancellation_update",
        location: 'הקליניקה, הדוגמה 1 ת"א',
      }),
    );
  });

  it("does not fail the appointment update when dashboardNotifications is not injected", async () => {
    const existing = appointment();
    const updated = appointment({ scheduledAt: "2027-01-20T12:00:00.000Z", version: 2 });
    const { service } = buildService({ existing, updated, withDashboardNotifications: false });

    const result = await service.updateAppointment(actor, appointmentId, existing.version, {
      scheduledAt: "2027-01-20T12:00:00.000Z",
    });

    expect(result.ok).toBe(true);
  });

  it("does not fail updateAppointment's reschedule when the enqueue fails", async () => {
    const existing = appointment();
    const updated = appointment({ scheduledAt: "2027-01-20T12:00:00.000Z", version: 2 });
    const { service, dashboardNotifications } = buildService({ existing, updated });
    dashboardNotifications.enqueueDashboardChangeNotification.mockResolvedValueOnce(
      err(AppError.internal("boom")),
    );
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await service.updateAppointment(actor, appointmentId, existing.version, {
      scheduledAt: "2027-01-20T12:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[appointment.updateAppointment] reschedule SMS enqueue failed",
      expect.anything(),
    );
    consoleErrorSpy.mockRestore();
  });

  it("enqueues cancellation_update with params.* (not updated.value, which has no customer/pet join) when rejecting a pending_approval appointment", async () => {
    const existing = appointment({
      appointmentType: "home_visit",
      status: "pending_approval",
      customerName: null,
      customerPhone: null,
      petName: null,
    });
    const updated = appointment({
      appointmentType: "home_visit",
      status: "cancelled",
      version: 2,
      cancelledAt: "2027-01-10T08:00:00.000Z",
      cancelledByUserId: owner.userId,
      cancellationReason: "rejected_by_vet",
      customerName: null,
      customerPhone: null,
      petName: null,
    });
    const { service, dashboardNotifications } = buildService({ existing, updated });
    const params = { phone: "+972501234567", customerName: "רותם", petName: "לונה" };

    const result = await service.rejectPendingAppointment(owner, appointmentId, params);

    expect(result.ok).toBe(true);
    expect(dashboardNotifications.enqueueDashboardChangeNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "cancellation_update",
        location: "ביקור בית בכתובתכם",
        phone: params.phone,
        customerName: params.customerName,
        petName: params.petName,
      }),
    );
  });

  it("does not fail rejectPendingAppointment when the enqueue fails", async () => {
    const existing = appointment({ appointmentType: "checkup", status: "pending_approval" });
    const updated = appointment({
      appointmentType: "checkup",
      status: "cancelled",
      version: 2,
      cancelledAt: "2027-01-10T08:00:00.000Z",
      cancelledByUserId: owner.userId,
      cancellationReason: "rejected_by_vet",
    });
    const { service, dashboardNotifications } = buildService({ existing, updated });
    dashboardNotifications.enqueueDashboardChangeNotification.mockResolvedValueOnce(
      err(AppError.internal("boom")),
    );
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const params = { phone: "+972501234567", customerName: "רותם", petName: "לונה" };

    const result = await service.rejectPendingAppointment(owner, appointmentId, params);

    expect(result.ok).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[appointment.rejectPendingAppointment] SMS enqueue failed",
      expect.anything(),
    );
    consoleErrorSpy.mockRestore();
  });
});
