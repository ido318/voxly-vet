import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import type {
  CreateVisitShareInput,
  VisitShare,
} from "@/types/domain/visit-share";

function mapVisitShareRow(row: Record<string, unknown>): VisitShare {
  return {
    id: row.id as string,
    clinicId: row.clinic_id as string,
    visitId: row.visit_id as string,
    token: row.token as string,
    channel: row.channel as VisitShare["channel"],
    recipientPhone: (row.recipient_phone as string | null) ?? null,
    createdByUserId: (row.created_by_user_id as string | null) ?? null,
    twilioMessageSid: (row.twilio_message_sid as string | null) ?? null,
    sentAt: (row.sent_at as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
    revokedAt: (row.revoked_at as string | null) ?? null,
    viewCount: (row.view_count as number | null) ?? 0,
    lastViewedAt: (row.last_viewed_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/**
 * Backed by the service-role client. The `visit_shares` table is deny-by-default
 * under RLS, so this repository must be constructed with the admin client.
 */
export class VisitShareRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(input: CreateVisitShareInput): Promise<Result<VisitShare>> {
    const { data, error } = await this.client
      .from("visit_shares")
      .insert({
        clinic_id: input.clinicId,
        visit_id: input.visitId,
        token: input.token,
        channel: input.channel,
        recipient_phone: input.recipientPhone,
        created_by_user_id: input.createdByUserId,
        expires_at: input.expiresAt,
      })
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to create visit share", error));
    return ok(mapVisitShareRow(data));
  }

  async markSent(shareId: string, twilioMessageSid: string | null): Promise<Result<VisitShare>> {
    const { data, error } = await this.client
      .from("visit_shares")
      .update({ sent_at: new Date().toISOString(), twilio_message_sid: twilioMessageSid })
      .eq("id", shareId)
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to mark visit share as sent", error));
    return ok(mapVisitShareRow(data));
  }

  /** Look up a live (not revoked, not expired) share by its token. */
  async findLiveByToken(token: string): Promise<Result<VisitShare | null>> {
    const { data, error } = await this.client
      .from("visit_shares")
      .select("*")
      .eq("token", token)
      .is("revoked_at", null)
      .maybeSingle();
    if (error) return err(AppError.externalProvider("Failed to load visit share", error));
    if (!data) return ok(null);

    const share = mapVisitShareRow(data);
    if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) {
      return ok(null);
    }
    return ok(share);
  }

  /**
   * Atomically increment view_count in SQL (`view_count + 1`) so concurrent
   * public views cannot undercount. A previously-read count argument is ignored
   * (kept optional so existing callers still typecheck).
   */
  async recordView(shareId: string, previousCount?: number): Promise<void> {
    void previousCount;
    await this.client.rpc("increment_visit_share_view", { p_share_id: shareId });
  }

  async revoke(shareId: string): Promise<Result<VisitShare>> {
    const { data, error } = await this.client
      .from("visit_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", shareId)
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to revoke visit share", error));
    return ok(mapVisitShareRow(data));
  }
}
