import type { AIEventService } from "@/lib/services/ai-event.service";
import type { CreateAIEventInput } from "@/types/domain/ai-event";

export async function logAIEvent(
  aiEventService: AIEventService,
  input: CreateAIEventInput,
) {
  return aiEventService.logEvent(input);
}
