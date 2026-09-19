import {
  buildAiEventGeneratedOutputSnapshot,
  buildAiEventInputSnapshot,
  buildVisitSummaryContext,
  hasMinimumClinicalContext,
} from "@/lib/ai/visit-summary/build-context";
import {
  generateVisitSummaryDraft,
  isOpenAiConfigured,
} from "@/lib/ai/visit-summary/provider";
import type { VisitSummaryProvider } from "@/lib/ai/visit-summary/types";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import type { MedicalNoteRepository } from "@/lib/repositories/medical-note.repository";
import type { PetRepository } from "@/lib/repositories/pet.repository";
import type { PrescriptionRepository } from "@/lib/repositories/prescription.repository";
import type { VisitRepository } from "@/lib/repositories/visit.repository";
import type { AIEventService } from "@/lib/services/ai-event.service";
import type { AuditService } from "@/lib/services/audit.service";
import { assertVisitSummaryAiAuthorized } from "@/lib/services/medical-authorization";
import type { ServiceActor } from "@/lib/services/service-context";
import type { GenerateVisitSummaryResponse } from "@/types/api/visit-ai-summary";
import type { Visit } from "@/types/domain/visit";

const AGENT_NAME = "visit_summary_assistant";
const MAX_GENERATES_PER_VISIT_PER_HOUR = 5;
const GENERATE_RATE_LIMIT_MS = 60 * 60 * 1000;
const GENERATE_FAILED_CLIENT_MESSAGE =
  "יצירת סיכום הביקור נכשלה. נסה שוב מאוחר יותר.";

export class VisitSummaryAssistantService {
  constructor(
    private readonly visitRepository: VisitRepository,
    private readonly medicalNoteRepository: MedicalNoteRepository,
    private readonly prescriptionRepository: PrescriptionRepository,
    private readonly petRepository: PetRepository,
    private readonly auditService: AuditService,
    private readonly aiEventService: AIEventService,
    private readonly summaryProvider?: VisitSummaryProvider,
  ) {}

  async generateDraft(
    actor: ServiceActor,
    visitId: string,
  ): Promise<Result<GenerateVisitSummaryResponse>> {
    const visitResult = await this.loadAuthorizedVisit(actor, visitId);
    if (!visitResult.ok) return visitResult;
    const visit = visitResult.value;

    if (visit.status === "cancelled") {
      return err(AppError.validation("Cannot generate summary for a cancelled visit"));
    }

    if (!isOpenAiConfigured() && !this.summaryProvider) {
      return err(
        AppError.serviceUnavailable(
          "AI visit summary is not configured (missing OPENAI_API_KEY)",
        ),
      );
    }

    const [notesResult, prescriptionsResult, petResult] = await Promise.all([
      this.medicalNoteRepository.listByVisit(visitId),
      this.prescriptionRepository.listByVisit(visitId),
      this.petRepository.findById(visit.petId),
    ]);

    if (!notesResult.ok) return err(notesResult.error);
    if (!prescriptionsResult.ok) return err(prescriptionsResult.error);
    if (!petResult.ok) return err(petResult.error);
    if (!petResult.value) return err(AppError.notFound("Pet not found"));

    if (!hasMinimumClinicalContext(visit, notesResult.value)) {
      return err(
        AppError.validation(
          "Add a chief complaint or at least one medical note before generating a summary",
        ),
      );
    }

    const rateLimit = await this.assertGenerateRateLimit(visit.id);
    if (!rateLimit.ok) return rateLimit;

    const context = buildVisitSummaryContext(
      visit,
      petResult.value,
      notesResult.value,
      prescriptionsResult.value,
    );

    let generation;
    try {
      generation = await generateVisitSummaryDraft(context, this.summaryProvider);
    } catch (error) {
      console.error("[visit-summary] generate failed", error);
      return err(AppError.externalProvider(GENERATE_FAILED_CLIENT_MESSAGE));
    }

    const aiEventResult = await this.aiEventService.logEvent({
      clinicId: visit.clinicId,
      sourceType: "visit",
      sourceId: visit.id,
      agentName: AGENT_NAME,
      eventType: "visit_summary_generated",
      inputPayload: buildAiEventInputSnapshot(context),
      outputPayload: buildAiEventGeneratedOutputSnapshot(
        context,
        generation.draftText.length,
        generation.modelName,
      ),
      modelName: generation.modelName,
      metadata: { userId: actor.userId },
    });

    if (!aiEventResult.ok) return err(aiEventResult.error);

    return ok({
      draftText: generation.draftText,
      modelName: generation.modelName,
      aiEventId: aiEventResult.value.id,
    });
  }

  async acceptDraft(
    actor: ServiceActor,
    visitId: string,
    version: number,
    summaryText: string,
  ): Promise<Result<Visit>> {
    const visitResult = await this.loadAuthorizedVisit(actor, visitId);
    if (!visitResult.ok) return visitResult;
    const visit = visitResult.value;

    if (visit.status === "cancelled") {
      return err(AppError.validation("Cannot accept summary for a cancelled visit"));
    }

    const acceptedAt = new Date().toISOString();
    const beforeAi = visit.aiVisitSummary;

    const updateResult = await this.visitRepository.acceptAiSummary(visitId, {
      expectedVersion: version,
      aiVisitSummary: summaryText,
      acceptedByUserId: actor.userId,
      acceptedAt,
    });

    if (!updateResult.ok) return updateResult;

    const auditResult = await this.auditService.logAction({
      clinicId: visit.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "ai_visit_summary_accepted",
      entityType: "visit",
      entityId: visit.id,
      beforePayload: { ai_visit_summary: beforeAi },
      afterPayload: {
        ai_visit_summary: summaryText,
        ai_summary_generated_at: acceptedAt,
        ai_summary_accepted_by_user_id: actor.userId,
      },
      metadata: { version },
    });

    if (!auditResult.ok) return err(auditResult.error);

    const aiEventResult = await this.aiEventService.logEvent({
      clinicId: visit.clinicId,
      sourceType: "visit",
      sourceId: visit.id,
      agentName: AGENT_NAME,
      eventType: "visit_summary_accepted",
      inputPayload: { summaryLength: summaryText.length, version },
      outputPayload: { visitId: visit.id },
      metadata: { userId: actor.userId },
    });

    if (!aiEventResult.ok) return err(aiEventResult.error);

    return ok(updateResult.value);
  }

  private async assertGenerateRateLimit(visitId: string): Promise<Result<void>> {
    const sinceIso = new Date(Date.now() - GENERATE_RATE_LIMIT_MS).toISOString();
    const countResult = await this.aiEventService.countVisitSummaryGenerationsSince(
      visitId,
      sinceIso,
    );
    if (!countResult.ok) return err(countResult.error);

    if (countResult.value >= MAX_GENERATES_PER_VISIT_PER_HOUR) {
      return err(
        AppError.validation(
          "Visit summary generation rate limit reached (5 per hour for this visit)",
        ),
      );
    }
    return ok(undefined);
  }

  private async loadAuthorizedVisit(
    actor: ServiceActor,
    visitId: string,
  ): Promise<Result<Visit>> {
    const existing = await this.visitRepository.findById(visitId);
    if (!existing.ok) return err(existing.error);
    if (!existing.value) return err(AppError.notFound("Visit not found"));

    const visit = existing.value;
    if (!actor.clinicIds.includes(visit.clinicId)) {
      return err(AppError.forbidden("Visit outside actor clinics"));
    }

    const auth = assertVisitSummaryAiAuthorized(actor, visit.clinicId);
    if (!auth.ok) return auth;

    return ok(visit);
  }
}
