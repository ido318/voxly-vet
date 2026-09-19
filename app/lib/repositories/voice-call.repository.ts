import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapVoiceCallRow } from "@/lib/repositories/mappers";
import type {
  LinkVoiceCallInput,
  UpdateVoiceCallStatusInput,
  UpsertInboundVoiceCallInput,
  VoiceCall,
  VoiceCallListFilters,
} from "@/types/domain/voice-call";

export class VoiceCallRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(filters: VoiceCallListFilters): Promise<Result<VoiceCall[]>> {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    let query = this.client
      .from("voice_calls")
      .select("*")
      .in("clinic_id", filters.clinicIds)
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters.customerId) query = query.eq("customer_id", filters.customerId);
    if (filters.petId) query = query.eq("pet_id", filters.petId);
    if (filters.appointmentId) query = query.eq("appointment_id", filters.appointmentId);
    if (filters.visitId) query = query.eq("visit_id", filters.visitId);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.from) query = query.gte("started_at", filters.from);
    if (filters.to) query = query.lt("started_at", filters.to);

    const { data, error } = await query;
    if (error) return err(AppError.externalProvider("Failed to list voice calls", error));
    return ok((data ?? []).map(mapVoiceCallRow));
  }

  async findById(callId: string): Promise<Result<VoiceCall | null>> {
    const { data, error } = await this.client
      .from("voice_calls")
      .select("*")
      .eq("id", callId)
      .maybeSingle();

    if (error) return err(AppError.externalProvider("Failed to load voice call", error));
    return ok(data ? mapVoiceCallRow(data) : null);
  }

  async findByTwilioCallSid(twilioCallSid: string): Promise<Result<VoiceCall | null>> {
    const { data, error } = await this.client
      .from("voice_calls")
      .select("*")
      .eq("twilio_call_sid", twilioCallSid)
      .maybeSingle();

    if (error) {
      return err(AppError.externalProvider("Failed to load voice call by SID", error));
    }
    return ok(data ? mapVoiceCallRow(data) : null);
  }

  async upsertInbound(input: UpsertInboundVoiceCallInput): Promise<Result<VoiceCall>> {
    const { data, error } = await this.client
      .from("voice_calls")
      .upsert(
        {
          clinic_id: input.clinicId,
          customer_id: input.customerId ?? null,
          pet_id: input.petId ?? null,
          appointment_id: input.appointmentId ?? null,
          visit_id: input.visitId ?? null,
          direction: "inbound",
          status: input.status ?? "ringing",
          from_number: input.fromNumber,
          to_number: input.toNumber,
          twilio_call_sid: input.twilioCallSid,
          twilio_parent_call_sid: input.twilioParentCallSid ?? null,
          metadata: input.metadata ?? {},
        },
        { onConflict: "twilio_call_sid" },
      )
      .select("*")
      .single();

    if (error) return err(AppError.externalProvider("Failed to upsert voice call", error));
    return ok(mapVoiceCallRow(data));
  }

  async updateStatusByTwilioSid(
    twilioCallSid: string,
    input: UpdateVoiceCallStatusInput,
  ): Promise<Result<VoiceCall>> {
    const patch: Record<string, unknown> = {
      status: input.status,
    };
    if (input.endedAt !== undefined) patch.ended_at = input.endedAt;
    if (input.durationSeconds !== undefined) patch.duration_seconds = input.durationSeconds;
    if (input.recordingUrl !== undefined) patch.recording_url = input.recordingUrl;
    if (input.metadata !== undefined) patch.metadata = input.metadata;

    const { data, error } = await this.client
      .from("voice_calls")
      .update(patch)
      .eq("twilio_call_sid", twilioCallSid)
      .select("*")
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") {
        return err(AppError.notFound("Voice call not found"));
      }
      return err(AppError.externalProvider("Failed to update voice call status", error));
    }
    return ok(mapVoiceCallRow(data));
  }

  async link(callId: string, input: LinkVoiceCallInput): Promise<Result<VoiceCall>> {
    const patch: Record<string, unknown> = {};
    if (input.customerId !== undefined) patch.customer_id = input.customerId;
    if (input.petId !== undefined) patch.pet_id = input.petId;
    if (input.appointmentId !== undefined) patch.appointment_id = input.appointmentId;
    if (input.visitId !== undefined) patch.visit_id = input.visitId;

    const { data, error } = await this.client
      .from("voice_calls")
      .update(patch)
      .eq("id", callId)
      .select("*")
      .single();

    if (error) return err(AppError.externalProvider("Failed to link voice call", error));
    return ok(mapVoiceCallRow(data));
  }
}
