import { describe, expect, it, vi } from "vitest";
import { ok } from "@/lib/errors/app-error";
import { AppointmentService } from "@/lib/services/appointment.service";
import type { AppointmentRepository } from "@/lib/repositories/appointment.repository";
import type { CustomerRepository } from "@/lib/repositories/customer.repository";
import type { PetRepository } from "@/lib/repositories/pet.repository";
import type { AuditService } from "@/lib/services/audit.service";
import type { ServiceActor } from "@/lib/services/service-context";
import type { Appointment } from "@/types/domain/appointment";

const TARGET_CLINIC = "clinic-target";
const OTHER_CLINIC = "clinic-other";

const actor: ServiceActor = {
  userId: "user-1",
  clinicIds: [TARGET_CLINIC, OTHER_CLINIC],
  defaultClinicId: TARGET_CLINIC,
  memberships: [
    { clinicId: TARGET_CLINIC, role: "staff" },
    { clinicId: OTHER_CLINIC, role: "owner" },
  ],
};

function pendingAppointment(): Appointment {
  return {
    id: "appt-1",
    clinicId: TARGET_CLINIC,
    customerId: "cust-1",
    petId: "pet-1",
    appointmentType: "neutering",
    source: "phone",
    status: "pending_approval",
    scheduledAt: "2026-06-21T09:00:00.000Z",
    durationMinutes: 40,
    reason: null,
    notes: null,
    cancelledAt: null,
    cancelledByUserId: null,
    cancellationReason: null,
    createdByUserId: null,
    createdAt: "2026-06-20T09:00:00.000Z",
    updatedAt: "2026-06-20T09:00:00.000Z",
    deletedAt: null,
    version: 0,
  };
}

function buildService() {
  const appointment = pendingAppointment();
  const appointmentRepository = {
    findById: vi.fn().mockResolvedValue(ok(appointment)),
    updateVersioned: vi.fn().mockResolvedValue(ok({
      ...appointment,
      status: "confirmed",
      version: 1,
    })),
  };
  const auditService = { logAction: vi.fn().mockResolvedValue(ok({})) };
  const dashboardNotifications = {
    enqueueApprovalNotifications: vi.fn(),
    enqueueRejectionNotification: vi.fn(),
  };
  const service = new AppointmentService(
    appointmentRepository as unknown as AppointmentRepository,
    {} as CustomerRepository,
    {} as PetRepository,
    auditService as unknown as AuditService,
    dashboardNotifications as never,
  );

  return { service, appointmentRepository, auditService, dashboardNotifications };
}

describe("AppointmentService privileged actions", () => {
  it("forbids approving pending appointments without owner/admin role in the appointment clinic", async () => {
    const { service, appointmentRepository, dashboardNotifications } = buildService();

    const result = await service.approvePendingAppointment(actor, "appt-1", {
      phone: "0501234567",
      customerName: "דנה",
      petName: "רקס",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(403);
    expect(appointmentRepository.updateVersioned).not.toHaveBeenCalled();
    expect(dashboardNotifications.enqueueApprovalNotifications).not.toHaveBeenCalled();
  });

  it("forbids rejecting pending appointments without owner/admin role in the appointment clinic", async () => {
    const { service, appointmentRepository, dashboardNotifications } = buildService();

    const result = await service.rejectPendingAppointment(actor, "appt-1", {
      phone: "0501234567",
      customerName: "דנה",
      petName: "רקס",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(403);
    expect(appointmentRepository.updateVersioned).not.toHaveBeenCalled();
    expect(dashboardNotifications.enqueueRejectionNotification).not.toHaveBeenCalled();
  });
});
