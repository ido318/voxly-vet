import type { Result } from "@/lib/errors/app-error";
import type { WaitlistRepository } from "@/lib/repositories/waitlist.repository";
import type { ServiceActor } from "@/lib/services/service-context";
import type { WaitlistEntry } from "@/types/domain/waitlist";

export class WaitlistService {
  constructor(private readonly repository: WaitlistRepository) {}

  async listEntries(actor: ServiceActor): Promise<Result<WaitlistEntry[]>> {
    return this.repository.list({ clinicIds: actor.clinicIds });
  }
}
