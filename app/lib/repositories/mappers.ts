import type { AIEvent } from "@/types/domain/ai-event";
import type { AiSummary } from "@/types/domain/ai-summary";
import type {
  Appointment,
  AppointmentSource,
  AppointmentStatus,
  AppointmentType,
} from "@/types/domain/appointment";
import type { CalendarBlock } from "@/types/domain/calendar-block";
import type { AuditLog } from "@/types/domain/audit-log";
import type { Clinic, ClinicMembership, ClinicRole, ClinicSettings } from "@/types/domain/clinic";
import { withClinicSettingsDefaults } from "@/lib/clinic-settings-defaults";
import type {
  Customer,
  CustomerStatus,
  PreferredContactMethod,
} from "@/types/domain/customer";
import type { Invoice, InvoiceLineItem, InvoiceStatus } from "@/types/domain/invoice";
import type { InventoryItem } from "@/types/domain/inventory";
import type { LabOrder, LabOrderStatus } from "@/types/domain/lab-order";
import type { MedicalNote, MedicalNoteType } from "@/types/domain/medical-note";
import type { MedicalRecord, ProblemListEntry } from "@/types/domain/medical-record";
import type { Pet, PetStatus } from "@/types/domain/pet";
import type { Prescription, PrescriptionStatus } from "@/types/domain/prescription";
import type { Profile } from "@/types/domain/profile";
import type { Task, TaskPriority, TaskStatus } from "@/types/domain/task";
import type { FollowUp } from "@/types/domain/follow-up";
import type { Payment } from "@/types/domain/payment";
import type { PriceListItem } from "@/types/domain/price-list-item";
import type { Vaccination } from "@/types/domain/vaccination";
import type { Visit, VisitStatus } from "@/types/domain/visit";
import type { VisitCharge } from "@/types/domain/visit-charge";
import type { Vital } from "@/types/domain/vital";
import type {
  VoiceCall,
  VoiceCallDirection,
  VoiceCallStatus,
  TranscriptItem,
} from "@/types/domain/voice-call";
import type { Escalation, EscalationContext } from "@/types/domain/escalation";
import type { WaitlistEntry } from "@/types/domain/waitlist";

export function mapProfileRow(row: {
  id: string;
  full_name: string | null;
  phone: string | null;
  default_clinic_id: string | null;
  role: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    defaultClinicId: row.default_clinic_id,
    role: row.role === "provider_admin" ? "provider_admin" : "clinic_user",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapClinicRow(row: {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  settings?: Partial<ClinicSettings> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Clinic {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    timezone: row.timezone,
    settings: withClinicSettingsDefaults(row.settings),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapMembershipRow(row: {
  id: string;
  clinic_id: string;
  user_id: string;
  role: ClinicRole;
  created_at: string;
  updated_at: string;
}): ClinicMembership {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAuditLogRow(row: {
  id: string;
  clinic_id: string | null;
  actor_type: AuditLog["actorType"];
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_payload: Record<string, unknown> | null;
  after_payload: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
}): AuditLog {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    actorType: row.actor_type,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    beforePayload: row.before_payload,
    afterPayload: row.after_payload,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export function mapAIEventRow(row: {
  id: string;
  clinic_id: string;
  source_type: string;
  source_id: string | null;
  agent_name: string;
  event_type: string;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown>;
  confidence: number | null;
  model_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}): AIEvent {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    agentName: row.agent_name,
    eventType: row.event_type,
    inputPayload: row.input_payload,
    outputPayload: row.output_payload,
    confidence: row.confidence,
    modelName: row.model_name,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export function mapAiSummaryRow(row: {
  id: string;
  clinic_id: string;
  artifact_type: AiSummary["artifactType"];
  source_type: AiSummary["sourceType"];
  source_id: string | null;
  status: AiSummary["status"];
  draft_text: string;
  structured_payload: Record<string, unknown>;
  model_name: string | null;
  prompt_version: string | null;
  created_by_user_id: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): AiSummary {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    artifactType: row.artifact_type,
    sourceType: row.source_type,
    sourceId: row.source_id,
    status: row.status,
    draftText: row.draft_text,
    structuredPayload: row.structured_payload ?? {},
    modelName: row.model_name,
    promptVersion: row.prompt_version,
    createdByUserId: row.created_by_user_id,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapCustomerRow(row: {
  id: string;
  clinic_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  preferred_contact_method: PreferredContactMethod;
  notes: string | null;
  status: CustomerStatus;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Customer {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    preferredContactMethod: row.preferred_contact_method,
    notes: row.notes,
    status: row.status,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapPetRow(row: {
  id: string;
  clinic_id: string;
  customer_id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string | null;
  birth_date: string | null;
  weight: number | null;
  chip_number: string | null;
  is_neutered: boolean;
  allergies: string | null;
  chronic_conditions: string | null;
  current_medications: string | null;
  notes: string | null;
  profile_image_url: string | null;
  status: PetStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Pet {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    customerId: row.customer_id,
    name: row.name,
    species: row.species,
    breed: row.breed,
    sex: row.sex,
    birthDate: row.birth_date,
    weight: row.weight,
    chipNumber: row.chip_number,
    isNeutered: row.is_neutered,
    allergies: row.allergies,
    chronicConditions: row.chronic_conditions,
    currentMedications: row.current_medications,
    notes: row.notes,
    profileImageUrl: row.profile_image_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapAppointmentRow(row: {
  id: string;
  clinic_id: string;
  customer_id: string;
  pet_id: string;
  customer?: { full_name: string | null; phone?: string | null } | { full_name: string | null; phone?: string | null }[] | null;
  pet?: { name: string | null; species: string | null } | { name: string | null; species: string | null }[] | null;
  appointment_type: AppointmentType;
  status: AppointmentStatus;
  source: AppointmentSource;
  scheduled_at: string;
  duration_minutes: number;
  reason: string | null;
  notes: string | null;
  version: number;
  cancelled_at: string | null;
  cancelled_by_user_id: string | null;
  cancellation_reason: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Appointment {
  const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
  const pet = Array.isArray(row.pet) ? row.pet[0] : row.pet;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    customerId: row.customer_id,
    petId: row.pet_id,
    customerName: customer?.full_name ?? null,
    customerPhone: customer?.phone ?? null,
    petName: pet?.name ?? null,
    petSpecies: pet?.species ?? null,
    appointmentType: row.appointment_type,
    status: row.status,
    source: row.source,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    reason: row.reason,
    notes: row.notes,
    version: row.version,
    cancelledAt: row.cancelled_at,
    cancelledByUserId: row.cancelled_by_user_id,
    cancellationReason: row.cancellation_reason,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapCalendarBlockRow(row: {
  id: string;
  clinic_id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}): CalendarBlock {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    startAt: row.start_at,
    endAt: row.end_at,
    reason: row.reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function mapVisitRow(row: {
  id: string;
  clinic_id: string;
  customer_id: string;
  pet_id: string;
  appointment_id: string | null;
  medical_record_id?: string | null;
  status: VisitStatus;
  chief_complaint: string | null;
  manual_visit_summary: string | null;
  ai_visit_summary: string | null;
  ai_summary_generated_at: string | null;
  ai_summary_accepted_by_user_id: string | null;
  started_at: string;
  completed_at: string | null;
  version: number;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Visit {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    customerId: row.customer_id,
    petId: row.pet_id,
    appointmentId: row.appointment_id,
    medicalRecordId: row.medical_record_id ?? null,
    status: row.status,
    chiefComplaint: row.chief_complaint,
    manualVisitSummary: row.manual_visit_summary,
    aiVisitSummary: row.ai_visit_summary,
    aiSummaryGeneratedAt: row.ai_summary_generated_at,
    aiSummaryAcceptedByUserId: row.ai_summary_accepted_by_user_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    version: row.version,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapMedicalNoteRow(row: {
  id: string;
  clinic_id: string;
  visit_id: string;
  note_type: MedicalNoteType;
  content: string;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  parent_note_id?: string | null;
  status?: "draft" | "approved" | "archived";
  approved_by_user_id?: string | null;
  approved_at?: string | null;
  version?: number;
  author_user_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): MedicalNote {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    visitId: row.visit_id,
    noteType: row.note_type,
    content: row.content,
    subjective: row.subjective ?? null,
    objective: row.objective ?? null,
    assessment: row.assessment ?? null,
    plan: row.plan ?? null,
    parentNoteId: row.parent_note_id ?? null,
    status: row.status ?? "draft",
    approvedByUserId: row.approved_by_user_id ?? null,
    approvedAt: row.approved_at ?? null,
    version: row.version ?? 1,
    authorUserId: row.author_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapMedicalRecordRow(row: {
  id: string;
  clinic_id: string;
  pet_id: string;
  summary: string | null;
  active_problem_list: unknown[] | null;
  alerts: unknown[] | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): MedicalRecord {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    petId: row.pet_id,
    summary: row.summary,
    // The DB CHECK constraint only enforces "is a jsonb array" — actual entry
    // shape is validated on write via problemListEntrySchema, not by Postgres.
    activeProblemList: (row.active_problem_list ?? []) as ProblemListEntry[],
    alerts: row.alerts ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapVaccinationRow(row: {
  id: string;
  clinic_id: string;
  pet_id: string;
  customer_id: string;
  visit_id: string | null;
  vaccine_name: string;
  administered_at: string;
  batch_number: string | null;
  next_due_at: string | null;
  notes: string | null;
  administered_by_user_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Vaccination {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    petId: row.pet_id,
    customerId: row.customer_id,
    visitId: row.visit_id,
    vaccineName: row.vaccine_name,
    administeredAt: row.administered_at,
    batchNumber: row.batch_number,
    nextDueAt: row.next_due_at,
    notes: row.notes,
    administeredByUserId: row.administered_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapVoiceCallRow(row: Record<string, unknown>): VoiceCall {
  return {
    id: row["id"] as string,
    clinicId: row["clinic_id"] as string,
    customerId: (row["customer_id"] as string | null) ?? null,
    petId: (row["pet_id"] as string | null) ?? null,
    appointmentId: (row["appointment_id"] as string | null) ?? null,
    visitId: (row["visit_id"] as string | null) ?? null,
    direction: row["direction"] as VoiceCallDirection,
    status: row["status"] as VoiceCallStatus,
    fromNumber: row["from_number"] as string,
    toNumber: row["to_number"] as string,
    twilioCallSid: (row["twilio_call_sid"] as string | null) ?? null,
    twilioParentCallSid: (row["twilio_parent_call_sid"] as string | null) ?? null,
    elevenLabsConversationId: (row["elevenlabs_conversation_id"] as string | null) ?? null,
    agentName: (row["agent_name"] as string | null) ?? null,
    startedAt: row["started_at"] as string,
    endedAt: (row["ended_at"] as string | null) ?? null,
    durationSeconds: (row["duration_seconds"] as number | null) ?? null,
    recordingUrl: (row["recording_url"] as string | null) ?? null,
    recordingStoragePath: (row["recording_storage_path"] as string | null) ?? null,
    transcript: (row["transcript"] as TranscriptItem[] | null) ?? null,
    aiSummary: (row["ai_summary"] as string | null) ?? null,
    callCategory: (row["call_category"] as "operation" | "information" | null) ?? null,
    metadata: (row["metadata"] as Record<string, unknown> | null) ?? {},
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string,
  };
}

export function mapEscalationRow(row: Record<string, unknown>): Escalation {
  // Reads the `context` column (20260918230000). This used to JSON.parse the
  // `notes` column for after_hours and throw the customer_id/pet_id it found
  // there away — and `notes` is also what a human types when resolving, so
  // resolving an escalation destroyed the context.
  const context = (row["context"] as EscalationContext | null) ?? {};

  const customer = row["customers"] as { full_name?: string } | null | undefined;
  const pet = row["pets"] as { name?: string } | null | undefined;

  return {
    id: row["id"] as string,
    clinicId: row["clinic_id"] as string,
    voiceCallId: (row["voice_call_id"] as string | null) ?? null,
    elevenLabsConversationId: (row["elevenlabs_conversation_id"] as string | null) ?? null,
    callerPhone: (row["caller_phone"] as string | null) ?? null,
    customerId: (row["customer_id"] as string | null) ?? null,
    customerName: customer?.full_name ?? null,
    petId: (row["pet_id"] as string | null) ?? null,
    petName: pet?.name ?? null,
    reason: row["reason"] as string,
    urgency: row["urgency"] as number,
    context,
    resolvedAt: (row["resolved_at"] as string | null) ?? null,
    resolvedBy: (row["resolved_by"] as string | null) ?? null,
    notes: (row["notes"] as string | null) ?? null,
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string,
    afterHours: context.after_hours,
  };
}

export function mapPrescriptionRow(row: {
  id: string;
  clinic_id: string;
  visit_id: string;
  pet_id: string;
  medication_name: string;
  instructions: string;
  status: PrescriptionStatus;
  discontinued_at: string | null;
  prescribed_at: string;
  prescribed_by_user_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Prescription {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    visitId: row.visit_id,
    petId: row.pet_id,
    medicationName: row.medication_name,
    instructions: row.instructions,
    status: row.status,
    discontinuedAt: row.discontinued_at,
    prescribedAt: row.prescribed_at,
    prescribedByUserId: row.prescribed_by_user_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapWaitlistRow(row: {
  id: string;
  clinic_id: string;
  customer_id: string;
  pet_id: string | null;
  customer?: { full_name: string | null; phone: string | null } | { full_name: string | null; phone: string | null }[] | null;
  pet?: { name: string | null } | { name: string | null }[] | null;
  visit_type: string;
  preferred_start: string | null;
  preferred_end: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}): WaitlistEntry {
  const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
  const pet = Array.isArray(row.pet) ? row.pet[0] : row.pet;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    customerId: row.customer_id,
    petId: row.pet_id,
    customerName: customer?.full_name ?? null,
    customerPhone: customer?.phone ?? null,
    petName: pet?.name ?? null,
    visitType: row.visit_type,
    preferredStart: row.preferred_start,
    preferredEnd: row.preferred_end,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapInvoiceRow(row: {
  id: string;
  clinic_id: string;
  customer_id: string;
  customer?: { full_name: string | null } | { full_name: string | null }[] | null;
  pet_id: string | null;
  pet?: { name: string | null } | { name: string | null }[] | null;
  invoice_number: string;
  status: InvoiceStatus;
  issued_at: string;
  items: unknown;
  total: number | string;
  notes: string | null;
  payment_link_url?: string | null;
  green_invoice_document_id?: string | null;
  payment_link_sent_at?: string | null;
  created_by_user_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Invoice {
  const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
  const pet = Array.isArray(row.pet) ? row.pet[0] : row.pet;
  const items = (Array.isArray(row.items) ? row.items : []) as InvoiceLineItem[];

  return {
    id: row.id,
    clinicId: row.clinic_id,
    customerId: row.customer_id,
    customerName: customer?.full_name ?? null,
    petId: row.pet_id,
    petName: pet?.name ?? null,
    invoiceNumber: row.invoice_number,
    status: row.status,
    issuedAt: row.issued_at,
    items,
    total: typeof row.total === "string" ? parseFloat(row.total) : row.total,
    notes: row.notes,
    paymentLinkUrl: row.payment_link_url ?? null,
    greenInvoiceDocumentId: row.green_invoice_document_id ?? null,
    paymentLinkSentAt: row.payment_link_sent_at ?? null,
    createdByUserId: row.created_by_user_id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapTaskRow(row: {
  id: string;
  clinic_id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_at: string | null;
  assignee_user_id: string | null;
  customer_id: string | null;
  customer?: { full_name: string | null } | { full_name: string | null }[] | null;
  pet_id: string | null;
  pet?: { name: string | null } | { name: string | null }[] | null;
  source_type?: Task["sourceType"];
  source_id?: string | null;
  completed_at?: string | null;
  created_by_user_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Task {
  const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
  const pet = Array.isArray(row.pet) ? row.pet[0] : row.pet;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    dueAt: row.due_at,
    assigneeUserId: row.assignee_user_id,
    customerId: row.customer_id,
    customerName: customer?.full_name ?? null,
    petId: row.pet_id,
    petName: pet?.name ?? null,
    sourceType: row.source_type ?? "manual",
    sourceId: row.source_id ?? null,
    completedAt: row.completed_at ?? null,
    createdByUserId: row.created_by_user_id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapFollowUpRow(row: {
  id: string;
  clinic_id: string;
  customer_id: string;
  customer?: { full_name: string | null } | { full_name: string | null }[] | null;
  pet_id: string | null;
  pet?: { name: string | null } | { name: string | null }[] | null;
  visit_id: string | null;
  voice_call_id: string | null;
  task_id: string | null;
  reason: string;
  due_at: string;
  status: TaskStatus;
  completed_at: string | null;
  completed_by_user_id: string | null;
  created_by_user_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): FollowUp {
  const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
  const pet = Array.isArray(row.pet) ? row.pet[0] : row.pet;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    customerId: row.customer_id,
    customerName: customer?.full_name ?? null,
    petId: row.pet_id,
    petName: pet?.name ?? null,
    visitId: row.visit_id,
    voiceCallId: row.voice_call_id,
    taskId: row.task_id,
    reason: row.reason,
    dueAt: row.due_at,
    status: row.status,
    completedAt: row.completed_at,
    completedByUserId: row.completed_by_user_id,
    createdByUserId: row.created_by_user_id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapLabOrderRow(row: {
  id: string;
  clinic_id: string;
  customer_id: string;
  customer?: { full_name: string | null } | { full_name: string | null }[] | null;
  pet_id: string;
  pet?: { name: string | null } | { name: string | null }[] | null;
  visit_id: string | null;
  test_name: string;
  status: LabOrderStatus;
  result_text: string | null;
  flagged: boolean;
  ordered_by_user_id: string | null;
  ordered_at: string;
  completed_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): LabOrder {
  const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
  const pet = Array.isArray(row.pet) ? row.pet[0] : row.pet;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    customerId: row.customer_id,
    customerName: customer?.full_name ?? null,
    petId: row.pet_id,
    petName: pet?.name ?? null,
    visitId: row.visit_id,
    testName: row.test_name,
    status: row.status,
    resultText: row.result_text,
    flagged: row.flagged,
    orderedByUserId: row.ordered_by_user_id,
    orderedAt: row.ordered_at,
    completedAt: row.completed_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapVitalRow(row: {
  id: string;
  clinic_id: string;
  customer_id: string;
  pet_id: string;
  visit_id: string | null;
  recorded_at: string;
  weight_kg: number | string | null;
  temperature_c: number | string | null;
  heart_rate_bpm: number | null;
  respiratory_rate_bpm: number | null;
  mucous_membrane: string | null;
  capillary_refill_time: string | null;
  body_condition_score: number | string | null;
  pain_score: number | null;
  hydration_status: string | null;
  notes: string | null;
  recorded_by_user_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Vital {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    customerId: row.customer_id,
    petId: row.pet_id,
    visitId: row.visit_id,
    recordedAt: row.recorded_at,
    weightKg: row.weight_kg == null ? null : Number(row.weight_kg),
    temperatureC: row.temperature_c == null ? null : Number(row.temperature_c),
    heartRateBpm: row.heart_rate_bpm,
    respiratoryRateBpm: row.respiratory_rate_bpm,
    mucousMembrane: row.mucous_membrane,
    capillaryRefillTime: row.capillary_refill_time,
    bodyConditionScore: row.body_condition_score == null ? null : Number(row.body_condition_score),
    painScore: row.pain_score,
    hydrationStatus: row.hydration_status,
    notes: row.notes,
    recordedByUserId: row.recorded_by_user_id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapInventoryItemRow(row: Record<string, unknown>): InventoryItem {
  return {
    id: row["id"] as string,
    clinicId: row["clinic_id"] as string,
    name: row["name"] as string,
    sku: (row["sku"] as string | null) ?? null,
    category: row["category"] as string,
    unit: row["unit"] as string,
    quantityOnHand: Number(row["quantity_on_hand"] ?? 0),
    reorderLevel: Number(row["reorder_level"] ?? 0),
    unitCost: row["unit_cost"] == null ? null : Number(row["unit_cost"]),
    unitPrice: row["unit_price"] == null ? null : Number(row["unit_price"]),
    active: row["active"] as boolean,
    createdByUserId: (row["created_by_user_id"] as string | null) ?? null,
    version: row["version"] as number,
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string,
    deletedAt: (row["deleted_at"] as string | null) ?? null,
  };
}

export function mapVisitChargeRow(row: Record<string, unknown>): VisitCharge {
  return {
    id: row["id"] as string,
    clinicId: row["clinic_id"] as string,
    visitId: row["visit_id"] as string,
    customerId: row["customer_id"] as string,
    petId: row["pet_id"] as string,
    description: row["description"] as string,
    quantity: Number(row["quantity"]),
    unitPrice: Number(row["unit_price"]),
    status: row["status"] as VisitCharge["status"],
    invoiceId: (row["invoice_id"] as string | null) ?? null,
    sourceType: row["source_type"] as string,
    sourceId: (row["source_id"] as string | null) ?? null,
    createdByUserId: (row["created_by_user_id"] as string | null) ?? null,
    reviewedByUserId: (row["reviewed_by_user_id"] as string | null) ?? null,
    reviewedAt: (row["reviewed_at"] as string | null) ?? null,
    version: row["version"] as number,
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string,
    deletedAt: (row["deleted_at"] as string | null) ?? null,
  };
}

export function mapPriceListItemRow(row: Record<string, unknown>): PriceListItem {
  return {
    id: row["id"] as string,
    clinicId: row["clinic_id"] as string,
    name: row["name"] as string,
    defaultPrice: Number(row["default_price"]),
    visitType: (row["visit_type"] as string | null) ?? null,
    active: row["active"] as boolean,
    createdByUserId: (row["created_by_user_id"] as string | null) ?? null,
    version: row["version"] as number,
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string,
    deletedAt: (row["deleted_at"] as string | null) ?? null,
  };
}

export function mapPaymentRow(row: Record<string, unknown>): Payment {
  return {
    id: row["id"] as string,
    clinicId: row["clinic_id"] as string,
    invoiceId: row["invoice_id"] as string,
    amount: Number(row["amount"]),
    method: row["method"] as Payment["method"],
    paidAt: row["paid_at"] as string,
    reference: (row["reference"] as string | null) ?? null,
    notes: (row["notes"] as string | null) ?? null,
    recordedByUserId: (row["recorded_by_user_id"] as string | null) ?? null,
    createdAt: row["created_at"] as string,
  };
}
