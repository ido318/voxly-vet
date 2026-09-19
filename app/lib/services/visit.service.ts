import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import type { AppointmentRepository } from "@/lib/repositories/appointment.repository";
import type { CustomerRepository } from "@/lib/repositories/customer.repository";
import type { PetRepository } from "@/lib/repositories/pet.repository";
import type { VisitRepository } from "@/lib/repositories/visit.repository";
import { assertMedicalDeleteAuthorized } from "@/lib/services/medical-authorization";
import type { AuditService } from "@/lib/services/audit.service";
import type { FollowUpService } from "@/lib/services/follow-up.service";
import type { MedicalRecordService } from "@/lib/services/medical-record.service";
import type { ServiceActor } from "@/lib/services/service-context";
import type {
  ChangeVisitStatusInput,
  CreateVisitInput,
  UpdateVisitInput,
  Visit,
  VisitListFilters,
  VisitStatus,
} from "@/types/domain/visit";

const ALLOWED_STATUS_TRANSITIONS: Record<VisitStatus, VisitStatus[]> = {
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export class VisitService {
  constructor(
    private readonly visitRepository: VisitRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly petRepository: PetRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly auditService: AuditService,
    private readonly medicalRecordService?: Pick<MedicalRecordService, "ensureRecordForPet" | "listNotes">,
    private readonly followUpService?: Pick<FollowUpService, "createFromVisitClose">,
  ) {}

  async listVisits(
    actor: ServiceActor,
    filters: Omit<VisitListFilters, "clinicIds"> & { clinicIds?: string[] },
  ): Promise<Result<Visit[]>> {
    const clinicIds = filters.clinicIds ?? actor.clinicIds;
    if (clinicIds.some((clinicId) => !actor.clinicIds.includes(clinicId))) {
      return err(AppError.forbidden("Cannot list visits for requested clinic"));
    }
    return this.visitRepository.list({ ...filters, clinicIds });
  }

  async getVisitById(actor: ServiceActor, visitId: string): Promise<Result<Visit>> {
    const existing = await this.visitRepository.findById(visitId);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Visit not found"));
    if (!actor.clinicIds.includes(existing.value.clinicId)) {
      return err(AppError.forbidden("Visit outside actor clinics"));
    }
    return ok(existing.value);
  }

  async createVisit(actor: ServiceActor, input: CreateVisitInput): Promise<Result<Visit>> {
    if (!actor.clinicIds.includes(input.clinicId)) {
      return err(AppError.forbidden("Cannot create visit in this clinic"));
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

    if (input.appointmentId) {
      const appointmentCheck = await this.assertAppointmentLink(
        input.appointmentId,
        input.clinicId,
        input.customerId,
        input.petId,
      );
      if (!appointmentCheck.ok) return appointmentCheck;
    }

    let medicalRecordId = input.medicalRecordId ?? null;
    if (!medicalRecordId && this.medicalRecordService) {
      const record = await this.medicalRecordService.ensureRecordForPet(actor, {
        clinicId: input.clinicId,
        petId: input.petId,
      });
      if (!record.ok) return err(record.error);
      medicalRecordId = record.value.id;
    }

    const created = await this.visitRepository.create(
      { ...input, medicalRecordId },
      actor.userId,
    );
    if (!created.ok) return created;

    await this.auditService.logAction({
      clinicId: created.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "visit.create",
      entityType: "visit",
      entityId: created.value.id,
      afterPayload: created.value,
    });

    return created;
  }

  async updateVisit(
    actor: ServiceActor,
    visitId: string,
    version: number,
    input: UpdateVisitInput,
  ): Promise<Result<Visit>> {
    const existing = await this.getVisitById(actor, visitId);
    if (!existing.ok) return existing;

    if (version !== existing.value.version) {
      return err(
        AppError.conflict("Visit update conflict: stale version", {
          expectedVersion: existing.value.version,
          providedVersion: version,
        }),
      );
    }

    if (input.appointmentId) {
      const appointmentCheck = await this.assertAppointmentLink(
        input.appointmentId,
        existing.value.clinicId,
        existing.value.customerId,
        existing.value.petId,
      );
      if (!appointmentCheck.ok) return appointmentCheck;
    }

    const data: {
      chief_complaint?: string | null;
      manual_visit_summary?: string | null;
      appointment_id?: string | null;
      medical_record_id?: string | null;
    } = {};
    if (input.chiefComplaint !== undefined) data.chief_complaint = input.chiefComplaint;
    if (input.manualVisitSummary !== undefined) {
      data.manual_visit_summary = input.manualVisitSummary;
    }
    if (input.appointmentId !== undefined) data.appointment_id = input.appointmentId;
    if (input.medicalRecordId !== undefined) data.medical_record_id = input.medicalRecordId;

    const updated = await this.visitRepository.updateVersioned(visitId, {
      expectedVersion: version,
      data,
    });
    if (!updated.ok) return updated;

    await this.auditService.logAction({
      clinicId: updated.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "visit.update",
      entityType: "visit",
      entityId: updated.value.id,
      beforePayload: existing.value,
      afterPayload: updated.value,
    });

    return updated;
  }

  async changeVisitStatus(
    actor: ServiceActor,
    visitId: string,
    version: number,
    input: ChangeVisitStatusInput,
  ): Promise<Result<Visit>> {
    const existing = await this.getVisitById(actor, visitId);
    if (!existing.ok) return existing;

    if (version !== existing.value.version) {
      return err(
        AppError.conflict("Visit update conflict: stale version", {
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

    let completedAt: string | null = existing.value.completedAt;
    if (input.status === "completed") {
      completedAt = new Date().toISOString();
      if (new Date(completedAt).getTime() < new Date(existing.value.startedAt).getTime()) {
        return err(AppError.validation("completed_at must be greater than or equal to started_at"));
      }
    } else if (input.status === "cancelled") {
      completedAt = null;
    }

    const updated = await this.visitRepository.updateVersioned(visitId, {
      expectedVersion: version,
      data: {
        status: input.status,
        completed_at: completedAt,
      },
    });
    if (!updated.ok) return updated;

    await this.auditService.logAction({
      clinicId: updated.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "visit.status_change",
      entityType: "visit",
      entityId: updated.value.id,
      beforePayload: existing.value,
      afterPayload: updated.value,
    });

    return updated;
  }

  async closeVisit(
    actor: ServiceActor,
    visitId: string,
    version: number,
    followUp?: { reason: string; dueAt: string },
  ): Promise<Result<Visit>> {
    const existing = await this.getVisitById(actor, visitId);
    if (!existing.ok) return existing;

    if (!existing.value.chiefComplaint?.trim()) {
      return err(AppError.validation("Cannot close visit without reason"));
    }
    if (!this.medicalRecordService) {
      return err(AppError.internal("Medical record service is not configured"));
    }

    const notes = await this.medicalRecordService.listNotes(actor, visitId);
    if (!notes.ok) return err(notes.error);
    if (notes.value.length === 0) {
      return err(AppError.validation("Cannot close visit without at least one clinical note"));
    }

    const closed = await this.changeVisitStatus(actor, visitId, version, { status: "completed" });
    if (!closed.ok) return closed;

    if (followUp) {
      if (!this.followUpService) {
        return err(AppError.internal("Follow-up service is not configured"));
      }
      const createdFollowUp = await this.followUpService.createFromVisitClose(
        actor,
        closed.value,
        followUp,
      );
      if (!createdFollowUp.ok) return err(createdFollowUp.error);
    }

    return closed;
  }

  async softDeleteVisit(
    actor: ServiceActor,
    visitId: string,
    version: number,
  ): Promise<Result<void>> {
    const existing = await this.getVisitById(actor, visitId);
    if (!existing.ok) return err(existing.error);

    const deleteAuth = assertMedicalDeleteAuthorized(actor, existing.value.clinicId);
    if (!deleteAuth.ok) return deleteAuth;

    if (version !== existing.value.version) {
      return err(
        AppError.conflict("Visit delete conflict: stale version", {
          expectedVersion: existing.value.version,
          providedVersion: version,
        }),
      );
    }

    const deleted = await this.visitRepository.updateVersioned(visitId, {
      expectedVersion: version,
      data: { deleted_at: new Date().toISOString() },
    });
    if (!deleted.ok) return err(deleted.error);

    await this.auditService.logAction({
      clinicId: existing.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "visit.delete",
      entityType: "visit",
      entityId: existing.value.id,
      beforePayload: existing.value,
    });

    return ok(undefined);
  }

  private async assertAppointmentLink(
    appointmentId: string,
    clinicId: string,
    customerId: string,
    petId: string,
  ): Promise<Result<void>> {
    const appointment = await this.appointmentRepository.findById(appointmentId);
    if (!appointment.ok) return err(appointment.error);
    if (!appointment.value) return err(AppError.notFound("Appointment not found"));
    if (
      appointment.value.clinicId !== clinicId ||
      appointment.value.customerId !== customerId ||
      appointment.value.petId !== petId
    ) {
      return err(AppError.validation("Appointment does not match visit clinic/customer/pet"));
    }
    return ok(undefined);
  }
}
