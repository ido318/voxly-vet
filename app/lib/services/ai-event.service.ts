import type { AIEventRepository } from "@/lib/repositories/ai-event.repository";
import { err, ok, type Result } from "@/lib/errors/app-error";
import type { AIEvent, CreateAIEventInput } from "@/types/domain/ai-event";

export class AIEventService {
  constructor(private readonly aiEventRepository: AIEventRepository) {}

  async logEvent(input: CreateAIEventInput): Promise<Result<AIEvent>> {
    const result = await this.aiEventRepository.insert(input);

    if (!result.ok) {
      return err(result.error);
    }

    return ok(result.value);
  }

  async countVisitSummaryGenerationsSince(
    visitId: string,
    sinceIso: string,
  ): Promise<Result<number>> {
    return this.aiEventRepository.countVisitSummaryGenerationsSince(
      visitId,
      sinceIso,
    );
  }

  async countArtifactGenerationsSince(
    sourceId: string,
    eventType: string,
    sinceIso: string,
  ): Promise<Result<number>> {
    return this.aiEventRepository.countArtifactGenerationsSince(
      sourceId,
      eventType,
      sinceIso,
    );
  }
}
