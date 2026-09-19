import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import type { VoiceCallRepository } from "@/lib/repositories/voice-call.repository";
import type { ServiceActor } from "@/lib/services/service-context";
import type {
  LinkVoiceCallInput,
  VoiceCall,
  VoiceCallListFilters,
} from "@/types/domain/voice-call";

export class VoiceCallService {
  constructor(private readonly voiceCallRepository: VoiceCallRepository) {}

  async listCalls(
    actor: ServiceActor,
    filters: Omit<VoiceCallListFilters, "clinicIds"> & { clinicIds?: string[] },
  ): Promise<Result<VoiceCall[]>> {
    const clinicIds = filters.clinicIds ?? actor.clinicIds;
    if (clinicIds.some((clinicId) => !actor.clinicIds.includes(clinicId))) {
      return err(AppError.forbidden("Cannot list voice calls for requested clinic"));
    }
    return this.voiceCallRepository.list({ ...filters, clinicIds });
  }

  async getCallById(actor: ServiceActor, callId: string): Promise<Result<VoiceCall>> {
    const existing = await this.voiceCallRepository.findById(callId);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Voice call not found"));
    if (!actor.clinicIds.includes(existing.value.clinicId)) {
      return err(AppError.forbidden("Voice call outside actor clinics"));
    }
    return ok(existing.value);
  }

  async linkCall(
    actor: ServiceActor,
    callId: string,
    input: LinkVoiceCallInput,
  ): Promise<Result<VoiceCall>> {
    const existing = await this.getCallById(actor, callId);
    if (!existing.ok) return existing;
    return this.voiceCallRepository.link(callId, input);
  }
}
