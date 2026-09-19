import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapAIEventRow } from "@/lib/repositories/mappers";
import type { AIEvent, CreateAIEventInput } from "@/types/domain/ai-event";

export class AIEventRepository {
  constructor(private readonly client: SupabaseClient) {}

  async insert(input: CreateAIEventInput): Promise<Result<AIEvent>> {
    const { data, error } = await this.client
      .from("ai_events")
      .insert({
        clinic_id: input.clinicId,
        source_type: input.sourceType,
        source_id: input.sourceId ?? null,
        agent_name: input.agentName,
        event_type: input.eventType,
        input_payload: input.inputPayload ?? {},
        output_payload: input.outputPayload ?? {},
        confidence: input.confidence ?? null,
        model_name: input.modelName ?? null,
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();

    if (error) {
      return err(AppError.externalProvider("Failed to create AI event", error));
    }

    return ok(mapAIEventRow(data));
  }

  async countVisitSummaryGenerationsSince(
    visitId: string,
    sinceIso: string,
  ): Promise<Result<number>> {
    const { count, error } = await this.client
      .from("ai_events")
      .select("id", { count: "exact", head: true })
      .eq("source_type", "visit")
      .eq("source_id", visitId)
      .eq("event_type", "visit_summary_generated")
      .gte("created_at", sinceIso);

    if (error) {
      return err(AppError.externalProvider("Failed to count AI events", error));
    }
    return ok(count ?? 0);
  }

  /**
   * Generalized version of `countVisitSummaryGenerationsSince`, scoped by
   * `(sourceId, eventType)` instead of being hardcoded to visit summaries —
   * usable by any artifact-generation flow that needs a per-source,
   * per-generation-type rate limit (e.g. `soap_note_generated`).
   */
  async countArtifactGenerationsSince(
    sourceId: string,
    eventType: string,
    sinceIso: string,
  ): Promise<Result<number>> {
    const { count, error } = await this.client
      .from("ai_events")
      .select("id", { count: "exact", head: true })
      .eq("source_id", sourceId)
      .eq("event_type", eventType)
      .gte("created_at", sinceIso);

    if (error) {
      return err(AppError.externalProvider("Failed to count AI events", error));
    }
    return ok(count ?? 0);
  }
}
