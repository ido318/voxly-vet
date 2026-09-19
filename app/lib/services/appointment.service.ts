import { CLINIC_LOCATION, HOME_VISIT_LOCATION, isValidIsraeliPhone, israelDateIso } from "@tomer/shared";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { isExpectedDuration, toIsraelLocalIso, BOOKING_WINDOW_DAYS, isWithinBookingWindow } from "@/lib/appointment-rules";
import type { AppointmentRepository } from "@/lib/repositories/appointment.repository";
import type { CustomerRepository } from "@/lib/repositories/customer.repository";
import type { PetRepository } from "@/lib/repositories/pet.repository";
import type { VisitRepository } from "@/lib/repositories/visit.repository";
import type { AuditService } from "@/lib/services/audit.service";
import type { DashboardNotificationsService } from "@/lib/services/dashboard-notifications.service";
import type { MedicalRecordService } from "@/lib/services/medical-record.service";
import type { NotificationDispatcher } from "@/lib/services/notification-dispatcher";
import type { ServiceActor } from "@/lib/services/service-context";
import type {
  Appointment,
  AppointmentListFilters,
  AppointmentStatus,
  ChangeAppointmentStatusInput,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from "@/types/domain/appointment";
import type { Visit } from "@/types/domain/visit";

/**
 * What actually happened to the client's SMS, so the dashboard can say it rather
 * than assert "נשלח SMS" unconditionally the way it used to.
 *   sent   — queued and the agent confirmed it processed the queue
 *   queued — queued, will go out on the next cron tick
 *   failed — not queued at all
 */
export type AppointmentSmsStatus = "sent" | "queued" | "failed";

export type AppointmentDecisionResult = {
  appointment: Appointment;
  smsStatus: AppointmentSmsStatus;
};

const ALLOWED_STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled:        ["confirmed", "checked_in", "cancelled", "no_show"],
  confirmed:        ["checked_in", "completed", "cancelled", "no_show"],
  completed:        [],
  cancelled:        [],
  no_show:          [],
  pending_approval: ["confirmed", "cancelled"],
  late_cancellation:[],
  checked_in:        ["in_visit", "cancelled", "no_show"],
  in_visit:          ["completed", "cancelled"],
};

function addDaysIso(date: string, days: number): string {
  const [yearRaw = "0", monthRaw = "1", dayRaw = "1"] = date.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(next);
}

function normalizeListFilters(
  filters: Omit<AppointmentListFilters, "clinicIds"> & { clinicIds: string[] },
): AppointmentListFilters {
  if (!filters.date || filters.from || filters.to) {
    return { ...filters, date: undefined };
  }

  return {
    ...filters,
    date: undefined,
    from: new Date(toIsraelLocalIso(filters.date, "00:00")).toISOString(),
    to: new Date(toIsraelLocalIso(addDaysIso(filters.date, 1), "00:00")).toISOString(),
  };
}

function hasPrivilegedClinicRole(actor: ServiceActor, clinicId: string): boolean {
  return actor.memberships.some(
    (membership) =>
      membership.clinicId === clinicId &&
      (membership.role === "owner" || membership.role === "admin"),
  );
}

export class AppointmentService {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly petRepository: PetRepository,
    private readonly auditService: AuditService,
    private readonly dashboardNotifications?: DashboardNotificationsService,
    private readonly visitRepository?: VisitRepository,
    private readonly medicalRecordService?: Pick<MedicalRecordService, "ensureRecordForPet">,
    private readonly notificationDispatcher?: Pick<NotificationDispatcher, "dispatch">,
  ) {}

  async listAppointments(
    actor: ServiceActor,
    filters: Omit<AppointmentListFilters, "clinicIds"> & { clinicIds?: string[] },
  ): Promise<Result<Appointment[]>> {
    const clinicIds = filters.clinicIds ?? actor.clinicIds;
    if (clinicIds.some((clinicId) => !actor.clinicIds.includes(clinicId))) {
      return err(AppError.forbidden("Cannot list appointments for requested clinic"));
    }
    return this.appointmentRepository.list(normalizeListFilters({ ...filters, clinicIds }));
  }

  async getAppointmentById(
    actor: ServiceActor,
    appointmentId: string,
  ): Promise<Result<Appointment>> {
    const existing = await this.appointmentRepository.findById(appointmentId);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Appointment not found"));
    if (!actor.clinicIds.includes(existing.value.clinicId)) {
      return err(AppError.forbidden("Appointment outside actor clinics"));
    }
    return ok(existing.value);
  }

  async createAppointment(
    actor: ServiceActor,
    input: CreateAppointmentInput,
  ): Promise<Result<Appointment>> {
    if (!actor.clinicIds.includes(input.clinicId)) {
      return err(AppError.forbidden("Cannot create appointment in this clinic"));
    }
    if (!isExpectedDuration(input.appointmentType, input.durationMinutes)) {
      return err(AppError.validation("Duration does not match appointment type"));
    }
    // Neither bound existed here or in createAppointmentSchema: the 14-day
    // window was a list of chips the wizard rendered, and nothing stopped a
    // booking in the past. The agent has enforced both since #19
    // (bookingWindowRejection); this closes the same hole on the dashboard.
    const scheduled = new Date(input.scheduledAt);
    if (Number.isNaN(scheduled.getTime())) {
      return err(AppError.validation("Invalid scheduledAt"));
    }
    if (scheduled.getTime() < Date.now()) {
      return err(AppError.validation("לא ניתן לקבוע תור בעבר"));
    }
    if (!isWithinBookingWindow(israelDateIso(scheduled))) {
      return err(
        AppError.validation(`ניתן לקבוע תורים עד ${BOOKING_WINDOW_DAYS} יום קדימה בלבד`),
      );
    }

    const customer = await this.customerRepository.findById(input.customerId);
    if (!customer.ok) return err(customer.error);
    if (!customer.value) return err(AppError.notFound("Customer not found"));
    if (customer.value.clinicId !== input.clinicId) {
      return err(AppError.validation("Customer clinic mismatch"));
    }

    const pet = await this.petRepository.findById(input.petId);
    if (!pet.ok) return err(pet.error);
    if (!pet.value) return err(AppError.notFound("Pet not found"));
    if (pet.value.clinicId !== input.clinicId || pet.value.customerId !== input.customerId) {
      return err(AppError.validation("Pet/customer/clinic mismatch"));
    }

    const overlapCheck = await this.appointmentRepository.findActiveOverlaps(
      input.clinicId,
      input.scheduledAt,
      input.durationMinutes,
    );
    if (!overlapCheck.ok) return err(overlapCheck.error);
    if (overlapCheck.value.length > 0) {
      return err(
        AppError.conflict("Appointment overlaps with an active appointment", {
          overlapCount: overlapCheck.value.length,
        }),
      );
    }

    const created = await this.appointmentRepository.create(input, actor.userId);
    if (!created.ok) return created;

    await this.auditService.logAction({
      clinicId: created.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "appointment.create",
      entityType: "appointment",
      entityId: created.value.id,
      afterPayload: created.value,
    });

    return created;
  }

  async updateAppointment(
    actor: ServiceActor,
    appointmentId: string,
    version: number,
    input: UpdateAppointmentInput,
  ): Promise<Result<Appointment>> {
    const existing = await this.getAppointmentById(actor, appointmentId);
    if (!existing.ok) return existing;

    if (version !== existing.value.version) {
      return err(
        AppError.conflict("Appointment update conflict: stale version", {
          expectedVersion: existing.value.version,
          providedVersion: version,
        }),
      );
    }

    const nextScheduledAt = input.scheduledAt ?? existing.value.scheduledAt;
    const nextType = input.appointmentType ?? existing.value.appointmentType;
    const nextDuration = input.durationMinutes ?? existing.value.durationMinutes;
    if (!isExpectedDuration(nextType, nextDuration)) {
      return err(AppError.validation("Duration does not match appointment type"));
    }

    const overlapCheck = await this.appointmentRepository.findActiveOverlaps(
      existing.value.clinicId,
      nextScheduledAt,
      nextDuration,
      existing.value.id,
    );
    if (!overlapCheck.ok) return err(overlapCheck.error);
    if (overlapCheck.value.length > 0) {
      return err(AppError.conflict("Appointment overlaps with an active appointment"));
    }

    const updated = await this.appointmentRepository.updateVersioned(appointmentId, {
      expectedVersion: version,
      data: {
        appointment_type: input.appointmentType,
        source: input.source,
        scheduled_at: input.scheduledAt,
        duration_minutes: input.durationMinutes,
        reason: input.reason,
        notes: input.notes,
        changed_via: "dashboard",
      },
    });
    if (!updated.ok) return updated;

    await this.auditService.logAction({
      clinicId: updated.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "appointment.update",
      entityType: "appointment",
      entityId: updated.value.id,
      beforePayload: existing.value,
      afterPayload: updated.value,
    });

    // A customer with no usable number used to enqueue a row with phone: "",
    // which Twilio then rejected as "Invalid 'To' Phone Number" — a dead row
    // in notifications_log with no way to retry. Skip the SMS instead.
    if (
      updated.value.scheduledAt !== existing.value.scheduledAt &&
      isValidIsraeliPhone(updated.value.customerPhone)
    ) {
      const enqueueResult = await this.dashboardNotifications?.enqueueDashboardChangeNotification({
        clinicId: updated.value.clinicId,
        customerId: updated.value.customerId,
        appointmentId: updated.value.id,
        phone: updated.value.customerPhone ?? "",
        customerName: updated.value.customerName ?? "",
        petName: updated.value.petName ?? "",
        templateKey: "reschedule_update",
        oldScheduledAt: existing.value.scheduledAt,
        newScheduledAt: updated.value.scheduledAt,
        location: updated.value.appointmentType === "home_visit" ? HOME_VISIT_LOCATION : CLINIC_LOCATION,
      });
      if (enqueueResult && !enqueueResult.ok) {
        console.error("[appointment.updateAppointment] reschedule SMS enqueue failed", enqueueResult.error);
      }
    }

    return updated;
  }

  async changeStatus(
    actor: ServiceActor,
    appointmentId: string,
    version: number,
    input: ChangeAppointmentStatusInput,
  ): Promise<Result<Appointment>> {
    const existing = await this.getAppointmentById(actor, appointmentId);
    if (!existing.ok) return existing;

    if (version !== existing.value.version) {
      return err(
        AppError.conflict("Appointment update conflict: stale version", {
          expectedVersion: existing.value.version,
          providedVersion: version,
        }),
      );
    }

    const allowed = ALLOWED_STATUS_TRANSITIONS[existing.value.status];
    if (!allowed.includes(input.status)) {
      return err(
        AppError.validation(
          `Invalid status transition: ${existing.value.status} -> ${input.status}`,
        ),
      );
    }

    const updated = await this.appointmentRepository.updateVersioned(appointmentId, {
      expectedVersion: version,
      data: {
        status: input.status,
        cancelled_at:
          input.status === "cancelled" ? new Date().toISOString() : existing.value.cancelledAt,
        cancelled_by_user_id:
          input.status === "cancelled" ? actor.userId : existing.value.cancelledByUserId,
        cancellation_reason:
          input.status === "cancelled"
            ? (input.cancellationReason ?? null)
            : existing.value.cancellationReason,
        changed_via: "dashboard",
      },
    });
    if (!updated.ok) return updated;

    await this.auditService.logAction({
      clinicId: updated.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "appointment.status_change",
      entityType: "appointment",
      entityId: updated.value.id,
      beforePayload: existing.value,
      afterPayload: updated.value,
    });

    if (input.status === "cancelled" && isValidIsraeliPhone(updated.value.customerPhone)) {
      const enqueueResult = await this.dashboardNotifications?.enqueueDashboardChangeNotification({
        clinicId: updated.value.clinicId,
        customerId: updated.value.customerId,
        appointmentId: updated.value.id,
        phone: updated.value.customerPhone ?? "",
        customerName: updated.value.customerName ?? "",
        petName: updated.value.petName ?? "",
        templateKey: "cancellation_update",
        oldScheduledAt: updated.value.scheduledAt,
        location: updated.value.appointmentType === "home_visit" ? HOME_VISIT_LOCATION : CLINIC_LOCATION,
      });
      if (enqueueResult && !enqueueResult.ok) {
        console.error("[appointment.changeStatus] cancellation SMS enqueue failed", enqueueResult.error);
      }
    }

    return updated;
  }

  async checkInAppointment(
    actor: ServiceActor,
    appointmentId: string,
    version: number,
  ): Promise<Result<Appointment>> {
    const existing = await this.getAppointmentById(actor, appointmentId);
    if (!existing.ok) return existing;

    if (version !== existing.value.version) {
      return err(
        AppError.conflict("Appointment update conflict: stale version", {
          expectedVersion: existing.value.version,
          providedVersion: version,
        }),
      );
    }

    if (existing.value.status !== "scheduled" && existing.value.status !== "confirmed") {
      return err(AppError.validation("Only scheduled or confirmed appointments can be checked in"));
    }

    const updated = await this.appointmentRepository.updateVersioned(appointmentId, {
      expectedVersion: version,
      data: { status: "checked_in", changed_via: "dashboard" },
    });
    if (!updated.ok) return updated;

    await this.auditService.logAction({
      clinicId: updated.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "appointment.check_in",
      entityType: "appointment",
      entityId: updated.value.id,
      beforePayload: existing.value,
      afterPayload: updated.value,
    });

    return updated;
  }

  async openVisitFromAppointment(
    actor: ServiceActor,
    appointmentId: string,
    version: number,
  ): Promise<Result<Visit>> {
    if (!this.visitRepository || !this.medicalRecordService) {
      return err(AppError.internal("Appointment visit workflow is not configured"));
    }

    const existing = await this.getAppointmentById(actor, appointmentId);
    if (!existing.ok) return err(existing.error);

    const existingVisit = await this.visitRepository.findByAppointment(appointmentId);
    if (!existingVisit.ok) return err(existingVisit.error);
    if (existingVisit.value) return ok(existingVisit.value);

    if (version !== existing.value.version) {
      return err(
        AppError.conflict("Appointment update conflict: stale version", {
          expectedVersion: existing.value.version,
          providedVersion: version,
        }),
      );
    }

    if (existing.value.status !== "checked_in") {
      return err(AppError.validation("Only checked_in appointments can be opened as visits"));
    }

    const record = await this.medicalRecordService.ensureRecordForPet(actor, {
      clinicId: existing.value.clinicId,
      petId: existing.value.petId,
    });
    if (!record.ok) return err(record.error);

    const createdVisit = await this.visitRepository.openFromAppointment({
      appointmentId: existing.value.id,
      expectedVersion: version,
      medicalRecordId: record.value.id,
      chiefComplaint: existing.value.reason,
      createdByUserId: actor.userId,
    });
    if (!createdVisit.ok) return createdVisit;

    const updatedAppointment = await this.appointmentRepository.findById(appointmentId);
    const afterPayload = updatedAppointment.ok ? updatedAppointment.value : createdVisit.value;

    await this.auditService.logAction({
      clinicId: existing.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "appointment.open_visit",
      entityType: "appointment",
      entityId: existing.value.id,
      beforePayload: existing.value,
      afterPayload,
      metadata: { visitId: createdVisit.value.id },
    });

    return createdVisit;
  }

  async softDelete(
    actor: ServiceActor,
    appointmentId: string,
    version: number,
  ): Promise<Result<void>> {
    const existing = await this.getAppointmentById(actor, appointmentId);
    if (!existing.ok) return err(existing.error);

    if (version !== existing.value.version) {
      return err(
        AppError.conflict("Appointment delete conflict: stale version", {
          expectedVersion: existing.value.version,
          providedVersion: version,
        }),
      );
    }

    const deleted = await this.appointmentRepository.updateVersioned(appointmentId, {
      expectedVersion: version,
      data: { deleted_at: new Date().toISOString() },
    });
    if (!deleted.ok) return err(deleted.error);

    await this.auditService.logAction({
      clinicId: existing.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "appointment.delete",
      entityType: "appointment",
      entityId: existing.value.id,
      beforePayload: existing.value,
    });

    return ok(undefined);
  }

  /**
   * Approve a pending_approval appointment (neutering/surgery):
   * status → confirmed, changed_via='dashboard', enqueue booking_confirmation + reminders.
   */
  async approvePendingAppointment(
    actor: ServiceActor,
    appointmentId: string,
    params: { phone: string; customerName: string; petName: string },
  ): Promise<Result<AppointmentDecisionResult>> {
    const existing = await this.getAppointmentById(actor, appointmentId);
    if (!existing.ok) return existing;
    if (!hasPrivilegedClinicRole(actor, existing.value.clinicId)) {
      return err(AppError.forbidden("Only owner or admin can approve appointments"));
    }
    if (existing.value.status !== "pending_approval") {
      return err(AppError.validation("Only pending_approval appointments can be approved"));
    }

    const updated = await this.appointmentRepository.updateVersioned(appointmentId, {
      expectedVersion: existing.value.version,
      data: { status: "confirmed", changed_via: "dashboard" },
    });
    if (!updated.ok) return updated;

    // The appointment is already approved, so a queueing failure must not roll it
    // back — but it must not pass silently either: the dashboard told the vet an
    // SMS was on its way, and for months an RLS rejection here was discarded.
    let notificationsQueued = false;
    let smsDispatched = false;
    if (this.dashboardNotifications) {
      const queued = await this.dashboardNotifications.enqueueApprovalNotifications({
        appointmentId,
        scheduledAt: updated.value.scheduledAt,
        durationMinutes: updated.value.durationMinutes,
        visitType: updated.value.appointmentType,
        clinicId: updated.value.clinicId,
        customerId: updated.value.customerId,
        phone: params.phone,
        customerName: params.customerName,
        petName: params.petName,
      });
      notificationsQueued = queued.ok;
      if (!queued.ok) {
        console.error("[appointment.approve] SMS enqueue failed", queued.error);
      } else {
        const dispatched = await this.notificationDispatcher?.dispatch({ appointmentId });
        smsDispatched = dispatched?.dispatched ?? false;
      }
    }

    await this.auditService.logAction({
      clinicId: updated.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "appointment.approve",
      entityType: "appointment",
      entityId: updated.value.id,
      beforePayload: existing.value,
      afterPayload: updated.value,
    });

    return ok({
      appointment: updated.value,
      smsStatus: !notificationsQueued ? "failed" : smsDispatched ? "sent" : "queued",
    });
  }

  /**
   * Reject a pending_approval appointment:
   * status → cancelled, changed_via='dashboard', enqueue cancellation_update SMS.
   */
  async rejectPendingAppointment(
    actor: ServiceActor,
    appointmentId: string,
    params: { phone: string; customerName: string; petName: string },
  ): Promise<Result<AppointmentDecisionResult>> {
    const existing = await this.getAppointmentById(actor, appointmentId);
    if (!existing.ok) return existing;
    if (!hasPrivilegedClinicRole(actor, existing.value.clinicId)) {
      return err(AppError.forbidden("Only owner or admin can reject appointments"));
    }
    if (existing.value.status !== "pending_approval") {
      return err(AppError.validation("Only pending_approval appointments can be rejected"));
    }

    const updated = await this.appointmentRepository.updateVersioned(appointmentId, {
      expectedVersion: existing.value.version,
      data: {
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by_user_id: actor.userId,
        cancellation_reason: "rejected_by_vet",
        changed_via: "dashboard",
      },
    });
    if (!updated.ok) return updated;

    // The appointments_notify_dashboard_change trigger no longer creates the
    // cancellation_update row itself (see 20260915120000_remove_hardcoded_dashboard_sms.sql)
    // — this now enqueues it explicitly, same as changeStatus()'s cancelled branch.
    const enqueueResult = await this.dashboardNotifications?.enqueueDashboardChangeNotification({
      clinicId: updated.value.clinicId,
      customerId: updated.value.customerId,
      appointmentId: updated.value.id,
      phone: params.phone,
      customerName: params.customerName,
      petName: params.petName,
      templateKey: "cancellation_update",
      oldScheduledAt: updated.value.scheduledAt,
      location: updated.value.appointmentType === "home_visit" ? HOME_VISIT_LOCATION : CLINIC_LOCATION,
    });
    if (enqueueResult && !enqueueResult.ok) {
      console.error("[appointment.rejectPendingAppointment] SMS enqueue failed", enqueueResult.error);
    }

    const dispatched = await this.notificationDispatcher?.dispatch({ appointmentId });
    const smsDispatched = dispatched?.dispatched ?? false;

    await this.auditService.logAction({
      clinicId: updated.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "appointment.reject",
      entityType: "appointment",
      entityId: updated.value.id,
      beforePayload: existing.value,
      afterPayload: updated.value,
    });

    return ok({
      appointment: updated.value,
      smsStatus: smsDispatched ? "sent" : "queued",
    });
  }
}
