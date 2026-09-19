import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapAuditLogRow } from "@/lib/repositories/mappers";
import type { AuditLog, CreateAuditLogInput } from "@/types/domain/audit-log";

export class AuditLogRepository {
  constructor(private readonly client: SupabaseClient) {}

  async insert(input: CreateAuditLogInput): Promise<Result<AuditLog>> {
    const { data, error } = await this.client
      .from("audit_logs")
      .insert({
        clinic_id: input.clinicId ?? null,
        actor_type: input.actorType,
        actor_id: input.actorId,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId,
        before_payload: input.beforePayload ?? null,
        after_payload: input.afterPayload ?? null,
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();

    if (error) {
      return err(
        AppError.externalProvider("Failed to create audit log", error),
      );
    }

    return ok(mapAuditLogRow(data));
  }
}
