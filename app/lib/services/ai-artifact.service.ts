import { isOpenAiConfigured, parseSoapNoteTranscript } from "@/lib/ai/soap-note/provider";
import type { SoapNoteDraft, SoapNoteProvider } from "@/lib/ai/soap-note/types";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import type { AiSummaryRepository } from "@/lib/repositories/ai-summary.repository";
import type { AIEventService } from "@/lib/services/ai-event.service";
import { assertVisitSummaryAiAuthorized } from "@/lib/services/medical-authorization";
import type { ServiceActor } from "@/lib/services/service-context";
import type {
  AiArtifactSourceType,
  AiArtifactType,
  AiSummary,
} from "@/types/domain/ai-summary";

type GenerateInput = {
  clinicId: string;
  sourceType: AiArtifactSourceType;
  sourceId?: string | null;
  sourceText: string;
};

type SoapDraftResult = {
  draftText: string;
  structuredPayload: Record<string, unknown>;
  modelName: string;
};

const TYPE_PREFIX: Record<AiArtifactType, string> = {
  patient_summary: "טיוטת סיכום מטופל",
  draft_soap: "טיוטת SOAP",
  client_instructions: "טיוטת הנחיות ללקוח",
  extracted_tasks: "טיוטת משימות מוצעות",
};

const SOAP_DRAFT_AGENT_NAME = "ai_artifact_service";
const SOAP_DRAFT_GENERATED_EVENT_TYPE = "soap_note_generated";
// Mirrors VisitSummaryAssistantService's per-hour generation cap.
const MAX_SOAP_DRAFTS_PER_SOURCE_PER_HOUR = 5;
const SOAP_DRAFT_RATE_LIMIT_MS = 60 * 60 * 1000;
const SOAP_DRAFT_FAILED_MESSAGE = "יצירת טיוטת SOAP נכשלה. נסה שוב מאוחר יותר.";
const AI_NOT_CONFIGURED_MESSAGE = "AI artifacts are not configured (missing OPENAI_API_KEY)";

function allowDeterministicAiStubs(): boolean {
  const appEnv = process.env.APP_ENV;
  const nodeEnv = process.env.NODE_ENV;
  if (appEnv === "production" || nodeEnv === "production") return false;
  return true;
}

const SOAP_SECTION_LABELS: Record<keyof SoapNoteDraft, string> = {
  S: "סובייקטיבי (S)",
  O: "אובייקטיבי (O)",
  A: "הערכה (A)",
  P: "תוכנית טיפול (P)",
};
const SOAP_SECTION_ORDER: (keyof SoapNoteDraft)[] = ["S", "O", "A", "P"];

export class AiArtifactService {
  constructor(
    private readonly repository: AiSummaryRepository,
    private readonly aiEventService: AIEventService,
    private readonly soapNoteProvider?: Pick<SoapNoteProvider, "parseTranscript">,
  ) {}

  async generateArtifact(
    actor: ServiceActor,
    artifactType: AiArtifactType,
    input: GenerateInput,
  ): Promise<Result<AiSummary>> {
    if (!actor.clinicIds.includes(input.clinicId)) {
      return err(AppError.forbidden("Cannot create AI artifact for requested clinic"));
    }

    const text = input.sourceText.trim();

    let draftText: string;
    let structuredPayload: Record<string, unknown>;
    let modelName: string;

    if (artifactType === "draft_soap") {
      const soapResult = await this.generateSoapDraft(actor, { ...input, sourceText: text });
      if (!soapResult.ok) return soapResult;
      ({ draftText, structuredPayload, modelName } = soapResult.value);
    } else {
      if (!allowDeterministicAiStubs()) {
        return err(AppError.serviceUnavailable(
          `AI ${artifactType} generation is not available outside test/dev (no model provider)`,
        ));
      }
      draftText = `${TYPE_PREFIX[artifactType]}:\n${text.slice(0, 1400)}`;
      structuredPayload = artifactType === "extracted_tasks"
        ? { tasks: extractTaskCandidates(text) }
        : { sourceLength: text.length };
      modelName = "deterministic-draft";
    }

    return this.repository.create({
      clinicId: input.clinicId,
      artifactType,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      draftText,
      structuredPayload,
      modelName,
      promptVersion: "phase9-v1",
      createdByUserId: actor.userId,
    });
  }

  async approveArtifact(actor: ServiceActor, artifactId: string): Promise<Result<AiSummary>> {
    const artifact = await this.loadReviewable(actor, artifactId);
    if (!artifact.ok) return artifact;
    return this.repository.review(artifactId, {
      status: "approved",
      reviewedByUserId: actor.userId,
    });
  }

  async rejectArtifact(
    actor: ServiceActor,
    artifactId: string,
    reason: string,
  ): Promise<Result<AiSummary>> {
    const artifact = await this.loadReviewable(actor, artifactId);
    if (!artifact.ok) return artifact;
    return this.repository.review(artifactId, {
      status: "rejected",
      reviewedByUserId: actor.userId,
      rejectionReason: reason,
    });
  }

  /**
   * Generates the `draft_soap` payload. Real path: when OpenAI is
   * configured (or a test provider was explicitly injected), parses the
   * already-transcribed `sourceText` via `parseSoapNoteTranscript` into a
   * real {S,O,A,P} draft, rate-limits and logs the generation. Fallback:
   * deterministic stub is allowed only in test/dev. Production without
   * OpenAI returns 503, matching VisitSummaryAssistantService.
   */
  private async generateSoapDraft(
    actor: ServiceActor,
    input: GenerateInput,
  ): Promise<Result<SoapDraftResult>> {
    const text = input.sourceText;

    if (!isOpenAiConfigured() && !this.soapNoteProvider) {
      if (!allowDeterministicAiStubs()) {
        return err(AppError.serviceUnavailable(AI_NOT_CONFIGURED_MESSAGE));
      }
      return ok({
        draftText: `${TYPE_PREFIX.draft_soap}:\n${text.slice(0, 1400)}`,
        structuredPayload: buildSoapPayload(text),
        modelName: "deterministic-draft",
      });
    }

    const sourceId = input.sourceId ?? null;

    if (sourceId) {
      const rateLimit = await this.assertSoapDraftRateLimit(sourceId);
      if (!rateLimit.ok) return rateLimit;
    }

    let parsed;
    try {
      parsed = await parseSoapNoteTranscript(text, this.soapNoteProvider);
    } catch (error) {
      console.error("[ai-artifact] SOAP draft generation failed", error);
      return err(AppError.externalProvider(SOAP_DRAFT_FAILED_MESSAGE));
    }

    const structuredPayload: Record<string, unknown> = {
      subjective: parsed.draft.S ?? "",
      objective: parsed.draft.O ?? "",
      assessment: parsed.draft.A ?? "",
      plan: parsed.draft.P ?? "",
    };
    const draftText = buildSoapDraftText(parsed.draft);

    const logResult = await this.aiEventService.logEvent({
      clinicId: input.clinicId,
      sourceType: input.sourceType,
      sourceId,
      agentName: SOAP_DRAFT_AGENT_NAME,
      eventType: SOAP_DRAFT_GENERATED_EVENT_TYPE,
      inputPayload: { sourceTextLength: text.length },
      outputPayload: { draftTextLength: draftText.length, modelName: parsed.modelName },
      modelName: parsed.modelName,
      metadata: { userId: actor.userId },
    });
    if (!logResult.ok) return err(logResult.error);

    return ok({ draftText, structuredPayload, modelName: parsed.modelName });
  }

  private async assertSoapDraftRateLimit(sourceId: string): Promise<Result<void>> {
    const sinceIso = new Date(Date.now() - SOAP_DRAFT_RATE_LIMIT_MS).toISOString();
    const countResult = await this.aiEventService.countArtifactGenerationsSince(
      sourceId,
      SOAP_DRAFT_GENERATED_EVENT_TYPE,
      sinceIso,
    );
    if (!countResult.ok) return err(countResult.error);

    if (countResult.value >= MAX_SOAP_DRAFTS_PER_SOURCE_PER_HOUR) {
      return err(
        AppError.validation(
          "SOAP draft generation rate limit reached (5 per hour for this source)",
        ),
      );
    }
    return ok(undefined);
  }

  private async loadReviewable(
    actor: ServiceActor,
    artifactId: string,
  ): Promise<Result<AiSummary>> {
    const artifact = await this.repository.findById(artifactId);
    if (!artifact.ok) return artifact;
    if (!artifact.value) return err(AppError.notFound("AI artifact not found"));
    if (!actor.clinicIds.includes(artifact.value.clinicId)) {
      return err(AppError.forbidden("AI artifact outside actor clinics"));
    }
    const authorized = assertVisitSummaryAiAuthorized(actor, artifact.value.clinicId);
    if (!authorized.ok) return authorized;
    return ok(artifact.value);
  }
}

function buildSoapPayload(text: string): Record<string, string> {
  return {
    subjective: text,
    objective: "",
    assessment: "",
    plan: "",
  };
}

function buildSoapDraftText(draft: SoapNoteDraft): string {
  const sections = SOAP_SECTION_ORDER
    .map((key) => {
      const value = draft[key]?.trim();
      return value ? `${SOAP_SECTION_LABELS[key]}:\n${value}` : null;
    })
    .filter((section): section is string => section !== null);

  return `${TYPE_PREFIX.draft_soap}:\n${sections.join("\n\n")}`;
}

function extractTaskCandidates(text: string): string[] {
  return text
    .split(/\n|\.|;|-/)
    .map((item) => item.trim())
    .filter((item) => item.length > 3)
    .slice(0, 8);
}
