import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapAiSummaryRow } from "@/lib/repositories/mappers";
import type { AiSummary, CreateAiSummaryInput } from "@/types/domain/ai-summary";

export class AiSummaryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findById(id: string): Promise<Result<AiSummary | null>> {
    const { data, error } = await this.client
      .from("ai_summaries")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return err(AppError.externalProvider("Failed to load AI artifact", error));
    return ok(data ? mapAiSummaryRow(data) : null);
  }

  async create(input: CreateAiSummaryInput & { createdByUserId: string }): Promise<Result<AiSummary>> {
    const { data, error } = await this.client
      .from("ai_summaries")
      .insert({
        clinic_id: input.clinicId,
        artifact_type: input.artifactType,
        source_type: input.sourceType,
        source_id: input.sourceId ?? null,
        draft_text: input.draftText,
        structured_payload: input.structuredPayload ?? {},
        model_name: input.modelName ?? null,
        prompt_version: input.promptVersion ?? "phase9-v1",
        created_by_user_id: input.createdByUserId,
      })
      .select("*")
      .single();

    if (error) return err(AppError.externalProvider("Failed to create AI artifact", error));
    return ok(mapAiSummaryRow(data));
  }

  async review(
    id: string,
    input: { status: "approved" | "rejected"; reviewedByUserId: string; rejectionReason?: string | null },
  ): Promise<Result<AiSummary>> {
    const { data, error } = await this.client
      .from("ai_summaries")
      .update({
        status: input.status,
        reviewed_by_user_id: input.reviewedByUserId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: input.status === "rejected" ? input.rejectionReason : null,
      })
      .eq("id", id)
      .is("deleted_at", null)
      .eq("status", "draft")
      .select("*")
      .single();

    if (error) return err(AppError.externalProvider("Failed to review AI artifact", error));
    return ok(mapAiSummaryRow(data));
  }
}
