import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import type { LabOrderRepository } from "@/lib/repositories/lab-order.repository";
import type { CustomerRepository } from "@/lib/repositories/customer.repository";
import type { MedicalNoteRepository } from "@/lib/repositories/medical-note.repository";
import type { MedicalRecordRepository } from "@/lib/repositories/medical-record.repository";
import type { PetRepository } from "@/lib/repositories/pet.repository";
import type { PrescriptionRepository } from "@/lib/repositories/prescription.repository";
import type { VaccinationRepository } from "@/lib/repositories/vaccination.repository";
import type { VisitRepository } from "@/lib/repositories/visit.repository";
import type { VitalRepository } from "@/lib/repositories/vital.repository";
import {
  assertMedicalDeleteAuthorized,
  assertMedicalNoteApproveAuthorized,
  assertPrescriptionApproveAuthorized,
} from "@/lib/services/medical-authorization";
import type { AuditService } from "@/lib/services/audit.service";
import type { DashboardNotificationsService } from "@/lib/services/dashboard-notifications.service";
import type { ServiceActor } from "@/lib/services/service-context";
import { isMedicalNoteLocked } from "@/lib/domain/medical-note-lock";
import type {
  AddMedicalNoteAddendumInput,
  CreateMedicalNoteInput,
  MedicalNote,
  UpdateMedicalNoteInput,
} from "@/types/domain/medical-note";
import type {
  EnsureMedicalRecordForPetInput,
  MedicalRecord,
  UpdateMedicalRecordInput,
} from "@/types/domain/medical-record";
import type {
  CreatePrescriptionInput,
  Prescription,
  UpdatePrescriptionInput,
} from "@/types/domain/prescription";
import type {
  CreateVaccinationInput,
  UpdateVaccinationInput,
  Vaccination,
} from "@/types/domain/vaccination";
import type { Pet } from "@/types/domain/pet";
import type { Visit } from "@/types/domain/visit";
import type { LabOrder } from "@/types/domain/lab-order";
import type { CreateVitalInput, Vital } from "@/types/domain/vital";
import type {
  MedicalRecordTimelineItem,
  MedicalRecordTimelineResponse,
  MedicalRecordTimelineType,
} from "@/types/api/medical-record-timeline";

const NOTE_TYPE_LABELS: Record<string, string> = {
  general: "הערה רפואית",
  soap_subjective: "SOAP - תלונת לקוח",
  soap_objective: "SOAP - ממצאים",
  soap_assessment: "SOAP - הערכה",
  soap_plan: "SOAP - תוכנית טיפול",
  follow_up: "מעקב",
  addendum: "נספח",
  // soap_full notes are created by VoiceSoapRecorder's "הוסף כהערה" flow
  // (voice-soap-recorder.tsx), after a voice-dictated SOAP draft has been
  // reviewed/edited — they flow into this same timeline like any other
  // note type.
  soap_full: "SOAP מלא",
};

export class MedicalRecordService {
  constructor(
    private readonly visitRepository: VisitRepository,
    private readonly medicalNoteRepository: MedicalNoteRepository,
    private readonly vaccinationRepository: VaccinationRepository,
    private readonly prescriptionRepository: PrescriptionRepository,
    private readonly petRepository: PetRepository,
    private readonly auditService: AuditService,
    private readonly medicalRecordRepository?: MedicalRecordRepository,
    private readonly vitalRepository?: VitalRepository,
    private readonly labOrderRepository?: LabOrderRepository,
    private readonly customerRepository?: CustomerRepository,
    private readonly dashboardNotifications?: DashboardNotificationsService,
  ) {}

  async getRecordByPet(actor: ServiceActor, petId: string): Promise<Result<MedicalRecord>> {
    const pet = await this.assertPetAccessible(actor, petId);
    if (!pet.ok) return err(pet.error);
    return this.ensureRecordForPet(actor, {
      clinicId: pet.value.clinicId,
      petId: pet.value.id,
    });
  }

  async ensureRecordForPet(
    actor: ServiceActor,
    input: EnsureMedicalRecordForPetInput,
  ): Promise<Result<MedicalRecord>> {
    if (!this.medicalRecordRepository) {
      return err(AppError.internal("Medical record repository is not configured"));
    }
    if (!actor.clinicIds.includes(input.clinicId)) {
      return err(AppError.forbidden("Cannot access medical record for requested clinic"));
    }

    const pet = await this.petRepository.findById(input.petId);
    if (!pet.ok) return err(pet.error);
    if (!pet.value) return err(AppError.notFound("Pet not found"));
    if (pet.value.clinicId !== input.clinicId) {
      return err(AppError.validation("Pet clinic mismatch"));
    }

    const existing = await this.medicalRecordRepository.findByPet(input.clinicId, input.petId);
    if (!existing.ok) return existing;
    if (existing.value) return ok(existing.value);

    const created = await this.medicalRecordRepository.createForPet(input.clinicId, input.petId);
    if (!created.ok) return created;

    await this.auditService.logAction({
      clinicId: created.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "medical_record.create",
      entityType: "medical_record",
      entityId: created.value.id,
      afterPayload: created.value,
      metadata: { petId: created.value.petId },
    });

    return created;
  }

  async updateRecordByPet(
    actor: ServiceActor,
    petId: string,
    input: UpdateMedicalRecordInput,
  ): Promise<Result<MedicalRecord>> {
    if (!this.medicalRecordRepository) {
      return err(AppError.internal("Medical record repository is not configured"));
    }
    const existing = await this.getRecordByPet(actor, petId);
    if (!existing.ok) return existing;

    const updated = await this.medicalRecordRepository.update(existing.value.id, input);
    if (!updated.ok) return updated;

    await this.auditService.logAction({
      clinicId: updated.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "medical_record.update",
      entityType: "medical_record",
      entityId: updated.value.id,
      beforePayload: existing.value,
      afterPayload: updated.value,
      metadata: { petId: updated.value.petId },
    });

    return updated;
  }

  async getTimeline(
    actor: ServiceActor,
    petId: string,
    filters: { type?: MedicalRecordTimelineType; q?: string },
  ): Promise<Result<MedicalRecordTimelineResponse>> {
    const pet = await this.assertPetAccessible(actor, petId);
    if (!pet.ok) return err(pet.error);

    const [visits, notes, vaccinations, prescriptions, vitals, labOrders] = await Promise.all([
      this.visitRepository.list({ clinicIds: [pet.value.clinicId], petId }),
      this.medicalNoteRepository.listByPet(pet.value.clinicId, petId),
      this.vaccinationRepository.listByPet(petId, pet.value.clinicId),
      this.prescriptionRepository.listByPet(petId),
      this.vitalRepository ? this.vitalRepository.listByPet(pet.value.clinicId, petId) : ok<Vital[]>([]),
      this.labOrderRepository ? this.labOrderRepository.list({ clinicIds: [pet.value.clinicId], petId }) : ok<LabOrder[]>([]),
    ]);

    if (!visits.ok) return err(visits.error);
    if (!notes.ok) return err(notes.error);
    if (!vaccinations.ok) return err(vaccinations.error);
    if (!prescriptions.ok) return err(prescriptions.error);
    if (!vitals.ok) return err(vitals.error);
    if (!labOrders.ok) return err(labOrders.error);

    const visitItems = visits.value;
    const noteItems = notes.value;
    const vaccinationItems = vaccinations.value;
    const prescriptionItems = prescriptions.value;
    const vitalItems = vitals.value;
    const labOrderItems = labOrders.value;

    const items: MedicalRecordTimelineItem[] = [
      ...visitItems.map((visit): MedicalRecordTimelineItem => ({
        id: `visit-${visit.id}`,
        type: "visit",
        occurredAt: visit.startedAt,
        title: "ביקור",
        subtitle: visit.chiefComplaint ?? visit.manualVisitSummary ?? visit.aiVisitSummary,
        sourceVisitId: visit.id,
        sourceHref: `/dashboard/visits/${visit.id}`,
        data: visit,
      })),
      ...noteItems.map((note): MedicalRecordTimelineItem => ({
        id: `medical-note-${note.id}`,
        type: "medical_note",
        occurredAt: note.createdAt,
        title: NOTE_TYPE_LABELS[note.noteType] ?? "הערה רפואית",
        subtitle: note.content,
        sourceVisitId: note.visitId,
        sourceHref: `/dashboard/visits/${note.visitId}`,
        data: note,
      })),
      ...vitalItems.map((vital): MedicalRecordTimelineItem => ({
        id: `vital-${vital.id}`,
        type: "vital",
        occurredAt: vital.recordedAt,
        title: "מדדים",
        subtitle: [
          vital.weightKg != null ? `${vital.weightKg} קג` : null,
          vital.temperatureC != null ? `${vital.temperatureC} C` : null,
          vital.heartRateBpm != null ? `${vital.heartRateBpm} bpm` : null,
        ].filter(Boolean).join(" · ") || vital.notes,
        sourceVisitId: vital.visitId,
        sourceHref: vital.visitId ? `/dashboard/visits/${vital.visitId}` : `/dashboard/pets/${petId}`,
        data: vital,
      })),
      ...prescriptionItems.map((prescription): MedicalRecordTimelineItem => ({
        id: `prescription-${prescription.id}`,
        type: "prescription",
        occurredAt: prescription.prescribedAt,
        title: `מרשם: ${prescription.medicationName}`,
        subtitle: prescription.instructions,
        sourceVisitId: prescription.visitId,
        sourceHref: `/dashboard/visits/${prescription.visitId}`,
        data: prescription,
      })),
      ...vaccinationItems.map((vaccination): MedicalRecordTimelineItem => ({
        id: `vaccination-${vaccination.id}`,
        type: "vaccination",
        occurredAt: vaccination.administeredAt,
        title: `חיסון: ${vaccination.vaccineName}`,
        subtitle: vaccination.notes,
        sourceVisitId: vaccination.visitId,
        sourceHref: vaccination.visitId ? `/dashboard/visits/${vaccination.visitId}` : `/dashboard/pets/${petId}`,
        data: vaccination,
      })),
      ...labOrderItems.map((labOrder): MedicalRecordTimelineItem => ({
        id: `lab-order-${labOrder.id}`,
        type: "lab_order",
        occurredAt: labOrder.completedAt ?? labOrder.orderedAt,
        title: `בדיקת מעבדה: ${labOrder.testName}`,
        subtitle: labOrder.resultText,
        sourceVisitId: labOrder.visitId,
        sourceHref: labOrder.visitId ? `/dashboard/visits/${labOrder.visitId}` : "/dashboard/lab",
        data: labOrder,
      })),
    ];

    const query = filters.q?.trim().toLowerCase();
    const filtered = items
      .filter((item) => !filters.type || item.type === filters.type)
      .filter((item) => {
        if (!query) return true;
        return `${item.title} ${item.subtitle ?? ""}`.toLowerCase().includes(query);
      })
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

    return ok({ items: filtered });
  }

  async listNotes(actor: ServiceActor, visitId: string): Promise<Result<MedicalNote[]>> {
    const visit = await this.assertVisitAccessible(actor, visitId);
    if (!visit.ok) return visit;
    return this.medicalNoteRepository.listByVisit(visitId);
  }

  async listVitals(actor: ServiceActor, petId: string): Promise<Result<Vital[]>> {
    if (!this.vitalRepository) {
      return err(AppError.internal("Vital repository is not configured"));
    }
    const pet = await this.assertPetAccessible(actor, petId);
    if (!pet.ok) return err(pet.error);
    return this.vitalRepository.listByPet(pet.value.clinicId, petId);
  }

  async recordVitals(
    actor: ServiceActor,
    visitId: string,
    input: Omit<CreateVitalInput, "clinicId" | "customerId" | "petId" | "visitId">,
  ): Promise<Result<Vital>> {
    if (!this.vitalRepository) {
      return err(AppError.internal("Vital repository is not configured"));
    }

    const visit = await this.assertVisitAccessible(actor, visitId);
    if (!visit.ok) return visit;

    const created = await this.vitalRepository.create(
      {
        ...input,
        clinicId: visit.value.clinicId,
        customerId: visit.value.customerId,
        petId: visit.value.petId,
        visitId,
      },
      actor.userId,
    );
    if (!created.ok) return created;

    await this.auditService.logAction({
      clinicId: visit.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "vital.create",
      entityType: "vital",
      entityId: created.value.id,
      afterPayload: created.value,
    });

    return created;
  }

  async addNote(
    actor: ServiceActor,
    visitId: string,
    input: CreateMedicalNoteInput,
  ): Promise<Result<MedicalNote>> {
    const visit = await this.assertVisitAccessible(actor, visitId);
    if (!visit.ok) return visit;

    const created = await this.medicalNoteRepository.create(
      visit.value.clinicId,
      visitId,
      input,
      actor.userId,
    );
    if (!created.ok) return created;

    await this.auditService.logAction({
      clinicId: visit.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "medical_note.create",
      entityType: "medical_note",
      entityId: created.value.id,
      afterPayload: created.value,
    });

    return created;
  }

  /**
   * Plain edits never transition status away from 'draft': 'approved' and
   * 'archived' are only reachable through approveNote() (and, later, its own
   * dedicated archive/lock flow), which enforces the elevated-role gate and
   * stamps approved_by_user_id/approved_at. Accepting those values here would
   * let any clinic member flip a note to 'approved' without either.
   *
   * Likewise, noteType can never become 'addendum' via a plain edit: even
   * though updateMedicalNoteSchema validates a { noteType: "addendum",
   * parentNoteId } body, this repository's update() never writes
   * parent_note_id, so that path would silently produce an addendum note
   * with a stale/missing parent link — the exact invariant the validator's
   * refine exists to enforce. addAddendum() is the only supported way to
   * create an addendum.
   */
  async updateNote(
    actor: ServiceActor,
    noteId: string,
    input: UpdateMedicalNoteInput,
    expectedVisitId?: string,
  ): Promise<Result<MedicalNote>> {
    if (input.status === "approved" || input.status === "archived") {
      return err(
        AppError.validation(
          "Cannot set medical note status to approved/archived via update; use the dedicated approve endpoint",
        ),
      );
    }

    if (input.noteType === "addendum") {
      return err(
        AppError.validation(
          "Cannot set medical note type to addendum via update; use the dedicated addendum endpoint",
        ),
      );
    }

    const existing = await this.loadScopedNote(noteId, expectedVisitId);
    if (!existing.ok) return existing;

    const visit = await this.assertVisitAccessible(actor, existing.value.visitId);
    if (!visit.ok) return visit;

    // Pre-emptive check above the DB trigger: give a clear Hebrew conflict
    // message instead of letting the request reach
    // medical_notes_enforce_lock and fail with a raw Postgres exception. The
    // trigger (see supabase/migrations/20260901172952_medical_notes_lock_and_addendum.sql)
    // remains the authoritative enforcement layer; this is defense-in-depth,
    // not a replacement.
    if (isMedicalNoteLocked(existing.value)) {
      return err(
        AppError.conflict(
          "לא ניתן לערוך הערה מאושרת שעברו עליה יותר מ-24 שעות — הוסף נספח במקום",
        ),
      );
    }

    const updated = await this.medicalNoteRepository.update(noteId, input);
    if (!updated.ok) return updated;

    await this.auditService.logAction({
      clinicId: existing.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "medical_note.update",
      entityType: "medical_note",
      entityId: updated.value.id,
      beforePayload: existing.value,
      afterPayload: updated.value,
    });

    return updated;
  }

  /**
   * Adds an addendum to an existing (possibly locked) note: a new
   * medical_notes row with note_type 'addendum' and parent_note_id pointing
   * back at the parent, created as a plain 'draft' like any other new note.
   * This is never blocked by the parent's 24-hour lock, because the
   * medical_notes_enforce_lock trigger only fires on UPDATE to the parent
   * row itself — inserting a new row is unaffected regardless of the
   * parent's age or approval status.
   */
  async addAddendum(
    actor: ServiceActor,
    parentNoteId: string,
    input: AddMedicalNoteAddendumInput,
    expectedVisitId?: string,
  ): Promise<Result<MedicalNote>> {
    const parent = await this.loadScopedNote(parentNoteId, expectedVisitId);
    if (!parent.ok) return parent;

    const visit = await this.assertVisitAccessible(actor, parent.value.visitId);
    if (!visit.ok) return visit;

    const created = await this.medicalNoteRepository.create(
      parent.value.clinicId,
      parent.value.visitId,
      {
        noteType: "addendum",
        parentNoteId: parent.value.id,
        content: input.content,
        subjective: input.subjective ?? null,
        objective: input.objective ?? null,
        assessment: input.assessment ?? null,
        plan: input.plan ?? null,
      },
      actor.userId,
    );
    if (!created.ok) return created;

    await this.auditService.logAction({
      clinicId: parent.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "medical_note.addendum_create",
      entityType: "medical_note",
      entityId: created.value.id,
      afterPayload: created.value,
      metadata: { parentNoteId: parent.value.id },
    });

    return created;
  }

  async approveNote(
    actor: ServiceActor,
    noteId: string,
    expectedVisitId?: string,
  ): Promise<Result<MedicalNote>> {
    const existing = await this.loadScopedNote(noteId, expectedVisitId);
    if (!existing.ok) return existing;

    const visit = await this.assertVisitAccessible(actor, existing.value.visitId);
    if (!visit.ok) return visit;

    const approveAuth = assertMedicalNoteApproveAuthorized(actor, existing.value.clinicId);
    if (!approveAuth.ok) return approveAuth;

    if (existing.value.status !== "draft") {
      return err(AppError.conflict(`Medical note already ${existing.value.status}`));
    }

    const approved = await this.medicalNoteRepository.approve(noteId, actor.userId);
    if (!approved.ok) return approved;

    await this.auditService.logAction({
      clinicId: existing.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "medical_note.approve",
      entityType: "medical_note",
      entityId: approved.value.id,
      beforePayload: existing.value,
      afterPayload: approved.value,
    });

    return approved;
  }

  /**
   * Loads a note by id, optionally verifying it belongs to expectedVisitId
   * (the visitId path segment on nested /visits/:visitId/notes/:noteId
   * routes). A mismatch is reported as not-found rather than leaking that a
   * note exists under a different visit.
   */
  private async loadScopedNote(
    noteId: string,
    expectedVisitId?: string,
  ): Promise<Result<MedicalNote>> {
    const existing = await this.medicalNoteRepository.findById(noteId);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Medical note not found"));
    if (expectedVisitId && existing.value.visitId !== expectedVisitId) {
      return err(AppError.notFound("Medical note not found"));
    }
    return ok(existing.value);
  }

  async softDeleteNote(actor: ServiceActor, noteId: string): Promise<Result<void>> {
    const existing = await this.medicalNoteRepository.findById(noteId);
    if (!existing.ok) return err(existing.error);
    if (!existing.value) return err(AppError.notFound("Medical note not found"));

    const visit = await this.assertVisitAccessible(actor, existing.value.visitId);
    if (!visit.ok) return visit;

    const deleteAuth = assertMedicalDeleteAuthorized(actor, existing.value.clinicId);
    if (!deleteAuth.ok) return deleteAuth;

    const deleted = await this.medicalNoteRepository.softDelete(noteId);
    if (!deleted.ok) return err(deleted.error);

    await this.auditService.logAction({
      clinicId: existing.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "medical_note.delete",
      entityType: "medical_note",
      entityId: existing.value.id,
      beforePayload: existing.value,
    });

    return ok(undefined);
  }

  async listPetVaccinations(
    actor: ServiceActor,
    petId: string,
    clinicId: string,
  ): Promise<Result<Vaccination[]>> {
    if (!actor.clinicIds.includes(clinicId)) {
      return err(AppError.forbidden("Cannot list vaccinations for requested clinic"));
    }
    const pet = await this.petRepository.findById(petId);
    if (!pet.ok) return err(pet.error);
    if (!pet.value) return err(AppError.notFound("Pet not found"));
    if (pet.value.clinicId !== clinicId) {
      return err(AppError.validation("Pet clinic mismatch"));
    }
    return this.vaccinationRepository.listByPet(petId, clinicId);
  }

  async recordVaccination(
    actor: ServiceActor,
    petId: string,
    input: CreateVaccinationInput,
  ): Promise<Result<Vaccination>> {
    if (!actor.clinicIds.includes(input.clinicId)) {
      return err(AppError.forbidden("Cannot record vaccination in this clinic"));
    }

    const pet = await this.petRepository.findById(petId);
    if (!pet.ok) return err(pet.error);
    if (!pet.value) return err(AppError.notFound("Pet not found"));
    if (pet.value.clinicId !== input.clinicId || pet.value.customerId !== input.customerId) {
      return err(AppError.validation("Pet/customer/clinic mismatch"));
    }

    if (input.visitId) {
      const visit = await this.assertVisitAccessible(actor, input.visitId);
      if (!visit.ok) return visit;
      if (visit.value.petId !== petId) {
        return err(AppError.validation("Visit pet mismatch"));
      }
    }

    const created = await this.vaccinationRepository.create(input, actor.userId, petId);
    if (!created.ok) return created;

    if (created.value.nextDueAt && this.customerRepository && this.dashboardNotifications) {
      const customer = await this.customerRepository.findById(created.value.customerId);
      if (!customer.ok) return err(customer.error);
      if (customer.value?.phone) {
        const reminder = await this.dashboardNotifications.enqueueVaccinationReminder({
          vaccinationId: created.value.id,
          clinicId: created.value.clinicId,
          customerId: created.value.customerId,
          phone: customer.value.phone,
          customerName: customer.value.fullName,
          petName: pet.value.name,
          vaccineName: created.value.vaccineName,
          nextDueAt: created.value.nextDueAt,
        });
        if (!reminder.ok) return err(reminder.error);
      }
    }

    await this.auditService.logAction({
      clinicId: created.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "vaccination.create",
      entityType: "vaccination",
      entityId: created.value.id,
      afterPayload: created.value,
    });

    return created;
  }

  async updateVaccination(
    actor: ServiceActor,
    vaccinationId: string,
    input: UpdateVaccinationInput,
  ): Promise<Result<Vaccination>> {
    const existing = await this.vaccinationRepository.findById(vaccinationId);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Vaccination not found"));
    if (!actor.clinicIds.includes(existing.value.clinicId)) {
      return err(AppError.forbidden("Vaccination outside actor clinics"));
    }

    if (input.visitId) {
      const visit = await this.assertVisitAccessible(actor, input.visitId);
      if (!visit.ok) return visit;
      if (visit.value.petId !== existing.value.petId) {
        return err(AppError.validation("Visit pet mismatch"));
      }
    }

    const updated = await this.vaccinationRepository.update(vaccinationId, input);
    if (!updated.ok) return updated;

    await this.auditService.logAction({
      clinicId: existing.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "vaccination.update",
      entityType: "vaccination",
      entityId: updated.value.id,
      beforePayload: existing.value,
      afterPayload: updated.value,
    });

    return updated;
  }

  async softDeleteVaccination(
    actor: ServiceActor,
    vaccinationId: string,
  ): Promise<Result<void>> {
    const existing = await this.vaccinationRepository.findById(vaccinationId);
    if (!existing.ok) return err(existing.error);
    if (!existing.value) return err(AppError.notFound("Vaccination not found"));
    if (!actor.clinicIds.includes(existing.value.clinicId)) {
      return err(AppError.forbidden("Vaccination outside actor clinics"));
    }

    const deleteAuth = assertMedicalDeleteAuthorized(actor, existing.value.clinicId);
    if (!deleteAuth.ok) return deleteAuth;

    const deleted = await this.vaccinationRepository.softDelete(vaccinationId);
    if (!deleted.ok) return err(deleted.error);

    await this.auditService.logAction({
      clinicId: existing.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "vaccination.delete",
      entityType: "vaccination",
      entityId: existing.value.id,
      beforePayload: existing.value,
    });

    return ok(undefined);
  }

  async listVisitPrescriptions(
    actor: ServiceActor,
    visitId: string,
  ): Promise<Result<Prescription[]>> {
    const visit = await this.assertVisitAccessible(actor, visitId);
    if (!visit.ok) return visit;
    return this.prescriptionRepository.listByVisit(visitId);
  }

  async listPetPrescriptions(
    actor: ServiceActor,
    petId: string,
  ): Promise<Result<Prescription[]>> {
    const pet = await this.petRepository.findById(petId);
    if (!pet.ok) return err(pet.error);
    if (!pet.value) return err(AppError.notFound("Pet not found"));
    if (!actor.clinicIds.includes(pet.value.clinicId)) {
      return err(AppError.forbidden("Pet outside actor clinics"));
    }
    return this.prescriptionRepository.listByPet(petId);
  }

  async addPrescription(
    actor: ServiceActor,
    visitId: string,
    input: CreatePrescriptionInput,
  ): Promise<Result<Prescription>> {
    const visit = await this.assertVisitAccessible(actor, visitId);
    if (!visit.ok) return visit;

    const created = await this.prescriptionRepository.create(
      visit.value.clinicId,
      visitId,
      visit.value.petId,
      input,
      actor.userId,
    );
    if (!created.ok) return created;

    await this.auditService.logAction({
      clinicId: visit.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "prescription.create",
      entityType: "prescription",
      entityId: created.value.id,
      afterPayload: created.value,
    });

    return created;
  }

  async updatePrescription(
    actor: ServiceActor,
    prescriptionId: string,
    input: UpdatePrescriptionInput,
  ): Promise<Result<Prescription>> {
    const existing = await this.prescriptionRepository.findById(prescriptionId);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Prescription not found"));
    if (!actor.clinicIds.includes(existing.value.clinicId)) {
      return err(AppError.forbidden("Prescription outside actor clinics"));
    }

    const patch = this.buildPrescriptionPatch(existing.value, input);
    if (!patch.ok) return patch;

    const updated = await this.prescriptionRepository.update(prescriptionId, patch.value);
    if (!updated.ok) return updated;

    await this.auditService.logAction({
      clinicId: existing.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "prescription.update",
      entityType: "prescription",
      entityId: updated.value.id,
      beforePayload: existing.value,
      afterPayload: updated.value,
    });

    return updated;
  }

  async approvePrescription(
    actor: ServiceActor,
    prescriptionId: string,
  ): Promise<Result<Prescription>> {
    const existing = await this.prescriptionRepository.findById(prescriptionId);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Prescription not found"));
    if (!actor.clinicIds.includes(existing.value.clinicId)) {
      return err(AppError.forbidden("Prescription outside actor clinics"));
    }

    const approval = assertPrescriptionApproveAuthorized(actor, existing.value.clinicId);
    if (!approval.ok) return approval;

    const updated = await this.prescriptionRepository.update(prescriptionId, {
      status: "active",
      discontinuedAt: null,
    });
    if (!updated.ok) return updated;

    await this.auditService.logAction({
      clinicId: existing.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "prescription.approve",
      entityType: "prescription",
      entityId: updated.value.id,
      beforePayload: existing.value,
      afterPayload: updated.value,
    });

    return updated;
  }

  async softDeletePrescription(
    actor: ServiceActor,
    prescriptionId: string,
  ): Promise<Result<void>> {
    const existing = await this.prescriptionRepository.findById(prescriptionId);
    if (!existing.ok) return err(existing.error);
    if (!existing.value) return err(AppError.notFound("Prescription not found"));
    if (!actor.clinicIds.includes(existing.value.clinicId)) {
      return err(AppError.forbidden("Prescription outside actor clinics"));
    }

    const deleteAuth = assertMedicalDeleteAuthorized(actor, existing.value.clinicId);
    if (!deleteAuth.ok) return deleteAuth;

    const deleted = await this.prescriptionRepository.softDelete(prescriptionId);
    if (!deleted.ok) return err(deleted.error);

    await this.auditService.logAction({
      clinicId: existing.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "prescription.delete",
      entityType: "prescription",
      entityId: existing.value.id,
      beforePayload: existing.value,
    });

    return ok(undefined);
  }

  private buildPrescriptionPatch(
    existing: Prescription,
    input: UpdatePrescriptionInput,
  ): Result<UpdatePrescriptionInput & { discontinuedAt?: string | null }> {
    const nextStatus = input.status ?? existing.status;
    if (nextStatus === "discontinued") {
      return ok({
        ...input,
        status: "discontinued",
        discontinuedAt: new Date().toISOString(),
      });
    }
    if (nextStatus === "active") {
      return ok({
        ...input,
        status: "active",
        discontinuedAt: null,
      });
    }
    return ok(input);
  }

  private async assertVisitAccessible(
    actor: ServiceActor,
    visitId: string,
  ): Promise<Result<Visit>> {
    const visit = await this.visitRepository.findById(visitId);
    if (!visit.ok) return err(visit.error);
    if (!visit.value) return err(AppError.notFound("Visit not found"));
    if (!actor.clinicIds.includes(visit.value.clinicId)) {
      return err(AppError.forbidden("Visit outside actor clinics"));
    }
    return ok(visit.value);
  }

  private async assertPetAccessible(actor: ServiceActor, petId: string): Promise<Result<Pet>> {
    const pet = await this.petRepository.findById(petId);
    if (!pet.ok) return err(pet.error);
    if (!pet.value) return err(AppError.notFound("Pet not found"));
    if (!actor.clinicIds.includes(pet.value.clinicId)) {
      return err(AppError.forbidden("Pet outside actor clinics"));
    }
    return ok(pet.value);
  }
}
